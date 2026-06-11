"use server";

import { createClient } from "@/lib/supabase/server";

export async function keepCard(cardId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("cards").update({ review_status: "accepted" }).eq("id", cardId);
  await supabase
    .from("generation_feedback")
    .insert({ user_id: user.id, card_id: cardId, action: "kept" });
}

export async function rejectCard(cardId: string, reason: string): Promise<void> {
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
    reason: reason || null,
  });
}

export async function editCard(
  cardId: string,
  term: string,
  definition: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  // Capture the before→after delta — the strongest taste-tuning signal (docs/METRICS.md).
  const { data: before } = await supabase
    .from("cards")
    .select("term, definition")
    .eq("id", cardId)
    .single();
  await supabase
    .from("cards")
    .update({ term, definition, review_status: "edited" })
    .eq("id", cardId);
  await supabase.from("generation_feedback").insert({
    user_id: user.id,
    card_id: cardId,
    action: "edited",
    before: before ?? null,
    after: { term, definition },
  });
}
