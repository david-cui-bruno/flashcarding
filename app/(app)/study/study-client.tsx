"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { gradeCard, flagBadCard } from "./actions";

type DueCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
};

const LABELS = ["", "Again", "Hard", "Good", "Easy"];

export function StudyClient({ cards }: { cards: DueCard[] }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");

  const card = i < cards.length ? cards[i] : null;

  const advance = useCallback(() => {
    setShown(false);
    setFlagging(false);
    setReason("");
    setI((n) => n + 1);
  }, []);

  const grade = useCallback(
    async (g: 1 | 2 | 3 | 4) => {
      if (!card || busy) return;
      setBusy(true);
      await gradeCard(card.id, g);
      setBusy(false);
      advance();
    },
    [card, busy, advance],
  );

  const flagBad = async () => {
    if (!card || busy) return;
    setBusy(true);
    await flagBadCard(card.id, reason);
    setBusy(false);
    advance();
  };

  // Anki-style controls: space flips, 1–4 grade once the answer is shown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.code === "Space") {
        e.preventDefault();
        setShown((s) => !s);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        void grade(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, grade]);

  if (!card) {
    return (
      <div className="space-y-3">
        <p>Done for now 🎉</p>
        <Link href="/library" className="underline">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500">
        {i + 1} / {cards.length} · space to flip · 1–4 to grade
      </p>
      {/* Default direction is fact → term (docs/CARD-QUALITY.md): the definition is the prompt. */}
      <div className="min-h-40 rounded border p-6 text-center">
        <div className="text-lg">{card.definition}</div>
        {shown && (
          <div className="mt-4 border-t pt-4 text-xl font-semibold">{card.term}</div>
        )}
      </div>
      {!shown ? (
        <button
          onClick={() => setShown(true)}
          className="w-full rounded bg-black py-2 text-white"
        >
          Show answer (space)
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((g) => (
            <button
              key={g}
              disabled={busy}
              onClick={() => grade(g as 1 | 2 | 3 | 4)}
              className="rounded border py-2 text-sm disabled:opacity-50"
            >
              {g}. {LABELS[g]}
            </button>
          ))}
        </div>
      )}

      {/* "This card is bad" — removes the card and feeds the loop (docs/METRICS.md). */}
      {flagging ? (
        <div className="space-y-2 rounded border border-red-200 p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What's wrong with it? (optional — feeds the generator)"
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={flagBad}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Remove this card
            </button>
            <button
              disabled={busy}
              onClick={() => setFlagging(false)}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setFlagging(true)}
          className="text-xs text-neutral-400 underline hover:text-red-600 disabled:opacity-50"
        >
          ⚠ This card is bad
        </button>
      )}
    </div>
  );
}
