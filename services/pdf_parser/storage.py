"""Persistent storage for unrecognized statement files (PDFs and screenshots).

Uploads to Supabase Storage when SUPABASE_URL and SUPABASE_SECRET_KEY
are set (production). Falls back to a local directory otherwise (development).

Required Supabase setup:
  - Create a private bucket named "unrecognized-statements" in the dashboard.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SECRET_KEY")
BUCKET = "unrecognized-statements"

UNRECOGNIZED_DIR = Path(os.getenv("UNRECOGNIZED_DIR", "./unrecognized"))

_client = None


def _get_client():
    global _client
    if _client is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        from supabase import create_client
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def save_unrecognized(content: bytes, original_filename: str) -> str:
    """Save an unsupported file (PDF or screenshot image) so it can be used
    to build a new parser later.

    Returns a string describing where the file was saved.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stem = Path(original_filename).stem
    ext = Path(original_filename).suffix.lower() or ".pdf"
    content_type = CONTENT_TYPES.get(ext, "application/octet-stream")
    file_name = f"{timestamp}_{stem}{ext}"
    meta = json.dumps({"original_filename": original_filename, "saved_at": timestamp}, indent=2)

    client = _get_client()
    if client:
        try:
            client.storage.from_(BUCKET).upload(file_name, content, {"content-type": content_type})
            client.storage.from_(BUCKET).upload(
                f"{timestamp}_{stem}.json",
                meta.encode(),
                {"content-type": "application/json"},
            )
            return f"supabase://{BUCKET}/{file_name}"
        except Exception as exc:
            print(f"[unrecognized] Supabase upload failed ({exc}), falling back to local")

    # Local fallback
    UNRECOGNIZED_DIR.mkdir(parents=True, exist_ok=True)
    saved_path = UNRECOGNIZED_DIR / file_name
    saved_path.write_bytes(content)
    saved_path.with_suffix(".json").write_text(meta)
    return str(saved_path)
