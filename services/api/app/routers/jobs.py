import asyncio
import io
import json
import os
import uuid
from typing import List, Literal, Optional

import fitz  # PyMuPDF
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
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
    export_format: str = Query(..., alias="format", pattern="^(json|svg|pdf)$")
):
    """
    Export processed job artifacts as JSON, SVG, or PDF.
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
