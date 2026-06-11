// Server-only: reads generation_feedback + study_reviews (RLS scopes to the user, like the
// rest of the app) and assembles the numbers the metrics view and review route consume.
// The schema is frozen (docs/BUILD-PLAN.md) — this only reads it.
// Server-only by construction: imported solely from server components / server actions.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  perBatchEditRate,
  rollingEditRate,
  type BatchEditRate,
  type FeedbackEvent,
} from "./edit-rate";
import {
  perCollectionRetention,
  retention,
  rollingRetention,
  type CollectionRetention,
  type Retention,
  type StudyReviewEvent,
} from "./retention";
import { decideReviewMode, type ModeDecision } from "./graduation";
import { METRICS_CONFIG } from "./config";

type Client = SupabaseClient<Database>;

/** A batch is a generation run: its job if linked, else the collection it landed in. */
function batchKeyOf(card: {
  generation_job_id: string | null;
  collection_id: string | null;
} | null): string {
  return card?.generation_job_id ?? card?.collection_id ?? "ungrouped";
}

export async function loadFeedbackEvents(supabase: Client): Promise<FeedbackEvent[]> {
  const { data, error } = await supabase
    .from("generation_feedback")
    .select("action, reason, created_at, card:cards(generation_job_id, collection_id)")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    action: r.action,
    createdAt: r.created_at,
    // Collection-view maintenance edits ('[collection]') count toward the edit rate but group
    // into their own batch, so they don't retroactively rewrite a generation batch's quality.
    batchKey: r.reason?.startsWith("[collection]")
      ? "collection-maintenance"
      : batchKeyOf(r.card),
  }));
}

export async function loadStudyEvents(supabase: Client): Promise<StudyReviewEvent[]> {
  const { data, error } = await supabase
    .from("study_reviews")
    .select("grade, reviewed_at, mode, card:cards(collection_id)")
    .order("reviewed_at", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    grade: r.grade,
    reviewedAt: r.reviewed_at,
    mode: r.mode,
    collectionId: r.card?.collection_id ?? null,
  }));
}

/** Just the review mode — the review route's only metrics dependency. */
export async function getReviewMode(supabase: Client): Promise<ModeDecision> {
  const events = await loadFeedbackEvents(supabase);
  return decideReviewMode(events);
}

export type MetricsDashboard = {
  config: typeof METRICS_CONFIG;
  mode: ModeDecision;
  editRate: {
    overall: number | null;
    overallReviewed: number;
    rolling: number | null;
    rollingReviewed: number;
    perBatch: BatchEditRate[];
  };
  retention: {
    overall: Retention;
    rolling: Retention;
    perCollection: (CollectionRetention & { name: string | null })[];
    target: number;
  };
};

export async function getMetricsDashboard(supabase: Client): Promise<MetricsDashboard> {
  const [feedback, study] = await Promise.all([
    loadFeedbackEvents(supabase),
    loadStudyEvents(supabase),
  ]);

  const allReviewed = feedback.length;
  const overallChanged = feedback.filter(
    (e) => e.action === "edited" || e.action === "rejected",
  ).length;
  const rolling = rollingEditRate(feedback);

  const perCollection = perCollectionRetention(study);
  const names = await loadCollectionNames(
    supabase,
    perCollection
      .map((c) => c.collectionId)
      .filter((id): id is string => id !== null),
  );

  return {
    config: METRICS_CONFIG,
    mode: decideReviewMode(feedback),
    editRate: {
      overall: allReviewed === 0 ? null : overallChanged / allReviewed,
      overallReviewed: allReviewed,
      rolling: rolling.rate,
      rollingReviewed: rolling.reviewed,
      perBatch: perBatchEditRate(feedback),
    },
    retention: {
      overall: retention(study),
      rolling: rollingRetention(study),
      perCollection: perCollection.map((c) => ({
        ...c,
        name: c.collectionId ? (names.get(c.collectionId) ?? null) : null,
      })),
      target: METRICS_CONFIG.TARGET_RETENTION,
    },
  };
}

async function loadCollectionNames(
  supabase: Client,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data } = await supabase.from("collections").select("id, name").in("id", ids);
  for (const c of data ?? []) out.set(c.id, c.name);
  return out;
}
