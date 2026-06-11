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
};

// grade: 1 Again, 2 Hard, 3 Good, 4 Easy — maps directly to FSRS Rating values.
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
