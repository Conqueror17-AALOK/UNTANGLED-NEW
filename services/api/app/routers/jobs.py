import asyncio
import io
import json
import os
import uuid
from typing import Any, Dict, List, Literal, Optional

import fitz  # PyMuPDF
import cv2
import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

from services.api.app.config import get_settings
from services.api.app.core.logging import logger
from services.api.app.core.security import (
    MAX_PDF_SIZE_BYTES,
    MAX_XLSX_SIZE_BYTES,
    validate_and_save_upload,
    verify_api_token,
)
from services.api.app.db.database import SessionLocal, get_db
from services.api.app.db.models import CorrectionModel, JobModel, TagModel
from services.api.app.db.schemas import (
    GraphSchema,
    JobResponseSchema,
    ReportSchema,
    TagSchema,
    TagUpdateSchema,
)
from services.api.app.engine.pipeline import (
    execute_untangle_pipeline,
    rebuild_graph_and_artifacts,
)
from services.api.app.engine.merger import (
    MultiSheetMerger,
    RevisionDiffEngine,
    RevisionDiffSchema,
)
from services.api.app.engine.simplifier import simplify_graph_layout
from services.api.app.engine.svg_generator import generate_svg_sketch
from services.api.app.engine.smart_pdf_generator import generate_smart_vector_pdf
from services.api.app.engine.report_generator import generate_pdf_report, localize_report

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(verify_api_token)])


def run_pipeline_in_background(job_id: str):
    """Background runner for full 9-stage pipeline with separate DB session."""
    db = SessionLocal()
    try:
        asyncio.run(execute_untangle_pipeline(job_id, db))
    finally:
        db.close()


def run_rebuild_in_background(job_id: str):
    """Background runner for sub-second rebuild stages 6-9."""
    db = SessionLocal()
    try:
        asyncio.run(rebuild_graph_and_artifacts(job_id, db))
    finally:
        db.close()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_job(
    background_tasks: BackgroundTasks,
    pid_pdf: UploadFile = File(...),
    io_list_xlsx: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload P&ID PDF and engineering IO List (.xlsx) and initiate 9-stage pipeline.
    """
    settings = get_settings()
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    # 1. Validate & save uploaded files
    saved_pdf_path = validate_and_save_upload(
        pid_pdf,
        allowed_mimes=["application/pdf"],
        max_size=MAX_PDF_SIZE_BYTES,
        target_dir=job_dir
    )
    saved_xlsx_path = validate_and_save_upload(
        io_list_xlsx,
        allowed_mimes=[
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/octet-stream"
        ],
        max_size=MAX_XLSX_SIZE_BYTES,
        target_dir=job_dir
    )

    # 2. Create Job in DB
    job = JobModel(
        id=job_id,
        status="queued",
        stage="perception",
        progress=0.0,
        pages=1,
        pdf_path=saved_pdf_path,
        xlsx_path=saved_xlsx_path,
        summary={"resolved": 0, "needs_review": 0, "rejected": 0}
    )
    db.add(job)
    db.commit()

    # 3. Dispatch pipeline in background
    background_tasks.add_task(run_pipeline_in_background, job_id)

    return {"job_id": job_id, "status": "queued"}


@router.get("/{job_id}", response_model=JobResponseSchema)
def get_job(job_id: str, db: Session = Depends(get_db)):
    """
    Get current job status, pipeline stage and progress metrics.
    """
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": f"Job {job_id} not found."}
        )

    return JobResponseSchema(
        job_id=job.id,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        pages=job.pages,
        summary=job.summary,
        error=job.error,
    )


@router.get("/{job_id}/tags", response_model=List[TagSchema])
def get_job_tags(
    job_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: Optional[int] = Query(1),
    db: Session = Depends(get_db)
):
    """
    List extracted and resolved tags with multi-signal confidence breakdown.
    """
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": f"Job {job_id} not found."}
        )

    query = db.query(TagModel).filter(TagModel.job_id == job_id)
    if status_filter:
        query = query.filter(TagModel.status == status_filter)
    if page:
        query = query.filter(TagModel.page == page)

    tags = query.all()
    results = []
    for t in tags:
        results.append(
            TagSchema(
                id=t.id,
                page=t.page,
                raw_text=t.raw_text,
                normalized_tag=t.normalized_tag,
                type=t.type,
                category=t.category,
                bbox=t.bbox,
                confidence=t.confidence,
                conf_breakdown=t.conf_breakdown,
                status=t.status,
                io_match=t.io_match,
                reasoning=t.reasoning,
                source=t.source,
            )
        )
    return results


@router.patch("/{job_id}/tags/{tag_id}", response_model=TagSchema)
def update_tag(
    job_id: str,
    tag_id: str,
    payload: TagUpdateSchema,
    db: Session = Depends(get_db)
):
    """
    Human-in-the-loop tag correction. Updates tag to 100% confidence with 'human' source,
    and logs the edit into audit table.
    """
    tag = db.query(TagModel).filter(TagModel.job_id == job_id, TagModel.id == tag_id).first()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TAG_NOT_FOUND", "message": f"Tag {tag_id} not found for job {job_id}."}
        )

    prev_val = tag.normalized_tag
    new_val = payload.normalized_tag.strip().upper()

    # Record correction in audit log
    correction = CorrectionModel(
        job_id=job_id,
        tag_id=tag_id,
        previous_val=prev_val,
        new_val=new_val
    )
    db.add(correction)

    tag.normalized_tag = new_val
    if payload.type:
        tag.type = payload.type
    tag.confidence = 1.0
    tag.status = "resolved"
    tag.source = "human"
    tag.conf_breakdown = {
        "ocr": 1.0,
        "symbol": 1.0,
        "io_match": 1.0,
        "grammar": 1.0,
        "llm": 1.0
    }
    tag.reasoning = f"Human verified correction from '{prev_val}'."
    db.commit()

    return TagSchema(
        id=tag.id,
        page=tag.page,
        raw_text=tag.raw_text,
        normalized_tag=tag.normalized_tag,
        type=tag.type,
        category=tag.category,
        bbox=tag.bbox,
        confidence=tag.confidence,
        conf_breakdown=tag.conf_breakdown,
        status=tag.status,
        io_match=tag.io_match,
        reasoning=tag.reasoning,
        source=tag.source,
    )


@router.post("/{job_id}/rebuild", status_code=status.HTTP_202_ACCEPTED)
def rebuild_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Rerun stages 6 through 9 (Graph, Simplify, Layout, Report) after human corrections in <1s.
    """
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": f"Job {job_id} not found."}
        )

    background_tasks.add_task(run_rebuild_in_background, job_id)
    return {"job_id": job_id, "status": "running"}


