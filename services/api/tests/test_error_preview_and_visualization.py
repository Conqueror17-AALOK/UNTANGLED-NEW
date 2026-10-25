import io
import json
import os
import shutil
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from services.api.app.config import get_settings
from services.api.app.db.database import Base, engine, get_db
from services.api.app.db.models import JobModel
from services.api.app.engine.error_visualizer import extract_error_hotspots, generate_error_overlay
from services.api.app.engine.report_generator import generate_pdf_report
from services.api.app.main import app

client = TestClient(app)


def test_generate_error_overlay_direct():
    """
    Test direct error overlay generation on a synthetic P&ID blueprint image.
    Verifies P1 highlights, P2 warnings, missing in IO markers, and missing in blueprint HUD.
    """
    # Create white canvas mimicking P&ID drawing (1000x700)
    canvas = np.ones((700, 1000, 3), dtype=np.uint8) * 255
    # Draw some schematic lines
    cv2.line(canvas, (100, 300), (900, 300), (50, 50, 50), 2)
    cv2.circle(canvas, (400, 300), 25, (80, 80, 80), 2)

    sample_report = {
        "summary": {"tags_total": 5, "resolved": 3, "needs_review": 2, "rejected": 0},
        "connection_validation": {
            "status": "NEEDS_ATTENTION",
            "health_score_pct": 75.0,
            "p1_critical_count": 1,
            "p2_high_count": 1,
            "diagnostics": [
                {
                    "element_id": "PSV-101",
                    "status": "WRONG",
                    "priority": "P1",
                    "priority_label": "P1 - Critical Safety Hazard",
                    "rule": "ISOLATED_RELIEF_VALVE",
                    "message": "Safety relief valve is isolated from flare header.",
                    "time_savings_action": "Route discharge line to flare header.",
                    "bbox": [375, 275, 425, 325],
                    "page": 1
                },
                {
                    "element_id": "P-101B",
                    "status": "WARNING",
                    "priority": "P2",
                    "priority_label": "P2 - Operational Hazard",
                    "rule": "FLOATING_EQUIPMENT",
                    "message": "Pump suction lacks defined fluid source line.",
                    "time_savings_action": "Verify inlet nozzle connection to feed vessel.",
                    "bbox": [600, 260, 680, 340],
                    "page": 1
                }
            ]
        },
        "missing_in_drawing": [
            {"io_tag": "FT-310", "description": "Secondary Recycle Flow Sensor registered in DCS IO List, absent on sheet."}
        ],
        "missing_in_io_list": [
            {"tag": "HV-77", "tag_id": "tag_008"}
        ],
        "type_mismatches": [
            {"tag": "PT-101", "drawing_type": "Pressure Transmitter", "io_signal": "Digital Input"}
        ]
    }

    sample_perception = {
        "pages": [
            {
                "page_number": 1,
                "width": 1000,
                "height": 700,
                "text_items": [],
                "symbols": []
            }
        ]
    }

    sample_resolved_tags = [
        {"id": "tag_008", "normalized_tag": "HV-77", "page": 1, "bbox": [150, 270, 210, 330], "type": "Hand Valve"},
        {"id": "tag_009", "normalized_tag": "PT-101", "page": 1, "bbox": [750, 270, 810, 330], "type": "Pressure Transmitter"}
    ]

    out_img = generate_error_overlay(
        bg_img=canvas,
        page_number=1,
        report_data=sample_report,
        perception_dict=sample_perception,
        resolved_tags=sample_resolved_tags
    )

    assert out_img is not None
    assert out_img.shape == canvas.shape
    # Ensure drawing was modified (pixels were altered by highlights)
    assert not np.array_equal(out_img, canvas)

    # Test hotspot extraction
    hotspots = extract_error_hotspots(
        page_number=1,
        report_data=sample_report,
        perception_dict=sample_perception,
        resolved_tags=sample_resolved_tags,
        src_w=1000.0,
        src_h=700.0
    )
    assert len(hotspots) >= 4
    tags = [h["tag"] for h in hotspots]
    assert "PSV-101" in tags
    assert "P-101B" in tags
    assert "HV-77" in tags
    assert "PT-101" in tags

    # Verify normalized bboxes are between 0 and 1
    for h in hotspots:
        nb = h["normalized_bbox"]
        assert 0.0 <= nb[0] <= 1.0
        assert 0.0 <= nb[1] <= 1.0
        assert 0.0 <= nb[2] <= 1.0
        assert 0.0 <= nb[3] <= 1.0


