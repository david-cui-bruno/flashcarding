// Metric B — edit rate. The operational definition of card quality (docs/METRICS.md,
// docs/CARD-QUALITY.md): of the cards the user reviews, what fraction did they change?
//   edit_rate = (edited + rejected) / reviewed
// Pure functions over feedback events; the Supabase fetch lives in ./server.ts.

import { METRICS_CONFIG } from "./config";

export type FeedbackActionKind = "kept" | "edited" | "rejected";

/** One review action, flattened from generation_feedback + its card's batch. */
export type FeedbackEvent = {
  action: FeedbackActionKind;
  createdAt: string;
  /** generation_job_id ?? collection_id ?? "ungrouped" — what counts as one batch. */
  batchKey: string;
};

/** (edited + rejected) / reviewed. null when nothing has been reviewed. */
export function editRate(events: readonly FeedbackEvent[]): number | null {
  if (events.length === 0) return null;
  const changed = events.filter(
    (e) => e.action === "edited" || e.action === "rejected",
  ).length;
  return changed / events.length;
}

function byCreatedAtAsc(a: FeedbackEvent, b: FeedbackEvent): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** Rolling edit rate over the most-recent `window` reviewed cards. */
export function rollingEditRate(
  events: readonly FeedbackEvent[],
  window: number = METRICS_CONFIG.ROLLING_WINDOW,
): { rate: number | null; reviewed: number } {
  const recent = [...events].sort(byCreatedAtAsc).slice(-window);
  return { rate: editRate(recent), reviewed: recent.length };
}

export type BatchEditRate = {
  batchKey: string;
  reviewed: number;
  /** edited + rejected count, for display. */
  changed: number;
  rate: number;
  /** Most-recent action time in the batch — used to order batches by recency. */
  lastAt: string;
};

/** Edit rate grouped per generation batch, most-recently-touched batch first. */
export function perBatchEditRate(
  events: readonly FeedbackEvent[],
): BatchEditRate[] {
  const groups = new Map<string, FeedbackEvent[]>();
  for (const e of events) {
    const g = groups.get(e.batchKey);
    if (g) g.push(e);
    else groups.set(e.batchKey, [e]);
  }
  const out: BatchEditRate[] = [];
  for (const [batchKey, rows] of groups) {
    const changed = rows.filter(
      (r) => r.action === "edited" || r.action === "rejected",
    ).length;
    const lastAt = rows.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), "");
    out.push({ batchKey, reviewed: rows.length, changed, rate: changed / rows.length, lastAt });
  }
  return out.sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}
