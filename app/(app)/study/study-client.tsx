"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { gradeCard, toggleFlag } from "./actions";
import { CardEditDialog } from "./card-edit-dialog";

type DueCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
  collection_id: string;
  flagged: boolean;
};

const LABELS = ["", "Again", "Hard", "Good", "Easy"];

export function StudyClient({ cards }: { cards: DueCard[] }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Local flag state so toggling is instant without a full re-render
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(cards.map((c) => [c.id, c.flagged])),
  );

  const card = i < cards.length ? cards[i] : null;

  const grade = useCallback(
    async (g: 1 | 2 | 3 | 4) => {
      if (!card || busy) return;
      setBusy(true);
      await gradeCard(card.id, g);
      setBusy(false);
      setShown(false);
      setEditOpen(false);
      setI((n: number) => n + 1);
    },
    [card, busy],
  );

  const handleFlag = useCallback(async () => {
    if (!card || busy) return;
    setBusy(true);
    const result = await toggleFlag(card.id);
    setFlagged((prev) => {
      const next: Record<string, boolean> = { ...prev };
      next[card.id] = result.flagged;
      return next;
    });
    setBusy(false);
  }, [card, busy]);

  // Anki-style controls: space flips, 1–4 grade once the answer is shown.
  // e opens the edit dialog, f toggles flag.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || editOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        setShown((s) => !s);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        void grade(Number(e.key) as 1 | 2 | 3 | 4);
      } else if (e.key === "e" && shown) {
        setEditOpen(true);
      } else if (e.key === "f" && shown) {
        void handleFlag();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, grade, editOpen, handleFlag]);

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

  const isCardFlagged = flagged[card.id] ?? card.flagged;

  return (
    <>
      {editOpen && (
        <CardEditDialog
          card={card}
          onClose={() => setEditOpen(false)}
        />
      )}

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
          <>
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

            {/* Edit + flag actions — appear after answer is revealed */}
            <div className="flex gap-3 justify-end">
              <button
                disabled={busy}
                onClick={handleFlag}
                title={isCardFlagged ? "Unflag card (f)" : "Flag for later (f)"}
                className={`rounded border px-3 py-1.5 text-xs ${
                  isCardFlagged
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "text-neutral-500 hover:text-neutral-800"
                } disabled:opacity-50`}
              >
                {isCardFlagged ? "⚑ Flagged" : "⚐ Flag"}
              </button>
              <button
                disabled={busy}
                onClick={() => setEditOpen(true)}
                title="Edit card (e)"
                className="rounded border px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
              >
                ✎ Edit
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
