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

/**
 * Toggle the flagged state on a card. Flags surface in the manage page so the
 * user can batch-process them. Flagging does not affect the FSRS schedule.
 * (docs/CARD-EDITING.md §5)
 */
export async function toggleFlag(cardId: string): Promise<{ flagged: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { flagged: false };

  const { data: card } = await supabase
    .from("cards")
    .select("id, flagged")
    .eq("id", cardId)
    .single();
  if (!card) return { flagged: false };

  const newFlagged = !card.flagged;
  await supabase.from("cards").update({ flagged: newFlagged }).eq("id", cardId);

  // Log event for feedback loop
  await supabase.from("review_events").insert({
    user_id: user.id,
    card_id: cardId,
    action: newFlagged ? "flagged" : "unflagged",
  });

  return { flagged: newFlagged };
}

/**
 * Edit a card's term and/or definition during study. Logs before→after for the
 * feedback loop. Saving an edit also clears the flag (user fixed the problem).
 * FSRS schedule is untouched — editing content does not reset intervals.
 * (docs/CARD-EDITING.md §1)
 */
export async function editCardInStudy(
  cardId: string,
  term: string,
  definition: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: before } = await supabase
    .from("cards")
    .select("term, definition")
    .eq("id", cardId)
    .single();

  await supabase
    .from("cards")
    .update({ term, definition, flagged: false })
    .eq("id", cardId);

  // Log before→after for taste-tuning (PIPELINE.md §5)
  await supabase.from("review_events").insert({
    user_id: user.id,
    card_id: cardId,
    action: "edited_in_study",
    before_term: before?.term ?? null,
    before_definition: before?.definition ?? null,
    after_term: term,
    after_definition: definition,
  });
}

/**
 * Create a new user-authored card in a collection. User-created cards skip the
 * pending review queue and are inserted as accepted. Due immediately.
 * (docs/CARD-EDITING.md §3)
 */
export async function createSiblingCard(
  collectionId: string,
  term: string,
  definition: string,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("cards")
    .insert({
      user_id: user.id,
      collection_id: collectionId,
      source_id: null,
      term,
      definition,
      source_span: null,
      review_status: "accepted",
      flagged: false,
    })
    .select("id")
    .single();

  if (error || !data) return null;

  await supabase.from("review_events").insert({
    user_id: user.id,
    card_id: data.id,
    action: "user_created",
  });

  return { id: data.id };
}