@router.get("/{job_id}/graph")
def get_graph(job_id: str):
    """
    Get simplified process graph with node positions and connections.
    """
    settings = get_settings()
    graph_path = os.path.join(settings.DATA_DIR, job_id, "graph.json")
    if not os.path.exists(graph_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "GRAPH_NOT_FOUND", "message": "Graph artifact not yet generated."}
        )

    with open(graph_path, "r") as f:
        return json.load(f)


@router.get("/{job_id}/sketch")
def get_sketch(job_id: str):
    """
    Get generated SVG process sketch.
    """
    settings = get_settings()
    sketch_path = os.path.join(settings.DATA_DIR, job_id, "sketch.svg")
    if not os.path.exists(sketch_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SKETCH_NOT_FOUND", "message": "Sketch SVG artifact not yet generated."}
        )

    with open(sketch_path, "r", encoding="utf-8") as f:
        svg_content = f.read()

    return Response(content=svg_content, media_type="image/svg+xml")


@router.get("/{job_id}/source/{page}/crop")
def get_source_crop(
    job_id: str,
    page: int,
    bbox: str = Query(..., description="Crop bbox in format 'x1,y1,x2,y2'"),
    db: Session = Depends(get_db)
):
    """
    Visual Traceability: Render source drawing crop with cyan bounding box overlay.
    """
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job or not os.path.exists(job.pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Job or PDF file not found."}
        )

    try:
        coords = [float(v.strip()) for v in bbox.split(",")]
        if len(coords) != 4:
            raise ValueError()
        bx1, by1, bx2, by2 = coords
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "bbox must be 4 comma-separated floats: 'x1,y1,x2,y2'"}
        )

    try:
        doc = fitz.open(job.pdf_path)
        page_idx = max(0, min(page - 1, len(doc) - 1))
        pdf_page = doc[page_idx]

        # Render page at 2x resolution (144 DPI) for crisp inspection crop
        pix = pdf_page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

        # Map PDF point coordinates to pixel image coordinates
        scale_x = img.width / pdf_page.rect.width
        scale_y = img.height / pdf_page.rect.height

        px1 = bx1 * scale_x
        py1 = by1 * scale_y
        px2 = bx2 * scale_x
        py2 = by2 * scale_y

        # Add context margin (50px) around bbox
        pad = 60
        crop_x1 = max(0, int(min(px1, px2) - pad))
        crop_y1 = max(0, int(min(py1, py2) - pad))
        crop_x2 = min(img.width, int(max(px1, px2) + pad))
        crop_y2 = min(img.height, int(max(py1, py2) + pad))

        cropped = img.crop((crop_x1, crop_y1, crop_x2, crop_y2))

        # Draw Cyan Bounding Box overlay
        draw = ImageDraw.Draw(cropped)
        box_x1 = px1 - crop_x1
        box_y1 = py1 - crop_y1
        box_x2 = px2 - crop_x1
        box_y2 = py2 - crop_y1

        for offset in range(3):  # 3px thick rectangle
            draw.rectangle(
                [box_x1 - offset, box_y1 - offset, box_x2 + offset, box_y2 + offset],
                outline=(0, 240, 255)  # Cyan
            )

        buf = io.BytesIO()
        cropped.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

    except Exception as e:
        logger.error(f"Crop generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL", "message": f"Failed to generate crop: {str(e)}"}
        )


