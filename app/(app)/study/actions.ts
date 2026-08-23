"use server";

import { createClient } from "@/lib/supabase/server";
import { schedule, type FsrsUpdate } from "@/lib/scheduling/fsrs";

type StudyMode = "scheduled" | "cram";

// What a grade write resolved to, so the client's offline outbox (lib/offline/)
// can tell "retry later" apart from "drop this forever":
//   ok              — persisted (or an idempotent duplicate of an already-persisted review)
//   unauthenticated — no session right now; keep the review queued and retry later
//   card_missing    — the card is gone (deleted / not this user's) → drop permanently
//   error           — unexpected DB failure → retry with backoff
export type GradeReceipt = {
  status: "ok" | "unauthenticated" | "card_missing" | "error";
};

// A client-generated review identity, passed when the review needs to be replayable:
// `reviewId` becomes the study_reviews primary key so a replayed/retried review
// upserts the same row instead of double-logging (ON CONFLICT DO NOTHING), and
// `reviewedAt` records when the user actually studied (offline reviews arrive late —
// metrics and retention must see the honest time, not the sync time).
export type ReviewReceipt = { reviewId?: string; reviewedAt?: string };

// The study session runs FSRS client-side (docs/SCHEDULING.md says scheduling is
// client-side) so it can re-queue learning-step cards within the session. It passes
// the resulting `update` here, which we persist as-is — this keeps the DB consistent
// with exactly what the learner saw and avoids a recompute race when a card is graded
// several times in one session (learning steps). If `update` is omitted we recompute
// server-side from the stored card as a fallback.
export async function gradeCard(
  cardId: string,
  grade: 1 | 2 | 3 | 4,
  mode: StudyMode = "scheduled",
  update?: FsrsUpdate,
  receipt?: ReviewReceipt,
): Promise<GradeReceipt> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "unauthenticated" };

  const reviewRow = {
    user_id: user.id,
    card_id: cardId,
    grade,
    ...(receipt?.reviewId ? { id: receipt.reviewId } : {}),
    ...(receipt?.reviewedAt ? { reviewed_at: receipt.reviewedAt } : {}),
  };

  // Idempotent when the client supplied a reviewId: a replay retry after a
  // half-applied send hits ON CONFLICT DO NOTHING instead of double-logging.
  async function insertReview(rowMode: StudyMode): Promise<GradeReceipt["status"]> {
    const row = { ...reviewRow, mode: rowMode };
    const { error } = receipt?.reviewId
      ? await supabase.from("study_reviews").upsert(row, { onConflict: "id", ignoreDuplicates: true })
      : await supabase.from("study_reviews").insert(row);
    if (!error) return "ok";
    // 23503 = foreign-key violation → the card no longer exists. Permanent.
    return error.code === "23503" ? "card_missing" : "error";
  }

  // Cram / free review never disturbs the FSRS schedule (docs/SCHEDULING.md): we log
  // the review for metrics but leave the card's `due`/scheduling columns untouched, so
  // blasting through a whole deck doesn't wreck the spacing FSRS computed.
  if (mode === "cram") {
    return { status: await insertReview("cram") };
  }

  // RLS scopes the read to the owner; a miss means the card was deleted (or was
  // never this user's) — either way the queued review can never apply. Permanent.
  const { data: card } = await supabase
    .from("cards")
    .select("*")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) return { status: "card_missing" };

  const reviewedAt = receipt?.reviewedAt ? new Date(receipt.reviewedAt) : undefined;
  const fsrs = update ?? schedule(card, grade, reviewedAt);

  // Last-write-wins by review time, not arrival time: an offline review replayed
  // hours late must not clobber FSRS state from a newer review that already landed
  // (e.g. graded again on another device). The review row is still logged below —
  // it truly happened — only the stale card-state write is skipped.
  const stale =
    card.last_review !== null && Date.parse(card.last_review) > Date.parse(fsrs.last_review);
  if (!stale) {
    const { error } = await supabase.from("cards").update(fsrs).eq("id", cardId);
    if (error) return { status: "error" };
  }

  return { status: await insertReview("scheduled") };
}

// "This card is bad" during study. The single, user-initiated path for pulling a card out
// of rotation — used both by the explicit "⚑ this card is bad" button and by the leech
// banner's "flag" action. It is NEVER called automatically on becoming a leech: a leech is
// often a hard-but-correctly-generated card (inherent difficulty), so auto-rejecting it
// would wrongly inflate the generation edit rate and walk the graduation ladder back up.
// Only a user's deliberate flag counts. Logs a rejection (review_status=rejected +
// generation_feedback action='rejected', reason prefixed '[study]') so it both trains the
// few-shot loop and counts toward the edit rate (docs/METRICS.md, docs/SCHEDULING.md).
export async function flagBadCard(cardId: string, reason?: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const trimmed = reason?.trim();
  await supabase.from("cards").update({ review_status: "rejected" }).eq("id", cardId);
  await supabase.from("generation_feedback").insert({
    user_id: user.id,
    card_id: cardId,
    action: "rejected",
    reason: trimmed ? `[study] ${trimmed}` : "[study] flagged bad during study",
  });
}
