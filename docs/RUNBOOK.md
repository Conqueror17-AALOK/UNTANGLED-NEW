# UNTANGLE Operations Runbook

## 1. Quick Troubleshooting Matrix

| Symptom | Root Cause | Remediation |
|---|---|---|
| `tesseract: command not found` | Tesseract binary not installed on host or container | Run `brew install tesseract` (Mac) or `apt-get install -y tesseract-ocr` (Linux/Docker) |
| `INVALID_FILE_TYPE` error on upload | File extension or MIME type not application/pdf or xlsx | Ensure upload is a valid PDF ($\le 50$MB) and standard Excel `.xlsx` ($\le 10$MB) |
| `IO_COLUMN_NOT_FOUND` | Excel sheet missing standard tag column header | Ensure column is named `Tag`, `Tag No`, `Tag Name`, or `Instrument Tag` |
| `LLM_UNAVAILABLE` warning | Gemini API quota exceeded or network interruption | Pipeline gracefully falls back to deterministic rule cleanup + IO List candidates |
| WebSocket connection drops | Browser sleeping or proxy timeout | Frontend auto-reconnects with exponential backoff and synchronizes state via `GET /api/v1/jobs/{id}` |

## 2. Running Diagnostic Perception Checks
To test perception on a new drawing without running the entire backend stack:
```bash
python -m services.perception.perception.run path/to/drawing.pdf /tmp/test_output
```
Inspect `/tmp/test_output/debug_overlay_page_1.png` to verify:
- Cyan bounding boxes surround text correctly
- Yellow circles enclose instrument bubbles
- Green boxes detect pump/tank equipment
- Blue lines trace piping process streams

## 3. Running & Testing the Backend API Gateway
To run the FastAPI backend gateway locally:
```bash
uvicorn services.api.app.main:app --host 0.0.0.0 --port 8000 --reload
```
To verify service health:
```bash
curl -s http://localhost:8000/api/v1/health
```
To kick off an instant benchmark demo pipeline execution without manual file uploads:
```bash
curl -s -X POST http://localhost:8000/api/v1/jobs/load-sample
```
To run the automated test suite across perception and API modules:
```bash
pytest -v
```

