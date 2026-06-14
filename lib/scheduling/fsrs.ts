import {
  fsrs,
  generatorParameters,
  State,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { Card } from "@/lib/types/domain";

// FSRS at the 90% target retention from docs/SCHEDULING.md ("copies modern Anki").
// Short-term (re)learning steps ON, with Anki's default ladder (1m, 10m / 10m): an
// Again/Good on a new-or-lapsed card cycles it through these short steps before it
// graduates to a multi-day review interval. The study session re-queues a card while
// it's in a learning/relearning step so it reappears the same session (see
// study-deck-client.tsx). No daily new/review caps — SCHEDULING.md keeps new cards uncapped.
const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_short_term: true,
    learning_steps: ["1m", "10m"],
    relearning_steps: ["10m"],
  }),
);

const STATE_TO_NUM: Record<string, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const NUM_TO_STATE = ["new", "learning", "review", "relearning"] as const;

// Just the FSRS columns the scheduler reads — lets callers pass a column subset
// (e.g. the study queue's projection) without the full cards row.
export type SchedulableCard = Pick<
  Card,
  | "due"
  | "stability"
  | "difficulty"
  | "elapsed_days"
  | "scheduled_days"
  | "reps"
  | "lapses"
  | "fsrs_state"
  | "last_review"
  | "learning_steps"
>;

function toFsrsCard(c: SchedulableCard): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: STATE_TO_NUM[c.fsrs_state] ?? State.New,
    last_review: c.last_review ? new Date(c.last_review) : undefined,
    // Which short-term step the card is on — persisted so it graduates correctly.
    learning_steps: c.learning_steps ?? 0,
  };
}

// The card columns FSRS updates after a review.
export type FsrsUpdate = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  fsrs_state: (typeof NUM_TO_STATE)[number];
  last_review: string;
  learning_steps: number;
};

// grade: 1 Again, 2 Hard, 3 Good, 4 Easy — maps directly to FSRS Rating values.
export function schedule(card: SchedulableCard, grade: 1 | 2 | 3 | 4, now: Date = new Date()): FsrsUpdate {
  const { card: u } = scheduler.next(toFsrsCard(card), now, grade as Grade);
  return {
    due: u.due.toISOString(),
    stability: u.stability,
    difficulty: u.difficulty,
    elapsed_days: u.elapsed_days,
    scheduled_days: u.scheduled_days,
    reps: u.reps,
    lapses: u.lapses,
    fsrs_state: NUM_TO_STATE[u.state],
    last_review: (u.last_review ?? now).toISOString(),
    learning_steps: u.learning_steps,
  };
}

// Short human label for an interval (Anki-style: <1m, 6m, 2h, 2d, 3mo, 1y).
function humanInterval(fromMs: number, toMs: number): string {
  const mins = Math.round((toMs - fromMs) / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const d = Math.round(hrs / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.round(mo / 12)}y`;
}

export type GradePreview = { again: string; hard: string; good: string; easy: string };

// The interval each grade would schedule next, for the study screen's grade buttons.
// Computed server-side so ts-fsrs never ships to the client.
export function previewIntervals(card: SchedulableCard, now: Date = new Date()): GradePreview {
  const log = scheduler.repeat(toFsrsCard(card), now);
  const at = (g: 1 | 2 | 3 | 4) => humanInterval(now.getTime(), log[g as Grade].card.due.getTime());
  return { again: at(1), hard: at(2), good: at(3), easy: at(4) };
}
