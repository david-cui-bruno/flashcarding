import {
  fsrs,
  generatorParameters,
  State,
  type Card as FsrsCard,
  type Grade,
} from "ts-fsrs";
import type { Card } from "@/lib/types/domain";

// FSRS at the 90% target retention from docs/SCHEDULING.md.
const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));

const STATE_TO_NUM: Record<string, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};
const NUM_TO_STATE = ["new", "learning", "review", "relearning"] as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The FSRS state fields that travel with a card.  These mirror the DB columns
 * on `cards` but are exposed here as a standalone type so callers (tests,
 * server actions, edge functions) can work with state without importing the
 * full DB Card row.
 */
export type CardState = {
  /** Predictive stability — how long before 90% of the information is lost. */
  stability: number;
  /** Intrinsic difficulty (1–10 scale internally to FSRS). */
  difficulty: number;
  /** ISO-8601 timestamp of the last review, or null for new cards. */
  lastReview: string | null;
  /** Days elapsed since the last review when this state was computed. */
  elapsedDays: number;
  /** Total number of review reps (including relearning). */
  reps: number;
  /** Number of times the card was graded Again after entering the review state. */
  lapses: number;
  /** Current FSRS state of the card. */
  fsrsState: "new" | "learning" | "review" | "relearning";
  /** Scheduled days until next review (the last interval FSRS chose). */
  scheduledDays: number;
};

/**
 * What FSRS returns after grading: when the card should next appear and
 * whether it needs relearning (i.e. was graded Again).
 */
export type Interval = {
  /** Days until the card should next be shown. */
  days: number;
  /** True when the card drops back into the learning/relearning queue. */
  relearning: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toFsrsCard(c: Card): FsrsCard {
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
    learning_steps: 0,
  };
}

function cardStateToFsrsCard(cs: CardState): FsrsCard {
  return {
    due: cs.lastReview
      ? new Date(new Date(cs.lastReview).getTime() + cs.scheduledDays * 86400000)
      : new Date(),
    stability: cs.stability,
    difficulty: cs.difficulty,
    elapsed_days: cs.elapsedDays,
    scheduled_days: cs.scheduledDays,
    reps: cs.reps,
    lapses: cs.lapses,
    state: STATE_TO_NUM[cs.fsrsState] ?? State.New,
    last_review: cs.lastReview ? new Date(cs.lastReview) : undefined,
    learning_steps: 0,
  };
}

// ---------------------------------------------------------------------------
// Public API — new ergonomic surface
// ---------------------------------------------------------------------------

/**
 * Returns a fresh CardState for a card that has never been reviewed.
 * Pass this as the initial state when inserting a new card.
 */
export function getInitialCardState(): CardState {
  return {
    stability: 0,
    difficulty: 0,
    lastReview: null,
    elapsedDays: 0,
    reps: 0,
    lapses: 0,
    fsrsState: "new",
    scheduledDays: 0,
  };
}

/**
 * Core scheduling function.  Takes a grade (1 Again … 4 Easy) and the card's
 * current FSRS state, and returns the next review Interval.
 *
 * `now` is injectable for testing.
 */
export function calculateNextInterval(
  grade: 1 | 2 | 3 | 4,
  cardState: CardState,
  now: Date = new Date(),
): Interval {
  const { card: u } = scheduler.next(cardStateToFsrsCard(cardState), now, grade as Grade);
  const days = u.scheduled_days;
  const relearning =
    u.state === State.Learning || u.state === State.Relearning;
  return { days, relearning };
}

// ---------------------------------------------------------------------------
// Legacy surface (used by app/(app)/study/actions.ts)
// ---------------------------------------------------------------------------

/** The card columns FSRS updates after a review. */
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
};

/** grade: 1 Again, 2 Hard, 3 Good, 4 Easy — maps directly to FSRS Rating values. */
export function schedule(card: Card, grade: 1 | 2 | 3 | 4, now: Date = new Date()): FsrsUpdate {
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
  };
}

// ---------------------------------------------------------------------------
// Leech detection (docs/SCHEDULING.md)
// ---------------------------------------------------------------------------

/** Threshold after which a card is considered a leech (matches Anki default). */
export const LEECH_THRESHOLD = 8;

export function isLeech(cardState: CardState): boolean {
  return cardState.lapses >= LEECH_THRESHOLD;
}
