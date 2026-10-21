# Observability & Structured Logging Proposal
**Author:** Aalok (DevOps & Infrastructure)  
**Target Module:** `services/api/app/core/logging.py` & `deps.py`  
**Recipient:** Indra (API Lead)

---

## 1. JSON Structured Logging Schema
All logs emitted by API routes, background workers, and pipeline stages should follow this JSON envelope:

```json
{
  "timestamp": "2026-10-21T10:15:30.123Z",
  "level": "INFO",
  "request_id": "req_8f2a1c",
  "job_id": "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90",
  "stage": "perception",
  "message": "Page 1 perception completed in 1.42s (12 text items, 8 symbols)",
  "metrics": {
    "duration_ms": 1420,
    "text_count": 12,
    "symbol_count": 8,
    "llm_prompt_tokens": 0,
    "llm_completion_tokens": 0,
    "llm_cost_usd": 0.0
  }
}
```

---

## 2. Python Implementation Pattern
```python
import json
import logging
import time
from typing import Optional, Dict, Any

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "request_id": getattr(record, "request_id", None),
            "job_id": getattr(record, "job_id", None),
            "stage": getattr(record, "stage", None),
            "metrics": getattr(record, "metrics", {})
        }
        return json.dumps(log_entry)
```

---

## 3. Deep Health Check Endpoint (`GET /api/v1/health`)
Ensure the health endpoint checks system dependencies:
- SQLite DB read/write availability
- `DATA_DIR` disk space and write permission
- Tesseract OCR binary availability
- LLM Provider connectivity check (optional dry-run)
