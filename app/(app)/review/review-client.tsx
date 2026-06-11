"use client";

import { useState } from "react";
import Link from "next/link";
import { keepCard, rejectCard, editCard } from "./actions";

type PendingCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
};

export function ReviewClient({ cards }: { cards: PendingCard[] }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [reason, setReason] = useState("");

  if (i >= cards.length) {
    return (
      <div className="space-y-3">
        <p>All reviewed 🎉</p>
        <Link href="/study" className="underline">
          Study now
        </Link>
      </div>
    );
  }

  const card = cards[i];
  const advance = () => {
    setMode("view");
    setReason("");
    setI((n) => n + 1);
  };

  const keep = async () => {
    setBusy(true);
    await keepCard(card.id);
    setBusy(false);
    advance();
  };
  const reject = async () => {
    setBusy(true);
    await rejectCard(card.id, reason);
    setBusy(false);
    advance();
  };
  const saveEdit = async () => {
    setBusy(true);
    await editCard(card.id, term, definition);
    setBusy(false);
    advance();
  };
  const startEdit = () => {
    setTerm(card.term);
    setDefinition(card.definition);
    setMode("edit");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        {i + 1} / {cards.length}
      </p>

      {mode === "edit" ? (
        <div className="space-y-2 rounded border p-4">
          <label className="block text-xs text-neutral-500">Term</label>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full rounded border px-2 py-1"
          />
          <label className="block text-xs text-neutral-500">Definition</label>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={3}
            className="w-full rounded border px-2 py-1"
          />
          <div className="flex gap-2 pt-2">
            <button
              disabled={busy}
              onClick={saveEdit}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Save &amp; keep
            </button>
            <button
              disabled={busy}
              onClick={() => setMode("view")}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded border p-4">
          <div className="text-lg font-medium">{card.term}</div>
          <div className="mt-1">{card.definition}</div>
          {card.source_span && (
            <div className="mt-3 border-l-2 pl-3 text-sm text-neutral-500">
              &ldquo;{card.source_span}&rdquo;
            </div>
          )}
        </div>
      )}

      {mode === "reject" ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What was wrong? (optional)"
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={reject}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              disabled={busy}
              onClick={() => setMode("view")}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : mode === "view" ? (
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={keep}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Keep
          </button>
          <button
            disabled={busy}
            onClick={startEdit}
            className="rounded border px-4 py-2 text-sm"
          >
            Edit
          </button>
          <button
            disabled={busy}
            onClick={() => setMode("reject")}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600"
          >
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
