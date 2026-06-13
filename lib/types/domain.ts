import type { Database } from "./database";

// Clean app-facing aliases over the generated DB types. Database is the source of
// truth (see CLAUDE.md); these just make call sites readable.
export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type CardInsert = Database["public"]["Tables"]["cards"]["Insert"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type GenerationJob = Database["public"]["Tables"]["generation_jobs"]["Row"];
export type StudyReview = Database["public"]["Tables"]["study_reviews"]["Row"];
export type DeckMetricsSnapshot =
  Database["public"]["Tables"]["deck_metrics_snapshots"]["Row"];

// Enum aliases
export type ReviewMode = Database["public"]["Enums"]["review_mode"];
// "review_all" | "spot_check" | "trust"

// The shape the generator returns, before persistence. term + one atomic fact +
// a verbatim supporting quote from the source (grounding). See docs/CARD-QUALITY.md.
export type GeneratedCard = {
  term: string;
  definition: string;
  source_span: string;
};

// ── Metrics API response shape ──────────────────────────────────────────────────
// Returned by GET /api/metrics and GET /api/metrics?collection=:id.
// See docs/ANALYTICS.md §7.
export type MetricsResponse = {
  retentionPct: number | null; // 0–1; null if no study reviews yet
  editRatePct: number | null;  // 0–1; null if no generation feedback yet
  reviewMode: ReviewMode;
  cardsDue: number;
  cardsTotal: number;
  sampledAt: string;           // ISO timestamp
};

// ── Review-mode graduation thresholds (from docs/METRICS.md) ───────────────────
// Centralised here so the server-side transition logic and the UI badge
// both read from the same constants.
export const REVIEW_MODE_THRESHOLDS = {
  /** edit_rate below this → promote review_all → spot_check */
  spotCheck: 0.15,
  /** edit_rate below this (sustained) → promote spot_check → trust */
  trust: 0.10,
  /** fraction of batch sampled in spot_check mode */
  spotCheckSampleRate: 0.20,
} as const;
