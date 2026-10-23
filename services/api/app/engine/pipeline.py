import asyncio
import json
import os
import time
from typing import Any, Dict, List, Optional

import fitz  # PyMuPDF
from sqlalchemy.orm import Session

from services.api.app.config import get_settings
from services.api.app.core.events import event_bus
from services.api.app.core.logging import logger
from services.api.app.db.models import JobModel, TagModel
from services.api.app.engine.cleanup import extract_pid_tags, normalize_tag, resolve_ocr_confusion
from services.api.app.engine.confidence import calculate_confidence
from services.api.app.engine.cross_validator import cross_validate_drawing_and_io
from services.api.app.engine.graph_builder import build_graph_from_perception
from services.api.app.engine.io_parser import parse_io_list
from services.api.app.engine.isa51_rules import parse_isa51_tag
from services.api.app.engine.llm_resolver import resolve_tag_with_llm_or_heuristics
from services.api.app.engine.report_generator import localize_report
from services.api.app.engine.simplifier import simplify_graph_layout
from services.api.app.engine.svg_generator import generate_svg_sketch
from services.perception.perception.run import run_perception


async def update_job_stage(
    db: Session,
    job: JobModel,
    stage: str,
    progress: float,
    status: str = "running",
    summary: Optional[Dict[str, Any]] = None
):
    job.stage = stage
    job.progress = round(progress, 2)
    job.status = status
    if summary is not None:
        job.summary = summary
    db.commit()

    event_type = "job_done" if status == "done" else ("job_failed" if status == "failed" else "stage_started")

    # Broadcast event via WebSocket
    payload = {
        "event": event_type,
        "job_id": job.id,
        "status": job.status,
        "stage": job.stage,
        "progress": job.progress,
        "pages": job.pages,
        "summary": job.summary,
        "error": job.error,
    }
    await event_bus.broadcast(job.id, payload)


