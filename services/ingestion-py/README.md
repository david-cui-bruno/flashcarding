# Carding ingestion sidecar

Converts uploaded **PDF / `.docx`** bytes into clean markdown for the Carding
generation pipeline (docs/PIPELINE.md, stage 0). Two ways to run it, same logic
(`convert()` in `ingest.py`):

- **Local dev** — a stdin→stdout CLI the Node adapter ([`lib/ingestion/`](../../lib/ingestion))
  spawns per upload. No server to manage; "just works" given the venv below.
- **Production** — an HTTP service (`server.py`) deployed on its own (PyTorch is too
  heavy for serverless). Set `INGESTION_SERVICE_URL` and the app calls it over HTTP
  instead of spawning. See **Deploy as a service (Railway)** below.

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

## HTTP service (`server.py`)

A thin FastAPI wrapper over the same `convert()`:

```
GET  /health   -> {"status":"ok","supported":["docx","pdf"]}
POST /ingest   (multipart: file, mode)  -> {markdown, parser, warnings} | {error}
```

Auth: if `INGESTION_SERVICE_TOKEN` is set, requests must send `Authorization: Bearer <token>`.

```bash
uv run uvicorn server:app --port 8000          # run locally
curl -F file=@fixtures/tables.pdf -F mode=docling localhost:8000/ingest
```

## Deploy as a service (Railway)

The `Dockerfile` bakes the Docling model weights into the image (`prefetch_docling.py`)
so the container starts warm. `railway.json` configures the build + a `/health` check.

1. **New Railway project → Deploy from repo.** In the service settings, set **Root
   Directory** to `services/ingestion-py` (so Railway uses this folder's Dockerfile).
2. **Set a variable** `INGESTION_SERVICE_TOKEN` to a long random string. (Railway provides
   `$PORT` automatically.)
3. **Deploy.** First build is large (PyTorch + model weights, a few GB) — subsequent
   deploys are cached. The image runs `uvicorn server:app` on `$PORT`.
4. **Point the app at it** — in the Next.js app's env (e.g. Vercel):
   ```
   INGESTION_SERVICE_URL=https://<your-service>.up.railway.app
   INGESTION_SERVICE_TOKEN=<same token as above>
   ```
   With `INGESTION_SERVICE_URL` set, the app POSTs uploads to the service instead of
   spawning the local CLI — no code change.

To **drop Docling** later (much lighter image, no PyTorch): remove `docling` from
`pyproject.toml`, delete the `_run_docling` path + `prefetch_docling.py` step, and
`uv lock`. MarkItDown alone covers clean PDFs/Word docs.

## Tests / fixtures

```bash
uv run --group dev python make_fixtures.py        # writes ./fixtures/*.pdf,*.docx
uv run python ingest.py --filename fixtures/simple.pdf  < fixtures/simple.pdf
uv run python ingest.py --filename fixtures/tables.pdf  < fixtures/tables.pdf
uv run python ingest.py --filename fixtures/simple.docx < fixtures/simple.docx
```
