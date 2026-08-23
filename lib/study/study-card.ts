// The study session's card shape + the matching DB projection, shared by the
// server study page, the client session, and the offline cache (lib/offline/) so
// the three can't drift. Full FSRS state travels to the client because the session
// runs the scheduler locally (docs/SCHEDULING.md: FSRS is client-side) — for live
// interval previews and to re-queue learning-step cards within a session.
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

export const STUDY_COLUMNS =
  "id, term, definition, prompt_direction, lapses, fsrs_state, due, stability, difficulty, elapsed_days, scheduled_days, reps, last_review, learning_steps, audio_path";
