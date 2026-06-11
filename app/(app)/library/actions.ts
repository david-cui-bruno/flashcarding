"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Collection-level CRUD. Card-level actions live in the detail route
// (app/(app)/collections/[id]/actions.ts). All queries run through the
// user-session client, so RLS (auth.uid() = user_id) scopes everything to
// the owner — these are owner-only by construction.

export type ActionResult = { error?: string };

const MAX_NAME = 120;

function cleanName(raw: FormDataEntryValue | null | undefined): string {
  return String(raw ?? "").trim().slice(0, MAX_NAME);
}

export async function createCollection(name: string): Promise<ActionResult & { id?: string }> {
  const clean = cleanName(name);
  if (!clean) return { error: "Give the collection a name." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: clean })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create collection." };

  revalidatePath("/library");
  return { id: data.id };
}

export async function renameCollection(id: string, name: string): Promise<ActionResult> {
  const clean = cleanName(name);
  if (!clean) return { error: "Name can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("collections").update({ name: clean }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/library");
  revalidatePath(`/collections/${id}`);
  return {};
}

// A card belongs to exactly one collection (docs/CARD-QUALITY.md), and the FK is
// ON DELETE SET NULL — so dropping a collection would silently orphan its cards
// (collection_id = null), making them invisible/unmanageable in the UI. We refuse
// to orphan: the caller must either delete the cards or move them somewhere first.
export async function deleteCollection(
  id: string,
  cardAction: "delete" | "move",
  targetCollectionId?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Only the owner's collection is visible under RLS; a miss means "not yours / gone".
  const { data: collection } = await supabase
    .from("collections")
    .select("id")
    .eq("id", id)
    .single();
  if (!collection) return { error: "Collection not found." };

  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", id);
  const cardCount = count ?? 0;

  if (cardCount > 0) {
    if (cardAction === "move") {
      if (!targetCollectionId || targetCollectionId === id) {
        return { error: "Pick a different collection to move the cards into." };
      }
      // Verify the destination is the user's (RLS makes the select return nothing otherwise).
      const { data: target } = await supabase
        .from("collections")
        .select("id")
        .eq("id", targetCollectionId)
        .single();
      if (!target) return { error: "Destination collection not found." };

      const { error: moveErr } = await supabase
        .from("cards")
        .update({ collection_id: targetCollectionId })
        .eq("collection_id", id);
      if (moveErr) return { error: moveErr.message };
    } else {
      const { error: delErr } = await supabase.from("cards").delete().eq("collection_id", id);
      if (delErr) return { error: delErr.message };
    }
  }

  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/library");
  if (cardAction === "move" && targetCollectionId) {
    revalidatePath(`/collections/${targetCollectionId}`);
  }
  return {};
}
