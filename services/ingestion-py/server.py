"""HTTP wrapper around the ingestion logic (ingest.py), for running ingestion as its
own deployed service (e.g. Railway) instead of a spawned subprocess.

Same contract as the CLI, over HTTP. The Node adapter (lib/ingestion/index.ts) calls
this when INGESTION_SERVICE_URL is set, and falls back to the local CLI otherwise.

  POST /ingest   (multipart: file, mode)  -> {markdown, parser, warnings} | {error}
  GET  /health                             -> {status: "ok"}

Auth: if INGESTION_SERVICE_TOKEN is set, requests must send `Authorization: Bearer <token>`.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from ingest import SUPPORTED_EXTENSIONS, convert  # reuse the exact same conversion logic

app = FastAPI(title="Carding ingestion", version="0.1.0")

MAX_BYTES = 25 * 1024 * 1024  # mirrors the app's upload cap (next.config.ts bodySizeLimit)


def _check_auth(authorization: str | None) -> None:
    token = os.environ.get("INGESTION_SERVICE_TOKEN")
    if not token:
        return  # no token configured → open (local/dev)
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "supported": sorted(SUPPORTED_EXTENSIONS)}


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    if mode not in ("auto", "markitdown", "docling"):
        raise HTTPException(status_code=400, detail="Invalid mode.")

    data = await file.read()
    if not data:
        return JSONResponse({"error": "No document bytes received."}, status_code=400)
    if len(data) > MAX_BYTES:
        return JSONResponse({"error": "File too large (max 25 MB)."}, status_code=413)

    try:
        result = convert(data, file.filename or "upload", mode)
    except Exception as exc:  # noqa: BLE001 — report any failure as structured JSON
        return JSONResponse({"error": str(exc)}, status_code=422)
    return JSONResponse(result)