@router.get("/{job_id}/report")
def get_report(
    job_id: str,
    lang: str = Query("en", pattern="^(en|hi|mr)$")
):
    """
    Get cross-validation report with optional multi-language operator localization (English, Hindi, Marathi).
    """
    settings = get_settings()
    report_path = os.path.join(settings.DATA_DIR, job_id, "report.json")
    if not os.path.exists(report_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "REPORT_NOT_FOUND", "message": "Report not yet generated."}
        )

    with open(report_path, "r", encoding="utf-8") as f:
        report_data = json.load(f)

    # Localize descriptions if requested
    report_schema = ReportSchema(**report_data)
    return localize_report(report_schema, lang=lang)


@router.get("/{job_id}/export")
def export_job(
    job_id: str,
    export_format: str = Query(..., alias="format", pattern="^(json|svg|pdf|diagram-pdf|smart-pdf)$")
):
    """
    Export processed job artifacts as JSON, SVG, Audit PDF, or Smart Vector Diagram PDF.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)

    if export_format == "svg":
        sketch_path = os.path.join(job_dir, "sketch.svg")
        if not os.path.exists(sketch_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SVG not found")
        with open(sketch_path, "r", encoding="utf-8") as f:
            return Response(content=f.read(), media_type="image/svg+xml")

    elif export_format == "json":
        graph_path = os.path.join(job_dir, "graph.json")
        report_path = os.path.join(job_dir, "report.json")
        res_path = os.path.join(job_dir, "resolved_items.json")

        bundle = {
            "job_id": job_id,
            "graph": json.load(open(graph_path)) if os.path.exists(graph_path) else {},
            "report": json.load(open(report_path)) if os.path.exists(report_path) else {},
            "tags": json.load(open(res_path)) if os.path.exists(res_path) else {}
        }
        return bundle

    elif export_format in ("diagram-pdf", "smart-pdf"):
        pdf_path = os.path.join(job_dir, "simplified_diagram.pdf")
        graph_path = os.path.join(job_dir, "graph.json")
        res_path = os.path.join(job_dir, "resolved_items.json")
        svg_path = os.path.join(job_dir, "sketch.svg")

        # Generate or re-generate Smart Vector PDF with interactive annotations if needed
        if not os.path.exists(pdf_path) or export_format == "smart-pdf":
            if os.path.exists(graph_path):
                try:
                    with open(graph_path, "r", encoding="utf-8") as f:
                        graph_data = json.load(f)
                    graph_schema = GraphSchema(**graph_data)
                    tag_meta = {}
                    items_list = []
                    if os.path.exists(res_path):
                        with open(res_path, "r", encoding="utf-8") as f:
                            res_data = json.load(f)
                            items_list = res_data.get("items", []) if isinstance(res_data, dict) else res_data
                            for it in items_list:
                                tag_meta[it.get("normalized_tag", "")] = it
                                tag_meta[it.get("id", "")] = it

                    report_path = os.path.join(job_dir, "report.json")
                    diagnostics = []
                    if os.path.exists(report_path):
                        try:
                            with open(report_path, "r", encoding="utf-8") as rf:
                                rpt = json.load(rf)
                                diagnostics = rpt.get("connection_validation", {}).get("diagnostics", [])
                        except Exception:
                            pass
                    if not diagnostics:
                        from services.api.app.engine.validator import ConnectionValidator
                        diagnostics = ConnectionValidator.validate_connections(graph_schema, items_list).get("diagnostics", [])

                    pdf_bytes = generate_smart_vector_pdf(graph_schema, job_id, tag_meta, diagnostics=diagnostics)
                    with open(pdf_path, "wb") as f:
                        f.write(pdf_bytes)
                except Exception as e:
                    logger.warning(f"Failed to generate smart pdf: {e}")
                    if os.path.exists(svg_path):
                        with open(svg_path, "r", encoding="utf-8") as f:
                            svg_content = f.read()
                        svg_doc = fitz.open(stream=svg_content.encode("utf-8"), filetype="svg")
                        pdf_bytes = svg_doc.convert_to_pdf()
                    else:
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simplified diagram artifacts not found")
            elif os.path.exists(svg_path):
                with open(svg_path, "r", encoding="utf-8") as f:
                    svg_content = f.read()
                svg_doc = fitz.open(stream=svg_content.encode("utf-8"), filetype="svg")
                pdf_bytes = svg_doc.convert_to_pdf()
            else:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simplified diagram artifacts not found")
        else:
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=simplified_diagram_smart_vector_{job_id[:8]}.pdf"}
        )

    elif export_format == "pdf":
        report_path = os.path.join(job_dir, "report.json")
        if not os.path.exists(report_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report artifacts not found")
        with open(report_path, "r", encoding="utf-8") as f:
            report_data = json.load(f)
        pdf_bytes = generate_pdf_report(job_id, report_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=untangle_audit_report_{job_id}.pdf"}
        )


@router.get("/{job_id}/simplified-diagram/pdf")
def download_simplified_diagram_pdf(job_id: str, db: Session = Depends(get_db)):
    """
    Download the simplified engineering process diagram as a Smart Vector PDF document
    with interactive annotations, clickable tag tooltips, and infinite zoom clarity.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    pdf_path = os.path.join(job_dir, "simplified_diagram.pdf")
    graph_path = os.path.join(job_dir, "graph.json")
    res_path = os.path.join(job_dir, "resolved_items.json")

    if not os.path.exists(pdf_path):
        if os.path.exists(graph_path):
            with open(graph_path, "r", encoding="utf-8") as f:
                graph_data = json.load(f)
            graph_schema = GraphSchema(**graph_data)
            tag_meta = {}
            items_list = []
            if os.path.exists(res_path):
                with open(res_path, "r", encoding="utf-8") as f:
                    res_data = json.load(f)
                    items_list = res_data.get("items", []) if isinstance(res_data, dict) else res_data
                    for it in items_list:
                        tag_meta[it.get("normalized_tag", "")] = it
                        tag_meta[it.get("id", "")] = it

            report_path = os.path.join(job_dir, "report.json")
            diagnostics = []
            if os.path.exists(report_path):
                try:
                    with open(report_path, "r", encoding="utf-8") as rf:
                        rpt = json.load(rf)
                        diagnostics = rpt.get("connection_validation", {}).get("diagnostics", [])
                except Exception:
                    pass
            if not diagnostics:
                from services.api.app.engine.validator import ConnectionValidator
                diagnostics = ConnectionValidator.validate_connections(graph_schema, items_list).get("diagnostics", [])

            pdf_bytes = generate_smart_vector_pdf(graph_schema, job_id, tag_meta, diagnostics=diagnostics)
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DIAGRAM_NOT_FOUND", "message": "Simplified diagram not yet generated."}
            )
    else:
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=simplified_diagram_smart_vector_{job_id[:8]}.pdf"
        }
    )


