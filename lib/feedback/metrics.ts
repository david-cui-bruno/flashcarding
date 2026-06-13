/**
 * lib/feedback/metrics.ts
 *
 * Server-side query helpers for deck analytics.
 * These back the GET /api/metrics route handler.
 *
 * All queries run against the Supabase DB via the server client.
 * The caller is responsible for passing the correct user_id (from auth.getUser()).
 *
 * See docs/ANALYTICS.md for formulas, refresh cadence, and the API contract.
 */

import { createClient } from "@/lib/supabase/server";
import type { MetricsResponse, ReviewMode } from "@/lib/types/domain";
import { REVIEW_MODE_THRESHOLDS } from "@/lib/types/domain";

/** How long (ms) a snapshot stays fresh before we recompute. */
const SNAPSHOT_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Returns metrics for one deck (or global if collectionId is null).
 * Reads the cached snapshot if it's fresh; recomputes and writes a new one
 * if it has expired.
 */
export async function getMetrics(
  userId: string,
  collectionId: string | null
): Promise<MetricsResponse> {
  const supabase = await createClient();

  // 1. Try the cache.
  const snapshot = await getFreshSnapshot(supabase, userId, collectionId);
  if (snapshot) {
    return snapshotToResponse(snapshot, collectionId, supabase, userId);
  }

  // 2. Recompute.
  return computeAndCache(supabase, userId, collectionId);
}

/**
 * Force-recomputes metrics, ignoring the TTL floor.
 * Used by POST /api/metrics/refresh and in tests.
 */
export async function refreshMetrics(
  userId: string,
  collectionId: string | null
): Promise<MetricsResponse> {
  const supabase = await createClient();
  return computeAndCache(supabase, userId, collectionId);
}

// ── Review-mode transitions ─────────────────────────────────────────────────────

/**
 * Evaluates whether a collection should transition to a higher-trust review
 * mode based on its current rolling edit rate, and updates the DB if needed.
 *
 * Call this after each generation batch completes for the collection.
 * Never auto-demotes (per spec); the user must reset manually.
 */
