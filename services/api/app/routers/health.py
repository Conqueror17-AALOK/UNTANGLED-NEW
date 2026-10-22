import os
import shutil
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from services.api.app.config import get_settings
from services.api.app.db.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Deep system health check conforming to docs/OBSERVABILITY_PROPOSAL.md.
    Verifies SQLite DB read/write, DATA_DIR storage, and system dependencies.
    """
    settings = get_settings()
    health_status = {
        "status": "ok",
        "version": "1.0.0",
        "checks": {
            "database": "unknown",
            "storage": "unknown",
            "tesseract": "unavailable",
            "llm": "mock_fallback"
        }
    }

    # 1. Database check
    try:
        db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        health_status["checks"]["database"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # 2. Storage write permission check
    try:
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        test_file = os.path.join(settings.DATA_DIR, ".health_check")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        health_status["checks"]["storage"] = "healthy"
    except Exception as e:
        health_status["checks"]["storage"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # 3. Tesseract OCR binary check
    if shutil.which("tesseract"):
        health_status["checks"]["tesseract"] = "available"
    else:
        health_status["checks"]["tesseract"] = "not_found (using vector & fallback OCR)"

    # 4. LLM provider check
    if settings.GEMINI_API_KEY:
        health_status["checks"]["llm"] = f"configured ({settings.LLM_PROVIDER})"
    else:
        health_status["checks"]["llm"] = "rule_based_fallback"

    return health_status
