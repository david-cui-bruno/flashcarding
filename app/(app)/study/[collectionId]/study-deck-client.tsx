"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Flag, Volume2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
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
  audio_path: string | null;
};

type Mode = "scheduled" | "cram";

const GRADES = [
  { g: 1, label: "Again", key: "again", cls: "hover:bg-[#fff5f8] hover:border-[#fbcfe0]", int: "text-learning" },
  { g: 2, label: "Hard", key: "hard", cls: "hover:bg-[#fffaf0] hover:border-[#fde2b8]", int: "text-warning" },
  { g: 3, label: "Good", key: "good", cls: "hover:bg-[#f3fbf6] hover:border-[#bbf7d0]", int: "text-due" },
  { g: 4, label: "Easy", key: "easy", cls: "hover:bg-[#f3f8ff] hover:border-[#bfdbfe]", int: "text-new" },
] as const;

// Default direction is fact → term (docs/CARD-QUALITY.md). `flipped` swaps the whole
// session's front/back (e.g. study English → recall the Chinese).
function faces(card: StudyCard, flipped: boolean): { prompt: string; answer: string } {
  const base =
    card.prompt_direction === "term_to_definition"
      ? { prompt: card.term, answer: card.definition }
      : { prompt: card.definition, answer: card.term };
  return flipped ? { prompt: base.answer, answer: base.prompt } : base;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Order the scheduled queue like Anki (docs/SCHEDULING.md: "copies modern Anki"): a
// learning/relearning card whose step has elapsed (due ≤ now) comes FIRST, then new/review
// cards in due order, then learning cards still waiting out their step. Re-applied on every
// grade, so a failed card resurfaces the moment its 1m/10m step is up — interleaved among
// new cards, not buried behind the whole pile. (New cards carry past/now due times that
// would otherwise sort a just-failed card, due in the near future, to the very end.)
function prioritize(cards: StudyCard[], nowMs: number): StudyCard[] {
  const group = (c: StudyCard) => {
    const learning = c.fsrs_state === "learning" || c.fsrs_state === "relearning";
    if (learning && Date.parse(c.due) <= nowMs) return 0;
    if (!learning) return 1;
    return 2;
  };
  return [...cards].sort((a, b) => group(a) - group(b) || Date.parse(a.due) - Date.parse(b.due));
}

// A card face. A second line (e.g. pinyin under the hanzi, joined with "\n" at import)
// renders smaller + muted so the primary line stays the focus.
function Face({ text, emphasis }: { text: string; emphasis?: boolean }) {
  const [primary, ...rest] = text.split("\n");
  return (
    <>
      <p className={cn("text-2xl leading-relaxed", emphasis && "font-semibold leading-snug")}>{primary}</p>
      {rest.length > 0 && <p className="mt-1.5 text-lg text-muted-foreground">{rest.join(" ")}</p>}
    </>
  );
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
    mode === "cram" ? shuffle(cards) : prioritize(cards, Date.now()),
  );
  const [shown, setShown] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");

  // Flip the whole session's front/back, persisted per deck. Audio stays on the revealed
  // side (it's the Chinese pronunciation — useful whichever way you study).
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(`dory-flip-${deckId}`) === "1") setFlipped(true);
    } catch {}
  }, [deckId]);
  const toggleFlip = useCallback(() => {
    setFlipped((f) => {
      const next = !f;
      try {
        localStorage.setItem(`dory-flip-${deckId}`, next ? "1" : "0");
      } catch {}
      return next;
    });
    setShown(false);
  }, [deckId]);

  // Anki-style end-of-session rest: when only not-yet-due learning cards remain, don't drill
  // them early — show a "next card in ~Xm" screen with a live countdown. The user can opt into
  // learn-ahead ("Study ahead now") to power through; otherwise no back-to-back repeat.
  const [learnAhead, setLearnAhead] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const card = queue[0] ?? null;
  const leech = card ? isLeech(card) : false;

  // prioritize() puts every available card ahead of not-yet-due learning cards, so if the head
  // is a future-due learning card, nothing is available now → rest instead of repeating.
  const cardDueMs = card ? Date.parse(card.due) : 0;
  const cardLearning = !!card && (card.fsrs_state === "learning" || card.fsrs_state === "relearning");
  const waitingForStep = mode === "scheduled" && cardLearning && cardDueMs > Date.now() && !learnAhead;

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

  // Preload the current card's audio — mint the signed URL and start buffering the moment
  // the card appears (while you read the front) — so pressing Play is instant instead of
  // waiting on two round-trips (sign + download). Replayable from the start each press.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioElRef.current?.pause();
    audioElRef.current = null;
    const path = card?.audio_path;
    if (!path) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase.storage
      .from("card-audio")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        const a = new Audio(data.signedUrl);
        a.preload = "auto";
        a.load();
        audioElRef.current = a;
      });
    return () => {
      cancelled = true;
      audioElRef.current?.pause(); // stop playback when leaving the card / unmounting
    };
  }, [card?.id, card?.audio_path]);

  const playAudio = useCallback(async () => {
    const path = card?.audio_path;
    if (!path) return;
    // Usually preloaded; if Play is pressed before the preload resolved, load on demand.
    if (!audioElRef.current) {
      const supabase = createClient();
      const { data } = await supabase.storage.from("card-audio").createSignedUrl(path, 3600);
      if (!audioElRef.current && data?.signedUrl) audioElRef.current = new Audio(data.signedUrl);
    }
    const a = audioElRef.current;
    if (!a) {
      toast.error("Couldn't load audio.");
      return;
    }
    a.currentTime = 0;
    void a.play().catch(() => toast.error("Couldn't play audio."));
  }, [card?.id, card?.audio_path]);

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
          // Graduated to a multi-day review → done this session. Otherwise re-queue and
          // re-order by Anki rules so it returns when its learning step elapses.
          const next = updated.fsrs_state === "review" ? tail : [...tail, updated];
          return prioritize(next, Date.now());
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
      if (!card || flagging || waitingForStep) return;
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
  }, [card, shown, flagging, waitingForStep, grade]);

  // While resting, tick once a second so the countdown updates and the card auto-appears the
  // moment its step elapses (cardDueMs <= now → waitingForStep flips false → main render).
  useEffect(() => {
    if (!waitingForStep) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waitingForStep]);

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

  if (waitingForStep) {
    const secs = Math.max(0, Math.ceil((cardDueMs - nowTick) / 1000));
    const eta = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl font-medium">Done for now 🎉</p>
        <p className="text-sm text-muted-foreground">
          {triplet.learning} card{triplet.learning === 1 ? "" : "s"} still learning — next one ready in{" "}
          <span className="font-semibold tabular-nums text-foreground">{eta}</span>.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLearnAhead(true)}>
            Study ahead now
          </Button>
          <Button asChild>
            <Link href="/library">Back to decks</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { prompt, answer } = faces(card, flipped);

  return (
    <div className="flex flex-1 flex-col">
      {/* flip front/back for the whole session (persisted per deck) */}
      <button
        onClick={toggleFlip}
        aria-pressed={flipped}
        title="Flip front / back"
        className={cn(
          "fixed bottom-5 right-5 z-10 flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[0.78rem] font-medium shadow-sm transition-colors hover:bg-muted",
          flipped && "border-primary/50 text-primary",
        )}
      >
        <ArrowLeftRight className="size-4" />
        Flip
      </button>
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
          <Face text={prompt} />
          {shown && (
            <>
              <hr className="mx-auto my-6 w-24 border-border" />
              <Face text={answer} emphasis />
              {card.audio_path && (
                <Button variant="outline" size="sm" className="mt-5" onClick={playAudio}>
                  <Volume2 className="size-4" />
                  Play
                </Button>
              )}
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
