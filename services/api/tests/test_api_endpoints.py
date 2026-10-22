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
