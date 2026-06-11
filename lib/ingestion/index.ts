// Document ingestion adapter: the TypeScript boundary over the Python sidecar
// (services/ingestion-py). Contract: (bytes, filename) -> { markdown }. The
// resulting markdown becomes `sources.content` and feeds the *same* generation
// path that pasted text uses (docs/PIPELINE.md stage 0).
//
// Server-only: this spawns a child process and must never be bundled into the
// client. It is imported only from server actions.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type ParserName = "markitdown" | "docling";
export type ParseMode = "auto" | "markitdown" | "docling";

export type ParseResult = {
  markdown: string;
  /** Which parser produced the markdown (fast path vs. fallback). */
  parser: ParserName;
  /** Non-fatal notes, e.g. "fell back to Docling". */
  warnings: string[];
};

/** File extensions the sidecar can convert. Mirrors source_kind pdf/docx. */
export const SUPPORTED_EXTENSIONS = ["pdf", "docx"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

const DEFAULT_TIMEOUT_MS = 120_000;

// Resolved lazily (not at module scope) so the bundler's file tracer doesn't
// follow process.cwd() and over-trace the project. Path is scoped to the
// services/ subfolder.
function serviceDir(): string {
  return path.join(process.cwd(), "services", "ingestion-py");
}
function scriptPath(): string {
  return path.join(serviceDir(), "ingest.py");
}

/** Lowercased extension without the dot (e.g. "pdf"), or "" if none. */
export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function isSupported(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/**
 * Resolve the Python interpreter that has the sidecar's deps installed.
 * Prefers the uv-managed venv; overridable via INGESTION_PYTHON; falls back to
 * `python3` on PATH (which will fail loudly if deps are missing).
 */
function resolvePython(): string {
  if (process.env.INGESTION_PYTHON) return process.env.INGESTION_PYTHON;
  const venvPython = path.join(serviceDir(), ".venv", "bin", "python");
  if (existsSync(venvPython)) return venvPython;
  return "python3";
}

/**
 * Convert document bytes to clean markdown. Two interchangeable backends, same contract:
 *  - INGESTION_SERVICE_URL set → POST to the deployed ingestion service
 *    (services/ingestion-py on e.g. Railway). Production path.
 *  - otherwise → spawn the local Python CLI (needs `uv sync` in services/ingestion-py).
 *    Dev path.
 *
 * @throws if the file type is unsupported, the backend can't be reached/started, it
 *         times out, or parsing fails. Callers (server actions) translate these into
 *         user-facing messages.
 */
export async function parseToMarkdown(
  bytes: Buffer | Uint8Array,
  filename: string,
  opts: { mode?: ParseMode; timeoutMs?: number } = {},
): Promise<ParseResult> {
  const ext = extensionOf(filename);
  if (!isSupported(filename)) {
    throw new Error(`Unsupported file type ".${ext}". Upload a PDF or .docx file.`);
  }

  const mode: ParseMode = opts.mode ?? "auto";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (process.env.INGESTION_SERVICE_URL) {
    return parseViaService(bytes, filename, mode, timeoutMs);
  }
  return parseViaSubprocess(bytes, filename, mode, timeoutMs);
}

/** Production path: call the deployed ingestion HTTP service (e.g. Railway). */
async function parseViaService(
  bytes: Buffer | Uint8Array,
  filename: string,
  mode: ParseMode,
  timeoutMs: number,
): Promise<ParseResult> {
  const base = process.env.INGESTION_SERVICE_URL!.replace(/\/+$/, "");
  const token = process.env.INGESTION_SERVICE_TOKEN;

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)]), filename);
  form.append("mode", mode);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${base}/ingest`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    const reason =
      e instanceof Error && e.name === "AbortError"
        ? "timed out"
        : e instanceof Error
          ? e.message
          : "unknown error";
    throw new Error(`Could not reach the ingestion service at ${base} (${reason}).`);
  } finally {
    clearTimeout(timer);
  }

  const payload = (await res.json().catch(() => null)) as
    | { markdown?: string; parser?: ParserName; warnings?: string[]; error?: string }
    | null;
  if (!res.ok || !payload || payload.error) {
    throw new Error(payload?.error ?? `Ingestion service error (HTTP ${res.status}).`);
  }
  return {
    markdown: payload.markdown ?? "",
    parser: payload.parser ?? "markitdown",
    warnings: payload.warnings ?? [],
  };
}

/** Dev path: spawn the local Python CLI (services/ingestion-py/ingest.py). */
function parseViaSubprocess(
  bytes: Buffer | Uint8Array,
  filename: string,
  mode: ParseMode,
  timeoutMs: number,
): Promise<ParseResult> {
  const python = resolvePython();

  return new Promise<ParseResult>((resolve, reject) => {
    const child = spawn(python, [scriptPath(), "--filename", filename, "--mode", mode], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => {
        child.kill("SIGKILL");
        reject(new Error("Document parsing timed out."));
      });
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => err.push(d));

    child.on("error", (e) => {
      finish(() =>
        reject(
          new Error(
            `Could not start the ingestion sidecar (${python}). ` +
              `Run \`uv sync\` in services/ingestion-py. ${e.message}`,
          ),
        ),
      );
    });

    child.on("close", (code) => {
      finish(() => {
        const stdout = Buffer.concat(out).toString("utf8").trim();
        const stderr = Buffer.concat(err).toString("utf8").trim();

        let payload: { markdown?: string; parser?: ParserName; warnings?: string[]; error?: string };
        try {
          payload = JSON.parse(stdout);
        } catch {
          return reject(
            new Error(
              `Ingestion sidecar returned no valid output (exit ${code}). ` +
                (stderr ? stderr.slice(0, 500) : "No error detail."),
            ),
          );
        }

        if (code !== 0 || payload.error) {
          return reject(new Error(payload.error ?? `Ingestion failed (exit ${code}).`));
        }

        resolve({
          markdown: payload.markdown ?? "",
          parser: payload.parser ?? "markitdown",
          warnings: payload.warnings ?? [],
        });
      });
    });

    // Feed the document bytes to the sidecar over stdin.
    child.stdin.on("error", () => {
      /* the 'close'/'error' handlers above own the outcome */
    });
    child.stdin.end(Buffer.from(bytes));
  });
}
