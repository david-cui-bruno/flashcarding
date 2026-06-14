"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { schedule, previewIntervals } from "@/lib/scheduling/fsrs";
import { isLeech } from "@/lib/scheduling/leech";
import { gradeCard, flagBadCard } from "../actions";

// Full FSRS state travels to the client so the session can run the scheduler locally
// (docs/SCHEDULING.md: FSRS is client-side) — for live interval previews and, crucially,
// to re-queue a card that's still in a learning/relearning step so it reappears this
// session (Anki-style learning steps).
export type StudyCard = {
  id: string;
  term: string;
  definition: string;
  prompt_direction: "definition_to_term" | "term_to_definition";
  lapses: number;
  fsrs_state: "new" | "learning" | "review" | "relearning";
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  last_review: string | null;
  learning_steps: number;
};

type Mode = "scheduled" | "cram";

const GRADES = [
  { g: 1, label: "Again", key: "again", cls: "hover:bg-[#fff5f8] hover:border-[#fbcfe0]", int: "text-learning" },
  { g: 2, label: "Hard", key: "hard", cls: "hover:bg-[#fffaf0] hover:border-[#fde2b8]", int: "text-warning" },
  { g: 3, label: "Good", key: "good", cls: "hover:bg-[#f3fbf6] hover:border-[#bbf7d0]", int: "text-due" },
  { g: 4, label: "Easy", key: "easy", cls: "hover:bg-[#f3f8ff] hover:border-[#bfdbfe]", int: "text-new" },
] as const;

// Default direction is fact → term (docs/CARD-QUALITY.md).
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

