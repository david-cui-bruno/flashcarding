"use server";

import { createClient } from "@/lib/supabase/server";
import { schedule } from "@/lib/scheduling/fsrs";

export async function gradeCard(cardId: string, grade: 1 | 2 | 3 | 4): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: card } = await supabase.from("cards").select("*").eq("id", cardId).single();
  if (!card) return;

  const update = schedule(card, grade);
  await supabase.from("cards").update(update).eq("id", cardId);
  await supabase
    .from("study_reviews")
    .insert({ user_id: user.id, card_id: cardId, grade, mode: "scheduled" });
}

// "This card is bad" during study (docs/SCHEDULING.md leeches, docs/METRICS.md trust mode).
// Pulls the card out of the deck and logs a rejection so it feeds the same loop as a
// review-time reject: it raises the edit rate (so the graduation ladder can walk review
// effort back up if trusted cards turn out bad) and teaches the generator what to avoid.
export async function flagBadCard(cardId: string, reason: string): Promise<void> {
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
    reason: reason.trim() ? `[study] ${reason.trim()}` : "[study] flagged bad during study",
  });
}
