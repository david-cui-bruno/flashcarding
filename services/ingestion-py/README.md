# Carding ingestion sidecar

Converts uploaded **PDF / `.docx`** bytes into clean markdown for the Carding
generation pipeline (docs/PIPELINE.md, stage 0). It is a small stdin→stdout CLI
invoked by the Node adapter in [`lib/ingestion/`](../../lib/ingestion); there is
no long-running server to manage, so it "just works" whenever the Next.js app
runs (given the venv below).

## Parsers (both MIT-licensed)

- **[MarkItDown](https://github.com/microsoft/markitdown)** (Microsoft) — the fast
  path for clean, simple documents.
- **[Docling](https://github.com/DS4SD/docling)** (IBM) — the fallback for
  structurally complex documents (tables, multi-column) and for cases where
  MarkItDown extracts little/no usable text. Heavier (pulls torch); imported
  lazily and only when needed.

Chosen over AGPL `PyMuPDF4LLM` and the paid Reducto / LlamaParse APIs to keep the
productization path clean — see `docs/ARCHITECTURE.md`.

## Setup

Requires [`uv`](https://docs.astral.sh/uv/) and Python 3.12 (Docling/torch wheels
are not yet published for 3.14). `uv` will fetch 3.12 automatically.

```bash
cd services/ingestion-py
uv sync          # creates .venv with MarkItDown + Docling
```

The Node adapter auto-discovers `.venv/bin/python`. Override with the
`INGESTION_PYTHON` env var if your interpreter lives elsewhere.

> The **first Docling run** loads torch and may download layout/OCR model
> weights (needs network once), so it can take ~30–60s. Subsequent runs and the
> MarkItDown fast path are fast. The adapter's default timeout is 120s.

## Usage

```bash
# bytes in on stdin, JSON out on stdout
uv run python ingest.py --filename doc.pdf < doc.pdf
# => {"markdown": "...", "parser": "markitdown", "warnings": []}

# force a parser (skip auto-selection)
uv run python ingest.py --filename doc.pdf --mode docling < doc.pdf
```

`--mode`: `auto` (default — MarkItDown, Docling fallback), `markitdown`, `docling`.

## Tests / fixtures

```bash
uv run --group dev python make_fixtures.py        # writes ./fixtures/*.pdf,*.docx
uv run python ingest.py --filename fixtures/simple.pdf  < fixtures/simple.pdf
uv run python ingest.py --filename fixtures/tables.pdf  < fixtures/tables.pdf
uv run python ingest.py --filename fixtures/simple.docx < fixtures/simple.docx
```