@router.get("/{job_id}/detection-preview")
def get_detection_preview(
    job_id: str,
    page: int = Query(1, ge=1),
    download: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Serve high-resolution visual detection overlay image showing all detected labels,
    tags, equipment, valves, and lines overlaid on top of the original blueprint.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    overlay_path = os.path.join(job_dir, f"debug_overlay_page_{page}.png")

    if not os.path.exists(overlay_path):
        # Fallback to page 1 overlay
        fallback_path = os.path.join(job_dir, "debug_overlay_page_1.png")
        if os.path.exists(fallback_path):
            overlay_path = fallback_path
        else:
            # Dynamically render overlay from perception.json and PDF
            job = db.query(JobModel).filter(JobModel.id == job_id).first()
            perc_path = os.path.join(job_dir, "perception.json")
            if job and os.path.exists(job.pdf_path) and os.path.exists(perc_path):
                try:
                    import cv2
                    import numpy as np
                    from services.perception.perception.run import generate_debug_overlay
                    from services.perception.perception.schema import PerceptionOutput
                    with open(perc_path, "r", encoding="utf-8") as f:
                        perc_data = json.load(f)
                    perception_output = PerceptionOutput(**perc_data)
                    page_perc = next((p for p in perception_output.pages if p.page_number == page), perception_output.pages[0])
                    doc = fitz.open(job.pdf_path)
                    pdf_page = doc[max(0, min(page - 1, len(doc) - 1))]
                    pix = pdf_page.get_pixmap(dpi=150)
                    bg_img = cv2.imdecode(np.frombuffer(pix.tobytes("png"), dtype=np.uint8), cv2.IMREAD_COLOR)
                    generate_debug_overlay(bg_img, page_perc, overlay_path)
                except Exception as e:
                    logger.warning(f"Could not dynamically render debug overlay: {e}")

    if not os.path.exists(overlay_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PREVIEW_NOT_FOUND", "message": f"Detection preview image for page {page} not found."}
        )

    with open(overlay_path, "rb") as f:
        content = f.read()

    headers = {}
    if download:
        headers["Content-Disposition"] = f"attachment; filename=detection_preview_{job_id[:8]}_p{page}.png"

    return Response(content=content, media_type="image/png", headers=headers)


@router.get("/{job_id}/error-preview")
def get_error_preview(
    job_id: str,
    page: int = Query(1, ge=1),
    download: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Serve high-resolution visual error and discrepancy overlay image
    showing all P1/P2 hazards, missing IO items, signal mismatches, and missing components
    highlighted directly on top of the original P&ID blueprint.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    overlay_path = os.path.join(job_dir, f"error_overlay_page_{page}.png")

    if not os.path.exists(overlay_path):
        # Fallback to page 1 overlay if exists
        fallback_path = os.path.join(job_dir, "error_overlay_page_1.png")
        if os.path.exists(fallback_path):
            overlay_path = fallback_path
        else:
            # Dynamically render error overlay from report.json, perception.json and PDF
            job = db.query(JobModel).filter(JobModel.id == job_id).first()
            report_path = os.path.join(job_dir, "report.json")
            perc_path = os.path.join(job_dir, "perception.json")
            res_path = os.path.join(job_dir, "resolved_items.json")

            report_data = {}
            if os.path.exists(report_path):
                try:
                    with open(report_path, "r", encoding="utf-8") as f:
                        report_data = json.load(f)
                except Exception:
                    pass

            perc_data = {}
            if os.path.exists(perc_path):
                try:
                    with open(perc_path, "r", encoding="utf-8") as f:
                        perc_data = json.load(f)
                except Exception:
                    pass

            resolved_tags = []
            if os.path.exists(res_path):
                try:
                    with open(res_path, "r", encoding="utf-8") as f:
                        rdata = json.load(f)
                        resolved_tags = rdata.get("items", []) if isinstance(rdata, dict) else rdata
                except Exception:
                    pass

            if job and os.path.exists(job.pdf_path):
                try:
                    from services.api.app.engine.error_visualizer import generate_error_overlay
                    doc = fitz.open(job.pdf_path)
                    pdf_page = doc[max(0, min(page - 1, len(doc) - 1))]
                    pix = pdf_page.get_pixmap(dpi=150)
                    bg_img = cv2.imdecode(np.frombuffer(pix.tobytes("png"), dtype=np.uint8), cv2.IMREAD_COLOR)
                    generate_error_overlay(
                        bg_img=bg_img,
                        page_number=page,
                        report_data=report_data,
                        perception_dict=perc_data,
                        resolved_tags=resolved_tags,
                        out_path=overlay_path
                    )
                except Exception as e:
                    logger.warning(f"Could not dynamically render error overlay: {e}")

    if not os.path.exists(overlay_path):
        # Fallback to debug overlay if error overlay could not be rendered
        debug_overlay = os.path.join(job_dir, f"debug_overlay_page_{page}.png")
        if os.path.exists(debug_overlay):
            overlay_path = debug_overlay
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "ERROR_PREVIEW_NOT_FOUND", "message": f"Error preview image for page {page} not found."}
            )

    with open(overlay_path, "rb") as f:
        content = f.read()

    headers = {}
    if download:
        headers["Content-Disposition"] = f"attachment; filename=error_preview_{job_id[:8]}_p{page}.png"

    return Response(content=content, media_type="image/png", headers=headers)


