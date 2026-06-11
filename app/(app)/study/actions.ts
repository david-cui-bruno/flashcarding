"use server";

import { createClient } from "@/lib/supabase/server";
import { schedule } from "@/lib/scheduling/fsrs";

type StudyMode = "scheduled" | "cram";

export async function gradeCard(
  cardId: string,
  grade: 1 | 2 | 3 | 4,
  mode: StudyMode = "scheduled",
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

  const { data: card } = await supabase.from("cards").select("*").eq("id", cardId).single();
  if (!card) return;

  const update = schedule(card, grade);
  await supabase.from("cards").update(update).eq("id", cardId);
  await supabase
    .from("study_reviews")
    .insert({ user_id: user.id, card_id: cardId, grade, mode: "scheduled" });
}

// A persistent leech usually signals a *bad card* (docs/SCHEDULING.md). When the user
// flags one mid-study, route it into the same "this card is bad" path the review screen
// uses — set review_status to rejected (pulling it out of the study rotation) and record
// the rejection in generation_feedback so it feeds the quality loop (PIPELINE/METRICS).
export async function flagBadCard(cardId: string, reason?: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("cards").update({ review_status: "rejected" }).eq("id", cardId);
  await supabase.from("generation_feedback").insert({
    user_id: user.id,
    card_id: cardId,
    action: "rejected",
    reason: reason?.trim() || "Leech: repeatedly failed in study",
  });
}
