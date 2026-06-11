"use client";

import { useActionState } from "react";
import { generateFromText } from "./actions";

type GenState = { error: string } | null;

export default function NewPage() {
  const [state, action, pending] = useActionState<GenState, FormData>(
    generateFromText,
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <h1 className="text-xl font-semibold">New cards</h1>
      <p className="text-sm text-neutral-500">
        Paste text or markdown. We&apos;ll generate atomic cards in the background
        and take you to review them when they&apos;re ready.
      </p>
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
        {pending ? "Submitting…" : "Generate cards"}
      </button>
    </form>
  );
}
