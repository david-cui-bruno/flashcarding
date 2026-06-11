"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/(app)/library/actions";

// Card-level management from inside a collection. This is maintenance, not the
// generation review flow — so it deliberately does NOT write generation_feedback
// (that signal feeds the edit-rate metric, docs/METRICS.md, and is owned by the
// review/feedback streams). RLS scopes every query to the owner.

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

  const { error } = await supabase
    .from("cards")
    .update({ term: t, definition: d })
    .eq("id", cardId);
  if (error) return { error: error.message };

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
