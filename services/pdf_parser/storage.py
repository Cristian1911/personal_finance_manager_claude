"""Persistent storage for unrecognized PDFs.

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


def save_unrecognized(content: bytes, original_filename: str) -> str:
    """Save an unsupported PDF so it can be used to build a new parser later.

    Returns a string describing where the file was saved.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    stem = Path(original_filename).stem
    pdf_name = f"{timestamp}_{stem}.pdf"
    meta = json.dumps({"original_filename": original_filename, "saved_at": timestamp}, indent=2)

    client = _get_client()
    if client:
        try:
            client.storage.from_(BUCKET).upload(pdf_name, content, {"content-type": "application/pdf"})
            client.storage.from_(BUCKET).upload(
                f"{timestamp}_{stem}.json",
                meta.encode(),
                {"content-type": "application/json"},
            )
            return f"supabase://{BUCKET}/{pdf_name}"
        except Exception as exc:
            print(f"[unrecognized] Supabase upload failed ({exc}), falling back to local")

    # Local fallback
    UNRECOGNIZED_DIR.mkdir(parents=True, exist_ok=True)
    saved_path = UNRECOGNIZED_DIR / pdf_name
    saved_path.write_bytes(content)
    saved_path.with_suffix(".json").write_text(meta)
    return str(saved_path)
