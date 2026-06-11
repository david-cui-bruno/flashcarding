import type { Database } from "./database";

// Clean app-facing aliases over the generated DB types. Database is the source of
// truth (see CLAUDE.md); these just make call sites readable.
export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type CardInsert = Database["public"]["Tables"]["cards"]["Insert"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type GenerationJob = Database["public"]["Tables"]["generation_jobs"]["Row"];
export type StudyReview = Database["public"]["Tables"]["study_reviews"]["Row"];

// The shape the generator returns, before persistence. term + one atomic fact +
// a verbatim supporting quote from the source (grounding). See docs/CARD-QUALITY.md.
export type GeneratedCard = {
  term: string;
  definition: string;
  source_span: string;
};
