import os
import re
import secrets
import uuid
from typing import Optional
from fastapi import Header, HTTPException, UploadFile, status

from services.api.app.config import get_settings

MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_XLSX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def verify_api_token(authorization: Optional[str] = Header(None)) -> None:
    settings = get_settings()
    expected_token = settings.API_TOKEN
    if not expected_token:
        return  # Skipped in local development

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing or invalid Bearer token"}
        )

    token = authorization.split("Bearer ")[1].strip()
    if not secrets.compare_digest(token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid credentials"}
        )


def validate_and_save_upload(file: UploadFile, allowed_mimes: list, max_size: int, target_dir: str) -> str:
    # 1. Content-Type check or extension check
    filename = file.filename or "upload"
    content_type = file.content_type or ""
    
    # Allow application/pdf or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet or extension fallback
    is_valid_mime = any(mime in content_type for mime in allowed_mimes)
    is_valid_ext = any(filename.lower().endswith(ext) for ext in [".pdf", ".xlsx", ".xls"])
    
    if not (is_valid_mime or is_valid_ext):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "code": "INVALID_FILE_TYPE",
                "message": f"Expected one of {allowed_mimes}, got {content_type} ({filename})"
            }
        )

    # 2. File size verification
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"File size {size} bytes exceeds limit {max_size} bytes"
            }
        )

    # 3. Path traversal prevention: strip original filename & use random uuid
    safe_name = f"{uuid.uuid4().hex}_{re.sub(r'[^a-zA-Z0-9_.-]', '', filename)}"
    os.makedirs(target_dir, exist_ok=True)
    dest_path = os.path.join(target_dir, safe_name)

    if not os.path.abspath(dest_path).startswith(os.path.abspath(target_dir)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Path traversal attempt detected"}
        )

    with open(dest_path, "wb") as buffer:
        buffer.write(file.file.read())

    return dest_path
