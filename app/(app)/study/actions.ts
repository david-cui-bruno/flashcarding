"use server";

import { createClient } from "@/lib/supabase/server";
import { schedule, type FsrsUpdate } from "@/lib/scheduling/fsrs";

type StudyMode = "scheduled" | "cram";

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
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Cram / free review never disturbs the FSRS schedule (docs/SCHEDULING.md): we log
  // the review for metrics but leave the card's `due`/scheduling columns untouched, so
  // blasting through a whole deck doesn't wreck the spacing FSRS computed.
  if (mode === "cram") {
    await supabase
      .from("study_reviews")
      .insert({ user_id: user.id, card_id: cardId, grade, mode: "cram" });
    return;
  }

  let fsrs = update;
  if (!fsrs) {
    const { data: card } = await supabase.from("cards").select("*").eq("id", cardId).single();
    if (!card) return;
    fsrs = schedule(card, grade);
  }
  await supabase.from("cards").update(fsrs).eq("id", cardId);
  await supabase
    .from("study_reviews")
    .insert({ user_id: user.id, card_id: cardId, grade, mode: "scheduled" });
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
