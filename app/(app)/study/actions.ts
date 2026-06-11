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
