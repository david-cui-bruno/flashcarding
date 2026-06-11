// The human-in-the-loop graduation ladder (docs/METRICS.md), driven by metric B.
// Review effort falls automatically as the generator learns the user's taste:
//
//   review-all  → spot-check   when the rolling edit rate drops below ~15%
//   spot-check  → trust        when the sampled edit rate stays below ~10% across several batches
//
// The mode is a PURE function of recent feedback history — there's no persisted "mode"
// column (and the schema is frozen, docs/BUILD-PLAN.md). Because it's recomputed from the
// rolling rate every time, the ladder is symmetric: if quality regresses (e.g. the user
// starts flagging cards bad during study), the rate rises and review effort climbs back up.
// docs/METRICS.md only specifies the downward path; the upward path is a deliberate safety
// net so trust mode can't strand a user with a deck of bad cards.

import { METRICS_CONFIG, type MetricsConfig } from "./config";
import {
  perBatchEditRate,
  rollingEditRate,
  type FeedbackEvent,
} from "./edit-rate";

export type ReviewMode = "review-all" | "spot-check" | "trust";

export type ModeDecision = {
  mode: ReviewMode;
  /** The rolling edit rate the decision was based on (null = not enough data). */
  rollingEditRate: number | null;
  reviewed: number;
  /** Why we're in this mode — surfaced on the metrics view. */
  reason: string;
};

export function decideReviewMode(
  events: readonly FeedbackEvent[],
  cfg: MetricsConfig = METRICS_CONFIG,
): ModeDecision {
  const { rate: rolling, reviewed } = rollingEditRate(events, cfg.ROLLING_WINDOW);

  // Not enough signal yet — stay in the safest mode and keep building the example set.
  if (rolling === null || reviewed < cfg.MIN_REVIEWED_TO_GRADUATE) {
    return {
      mode: "review-all",
      rollingEditRate: rolling,
      reviewed,
      reason: `Building the example set — ${reviewed}/${cfg.MIN_REVIEWED_TO_GRADUATE} cards reviewed before review effort can drop.`,
    };
  }

  // Trust: the last few batches with a real sample all stayed under the trust threshold.
  const sampledBatches = perBatchEditRate(events).filter(
    (b) => b.reviewed >= cfg.MIN_BATCH_SAMPLE,
  );
  const recentBatches = sampledBatches.slice(0, cfg.TRUST_BATCH_COUNT);
  const trustEligible =
    recentBatches.length >= cfg.TRUST_BATCH_COUNT &&
    recentBatches.every((b) => b.rate < cfg.TRUST_EDIT_RATE);
  if (trustEligible) {
    return {
      mode: "trust",
      rollingEditRate: rolling,
      reviewed,
      reason: `Last ${cfg.TRUST_BATCH_COUNT} batches stayed under ${pct(cfg.TRUST_EDIT_RATE)} edits — new cards go straight into the deck.`,
    };
  }

  // Spot-check vs review-all, WITH hysteresis. A bare `rolling < threshold` check flip-flops
  // when the rate sits right at SPOT_CHECK_EDIT_RATE (one edited card tips it back and forth).
  // We don't persist the mode (it stays a pure function of history, schema frozen), so we use
  // a deadband: switch only when the rate clears the threshold by HYSTERESIS_MARGIN; inside the
  // band, HOLD the prior leaning — derived from the rolling rate as of a few reviews ago.
  const lo = cfg.SPOT_CHECK_EDIT_RATE - cfg.HYSTERESIS_MARGIN;
  const hi = cfg.SPOT_CHECK_EDIT_RATE + cfg.HYSTERESIS_MARGIN;
  let spotCheck: boolean;
  if (rolling < lo) spotCheck = true; // clearly good → graduate
  else if (rolling >= hi) spotCheck = false; // clearly poor → fall back to review-all
  else {
    const prior = rollingEditRate(
      events.slice(0, Math.max(0, events.length - cfg.HYSTERESIS_LOOKBACK)),
      cfg.ROLLING_WINDOW,
    ).rate;
    spotCheck = prior !== null && prior < cfg.SPOT_CHECK_EDIT_RATE; // hold where we were
  }

  if (spotCheck) {
    return {
      mode: "spot-check",
      rollingEditRate: rolling,
      reviewed,
      reason: `Edit rate ${pct(rolling)} is under ${pct(cfg.SPOT_CHECK_EDIT_RATE)} — reviewing a ~${pct(cfg.SPOT_CHECK_SAMPLE_FRACTION)} sample of each batch.`,
    };
  }

  return {
    mode: "review-all",
    rollingEditRate: rolling,
    reviewed,
    reason: `Edit rate ${pct(rolling)} is at or above ${pct(cfg.SPOT_CHECK_EDIT_RATE)} — reviewing every card.`,
  };
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

// --- Sampling: which pending cards the current mode asks the user to review ---

/**
 * Stable per-card sample membership in [0, 1): a card is "in the sample" iff its
 * hash is below the sample fraction. Deterministic so a page reload shows the same
 * cards (and accepts the same complement), and uniform so each batch is ~20% sampled.
 */
function hashUnit(id: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h / 0xffffffff;
}

export type ReviewPartition = {
  /** Card ids the user reviews card-by-card. */
  toReview: string[];
  /** Card ids that skip review and go straight into the deck (no feedback logged). */
  autoAccept: string[];
};

export function partitionPendingForReview(
  cardIds: readonly string[],
  mode: ReviewMode,
  cfg: MetricsConfig = METRICS_CONFIG,
): ReviewPartition {
  if (mode === "review-all") return { toReview: [...cardIds], autoAccept: [] };
  if (mode === "trust") return { toReview: [], autoAccept: [...cardIds] };
  // spot-check
  const toReview: string[] = [];
  const autoAccept: string[] = [];
  for (const id of cardIds) {
    if (hashUnit(id) < cfg.SPOT_CHECK_SAMPLE_FRACTION) toReview.push(id);
    else autoAccept.push(id);
  }
  return { toReview, autoAccept };
}
