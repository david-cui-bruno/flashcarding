"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { gradeCard } from "./actions";

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

  const card = i < cards.length ? cards[i] : null;

  const grade = useCallback(
    async (g: 1 | 2 | 3 | 4) => {
      if (!card || busy) return;
      setBusy(true);
      await gradeCard(card.id, g);
      setBusy(false);
      setShown(false);
      setI((n) => n + 1);
    },
    [card, busy],
  );

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
    </div>
  );
}
