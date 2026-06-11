"use client";

import { useActionState, useState } from "react";
import { generateFromText, generateFromFile } from "./actions";

type GenState = { error: string } | null;

export default function NewPage() {
  const [mode, setMode] = useState<"paste" | "upload">("paste");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">New cards</h1>
        <p className="text-sm text-neutral-500">
          Paste text, or upload a PDF or Word document. We&apos;ll generate atomic
          cards for you to review.
        </p>
      </div>

      <div className="inline-flex rounded border p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`rounded px-3 py-1 ${mode === "paste" ? "bg-black text-white" : "text-neutral-600"}`}
        >
          Paste text
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`rounded px-3 py-1 ${mode === "upload" ? "bg-black text-white" : "text-neutral-600"}`}
        >
          Upload file
        </button>
      </div>

      {mode === "paste" ? <PasteForm /> : <UploadForm />}
    </div>
  );
}

function PasteForm() {
  const [state, action, pending] = useActionState<GenState, FormData>(
    generateFromText,
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="text"
        required
        rows={14}
        placeholder="Paste your material here…"
        className="w-full rounded border p-3 font-mono text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Generating… (~20s)" : "Generate cards"}
      </button>
    </form>
  );
}

function UploadForm() {
  const [state, action, pending] = useActionState<GenState, FormData>(
    generateFromFile,
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <input
        type="file"
        name="file"
        required
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="block w-full rounded border p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-neutral-100 file:px-3 file:py-1"
      />
      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" name="complex" value="1" />
        Complex layout (tables / multiple columns) — use the thorough parser
      </label>
      <p className="text-xs text-neutral-400">PDF or .docx, up to 25 MB.</p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Parsing & generating…" : "Upload & generate cards"}
      </button>
    </form>
  );
}