def test_api_error_preview_endpoints():
    """
    Test GET /api/v1/jobs/{job_id}/error-preview and GET /api/v1/jobs/{job_id}/error-previews.
    """
    settings = get_settings()
    test_job_id = "test-error-preview-job"
    job_dir = os.path.join(settings.DATA_DIR, test_job_id)
    os.makedirs(job_dir, exist_ok=True)

    db = next(get_db())

    try:
        # Create a simple PDF for the job
        import fitz
        pdf_path = os.path.join(job_dir, "input.pdf")
        doc = fitz.open()
        page = doc.new_page(width=800, height=600)
        page.draw_rect(fitz.Rect(50, 50, 750, 550), color=(0, 0, 0), width=1.5)
        page.insert_text(fitz.Point(100, 100), "Sample Process Blueprint", fontsize=16)
        doc.save(pdf_path)
        doc.close()

        # Create report.json with error diagnostics
        report_dict = {
            "summary": {"tags_total": 4, "resolved": 2, "needs_review": 2, "rejected": 0},
            "connection_validation": {
                "status": "NEEDS_ATTENTION",
                "health_score_pct": 60.0,
                "p1_critical_count": 1,
                "p2_high_count": 1,
                "diagnostics": [
                    {
                        "element_id": "XV-101",
                        "status": "WRONG",
                        "priority": "P1",
                        "priority_label": "P1 - Critical Safety",
                        "rule": "DEAD_END_VALVE",
                        "message": "Block valve lacks downstream pipe termination.",
                        "time_savings_action": "Cap open outlet or connect downstream manifold.",
                        "bbox": [150, 150, 220, 220],
                        "page": 1
                    }
                ]
            },
            "missing_in_drawing": [
                {"io_tag": "TT-101", "description": "Temperature Sensor registered in DCS, not on drawing."}
            ],
            "missing_in_io_list": [],
            "type_mismatches": []
        }
        with open(os.path.join(job_dir, "report.json"), "w") as f:
            json.dump(report_dict, f)

        # Create perception.json
        perc_dict = {
            "job_id": test_job_id,
            "source_file": "input.pdf",
            "total_pages": 1,
            "pages": [
                {
                    "page_number": 1,
                    "width": 800,
                    "height": 600,
                    "text_items": [{"id": "t1", "text": "XV-101", "bbox": [150, 150, 220, 220], "ocr_confidence": 0.95}],
                    "symbols": []
                }
            ]
        }
        with open(os.path.join(job_dir, "perception.json"), "w") as f:
            json.dump(perc_dict, f)

        # Add job to DB
        job = JobModel(
            id=test_job_id,
            status="done",
            stage="report",
            progress=1.0,
            pdf_path=pdf_path,
            xlsx_path="dummy.xlsx"
        )
        db.add(job)
        db.commit()

        # 1. Test GET /api/v1/jobs/{job_id}/error-preview (Dynamically renders overlay)
        resp_img = client.get(f"/api/v1/jobs/{test_job_id}/error-preview?page=1")
        assert resp_img.status_code == 200
        assert resp_img.headers["content-type"] == "image/png"
        assert len(resp_img.content) > 500

        # Verify error overlay PNG was cached on disk
        cached_overlay = os.path.join(job_dir, "error_overlay_page_1.png")
        assert os.path.exists(cached_overlay)

        # 2. Test GET /api/v1/jobs/{job_id}/error-previews (Metadata & Hotspots)
        resp_meta = client.get(f"/api/v1/jobs/{test_job_id}/error-previews")
        assert resp_meta.status_code == 200
        meta_json = resp_meta.json()
        assert meta_json["job_id"] == test_job_id
        assert meta_json["p1_critical_count"] == 1
        assert meta_json["missing_in_drawing_count"] == 1
        assert len(meta_json["pages"]) == 1
        page_info = meta_json["pages"][0]
        assert "error_preview_url" in page_info
        assert len(page_info["hotspots"]) >= 1
        assert page_info["hotspots"][0]["tag"] == "XV-101"

        # 3. Test generate_pdf_report with visual error overlay
        pdf_bytes = generate_pdf_report(
            job_id=test_job_id,
            report_data=report_dict,
            error_overlay_image_path=cached_overlay
        )
        assert pdf_bytes is not None
        assert len(pdf_bytes) > 2000
        # Check generated PDF has pages including Page 5 error overlay
        check_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        assert len(check_doc) >= 3
        last_page_text = check_doc[-1].get_text()
        assert "Visual Error & Discrepancy Blueprint Overlay" in last_page_text or "UNTANGLED" in last_page_text
        check_doc.close()

    finally:
        db.query(JobModel).filter(JobModel.id == test_job_id).delete()
        db.commit()
        db.close()
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir, ignore_errors=True)
