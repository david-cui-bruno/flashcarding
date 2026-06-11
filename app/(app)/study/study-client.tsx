"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { gradeCard, flagBadCard } from "./actions";
import { isLeech } from "@/lib/scheduling/leech";

export type StudyCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
  prompt_direction: "definition_to_term" | "term_to_definition";
  lapses: number;
  fsrs_state: "new" | "learning" | "review" | "relearning";
};

type Mode = "scheduled" | "cram";

// 1–4 Anki grades. Colour runs cold→warm so the keys are learnable at a glance.
const GRADES = [
  { g: 1, label: "Again", cls: "border-red-300 text-red-700 hover:bg-red-50" },
  { g: 2, label: "Hard", cls: "border-orange-300 text-orange-700 hover:bg-orange-50" },
  { g: 3, label: "Good", cls: "border-green-300 text-green-700 hover:bg-green-50" },
  { g: 4, label: "Easy", cls: "border-blue-300 text-blue-700 hover:bg-blue-50" },
] as const;

const STATE_LABEL: Record<StudyCard["fsrs_state"], string> = {
  new: "New",
  learning: "Learning",
  review: "Review",
  relearning: "Relearning",
};

// Default direction is fact → term (docs/CARD-QUALITY.md): prompt with the definition,
// recall the term. A per-card flip (term_to_definition) shows the term and recalls the fact.
function faces(card: StudyCard): { prompt: string; answer: string } {
  return card.prompt_direction === "term_to_definition"
    ? { prompt: card.term, answer: card.definition }
    : { prompt: card.definition, answer: card.term };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ModeTabs({ mode }: { mode: Mode }) {
  const tab = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition ${
      active ? "bg-black text-white" : "border text-neutral-600 hover:text-black"
    }`;
  return (
    <div className="flex gap-2">
      <Link href="/study" className={tab(mode === "scheduled")}>
        Due today
      </Link>
      <Link href="/study?mode=cram" className={tab(mode === "cram")}>
        Cram
      </Link>
    </div>
  );
}

export function StudyClient({ cards, mode }: { cards: StudyCard[]; mode: Mode }) {
  // Cram is a free pass over the deck — shuffle once so repeat sessions vary. Scheduled
  // keeps FSRS's due-order. Either way the queue is fixed for the life of the session.
  const queue = useMemo(() => (mode === "cram" ? shuffle(cards) : cards), [cards, mode]);

  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [flagged, setFlagged] = useState(false);

  const card = i < queue.length ? queue[i] : null;
  const leech = card ? isLeech(card) : false;

  const advance = useCallback(() => {
    setShown(false);
    setFlagged(false);
    setI((n) => n + 1);
  }, []);

  const grade = useCallback(
    async (g: 1 | 2 | 3 | 4) => {
      if (!card || busy) return;
      setBusy(true);
      // In cram this records the review but never reschedules (docs/SCHEDULING.md).
      await gradeCard(card.id, g, mode);
      setReviewed((n) => n + 1);
      setBusy(false);
      advance();
    },
    [card, busy, mode, advance],
  );

  const flagBad = useCallback(async () => {
    if (!card || busy) return;
    setBusy(true);
    await flagBadCard(card.id);
    setBusy(false);
    advance();
  }, [card, busy, advance]);

  // Anki controls: space flips, 1–4 grade once the answer is shown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.code === "Space") {
        e.preventDefault();
        setShown((s) => !s);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        void grade(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, grade]);

  if (!card) {
    return (
      <div className="space-y-4">
        <ModeTabs mode={mode} />
        <div className="rounded border p-6 text-center">
          <p className="text-lg">Done for now 🎉</p>
          <p className="mt-1 text-sm text-neutral-500">
            {reviewed} card{reviewed === 1 ? "" : "s"} reviewed
            {mode === "cram" ? " · schedule untouched" : ""}.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          {mode === "scheduled" ? (
            <Link href="/study?mode=cram" className="underline">
              Cram more
            </Link>
          ) : (
            <Link href="/study" className="underline">
              Back to due cards
            </Link>
          )}
          <Link href="/library" className="underline">
            Library
          </Link>
        </div>
      </div>
    );
  }

  const { prompt, answer } = faces(card);
  const progress = Math.round((i / queue.length) * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <ModeTabs mode={mode} />
        <span className="text-sm text-neutral-500">
          {i + 1} / {queue.length}
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full bg-black transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {leech && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ You&rsquo;ve missed this {card.lapses} times. Leeches are usually a sign the{" "}
          <em>card</em> is the problem — ambiguous, miscued, or wrong.{" "}
          <button
            onClick={flagBad}
            disabled={busy}
            className="font-medium underline disabled:opacity-50"
          >
            Flag as a bad card
          </button>
          .
        </div>
      )}

      <div className="min-h-40 rounded-lg border p-6 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-xs text-neutral-400">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">
            {STATE_LABEL[card.fsrs_state]}
          </span>
          {mode === "cram" && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5">
              won&rsquo;t reschedule
            </span>
          )}
        </div>
        <div className="text-lg">{prompt}</div>
        {shown && (
          <div className="mt-4 border-t pt-4 text-xl font-semibold">{answer}</div>
        )}
        {shown && card.source_span && (
          <div className="mt-4 border-l-2 pl-3 text-left text-sm text-neutral-400">
            &ldquo;{card.source_span}&rdquo;
          </div>
        )}
      </div>

      {!shown ? (
        <button
          onClick={() => setShown(true)}
          className="w-full rounded bg-black py-2.5 text-white"
        >
          Show answer{" "}
          <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-xs">space</kbd>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {GRADES.map(({ g, label, cls }) => (
              <button
                key={g}
                disabled={busy}
                onClick={() => grade(g as 1 | 2 | 3 | 4)}
                className={`flex flex-col items-center rounded border py-2 text-sm disabled:opacity-50 ${cls}`}
              >
                <span className="font-medium">{label}</span>
                <span className="text-xs opacity-60">{g}</span>
              </button>
            ))}
          </div>
          {!leech && !flagged && (
            <button
              onClick={() => setFlagged(true)}
              disabled={busy}
              className="text-xs text-neutral-400 underline hover:text-neutral-600 disabled:opacity-50"
            >
              ⚑ This card is bad
            </button>
          )}
          {!leech && flagged && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-neutral-500">Flag this card as bad and skip it?</span>
              <button
                onClick={flagBad}
                disabled={busy}
                className="font-medium text-red-600 underline disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setFlagged(false)}
                disabled={busy}
                className="text-neutral-400 underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
