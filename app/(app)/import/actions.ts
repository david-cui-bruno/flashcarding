"use server";

import { redirect } from "next/navigation";
import { parseQuizletExport, type ImportedCard } from "@/lib/import/quizlet";
import { createClient } from "@/lib/supabase/server";

type ImportState = { error: string } | null;
const MAX_ROWS = 5000;

function parseRows(text: string): { rows: ImportedCard[]; lineCount: number } {
  const tabResult = parseQuizletExport(text, { termSeparator: "\t", rowSeparator: "\n" });
  if (tabResult.cards.length > 0) return { rows: tabResult.cards, lineCount: tabResult.rowCount };

  const commaResult = parseQuizletExport(text, { termSeparator: ",", rowSeparator: "\n" });
  return { rows: commaResult.cards, lineCount: Math.max(tabResult.rowCount, commaResult.rowCount) };
}

function parseImport(formData: FormData): { rows: ImportedCard[]; lineCount: number; error?: string } {
  const text = String(formData.get("text") ?? "");
  if (String(formData.get("importMode") ?? "paste") !== "quizlet") return parseRows(text);

  const termSeparator = String(formData.get("termSeparator") ?? "\t");
  const rowSeparator = String(formData.get("rowSeparator") ?? "\n");
  const result = parseQuizletExport(text, { termSeparator, rowSeparator });
  const blockingIssue = result.issues.find((issue) => issue.code === "empty_input" || issue.code === "single_column");
  return {
    rows: result.cards,
    lineCount: result.rowCount,
    error: blockingIssue?.message,
  };
}

// Direct paste/CSV import — a new card type that BYPASSES the AI pipeline (no generation,
// gate, or review). Runs as the signed-in user (RLS-scoped), so it's self-serve. For big
// binary imports (Anki .apkg with media) use scripts/import-apkg.ts instead.
export async function importPastedCards(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const deckName = String(formData.get("deckName") ?? "").trim() || "Imported deck";
  const { rows, lineCount, error: parseError } = parseImport(formData);
  if (lineCount > MAX_ROWS) {
    return { error: `Too many lines (${lineCount}). Paste up to ${MAX_ROWS}, or use the .apkg uploader for big decks.` };
  }
  if (parseError) return { error: parseError };
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
