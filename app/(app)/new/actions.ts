"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateCards } from "@/lib/generation/generate";

type GenState = { error: string } | null;

export async function generateFromText(
  _prev: GenState,
  formData: FormData,
): Promise<GenState> {
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 20) return { error: "Please paste a bit more text." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const title = text.split("\n")[0].slice(0, 80) || "Pasted text";

  // 1. Persist the source (kept for grounding / provenance — see docs/PIPELINE.md).
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({ user_id: user.id, kind: "paste", title, content: text })
    .select("id")
    .single();
  if (srcErr || !source) return { error: srcErr?.message ?? "Could not save source." };

  // 2. Generate (skeleton: one synchronous Sonnet call; production = async Batch).
  let generated;
  try {
    generated = await generateCards(text);
  } catch (e) {
    return {
      error: "Generation failed: " + (e instanceof Error ? e.message : "unknown error"),
    };
  }
  if (generated.length === 0) {
    return { error: "No cards were generated from that text." };
  }

  // 3. One collection per run, named after the source (cards reassignable later).
  const { data: collection, error: colErr } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: title })
    .select("id")
    .single();
  if (colErr || !collection) {
    return { error: colErr?.message ?? "Could not create collection." };
  }

  // 4. Insert cards as pending, awaiting review.
  const rows = generated.map((c) => ({
    user_id: user.id,
    collection_id: collection.id,
    source_id: source.id,
    term: c.term,
    definition: c.definition,
    source_span: c.source_span,
    review_status: "pending" as const,
  }));
  const { error: cardsErr } = await supabase.from("cards").insert(rows);
  if (cardsErr) return { error: cardsErr.message };

  redirect("/review");
}
