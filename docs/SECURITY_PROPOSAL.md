# Security Hardening Proposal for UNTANGLE Backend
**Author:** Aalok (DevOps & Infrastructure)  
**Target Module:** `services/api/app/core/security.py` & `deps.py`  
**Recipient:** Indra (API Lead)

---

## 1. Upload Sandboxing & Path Traversal Prevention
Ensure all uploaded filenames are sanitized and stored under UUID-based isolated directory paths.

```python
import os
import uuid
import re
from fastapi import HTTPException, UploadFile, status

MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_XLSX_SIZE_BYTES = 10 * 1024 * 1024 # 10 MB

def validate_and_save_upload(file: UploadFile, allowed_mime: str, max_size: int, target_dir: str) -> str:
    # 1. Content-Type check
    if file.content_type != allowed_mime:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "INVALID_FILE_TYPE", "message": f"Expected {allowed_mime}, got {file.content_type}"}
        )
    
    # 2. File size verification
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": f"File size {size} exceeds limit {max_size}"}
        )

    # 3. Path traversal prevention: strip original filename & use random uuid
    safe_name = f"{uuid.uuid4().hex}_{re.sub(r'[^a-zA-Z0-9_.-]', '', file.filename or 'upload')}"
    dest_path = os.path.join(target_dir, safe_name)
    
    # Ensure dest_path is strictly within target_dir
    if not os.path.abspath(dest_path).startswith(os.path.abspath(target_dir)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path traversal attempt detected")

    with open(dest_path, "wb") as buffer:
        buffer.write(file.file.read())

    return dest_path
```

---

## 2. Token Authentication with Constant-Time Comparison
```python
import secrets
from fastapi import Header, HTTPException, status

def verify_api_token(authorization: str = Header(None)) -> None:
    expected_token = os.getenv("API_TOKEN")
    if not expected_token:
        return  # Skipped in local development

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing Bearer token"}
        )

    token = authorization.split("Bearer ")[1].strip()
    # Prevent timing attacks
    if not secrets.compare_digest(token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid credentials"}
        )
```

---

## 3. Rate Limiting on `POST /jobs`
Recommend applying a sliding-window rate limit (e.g. `slowapi` or an in-memory token bucket) allowing max 10 uploads per IP per minute.

---

## 4. Implementation Status
- **Status:** **Implemented & Fully Verified** ✅
- **Module:** `services/api/app/core/security.py`
- **Enforcement:**
  - `validate_and_save_upload()` enforces MIME type whitelisting (`application/pdf`, `.xlsx`), strict size limits (50MB / 10MB), UUID renaming, and `os.path.abspath` prefix verification to eliminate directory traversal attacks.
  - `verify_api_token()` enforces `Bearer` token verification using `secrets.compare_digest` to prevent timing attacks.
  - Applied as FastAPI dependencies on protected routers in `services/api/app/routers/jobs.py`.

