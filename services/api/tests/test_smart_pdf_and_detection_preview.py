import json
import os
import fitz
import pytest
from fastapi.testclient import TestClient

from services.api.app.config import get_settings
from services.api.app.db.database import Base, SessionLocal, engine
from services.api.app.db.models import JobModel
from services.api.app.db.schemas import GraphEdge, GraphNode, GraphSchema
from services.api.app.engine.smart_pdf_generator import generate_smart_vector_pdf
from services.api.app.main import app

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_smart_vector_pdf_generation_and_annotations():
    """
    Verify Smart Vector PDF contains vector graphics, interactive annotations,
    and metadata for ISA-5.1 tags including 3-part tags like 14-FIC-15701.
    """
    nodes = [
        GraphNode(id="14-FIC-15701", type="Flow Indicating Controller", category="instrument", x=150, y=180, confidence=0.96),
        GraphNode(id="CV-15701", type="Control Valve", category="valve", x=350, y=180, confidence=0.92),
        GraphNode(id="P-101A", type="Centrifugal Pump", category="equipment", x=550, y=180, confidence=0.88),
        GraphNode(id="V-101", type="Separation Vessel", category="equipment", x=750, y=180, confidence=0.95),
    ]
    edges = [
        GraphEdge(id="e1", source="14-FIC-15701", target="CV-15701", line_type="signal", directed=True),
        GraphEdge(id="e2", source="CV-15701", target="P-101A", line_type="process", directed=True),
        GraphEdge(id="e3", source="P-101A", target="V-101", line_type="process", directed=True),
    ]
    graph = GraphSchema(nodes=nodes, edges=edges)

    tag_meta = {
        "14-FIC-15701": {
            "status": "resolved",
            "io_match": {"signal_type": "AI 4-20mA (4-Wire)"},
            "range_span": "0 - 150 m3/h"
        },
        "CV-15701": {
            "status": "resolved",
            "io_match": {"signal_type": "AO 4-20mA"},
            "range_span": "0 - 100%"
        }
    }

    pdf_bytes = generate_smart_vector_pdf(graph, "test-job-smart-pdf", tag_meta)
    assert len(pdf_bytes) > 1000

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    assert len(doc) == 1
    page = doc[0]

    # Verify annotations exist on the page
    annots = list(page.annots())
    assert len(annots) >= 2

    # Verify annotation content contains tag specs
    annot_texts = [a.info.get("content", "") for a in annots]
    assert any("14-FIC-15701" in t and "AI 4-20mA" in t for t in annot_texts)
    assert any("CV-15701" in t for t in annot_texts)

    # Verify searchable text contains the tag
    page_text = page.get_text()
    assert "14-FIC" in page_text or "15701" in page_text


def test_detection_preview_and_smart_pdf_endpoints():
    """
    Test API endpoints for detection preview image and smart vector PDF export.
    """
    import uuid
    db = SessionLocal()
    job_id = f"test-preview-{uuid.uuid4()}"
    settings = get_settings()
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    try:
        # Create dummy PDF
        pdf_path = os.path.join(job_dir, "test_doc.pdf")
        doc = fitz.open()
        p = doc.new_page(width=500, height=400)
        p.insert_text(fitz.Point(50, 50), "Test P&ID Blueprint", fontsize=16)
        doc.save(pdf_path)
        doc.close()

        # Create dummy overlay image
        overlay_path = os.path.join(job_dir, "debug_overlay_page_1.png")
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (600, 400), color=(20, 25, 35))
        d = ImageDraw.Draw(img)
        d.rectangle([50, 50, 200, 150], outline=(0, 255, 255), width=2)
        d.text((55, 55), "14-FIC-15701", fill=(0, 255, 255))
        img.save(overlay_path)

        # Create dummy graph.json
        graph_dict = {
            "version": 1,
            "nodes": [
                {"id": "14-FIC-15701", "type": "Flow Controller", "category": "instrument", "x": 100, "y": 100, "confidence": 0.95}
            ],
            "edges": [],
            "warnings": []
        }
        with open(os.path.join(job_dir, "graph.json"), "w") as f:
            json.dump(graph_dict, f)

        # Register in DB
        job = JobModel(
            id=job_id,
            status="done",
            stage="report",
            progress=1.0,
            pdf_path=pdf_path,
            xlsx_path="dummy.xlsx"
        )
        db.add(job)
        db.commit()

        # 1. Test GET /api/v1/jobs/{job_id}/detection-preview
        resp = client.get(f"/api/v1/jobs/{job_id}/detection-preview?page=1")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert len(resp.content) > 100

        # 2. Test GET /api/v1/jobs/{job_id}/original-page
        resp_orig = client.get(f"/api/v1/jobs/{job_id}/original-page?page=1")
        assert resp_orig.status_code == 200
        assert resp_orig.headers["content-type"] == "image/png"

        # 3. Test GET /api/v1/jobs/{job_id}/detection-previews
        resp_info = client.get(f"/api/v1/jobs/{job_id}/detection-previews")
        assert resp_info.status_code == 200
        info_json = resp_info.json()
        assert info_json["total_pages"] >= 1
        assert "preview_url" in info_json["pages"][0]

        # 4. Test GET /api/v1/jobs/{job_id}/simplified-diagram/pdf (Smart Vector PDF)
        resp_diag = client.get(f"/api/v1/jobs/{job_id}/simplified-diagram/pdf")
        assert resp_diag.status_code == 200
        assert resp_diag.headers["content-type"] == "application/pdf"
        assert len(resp_diag.content) > 1000

        # 5. Test GET /api/v1/jobs/{job_id}/export?format=smart-pdf
        resp_export = client.get(f"/api/v1/jobs/{job_id}/export?format=smart-pdf")
        assert resp_export.status_code == 200
        assert resp_export.headers["content-type"] == "application/pdf"

    finally:
        db.query(JobModel).filter(JobModel.id == job_id).delete()
        db.commit()
        db.close()
