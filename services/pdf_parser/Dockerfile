FROM python:3.12-slim

WORKDIR /app

# System dependencies required for OCR/image-based PDF support
# - tesseract-ocr (+ Spanish language pack) for pytesseract
# - poppler-utils (pdftoppm) for pdf2image
RUN apt-get update && apt-get install -y --no-install-recommends \
	tesseract-ocr \
	tesseract-ocr-spa \
	poppler-utils \
	&& rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for caching
COPY pyproject.toml uv.lock ./

# Install dependencies (no dev deps)
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
