import os
import stat
import tempfile
import logging
import shutil
from pathlib import Path

import uvicorn
from fastapi import Depends, FastAPI, Form, HTTPException, Security, UploadFile
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

from models import ParsedStatement
from parsers import detect_and_parse
from parsers.opendataloader_fallback import (
    get_opendataloaders_binary,
    is_opendataloader_fallback_enabled,
    try_parse_with_opendataloader,
)
from storage import save_unrecognized


logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("pdf_parser")

app = FastAPI(
    title="PFM PDF Parser",
    description="Bank statement PDF parser for Personal Finance Manager",
    version="0.1.0",
)

# ── API key auth ─────────────────────────────────────────────────────────────
_PARSER_API_KEY = os.getenv("PARSER_API_KEY")
_api_key_header = APIKeyHeader(name="X-Parser-Key", auto_error=False)

MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB


async def _verify_key(key: str | None = Security(_api_key_header)) -> None:
    """Reject requests that don't carry the correct shared secret."""
    if not _PARSER_API_KEY:
        # Key not configured — fail closed so a misconfigured deploy is obvious.
        raise HTTPException(status_code=503, detail="Parser API key not configured")
    if key != _PARSER_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


class ParseResponse(BaseModel):
    statements: list[ParsedStatement]


def _attempt_fallback_parse(
    tmp_path: str, password: str | None, filename: str, reason: str
) -> ParseResponse | None:
    fallback_statements = try_parse_with_opendataloader(tmp_path, password=password)
    if not fallback_statements:
        return None

    logger.info(
        "Parsing recovered via OpenDataLoader fallback (%s): filename=%s statements=%s",
        reason,
        filename,
        len(fallback_statements),
    )
    return ParseResponse(statements=fallback_statements)


@app.on_event("startup")
def startup_diagnostics() -> None:
    tesseract_path = shutil.which("tesseract")
    pdftoppm_path = shutil.which("pdftoppm")
    opendataloaders_path = get_opendataloaders_binary()
    logger.info(
        "Startup diagnostics: tesseract=%s, pdftoppm=%s, opendataloaders=%s, opendataloader_fallback_enabled=%s",
        tesseract_path or "NOT_FOUND",
        pdftoppm_path or "NOT_FOUND",
        opendataloaders_path or "NOT_FOUND",
        is_opendataloader_fallback_enabled(),
    )
    if not _PARSER_API_KEY:
        logger.warning("PARSER_API_KEY is not set — all requests will be rejected with 503")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse, dependencies=[Depends(_verify_key)])
async def parse_pdf(file: UploadFile, password: str | None = Form(None)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    content = await file.read()

    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="El archivo excede el tamaño máximo de 50MB")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF válido")

    # Save to temp file for pdfplumber — restrict permissions immediately
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    os.chmod(tmp_path, stat.S_IRUSR | stat.S_IWUSR)

    logger.info(
        "Parsing request received: filename=%s size_bytes=%s password_provided=%s temp_file=%s",
        file.filename,
        len(content),
        bool(password),
        tmp_path,
    )

    try:
        statements = detect_and_parse(tmp_path, password=password)
        logger.info(
            "Parsing succeeded: filename=%s statements=%s",
            file.filename,
            len(statements),
        )
        return ParseResponse(statements=statements)
    except ValueError as e:
        fallback_response = _attempt_fallback_parse(
            tmp_path=tmp_path,
            password=password,
            filename=file.filename,
            reason="unsupported format",
        )
        if fallback_response:
            return fallback_response

        logger.warning("Parsing rejected for filename=%s: %s", file.filename, e)
        raise HTTPException(
            status_code=422,
            detail={"message": str(e), "type": "unsupported_format"},
        )
    except Exception:
        fallback_response = _attempt_fallback_parse(
            tmp_path=tmp_path,
            password=password,
            filename=file.filename,
            reason="unexpected failure",
        )
        if fallback_response:
            return fallback_response

        logger.exception("Unexpected parser failure for filename=%s", file.filename)
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Error interno procesando el PDF. Revisa logs del servicio pdf-parser para el stack trace.",
                "type": "internal_error",
            },
        )
    finally:
        try:
            os.remove(tmp_path)
        except OSError as exc:
            logger.warning("Failed to delete temp file %s: %s", tmp_path, exc)


@app.post("/save-unrecognized", dependencies=[Depends(_verify_key)])
async def save_for_support(file: UploadFile):
    """Save an unsupported PDF (user-confirmed) to help build a new parser."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    content = await file.read()

    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="El archivo excede el tamaño máximo de 50MB")

    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF válido")

    location = save_unrecognized(content, file.filename)
    logger.info("Unrecognized PDF saved: filename=%s path=%s", file.filename, location)
    return {"saved": True}


def run():
    is_dev = os.getenv("APP_ENV", "production") != "production"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=is_dev)


if __name__ == "__main__":
    run()