export function StudyDeckClient({
  deckId,
  name,
  cards,
  mode,
}: {
  deckId: string;
  name: string;
  cards: StudyCard[];
  mode: Mode;
}) {
  // The session queue. Cram = a fixed shuffled pass (no rescheduling). Scheduled =
  // a live queue ordered by due; the head is the current card, and a graded card is
  // either dropped (graduated to a multi-day review) or re-inserted in due order
  // (still in a short learning/relearning step → seen again this session).
  const [queue, setQueue] = useState<StudyCard[]>(() =>
    mode === "cram" ? shuffle(cards) : [...cards].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)),
  );
  const [shown, setShown] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");

  const card = queue[0] ?? null;
  const leech = card ? isLeech(card) : false;

  // New / learning / due across what's left in the session — behaves like Anki's
  // bottom counts: New falls as you study new cards, Learning rises on Again, Due
  // falls as review cards clear.
  const triplet = useMemo(() => {
    let nw = 0,
      learning = 0,
      due = 0;
    for (const c of queue) {
      if (c.fsrs_state === "new") nw++;
      else if (c.fsrs_state === "learning" || c.fsrs_state === "relearning") learning++;
      else due++;
    }
    return { nw, learning, due };
  }, [queue]);

  // Live interval previews for the current card (cram never reschedules → no previews).
  const intervals = useMemo(
    () => (card && mode === "scheduled" ? previewIntervals(card) : null),
    [card, mode],
  );

  const resetCardUi = useCallback(() => {
    setShown(false);
    setFlagging(false);
    setReason("");
  }, []);

  // Optimistic + client-scheduled: compute the next state locally (instant, no round
  // trip), update the queue, and persist in the background. A failed write is rare and
  // non-fatal (that card just isn't rescheduled), so we only toast.
  const grade = useCallback(
    (g: 1 | 2 | 3 | 4) => {
      const cur = queue[0];
      if (!cur) return;

      if (mode === "cram") {
        void gradeCard(cur.id, g, "cram").catch(() => toast.error("Couldn't save that review."));
        setQueue((q) => q.slice(1));
      } else {
        const u = schedule(cur, g);
        void gradeCard(cur.id, g, "scheduled", u).catch(() =>
          toast.error("Couldn't save that review — it may not be rescheduled."),
        );
        const updated: StudyCard = {
          ...cur,
          due: u.due,
          stability: u.stability,
          difficulty: u.difficulty,
          elapsed_days: u.elapsed_days,
          scheduled_days: u.scheduled_days,
          reps: u.reps,
          lapses: u.lapses,
          fsrs_state: u.fsrs_state,
          last_review: u.last_review,
          learning_steps: u.learning_steps,
        };
        setQueue((q) => {
          const tail = q.slice(1);
          if (updated.fsrs_state === "review") return tail; // graduated → done this session
          const idx = tail.findIndex((c) => c.due > updated.due);
          if (idx === -1) tail.push(updated);
          else tail.splice(idx, 0, updated);
          return tail;
        });
      }

      setReviewed((n) => n + 1);
      resetCardUi();
    },
    [queue, mode, resetCardUi],
  );

  const flagBad = useCallback(() => {
    const cur = queue[0];
    if (!cur) return;
    void flagBadCard(cur.id, reason).catch(() => toast.error("Couldn't remove that card."));
    setQueue((q) => q.slice(1));
    resetCardUi();
  }, [queue, reason, resetCardUi]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || flagging) return;
      if (e.code === "Space") {
        e.preventDefault();
        setShown((s) => !s);
      } else if (shown && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, flagging, grade]);

  if (!card) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl font-medium">Done for now 🎉</p>
        <p className="text-sm text-muted-foreground">
          {reviewed} card{reviewed === 1 ? "" : "s"} reviewed
          {mode === "cram" ? " · schedule untouched" : ""}.
        </p>
        <div className="flex gap-2">
          {mode === "scheduled" ? (
            <Button asChild variant="outline">
              <Link href={`/study/${deckId}?mode=cram`}>Cram more</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/library">Back to decks</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { prompt, answer } = faces(card);

  return (
    <div className="flex flex-1 flex-col">
      {/* content anchored toward the top, plain text, no card */}
      <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
        <div className="w-full max-w-[620px]">
          {leech && (
            <div className="mb-6 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-left text-sm text-warning">
              You&rsquo;ve missed this {card.lapses} times — leeches are usually a sign the{" "}
              <em>card</em> is the problem.{" "}
              <button onClick={() => setFlagging(true)} className="font-medium underline">
                Flag it
              </button>
              .
            </div>
          )}
          <p className="text-2xl leading-relaxed">{prompt}</p>
          {shown && (
            <>
              <hr className="mx-auto my-6 w-24 border-border" />
              <p className="text-2xl font-semibold leading-snug">{answer}</p>
            </>
          )}
        </div>
      </div>

      {/* bottom controls */}
      <div className="flex flex-col items-center gap-4 px-6 pb-8">
        {!shown ? (
          <Button size="lg" className="min-w-52" onClick={() => setShown(true)}>
            Show answer
            <kbd className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[0.7rem] font-semibold">space</kbd>
          </Button>
        ) : (
          <div className="flex justify-center gap-2.5">
            {GRADES.map(({ g, label, key, cls, int }) => (
              <button
                key={g}
                onClick={() => grade(g as 1 | 2 | 3 | 4)}
                className={cn(
                  "flex min-w-[78px] flex-col items-center gap-0.5 rounded-md border border-border bg-card px-3 pb-1.5 pt-2 transition-colors md:min-w-[86px]",
                  cls,
                )}
              >
                {intervals && (
                  <span className={cn("text-[0.68rem] font-semibold tabular-nums", int)}>
                    {intervals[key]}
                  </span>
                )}
                <span className="text-[0.82rem] font-semibold leading-none">{label}</span>
                <span className="text-[0.6rem] text-muted-foreground">{g}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[1.05rem] font-semibold tabular-nums">
            <span className="text-new">{triplet.nw}</span>
            <span className="mx-1 font-normal text-muted-foreground">+</span>
            <span className="text-learning">{triplet.learning}</span>
            <span className="mx-1 font-normal text-muted-foreground">+</span>
            <span className="text-due">{triplet.due}</span>
          </div>
          <div className="text-[0.62rem] tracking-wide text-muted-foreground">new · learning · due</div>
        </div>

        {flagging ? (
          <div className="w-full max-w-md space-y-2 rounded-lg border border-destructive/30 p-3">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="What's wrong with it? (optional — feeds the generator)"
            />
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={flagBad}>
                Remove this card
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFlagging(false);
                  setReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setFlagging(true)}
            className="flex items-center gap-1.5 text-[0.74rem] text-muted-foreground transition-colors hover:text-destructive"
          >
            <Flag className="size-[13px]" />
            this card is bad
          </button>
        )}
      </div>
    </div>
  );
}
