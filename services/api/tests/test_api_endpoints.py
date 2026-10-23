import pytest
from fastapi.testclient import TestClient

from services.api.app.db.database import Base, SessionLocal, engine
from services.api.app.db.models import JobModel, TagModel
from services.api.app.main import app

client = TestClient(app)


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_health_check_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ["ok", "degraded"]
    assert "version" in data


def test_api_v1_health_check():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "checks" in data


def test_get_nonexistent_job():
    resp = client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
    data = resp.json()
    assert data["error"]["code"] == "JOB_NOT_FOUND"


def test_tag_correction_flow():
    db = SessionLocal()
    job_id = "test-job-uuid-123"
    tag_id = "tag_0099"
    try:
        # Create test job and tag
        job = JobModel(id=job_id, status="running", stage="cleanup", progress=0.4, pdf_path="dummy.pdf", xlsx_path="dummy.xlsx")
        tag = TagModel(
            id=tag_id,
            job_id=job_id,
            page=1,
            raw_text="PT10l",
            normalized_tag="PT-10l",
            type="Pressure Transmitter",
            category="instrument",
            confidence=0.72,
            status="needs_review",
            source="ocr"
        )
        db.add(job)
        db.add(tag)
        db.commit()

        # Call PATCH /api/v1/jobs/{job_id}/tags/{tag_id}
        patch_resp = client.patch(
            f"/api/v1/jobs/{job_id}/tags/{tag_id}",
            json={"normalized_tag": "PT-101", "type": "Pressure Transmitter"}
        )
        assert patch_resp.status_code == 200
        tag_data = patch_resp.json()
        assert tag_data["normalized_tag"] == "PT-101"
        assert tag_data["confidence"] == 1.0
        assert tag_data["status"] == "resolved"
        assert tag_data["source"] == "human"

    finally:
        # Cleanup
        db.query(TagModel).filter(TagModel.job_id == job_id).delete()
        db.query(JobModel).filter(JobModel.id == job_id).delete()
        db.commit()
        db.close()


def test_multilingual_report_and_pdf_export(tmp_path):
    import json
    import os
    from services.api.app.config import get_settings
    from services.api.app.engine.report_generator import generate_pdf_report

    settings = get_settings()
    test_job_id = "test-job-report-456"
    job_dir = os.path.join(settings.DATA_DIR, test_job_id)
    os.makedirs(job_dir, exist_ok=True)

    report_payload = {
        "summary": {
            "tags_total": 5,
            "resolved": 4,
            "needs_review": 1,
            "rejected": 0,
            "auto_pct": 80.0,
            "llm_pct": 20.0,
            "human_pct": 0.0,
        },
        "missing_in_drawing": [
            {"io_tag": "FT-999", "description": "Flow Sensor defined in DCS"}
        ],
        "missing_in_io_list": [
            {"tag": "HV-12", "tag_id": "tag_0012"}
        ],
        "type_mismatches": [
            {"tag": "PT-101", "drawing_type": "PT", "io_signal": "4-20mA AI"}
        ],
        "graph_warnings": []
    }

    with open(os.path.join(job_dir, "report.json"), "w") as f:
        json.dump(report_payload, f)

    try:
        # Test English report
        resp_en = client.get(f"/api/v1/jobs/{test_job_id}/report?lang=en")
        assert resp_en.status_code == 200
        data_en = resp_en.json()
        assert data_en["lang"] == "en"
        assert "i18n_labels" in data_en

        # Test Hindi report
        resp_hi = client.get(f"/api/v1/jobs/{test_job_id}/report?lang=hi")
        assert resp_hi.status_code == 200
        data_hi = resp_hi.json()
        assert data_hi["lang"] == "hi"
        assert "ड्राइंग" in data_hi["i18n_labels"]["missing_drawing_title"]

        # Test Marathi report
        resp_mr = client.get(f"/api/v1/jobs/{test_job_id}/report?lang=mr")
        assert resp_mr.status_code == 200
        data_mr = resp_mr.json()
        assert data_mr["lang"] == "mr"
        assert "रेखाचित्र" in data_mr["i18n_labels"]["missing_drawing_title"]

        # Test PDF Export
        resp_pdf = client.get(f"/api/v1/jobs/{test_job_id}/export?format=pdf")
        assert resp_pdf.status_code == 200
        assert resp_pdf.headers["content-type"] == "application/pdf"
        assert len(resp_pdf.content) > 500  # Valid PDF binary

        # Direct unit test of generate_pdf_report
        pdf_bytes = generate_pdf_report(test_job_id, report_payload)
        assert pdf_bytes.startswith(b"%PDF")
    finally:
        import shutil
        if os.path.exists(job_dir):
            shutil.rmtree(job_dir)