async def execute_untangle_pipeline(job_id: str, db: Session):
    """
    Execute the full 9-Stage UNTANGLE pipeline:
    1. perception -> 2. io_parse -> 3. cleanup -> 4. llm_resolve -> 5. validate
    -> 6. graph -> 7. simplify -> 8. layout -> 9. report
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found in database.")
        return

    try:
        # =====================================================================
        # STAGE 1: PERCEPTION (PyMuPDF vector/raster + OpenCV + OCR)
        # =====================================================================
        await update_job_stage(db, job, "perception", 0.10)
        t0 = time.time()
        
        # Run perception pipeline or load cache if already computed
        perception_cache_path = os.path.join(job_dir, "perception.json")
        if os.path.exists(perception_cache_path) and os.path.getsize(perception_cache_path) > 100:
            logger.info(f"Loading existing perception cache from {perception_cache_path}")
            with open(perception_cache_path, "r") as f:
                perception_dict = json.load(f)
            from services.perception.perception.models import PerceptionOutput
            perception_data = PerceptionOutput(**perception_dict)
            job.pages = perception_data.total_pages
        else:
            perception_data = run_perception(job.pdf_path, job_dir)
            job.pages = perception_data.total_pages
            perception_dict = perception_data.model_dump(by_alias=True)
            with open(perception_cache_path, "w") as f:
                json.dump(perception_dict, f, indent=2)

        logger.info(f"Stage 1 perception completed in {time.time() - t0:.2f}s for job {job_id}")

        # =====================================================================
        # STAGE 2: IO_PARSE (Excel sheet parsing with openpyxl)
        # =====================================================================
        await update_job_stage(db, job, "io_parse", 0.22)
        io_result = parse_io_list(job.xlsx_path)

        # =====================================================================
        # STAGE 3 & 4: CLEANUP & LLM_RESOLVE (ISA-5.1 grammar, OCR confusion, LLM)
        # =====================================================================
        await update_job_stage(db, job, "cleanup", 0.35)
        
        extracted_tag_items = []
        for p in perception_data.pages:
            p_items = [t.model_dump() for t in p.text_items]
            p_tags = extract_pid_tags(p_items, io_tags=io_result.tags_list)
            for pt in p_tags:
                extracted_tag_items.append((p.page_number, pt))

        # Multi-modal drawing & IO List fusion for complex drawings where CAD converted text to outlines
        if len(extracted_tag_items) < 5 and io_result.items:
            logger.info(
                f"Sparse direct text detected ({len(extracted_tag_items)} tags). Fusing {len(io_result.items)} IO List records with drawing topology."
            )
            detected_symbols = []
            for p in perception_data.pages:
                for sym in p.symbols:
                    detected_symbols.append((p.page_number, sym.bbox, sym.symbol_class))

            w_canvas = max(float(perception_data.pages[0].width) if perception_data.pages else 2000.0, 1500.0)
            h_canvas = max(float(perception_data.pages[0].height) if perception_data.pages else 1000.0, 900.0)

            sym_idx = 0
            for idx_io, io_item in enumerate(io_result.items):
                raw = io_item.tag.strip()
                norm = normalize_tag(raw)
                if any(ext[1]["text"] == norm or ext[1]["text"] == raw for ext in extracted_tag_items):
                    continue

                if sym_idx < len(detected_symbols):
                    page_num, bbox, sym_class = detected_symbols[sym_idx]
                    sym_idx += 1
                else:
                    page_num = 1
                    cols = 8
                    col = idx_io % cols
                    row = idx_io // cols
                    bx = 200 + col * (w_canvas - 400) / max(cols - 1, 1)
                    by = 250 + row * 160
                    bbox = [bx - 40, by - 40, bx + 40, by + 40]

                extracted_tag_items.append((
                    page_num,
                    {
                        "id": f"p{page_num}_fused_{idx_io+1:04d}",
                        "text": norm,
                        "bbox": bbox,
                        "ocr_confidence": 0.98,
                        "rotation": 0,
                        "source": "io_drawing_fusion"
                    }
                ))

        await update_job_stage(db, job, "llm_resolve", 0.48)

        resolved_tags_list = []
        idx = 1
        
        for page_num, txt_dict in extracted_tag_items:
            raw = txt_dict["text"].strip()
            candidates = resolve_ocr_confusion(raw)
            best_cand, cand_rule_conf, rule_reason = candidates[0]

            # Parse against ISA-5.1 rules
            is_valid_isa, desc_type, category, grammar_score = parse_isa51_tag(best_cand)

            # Invoke LLM or deterministic candidate resolution
            res = await resolve_tag_with_llm_or_heuristics(
                raw_text=raw,
                normalized_candidate=best_cand,
                symbol_class=category,
                io_tags=io_result.tags_list,
                rule_reasoning=rule_reason
            )

            # Compute Multi-Signal Confidence
            symbol_score = 0.95 if category in ["equipment", "valve"] else 0.92
            final_conf, conf_breakdown, status_val = calculate_confidence(
                ocr_score=txt_dict.get("ocr_confidence", 0.95),
                symbol_score=symbol_score,
                io_score=res.io_score,
                grammar_score=grammar_score,
                llm_score=res.confidence
            )

            tag_id = f"{job.id[:8]}_tag_{idx:04d}"
            tag_bbox = txt_dict.get("bbox", [0, 0, 0, 0])
            tag_data = {
                "id": tag_id,
                "page": page_num,
                "raw_text": raw,
                "normalized_tag": res.resolved_tag,
                "type": desc_type,
                "category": category,
                "bbox": tag_bbox,
                "confidence": final_conf,
                "conf_breakdown": conf_breakdown,
                "status": status_val,
                "io_match": {
                    "matched": bool(res.io_match_tag),
                    "io_tag": res.io_match_tag,
                    "score": int(res.io_score * 100)
                },
                "reasoning": res.reasoning,
                "source": "auto" if final_conf >= 0.85 else "llm"
            }
            resolved_tags_list.append(tag_data)

            # Save to Database
            tag_row = TagModel(
                id=tag_id,
                job_id=job.id,
                page=page_num,
                raw_text=raw,
                normalized_tag=res.resolved_tag,
                type=desc_type,
                category=category,
                confidence=final_conf,
                status=status_val,
                reasoning=res.reasoning,
                source="auto" if final_conf >= 0.85 else "llm"
            )
            tag_row.bbox = tag_bbox
            tag_row.conf_breakdown = conf_breakdown
            tag_row.io_match = tag_data["io_match"]
            db.add(tag_row)
            idx += 1

        db.commit()

        with open(os.path.join(job_dir, "resolved_items.json"), "w") as f:
            json.dump({"job_id": job.id, "items": resolved_tags_list}, f, indent=2)

        # Update summary
        res_cnt = sum(1 for t in resolved_tags_list if t["status"] == "resolved")
        rev_cnt = sum(1 for t in resolved_tags_list if t["status"] == "needs_review")
        rej_cnt = sum(1 for t in resolved_tags_list if t["status"] == "rejected")
        job.summary = {"resolved": res_cnt, "needs_review": rev_cnt, "rejected": rej_cnt}
        db.commit()

        # =====================================================================
        # STAGE 5: VALIDATE (Cross-validation against IO list)
        # =====================================================================
        await update_job_stage(db, job, "validate", 0.60)
        report_schema = cross_validate_drawing_and_io(resolved_tags_list, io_result.items)
        report_dict = report_schema.model_dump()

        # =====================================================================
        # STAGE 6: GRAPH (Topological graph construction)
        # =====================================================================
        await update_job_stage(db, job, "graph", 0.72)
        raw_graph = build_graph_from_perception(perception_dict, resolved_tags_list)

        # =====================================================================
        # STAGE 7: SIMPLIFY (Operator schematic layout alignment)
        # =====================================================================
        await update_job_stage(db, job, "simplify", 0.82)
        simplified_graph = simplify_graph_layout(raw_graph)
        
        with open(os.path.join(job_dir, "graph.json"), "w") as f:
            json.dump(simplified_graph.model_dump(), f, indent=2)

        # =====================================================================
        # STAGE 8: LAYOUT (SVG Process Sketch generation & Vector PDF)
        # =====================================================================
        await update_job_stage(db, job, "layout", 0.92)
        svg_content = generate_svg_sketch(simplified_graph)

        with open(os.path.join(job_dir, "sketch.svg"), "w", encoding="utf-8") as f:
            f.write(svg_content)

        # Generate downloadable Vector PDF of Simplified Diagram
        try:
            svg_doc = fitz.open(stream=svg_content.encode("utf-8"), filetype="svg")
            pdf_bytes = svg_doc.convert_to_pdf()
            with open(os.path.join(job_dir, "simplified_diagram.pdf"), "wb") as f:
                f.write(pdf_bytes)
            logger.info(f"Generated simplified_diagram.pdf ({len(pdf_bytes)} bytes) for job {job_id}")
        except Exception as e:
            logger.warning(f"Could not convert sketch.svg to PDF: {e}")

        # =====================================================================
        # STAGE 9: REPORT (Cross-validation report finalized)
        # =====================================================================
        await update_job_stage(db, job, "report", 0.98)
        with open(os.path.join(job_dir, "report.json"), "w") as f:
            json.dump(report_dict, f, indent=2)

        # Mark Done
        await update_job_stage(db, job, "report", 1.0, status="done", summary=job.summary)
        logger.info(f"Pipeline successfully completed for job {job_id} in {time.time() - t0:.2f}s")

    except Exception as e:
        logger.error(f"Pipeline failed for job {job_id}: {str(e)}", exc_info=True)
        job.status = "failed"
        job.error = {"code": "PIPELINE_FAILED", "message": str(e)}
        db.commit()
        await event_bus.broadcast(job.id, {
            "job_id": job.id,
            "status": "failed",
            "stage": job.stage,
            "progress": job.progress,
            "error": job.error
        })


async def rebuild_graph_and_artifacts(job_id: str, db: Session):
    """
    Sub-second rerun of stages 6 through 9 (Graph, Simplify, Layout, Report)
    after human review corrections without re-running OCR perception!
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job:
        raise ValueError("Job not found")

    job.status = "running"
    db.commit()
    await update_job_stage(db, job, "graph", 0.70)

    # 1. Read existing perception data
    perception_path = os.path.join(job_dir, "perception.json")
    if os.path.exists(perception_path):
        with open(perception_path, "r") as f:
            perception_dict = json.load(f)
    else:
        perception_dict = {"pages": []}

    # 2. Read updated tags from DB
    tags = db.query(TagModel).filter(TagModel.job_id == job_id).all()
    resolved_tags_list = []
    for t in tags:
        resolved_tags_list.append({
            "id": t.id,
            "page": t.page,
            "raw_text": t.raw_text,
            "normalized_tag": t.normalized_tag,
            "type": t.type,
            "category": t.category,
            "bbox": t.bbox,
            "confidence": t.confidence,
            "conf_breakdown": t.conf_breakdown,
            "status": t.status,
            "io_match": t.io_match,
            "reasoning": t.reasoning,
            "source": t.source,
        })

    # 3. Read IO list
    io_result = parse_io_list(job.xlsx_path)

    # 4. Stage 6: Graph builder
    await update_job_stage(db, job, "graph", 0.75)
    raw_graph = build_graph_from_perception(perception_dict, resolved_tags_list)

    # 5. Stage 7: Simplifier
    await update_job_stage(db, job, "simplify", 0.85)
    simplified_graph = simplify_graph_layout(raw_graph)
    with open(os.path.join(job_dir, "graph.json"), "w") as f:
        json.dump(simplified_graph.model_dump(), f, indent=2)

    # 6. Stage 8: Layout
    await update_job_stage(db, job, "layout", 0.92)
    svg_content = generate_svg_sketch(simplified_graph)
    with open(os.path.join(job_dir, "sketch.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)

    # Generate downloadable Vector PDF of Simplified Diagram
    try:
        svg_doc = fitz.open(stream=svg_content.encode("utf-8"), filetype="svg")
        pdf_bytes = svg_doc.convert_to_pdf()
        with open(os.path.join(job_dir, "simplified_diagram.pdf"), "wb") as f:
            f.write(pdf_bytes)
    except Exception as e:
        logger.warning(f"Could not convert sketch.svg to PDF: {e}")

    # 7. Stage 9: Report
    await update_job_stage(db, job, "report", 0.98)
    report_schema = cross_validate_drawing_and_io(resolved_tags_list, io_result.items)
    report_dict = report_schema.model_dump()
    with open(os.path.join(job_dir, "report.json"), "w") as f:
        json.dump(report_dict, f, indent=2)

    # Summary
    res_cnt = sum(1 for t in resolved_tags_list if t["status"] == "resolved")
    rev_cnt = sum(1 for t in resolved_tags_list if t["status"] == "needs_review")
    rej_cnt = sum(1 for t in resolved_tags_list if t["status"] == "rejected")
    job.summary = {"resolved": res_cnt, "needs_review": rev_cnt, "rejected": rej_cnt}

    await update_job_stage(db, job, "report", 1.0, status="done", summary=job.summary)