@router.get("/{job_id}/original-page")
def get_original_page(
    job_id: str,
    page: int = Query(1, ge=1),
    db: Session = Depends(get_db)
):
    """
    Render the original unannotated P&ID drawing page for side-by-side inspection.
    """
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job or not os.path.exists(job.pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PDF_NOT_FOUND", "message": "Original PDF blueprint not found."}
        )

    try:
        doc = fitz.open(job.pdf_path)
        pdf_page = doc[max(0, min(page - 1, len(doc) - 1))]
        pix = pdf_page.get_pixmap(dpi=150)
        return Response(content=pix.tobytes("png"), media_type="image/png")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "RENDER_FAILED", "message": str(e)}
        )


@router.get("/{job_id}/detection-previews")
def get_detection_previews_info(job_id: str, db: Session = Depends(get_db)):
    """
    Get summary list of available detection preview pages with symbol and tag counts.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    perc_path = os.path.join(job_dir, "perception.json")

    pages_info = []
    if os.path.exists(perc_path):
        try:
            with open(perc_path, "r", encoding="utf-8") as f:
                perc_data = json.load(f)
            for p in perc_data.get("pages", []):
                p_num = p.get("page_number", 1)
                pages_info.append({
                    "page": p_num,
                    "preview_url": f"/api/v1/jobs/{job_id}/detection-preview?page={p_num}",
                    "original_url": f"/api/v1/jobs/{job_id}/original-page?page={p_num}",
                    "symbols_detected": len(p.get("symbols", [])),
                    "tags_detected": len(p.get("text_items", [])),
                    "lines_detected": len(p.get("line_segments", [])),
                    "width": p.get("width", 2000),
                    "height": p.get("height", 1400)
                })
        except Exception:
            pass

    if not pages_info:
        pages_info.append({
            "page": 1,
            "preview_url": f"/api/v1/jobs/{job_id}/detection-preview?page=1",
            "original_url": f"/api/v1/jobs/{job_id}/original-page?page=1",
            "symbols_detected": 0,
            "tags_detected": 0,
            "lines_detected": 0,
            "width": 2000,
            "height": 1400
        })

    return {
        "job_id": job_id,
        "total_pages": len(pages_info),
        "pages": pages_info
    }


@router.get("/{job_id}/error-previews")
def get_error_previews_info(job_id: str, db: Session = Depends(get_db)):
    """
    Get summary list of available error preview pages with counts of P1, P2,
    missing in drawing, missing in IO list, and detailed error hotspots with coordinates.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    report_path = os.path.join(job_dir, "report.json")
    perc_path = os.path.join(job_dir, "perception.json")
    res_path = os.path.join(job_dir, "resolved_items.json")

    report_data = {}
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report_data = json.load(f)
        except Exception:
            pass

    perc_data = {}
    if os.path.exists(perc_path):
        try:
            with open(perc_path, "r", encoding="utf-8") as f:
                perc_data = json.load(f)
        except Exception:
            pass

    resolved_tags = []
    if os.path.exists(res_path):
        try:
            with open(res_path, "r", encoding="utf-8") as f:
                rdata = json.load(f)
                resolved_tags = rdata.get("items", []) if isinstance(rdata, dict) else rdata
        except Exception:
            pass

    from services.api.app.engine.error_visualizer import extract_error_hotspots

    conn_val = report_data.get("connection_validation", {})
    p1_count = conn_val.get("p1_critical_count", 0)
    p2_count = conn_val.get("p2_high_count", 0)
    missing_draw = report_data.get("missing_in_drawing", [])
    missing_io = report_data.get("missing_in_io_list", [])
    type_mismatches = report_data.get("type_mismatches", [])

    pages_info = []
    total_pages = len(perc_data.get("pages", [])) or 1

    for p_num in range(1, total_pages + 1):
        page_perc = next((p for p in perc_data.get("pages", []) if p.get("page_number") == p_num), {})
        w = page_perc.get("width", 2000)
        h = page_perc.get("height", 1400)
        hotspots = extract_error_hotspots(
            page_number=p_num,
            report_data=report_data,
            perception_dict=perc_data,
            resolved_tags=resolved_tags,
            src_w=float(w),
            src_h=float(h)
        )
        pages_info.append({
            "page": p_num,
            "error_preview_url": f"/api/v1/jobs/{job_id}/error-preview?page={p_num}",
            "detection_preview_url": f"/api/v1/jobs/{job_id}/detection-preview?page={p_num}",
            "original_url": f"/api/v1/jobs/{job_id}/original-page?page={p_num}",
            "hotspots_count": len(hotspots),
            "hotspots": hotspots,
            "missing_in_drawing": missing_draw if p_num == 1 else [],
            "width": w,
            "height": h
        })

    return {
        "job_id": job_id,
        "total_pages": len(pages_info),
        "total_hotspots": sum(p["hotspots_count"] for p in pages_info),
        "p1_critical_count": p1_count,
        "p2_high_count": p2_count,
        "missing_in_drawing_count": len(missing_draw),
        "missing_in_io_count": len(missing_io),
        "type_mismatch_count": len(type_mismatches),
        "pages": pages_info
    }


