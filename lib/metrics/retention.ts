// Metric A — retention. The long-term goal (docs/METRICS.md): the fraction of cards
// recalled correctly at their scheduled review, versus the 90% target (docs/SCHEDULING.md).
//
// What we can compute from study_reviews alone: a SCHEDULED review (mode='scheduled')
// is a card seen at its FSRS due time. It was recalled if it wasn't graded "Again" (1).
// Cram reviews are off-schedule (docs/SCHEDULING.md) and never count toward retention.
// Pure functions; the Supabase fetch lives in ./server.ts.

import { METRICS_CONFIG } from "./config";

export type StudyReviewEvent = {
  grade: number; // 1 Again .. 4 Easy
  reviewedAt: string;
  mode: "scheduled" | "cram";
  collectionId: string | null;
};

/** A scheduled review counts as recalled unless it was graded Again (1). */
function isRecalled(e: StudyReviewEvent): boolean {
  return e.grade >= 2;
}

export type Retention = { rate: number | null; reviewed: number };

/** Retention over all scheduled reviews in `events`. null when there are none. */
export function retention(events: readonly StudyReviewEvent[]): Retention {
  const scheduled = events.filter((e) => e.mode === "scheduled");
  if (scheduled.length === 0) return { rate: null, reviewed: 0 };
  const recalled = scheduled.filter(isRecalled).length;
  return { rate: recalled / scheduled.length, reviewed: scheduled.length };
}

function byReviewedAtAsc(a: StudyReviewEvent, b: StudyReviewEvent): number {
  return a.reviewedAt < b.reviewedAt ? -1 : a.reviewedAt > b.reviewedAt ? 1 : 0;
}

/** Retention over the most-recent `window` scheduled reviews. */
export function rollingRetention(
  events: readonly StudyReviewEvent[],
  window: number = METRICS_CONFIG.RETENTION_ROLLING_WINDOW,
): Retention {
  const recentScheduled = events
    .filter((e) => e.mode === "scheduled")
    .sort(byReviewedAtAsc)
    .slice(-window);
  return retention(recentScheduled);
}

export type CollectionRetention = Retention & { collectionId: string | null };

/** Retention broken out per collection (docs/METRICS.md: "reported … per collection"). */
export function perCollectionRetention(
  events: readonly StudyReviewEvent[],
): CollectionRetention[] {
  const groups = new Map<string | null, StudyReviewEvent[]>();
  for (const e of events.filter((x) => x.mode === "scheduled")) {
    const g = groups.get(e.collectionId);
    if (g) g.push(e);
    else groups.set(e.collectionId, [e]);
  }
  return [...groups.entries()]
    .map(([collectionId, rows]) => ({ collectionId, ...retention(rows) }))
    .sort((a, b) => b.reviewed - a.reviewed);
}
