# Carding ingestion service — PDF/DOCX → markdown (MarkItDown fast path, Docling fallback).
# Deploy target: Railway (or any container host). Docling model weights are baked in at
# build time (prefetch_docling.py) so the running container starts warm.
FROM python:3.12-slim

# System libs Docling / its OCR + PDF rendering deps commonly need.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# uv for fast, locked installs.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Cache Hugging Face / Docling model weights inside the image (baked at build time).
ENV HF_HOME=/models \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# 1. Install runtime deps first (cached layer; no dev group).
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# 2. App source.
COPY ingest.py server.py prefetch_docling.py ./

# 3. Bake Docling model weights into the image so the first request is fast.
RUN uv run python prefetch_docling.py

EXPOSE 8000
# Railway provides $PORT; default to 8000 locally.
CMD ["sh", "-c", "uv run uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
