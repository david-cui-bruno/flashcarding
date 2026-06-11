"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/(app)/library/actions";

// Card-level management from inside a collection. Editing a card here DOES count toward the
// edit rate (docs/METRICS.md): a fix is a quality signal wherever it happens. Such edits are
// tagged '[collection]' and grouped into their own batch (lib/metrics/server.ts) so they're
// distinguishable from review-time edits and don't retroactively rewrite a generation batch's
// quality number. RLS scopes every query to the owner.

export async function updateCard(
  cardId: string,
  collectionId: string,
  term: string,
  definition: string,
): Promise<ActionResult> {
  const t = term.trim();
  const d = definition.trim();
  // Hard rule #1 (docs/CARD-QUALITY.md): a term/definition can't be empty.
  // No length cap — richness is fine; that's a frozen stance.
  if (!t || !d) return { error: "Term and definition can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Capture the before→after delta (the strongest taste-tuning signal) for the feedback row.
  const { data: before } = await supabase
    .from("cards")
    .select("term, definition")
    .eq("id", cardId)
    .single();

  const { error } = await supabase
    .from("cards")
    .update({ term: t, definition: d })
    .eq("id", cardId);
  if (error) return { error: error.message };

  // Log the edit toward the edit rate — but only on a real change, and tagged '[collection]'.
  if (!before || before.term !== t || before.definition !== d) {
    await supabase.from("generation_feedback").insert({
      user_id: user.id,
      card_id: cardId,
      action: "edited",
      before: before ?? null,
      after: { term: t, definition: d },
      reason: "[collection] edited in collection view",
    });
  }

  revalidatePath(`/collections/${collectionId}`);
  return {};
}

export async function deleteCard(cardId: string, collectionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("cards").delete().eq("id", cardId);
  if (error) return { error: error.message };

  revalidatePath(`/collections/${collectionId}`);
  revalidatePath("/library");
  return {};
}

// Bulk-move cards into another collection. A card lives in exactly one collection,
// so this is a reassignment of collection_id (docs/CARD-QUALITY.md).
export async function moveCards(
  cardIds: string[],
  targetCollectionId: string,
  sourceCollectionId: string,
): Promise<ActionResult> {
  if (cardIds.length === 0) return { error: "No cards selected." };
  if (!targetCollectionId) return { error: "Pick a destination collection." };
  if (targetCollectionId === sourceCollectionId) return {}; // no-op

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Confirm the destination belongs to the user before pointing cards at it.
  const { data: target } = await supabase
    .from("collections")
    .select("id")
    .eq("id", targetCollectionId)
    .single();
  if (!target) return { error: "Destination collection not found." };

  const { error } = await supabase
    .from("cards")
    .update({ collection_id: targetCollectionId })
    .in("id", cardIds);
  if (error) return { error: error.message };

  revalidatePath(`/collections/${sourceCollectionId}`);
  revalidatePath(`/collections/${targetCollectionId}`);
  revalidatePath("/library");
  return {};
}