export async function maybePromoteReviewMode(
  userId: string,
  collectionId: string
): Promise<ReviewMode> {
  const supabase = await createClient();

  // Fetch current mode + rolling edit rate.
  const [collectionResult, editRateResult] = await Promise.all([
    supabase
      .from("collections")
      .select("review_mode")
      .eq("id", collectionId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("v_collection_edit_rate_30d")
      .select("edit_rate_pct")
      .eq("collection_id", collectionId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (collectionResult.error || !collectionResult.data) {
    throw new Error("collection not found");
  }

  const currentMode = collectionResult.data.review_mode as ReviewMode;
  const editRate = editRateResult.data?.edit_rate_pct ?? null;

  if (editRate === null) return currentMode; // not enough data yet

  let nextMode: ReviewMode = currentMode;

  if (
    currentMode === "review_all" &&
    editRate < REVIEW_MODE_THRESHOLDS.spotCheck
  ) {
    nextMode = "spot_check";
  } else if (
    currentMode === "spot_check" &&
    editRate < REVIEW_MODE_THRESHOLDS.trust
  ) {
    // TODO: add "sustained across 3 batches" guard — for now, a single window
    // below 10% is sufficient for v1 personal use.
    nextMode = "trust";
  }

  if (nextMode !== currentMode) {
    await supabase
      .from("collections")
      .update({ review_mode: nextMode })
      .eq("id", collectionId)
      .eq("user_id", userId);
  }

  return nextMode;
}

// ── Helpers (not exported) ──────────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function getFreshSnapshot(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string | null
) {
  const query = supabase
    .from("deck_metrics_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("sampled_at", { ascending: false })
    .limit(1);

  if (collectionId) {
    query.eq("collection_id", collectionId);
  } else {
    query.is("collection_id", null);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

  const age = Date.now() - new Date(data.sampled_at).getTime();
  if (age > SNAPSHOT_TTL_MS) return null;

  return data;
}

async function computeAndCache(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string | null
): Promise<MetricsResponse> {
  // Retention from the SQL view.
  const retentionQuery = supabase
    .from("v_collection_retention_30d")
    .select("retention_pct")
    .eq("user_id", userId);
  if (collectionId) retentionQuery.eq("collection_id", collectionId);

  // Edit rate from the SQL view.
  const editRateQuery = supabase
    .from("v_collection_edit_rate_30d")
    .select("edit_rate_pct")
    .eq("user_id", userId);
  if (collectionId) editRateQuery.eq("collection_id", collectionId);

  // cards_due and cards_total.
  const now = new Date().toISOString();
  const cardsQuery = supabase
    .from("cards")
    .select("id, due, review_status")
    .eq("user_id", userId)
    .eq("review_status", "accepted"); // only accepted cards count
  if (collectionId) cardsQuery.eq("collection_id", collectionId);

  // review_mode (per collection, or fallback 'review_all' for global).
  const reviewModeQuery = collectionId
    ? supabase
        .from("collections")
        .select("review_mode")
        .eq("id", collectionId)
        .eq("user_id", userId)
        .single()
    : Promise.resolve({ data: { review_mode: "review_all" as ReviewMode }, error: null });

  const [retentionRes, editRateRes, cardsRes, reviewModeRes] =
    await Promise.all([retentionQuery, editRateQuery, cardsQuery, reviewModeQuery]);

  const retentionPct =
    (retentionRes.data as { retention_pct: number | null }[] | null)?.[0]
      ?.retention_pct ?? null;
  const editRatePct =
    (editRateRes.data as { edit_rate_pct: number | null }[] | null)?.[0]
      ?.edit_rate_pct ?? null;

  const allCards = cardsRes.data ?? [];
  const cardsTotal = allCards.length;
  const cardsDue = allCards.filter((c) => c.due <= now).length;

  const reviewMode: ReviewMode =
    (reviewModeRes.data?.review_mode as ReviewMode) ?? "review_all";

  // Write new snapshot.
  await supabase.from("deck_metrics_snapshots").insert({
    user_id: userId,
    collection_id: collectionId,
    retention_pct: retentionPct,
    edit_rate_pct: editRatePct,
    cards_due: cardsDue,
    cards_total: cardsTotal,
    sampled_at: new Date().toISOString(),
  });

  return {
    retentionPct,
    editRatePct,
    reviewMode,
    cardsDue,
    cardsTotal,
    sampledAt: new Date().toISOString(),
  };
}

function snapshotToResponse(
  snapshot: {
    retention_pct: number | null;
    edit_rate_pct: number | null;
    cards_due: number;
    cards_total: number;
    sampled_at: string;
  },
  collectionId: string | null,
  supabase: SupabaseClient,
  userId: string
): MetricsResponse | Promise<MetricsResponse> {
  // review_mode isn't cached in the snapshot — read it live (it's a tiny query).
  // This keeps the snapshot table simple and avoids staleness on mode changes.
  if (collectionId) {
    return supabase
      .from("collections")
      .select("review_mode")
      .eq("id", collectionId)
      .eq("user_id", userId)
      .single()
      .then(({ data }) => ({
        retentionPct: snapshot.retention_pct,
        editRatePct: snapshot.edit_rate_pct,
        reviewMode: (data?.review_mode as ReviewMode) ?? "review_all",
        cardsDue: snapshot.cards_due,
        cardsTotal: snapshot.cards_total,
        sampledAt: snapshot.sampled_at,
      }));
  }

  return {
    retentionPct: snapshot.retention_pct,
    editRatePct: snapshot.edit_rate_pct,
    reviewMode: "review_all",
    cardsDue: snapshot.cards_due,
    cardsTotal: snapshot.cards_total,
    sampledAt: snapshot.sampled_at,
  };
}
