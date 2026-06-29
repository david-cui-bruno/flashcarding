"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ImportState = { error: string } | null;
const MAX_ROWS = 5000;

// One card per line: "term <tab|comma> definition". Quizlet's default export is tab between
// fields + newline between cards; CSV uses commas. Split on the FIRST delimiter so commas
// inside a definition survive. Skips blank / delimiter-less / empty rows.
function parseRows(text: string): { term: string; definition: string }[] {
  const rows: { term: string; definition: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const tab = line.indexOf("\t");
    const idx = tab >= 0 ? tab : line.indexOf(",");
    if (idx <= 0) continue; // no delimiter, or empty term
    const term = line.slice(0, idx).trim();
    const definition = line.slice(idx + 1).trim();
    if (term && definition) rows.push({ term, definition });
    if (rows.length >= MAX_ROWS) break;
  }
  return rows;
}

// Direct paste/CSV import — a new card type that BYPASSES the AI pipeline (no generation,
// gate, or review). Runs as the signed-in user (RLS-scoped), so it's self-serve. For big
// binary imports (Anki .apkg with media) use scripts/import-apkg.ts instead.
export async function importPastedCards(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const deckName = String(formData.get("deckName") ?? "").trim() || "Imported deck";
  const rows = parseRows(String(formData.get("text") ?? ""));
  if (rows.length === 0) {
    return { error: "No cards found. Use one per line: term, definition (or tab-separated)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: col, error: colErr } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: deckName })
    .select("id")
    .single();
  if (colErr || !col) return { error: colErr?.message ?? "Could not create the deck." };

  // Accepted/new, front = term / back = definition. Stagger `due` into the past by index so
  // scheduled study preserves the pasted order (id tiebreaker handles ties at page edges).
  const base = Date.now() - 30 * 86400_000;
  const cards = rows.map((r, i) => ({
    user_id: user.id,
    collection_id: col.id,
    term: r.term,
    definition: r.definition,
    source_span: null,
    review_status: "accepted" as const,
    prompt_direction: "term_to_definition" as const,
    reps: 0,
    fsrs_state: "new" as const,
    lapses: 0,
    stability: 0,
    difficulty: 0,
    due: new Date(base + i).toISOString(),
    last_review: null,
  }));

  for (let i = 0; i < cards.length; i += 500) {
    const { error } = await supabase.from("cards").insert(cards.slice(i, i + 500));
    if (error) {
      // Roll back the half-created deck so a failed import leaves nothing behind.
      await supabase.from("cards").delete().eq("collection_id", col.id);
      await supabase.from("collections").delete().eq("id", col.id);
      return { error: error.message };
    }
  }

  redirect(`/collections/${col.id}`);
}
