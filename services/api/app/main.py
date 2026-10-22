import os
import shutil
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from services.api.app.config import get_settings
from services.api.app.core.logging import logger
from services.api.app.db.database import SessionLocal, init_db
from services.api.app.db.models import JobModel
from services.api.app.engine.pipeline import execute_untangle_pipeline
from services.api.app.routers import health, jobs, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database
    logger.info("Initializing UNTANGLE database tables...")
    init_db()
    yield
    logger.info("UNTANGLE API gateway shutting down.")


settings = get_settings()

app = FastAPI(
    title="UNTANGLE API",
    version="1.0.0",
    description="API for UNTANGLE P&ID untangling, cross-validation, and operator sketch generation.",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Error Handling conforming to contracts/openapi.yaml
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    request_id = request.headers.get("X-Request-ID", f"req_{uuid.uuid4().hex[:8]}")
    
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "VALIDATION_ERROR")
        message = exc.detail.get("message", str(exc.detail))
        details = exc.detail.get("details", [])
    else:
        code = "VALIDATION_ERROR" if exc.status_code == 400 else ("UNAUTHORIZED" if exc.status_code == 401 else "INTERNAL")
        message = exc.detail
        details = []

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details,
                "request_id": request_id
            }
        }
    )


# Include Routers
app.include_router(health.router, prefix="/api/v1")
app.include_router(health.router)  # root /health for docker healthcheck
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(ws.router)


# Quick Hackathon Demo Endpoint: Load Pre-packaged Benchmark Sample
@app.post("/api/v1/jobs/load-sample", status_code=status.HTTP_202_ACCEPTED)
async def load_sample_job():
    """
    Convenience endpoint for 3-minute hackathon demo:
    Loads sample_pid_01.pdf and sample_io_list.xlsx into a new job and kicks off pipeline.
    """
    sample_pdf = os.path.abspath("contracts/samples/sample_pid_01.pdf")
    sample_xlsx = os.path.abspath("contracts/samples/sample_io_list.xlsx")

    if not os.path.exists(sample_pdf) or not os.path.exists(sample_xlsx):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SAMPLE_NOT_FOUND", "message": "Pre-packaged sample files not found in contracts/samples."}
        )

    job_id = str(uuid.uuid4())
    job_dir = os.path.join(settings.DATA_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    dest_pdf = os.path.join(job_dir, "sample_drawing.pdf")
    dest_xlsx = os.path.join(job_dir, "sample_io_list.xlsx")
    shutil.copyfile(sample_pdf, dest_pdf)
    shutil.copyfile(sample_xlsx, dest_xlsx)

    db = SessionLocal()
    try:
        job = JobModel(
            id=job_id,
            status="queued",
            stage="perception",
            progress=0.0,
            pages=1,
            pdf_path=dest_pdf,
            xlsx_path=dest_xlsx,
            summary={"resolved": 0, "needs_review": 0, "rejected": 0}
        )
        db.add(job)
        db.commit()

        # Run pipeline in background task
        import asyncio
        asyncio.create_task(execute_untangle_pipeline(job_id, db))
    finally:
        db.close()

    return {"job_id": job_id, "status": "queued"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.api.app.main:app", host="0.0.0.0", port=8000, reload=True)