@router.get("/{job_id}/verification")
def get_job_verification(job_id: str, db: Session = Depends(get_db)):
    """
    Retrieve deterministic engineering verification report:
    1. P&ID connection checks (correct vs. wrong, floating equipment, control loops, line compatibility).
    2. DCS I/O list verification (correct vs. wrong, missing tags, signal type mismatches, calibration errors).
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    report_path = os.path.join(job_dir, "report.json")
    graph_path = os.path.join(job_dir, "graph.json")

    # If report.json exists and has verification data, return it
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            r_data = json.load(f)
            if r_data.get("connection_validation") and r_data.get("io_verification"):
                return {
                    "job_id": job_id,
                    "connection_validation": r_data.get("connection_validation"),
                    "io_verification": r_data.get("io_verification"),
                }

    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")

    tags = db.query(TagModel).filter(TagModel.job_id == job_id).all()
    resolved_tags_list = [
        {
            "id": t.id,
            "normalized_tag": t.normalized_tag,
            "type": t.type,
            "category": t.category,
            "status": t.status,
            "confidence": t.confidence,
            "bbox": t.bbox,
        }
        for t in tags
    ]

    graph = None
    if os.path.exists(graph_path):
        with open(graph_path, "r", encoding="utf-8") as f:
            graph = GraphSchema(**json.load(f))

    io_items = []
    if job.xlsx_path and os.path.exists(job.xlsx_path):
        from services.api.app.engine.io_parser import parse_io_list
        io_result = parse_io_list(job.xlsx_path)
        io_items = io_result.items

    from services.api.app.engine.validator import ConnectionValidator, IoListValidator
    conn_val = ConnectionValidator.validate_connections(graph, resolved_tags_list) if graph else None
    io_val = IoListValidator.verify_io_and_drawing(resolved_tags_list, io_items)

    return {
        "job_id": job_id,
        "connection_validation": conn_val,
        "io_verification": io_val,
    }


# =============================================================================
# Multi-Sheet P&ID Merging & Incremental Revision Diff Endpoints
# =============================================================================

class MergeJobsRequest(BaseModel):
    job_ids: List[str]
    merged_job_name: Optional[str] = "Merged Plant Master"


@router.post("/merge", status_code=status.HTTP_201_CREATED)
def merge_jobs(payload: MergeJobsRequest, db: Session = Depends(get_db)):
    """
    Merge multiple P&ID jobs or sheets into a unified plant master topology.
    Stitches boundary pipelines via Off-Page Connectors (OPCs).
    """
    if len(payload.job_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_MERGE_REQUEST", "message": "At least 2 job IDs are required for merging."}
        )

    settings = get_settings()
    graphs: List[GraphSchema] = []
    all_opcs: List[Dict[str, Any]] = []
    total_pages = 0
    merged_tags_data: List[Dict[str, Any]] = []
    sheet_labels: List[str] = []

    for idx, j_id in enumerate(payload.job_ids, start=1):
        job_dir = os.path.join(settings.DATA_DIR, j_id)
        graph_path = os.path.join(job_dir, "graph.json")
        if not os.path.exists(graph_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SOURCE_GRAPH_NOT_FOUND", "message": f"Graph for job {j_id} not found."}
            )

        with open(graph_path, "r", encoding="utf-8") as f:
            g_data = json.load(f)
            graphs.append(GraphSchema(**g_data))

        # Check for OPCs in perception.json
        perc_path = os.path.join(job_dir, "perception.json")
        if os.path.exists(perc_path):
            with open(perc_path, "r", encoding="utf-8") as f:
                p_data = json.load(f)
                for page in p_data.get("pages", []):
                    total_pages += 1
                    for opc in page.get("off_page_connectors", []):
                        opc_copy = dict(opc)
                        opc_copy["sheet"] = idx
                        all_opcs.append(opc_copy)
        else:
            total_pages += 1

        sheet_labels.append(f"Sheet_{idx}")

        # Collect tags from database
        tags = db.query(TagModel).filter(TagModel.job_id == j_id).all()
        for t in tags:
            merged_tags_data.append({
                "page": t.page,
                "raw_text": t.raw_text,
                "normalized_tag": t.normalized_tag,
                "type": t.type,
                "category": t.category,
                "confidence": t.confidence,
                "status": t.status,
                "bbox": t.bbox,
                "conf_breakdown": t.conf_breakdown,
                "io_match": t.io_match,
                "reasoning": t.reasoning,
                "source": t.source,
            })

    # Execute Multi-Sheet Stitching & Layout
    merger = MultiSheetMerger(sheet_spacing_x=2200.0)
    raw_merged_graph = merger.merge_graphs(graphs, sheet_labels=sheet_labels, all_opcs=all_opcs)
    simplified_merged_graph = simplify_graph_layout(raw_merged_graph)

    # Create new merged job record
    merged_job_id = str(uuid.uuid4())
    merged_dir = os.path.join(settings.DATA_DIR, merged_job_id)
    os.makedirs(merged_dir, exist_ok=True)

    # Save artifacts
    with open(os.path.join(merged_dir, "graph.json"), "w", encoding="utf-8") as f:
        json.dump(simplified_merged_graph.model_dump(), f, indent=2)

    svg_content = generate_svg_sketch(simplified_merged_graph)
    with open(os.path.join(merged_dir, "sketch.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)

    try:
        svg_doc = fitz.open(stream=svg_content.encode("utf-8"), filetype="svg")
        pdf_bytes = svg_doc.convert_to_pdf()
        with open(os.path.join(merged_dir, "simplified_diagram.pdf"), "wb") as f:
            f.write(pdf_bytes)
    except Exception as e:
        logger.warning(f"Could not convert merged sketch.svg to PDF: {e}")

    # Save merge metadata
    merge_meta = {
        "merged_job_id": merged_job_id,
        "source_jobs": payload.job_ids,
        "nodes_count": len(simplified_merged_graph.nodes),
        "edges_count": len(simplified_merged_graph.edges),
        "cross_sheet_connections": sum(1 for e in simplified_merged_graph.edges if "opc_bridge" in e.id),
    }
    with open(os.path.join(merged_dir, "merge_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(merge_meta, f, indent=2)

    # Save TagModel entries for merged job
    for idx, t in enumerate(merged_tags_data, start=1):
        tag_row = TagModel(
            id=f"{merged_job_id[:8]}_tag_{idx:04d}",
            job_id=merged_job_id,
            page=t["page"],
            raw_text=t["raw_text"],
            normalized_tag=t["normalized_tag"],
            type=t["type"],
            category=t["category"],
            confidence=t["confidence"],
            status=t["status"],
            reasoning=t["reasoning"],
            source=t["source"],
        )
        tag_row.bbox = t["bbox"]
        tag_row.conf_breakdown = t["conf_breakdown"]
        tag_row.io_match = t["io_match"]
        db.add(tag_row)

    # Save JobModel
    new_job = JobModel(
        id=merged_job_id,
        status="done",
        stage="report",
        progress=1.0,
        pages=max(1, total_pages),
        pdf_path=os.path.join(merged_dir, "simplified_diagram.pdf"),
        xlsx_path="",
        summary={
            "resolved": sum(1 for t in merged_tags_data if t["status"] == "resolved"),
            "needs_review": sum(1 for t in merged_tags_data if t["status"] == "needs_review"),
            "rejected": 0,
        }
    )
    db.add(new_job)
    db.commit()

    return {
        "merged_job_id": merged_job_id,
        "status": "done",
        "nodes_count": len(simplified_merged_graph.nodes),
        "edges_count": len(simplified_merged_graph.edges),
        "source_jobs": payload.job_ids,
        "cross_sheet_connections": merge_meta["cross_sheet_connections"],
    }


@router.get("/{job_id}/diff", response_model=RevisionDiffSchema)
def get_revision_diff(
    job_id: str,
    compare_to: Optional[str] = Query(None, description="Optional job ID to compare against. If omitted, uses baseline parent."),
    db: Session = Depends(get_db)
):
    """
    Retrieve differential changes (added, modified, removed tags & connections) between revisions.
    """
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)

    # Check if precomputed diff exists
    diff_file = os.path.join(job_dir, "revision_diff.json")
    if not compare_to and os.path.exists(diff_file):
        with open(diff_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Otherwise compute on-the-fly comparing against compare_to
    target_id = compare_to
    if not target_id:
        rev_meta_path = os.path.join(job_dir, "revision_meta.json")
        if os.path.exists(rev_meta_path):
            with open(rev_meta_path, "r") as f:
                target_id = json.load(f).get("baseline_job_id")

    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BASELINE_REQUIRED", "message": "Specify 'compare_to' query parameter to diff against another job."}
        )

    target_dir = os.path.join(settings.DATA_DIR, target_id)

    # Load tags and graphs for both jobs
    tags_v1 = [
        {"id": t.id, "normalized_tag": t.normalized_tag, "page": t.page, "type": t.type, "category": t.category, "status": t.status, "bbox": t.bbox, "io_match": t.io_match}
        for t in db.query(TagModel).filter(TagModel.job_id == target_id).all()
    ]
    tags_v2 = [
        {"id": t.id, "normalized_tag": t.normalized_tag, "page": t.page, "type": t.type, "category": t.category, "status": t.status, "bbox": t.bbox, "io_match": t.io_match}
        for t in db.query(TagModel).filter(TagModel.job_id == job_id).all()
    ]

    g1_path = os.path.join(target_dir, "graph.json")
    g2_path = os.path.join(job_dir, "graph.json")
    graph_v1 = {}
    graph_v2 = {}
    if os.path.exists(g1_path):
        with open(g1_path, "r") as f:
            graph_v1 = json.load(f)
    if os.path.exists(g2_path):
        with open(g2_path, "r") as f:
            graph_v2 = json.load(f)

    diff = RevisionDiffEngine.compare_revisions(
        job_v1_id=target_id,
        tags_v1=tags_v1,
        graph_v1=graph_v1,
        job_v2_id=job_id,
        tags_v2=tags_v2,
        graph_v2=graph_v2,
    )
    return diff


@router.post("/{job_id}/revisions", status_code=status.HTTP_202_ACCEPTED)
async def create_revision_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    pid_pdf: Optional[UploadFile] = File(None),
    io_list_xlsx: Optional[UploadFile] = File(None),
    revision_label: str = Query("Rev 02"),
    db: Session = Depends(get_db)
):
    """
    Submit an updated P&ID diagram or I/O list as a new revision against an existing job.
    Automatically initiates the processing pipeline and triggers differential change tracking.
    """
    settings = get_settings()
    base_job = db.query(JobModel).filter(JobModel.id == job_id).first()
    if not base_job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Baseline job not found.")

    new_job_id = str(uuid.uuid4())
    new_job_dir = os.path.join(settings.DATA_DIR, new_job_id)
    os.makedirs(new_job_dir, exist_ok=True)

    # 1. Use new PDF if uploaded, else clone base PDF
    if pid_pdf is not None:
        saved_pdf_path = validate_and_save_upload(
            pid_pdf,
            allowed_mimes=["application/pdf"],
            max_size=MAX_PDF_SIZE_BYTES,
            target_dir=new_job_dir
        )
    else:
        saved_pdf_path = base_job.pdf_path

    # 2. Use new XLSX if uploaded, else clone base XLSX
    if io_list_xlsx is not None:
        saved_xlsx_path = validate_and_save_upload(
            io_list_xlsx,
            allowed_mimes=[
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.ms-excel",
                "text/csv"
            ],
            max_size=MAX_XLSX_SIZE_BYTES,
            target_dir=new_job_dir
        )
    else:
        saved_xlsx_path = base_job.xlsx_path

    # Record revision metadata
    rev_meta = {
        "job_id": new_job_id,
        "baseline_job_id": job_id,
        "revision_label": revision_label,
    }
    with open(os.path.join(new_job_dir, "revision_meta.json"), "w") as f:
        json.dump(rev_meta, f, indent=2)

    # Create JobModel record
    job_record = JobModel(
        id=new_job_id,
        status="queued",
        stage="perception",
        progress=0.0,
        pdf_path=saved_pdf_path,
        xlsx_path=saved_xlsx_path,
    )
    db.add(job_record)
    db.commit()

    # Launch pipeline in background
    background_tasks.add_task(run_pipeline_in_background, new_job_id)

    return {
        "job_id": new_job_id,
        "baseline_job_id": job_id,
        "revision_label": revision_label,
        "status": "queued",
    }


