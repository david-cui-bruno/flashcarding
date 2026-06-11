// The numbers that drive the human-in-the-loop workflow live HERE, in one place,
// so they're tuned from real data — not scattered across the code (docs/METRICS.md).
// The 15% / 10% / 20% values are the "starting points" the spec calls out; the
// window/gate values are the engineering knobs that keep graduation from firing on
// noise. docs/METRICS.md is the spec; this file is where its thresholds become code.

export const METRICS_CONFIG = {
  // --- Metric A: retention (docs/SCHEDULING.md) ---
  /** FSRS target retention. Retention is reported as a delta against this. */
  TARGET_RETENTION: 0.9,
  /** Most-recent scheduled reviews used for the rolling retention number. */
  RETENTION_ROLLING_WINDOW: 100,

  // --- Metric B: edit rate + the graduation ladder (docs/METRICS.md) ---
  /** Rolling edit rate below this graduates review-all → spot-check. */
  SPOT_CHECK_EDIT_RATE: 0.15,
  /** Per-batch edit rate that, sustained across several batches, graduates → trust. */
  TRUST_EDIT_RATE: 0.1,
  /** Fraction of each new batch the user reviews in spot-check mode. */
  SPOT_CHECK_SAMPLE_FRACTION: 0.2,

  /** Most-recent reviewed cards used for the rolling edit rate. */
  ROLLING_WINDOW: 50,
  /** Don't leave review-all until at least this many cards have been reviewed. */
  MIN_REVIEWED_TO_GRADUATE: 20,
  /** "Several batches": consecutive recent batches that must stay under TRUST_EDIT_RATE. */
  TRUST_BATCH_COUNT: 3,
  /** A batch needs at least this many reviewed cards to count toward the trust decision. */
  MIN_BATCH_SAMPLE: 5,
} as const;

export type MetricsConfig = typeof METRICS_CONFIG;
