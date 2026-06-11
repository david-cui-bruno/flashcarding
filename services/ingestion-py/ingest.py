#!/usr/bin/env python3
"""Carding document ingestion sidecar.

Reads raw document bytes from **stdin**, converts them to clean markdown, and
prints a JSON result to **stdout**:

    {"markdown": str, "parser": "markitdown" | "docling", "warnings": [str]}

On failure it prints {"error": str} to stdout and exits non-zero.

Strategy (docs/ARCHITECTURE.md, docs/PIPELINE.md stage 0):
  * MarkItDown (Microsoft, MIT) is the **fast path** for clean, simple documents.
  * Docling (IBM, MIT) is the **fallback** for structurally complex documents
    (tables / multi-column) and for the cases where MarkItDown extracts little
    or no usable text. Docling does real layout analysis and renders tables as
    markdown, but is heavy (pulls torch) — so it is imported lazily and only
    invoked when needed.

Why these two: both are MIT-licensed, keeping the productization path clean.
We deliberately avoid AGPL PyMuPDF4LLM and the paid Reducto/LlamaParse APIs.

Mode (`--mode`):
  auto       run MarkItDown, fall back to Docling on low-yield/empty/error (default)
  markitdown force MarkItDown only
  docling    force Docling only (use for known table-heavy / multi-column docs)

Invoked by the Node adapter in lib/ingestion/ via child_process; not a server.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import threading

SUPPORTED_EXTENSIONS = {"pdf", "docx"}

# Docling loads a layout + table-structure model into memory. In the long-lived HTTP service
# we build the converter ONCE and reuse it: rebuilding per request both wastes time and causes
# memory spikes (two models briefly resident) that OOM a small container. The lock serializes
# Docling so a single worker never holds two models at once. (In the one-shot CLI this is just
# a per-process build + a no-op lock.)
_docling_converter = None
_docling_lock = threading.Lock()

# Below this many non-whitespace characters of extracted text, we treat the
# MarkItDown result as a failed/low-yield extraction (scanned, image-only, or
# layout MarkItDown couldn't read) and fall back to Docling in auto mode.
MIN_USABLE_CHARS = 32


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _usable_chars(markdown: str) -> int:
    return len("".join(markdown.split()))


def _run_markitdown(path: str) -> str:
    """Fast path. Returns extracted markdown (may be empty)."""
    from markitdown import MarkItDown

    converter = MarkItDown(enable_plugins=False)
    result = converter.convert(path)
    # Newer MarkItDown exposes `.markdown`; older only `.text_content`.
    return getattr(result, "markdown", None) or result.text_content or ""


def _run_docling(path: str) -> str:
    """Fallback path: layout-aware, renders tables. Heavy import (torch).

    Docling and its deps (RapidOCR, transformers, HF hub) log freely to stderr;
    quiet them so stdout stays the sole channel for our JSON result and stderr
    buffers stay bounded on large documents. On a fresh machine Docling may
    download layout/OCR model weights on first use (needs network once).
    """
    global _docling_converter
    import logging

    logging.getLogger().setLevel(logging.ERROR)
    for name in ("docling", "transformers", "RapidOCR", "huggingface_hub"):
        logging.getLogger(name).setLevel(logging.ERROR)

    with _docling_lock:
        if _docling_converter is None:
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions
            from docling.document_converter import DocumentConverter, PdfFormatOption

            # OCR off: digital PDFs don't need it, and the OCR models (RapidOCR) add significant
            # memory. Layout + table-structure recognition (why we use Docling) still run.
            # Scanned/image-only PDFs won't get text extracted — an acceptable v1 tradeoff.
            pdf_opts = PdfPipelineOptions()
            pdf_opts.do_ocr = False
            _docling_converter = DocumentConverter(
                format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)}
            )
        result = _docling_converter.convert(path)
    return result.document.export_to_markdown() or ""


def convert(data: bytes, filename: str, mode: str) -> dict:
    """Convert document bytes to markdown. Returns the result dict."""
    ext = _extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f'Unsupported file type ".{ext}". Only PDF and .docx are supported.'
        )

    warnings: list[str] = []

    # Both parsers take a file path; persist stdin bytes to a temp file with the
    # right suffix so the parsers can sniff the format.
    fd, tmp_path = tempfile.mkstemp(suffix=f".{ext}")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)

        if mode == "docling":
            return {"markdown": _run_docling(tmp_path), "parser": "docling", "warnings": warnings}

        if mode == "markitdown":
            return {"markdown": _run_markitdown(tmp_path), "parser": "markitdown", "warnings": warnings}

        # auto: MarkItDown first, Docling fallback on error / low yield.
        markdown = ""
        try:
            markdown = _run_markitdown(tmp_path)
        except Exception as exc:  # noqa: BLE001 — any MarkItDown failure → try Docling
            warnings.append(f"MarkItDown failed ({exc}); falling back to Docling.")

        if _usable_chars(markdown) >= MIN_USABLE_CHARS:
            return {"markdown": markdown, "parser": "markitdown", "warnings": warnings}

        if not warnings:
            warnings.append(
                "MarkItDown produced little usable text; falling back to Docling "
                "(likely tables/multi-column or a scanned PDF)."
            )
        docling_markdown = _run_docling(tmp_path)
        # If Docling also comes back near-empty, return the better of the two
        # rather than nothing, so the caller can surface a clear error.
        if _usable_chars(docling_markdown) < _usable_chars(markdown):
            return {"markdown": markdown, "parser": "markitdown", "warnings": warnings}
        return {"markdown": docling_markdown, "parser": "docling", "warnings": warnings}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert document bytes (stdin) to markdown.")
    parser.add_argument("--filename", required=True, help="Original filename (used to infer type).")
    parser.add_argument(
        "--mode",
        choices=["auto", "markitdown", "docling"],
        default="auto",
        help="Parser selection strategy.",
    )
    args = parser.parse_args()

    data = sys.stdin.buffer.read()
    if not data:
        print(json.dumps({"error": "No document bytes received on stdin."}))
        return 1

    try:
        result = convert(data, args.filename, args.mode)
    except Exception as exc:  # noqa: BLE001 — report any failure as structured JSON
        print(json.dumps({"error": str(exc)}))
        return 1

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
