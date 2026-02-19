import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Form, HTTPException, UploadFile
from pydantic import BaseModel

from models import ParsedStatement
from parsers import detect_and_parse
from storage import save_unrecognized

app = FastAPI(
    title="PFM PDF Parser",
    description="Bank statement PDF parser for Personal Finance Manager",
    version="0.1.0",
)


class ParseResponse(BaseModel):
    statements: list[ParsedStatement]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
async def parse_pdf(file: UploadFile, password: str | None = Form(None)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    # Save to temp file for pdfplumber
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        statements = detect_and_parse(tmp_path, password=password)
        return ParseResponse(statements=statements)
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail={"message": str(e), "type": "unsupported_format"},
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.post("/save-unrecognized")
async def save_for_support(file: UploadFile):
    """Save an unsupported PDF (user-confirmed) to help build a new parser."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un PDF")

    content = await file.read()
    location = save_unrecognized(content, file.filename)
    print(f"[unrecognized] User-submitted unsupported PDF saved to {location}")
    return {"saved": True}


def run():
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
