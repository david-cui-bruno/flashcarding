"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateCards } from "@/lib/generation/generate";
import { parseToMarkdown, extensionOf, isSupported, type ParseMode } from "@/lib/ingestion";
import type { Database } from "@/lib/types/database";

type GenState = { error: string } | null;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SourceKind = Database["public"]["Enums"]["source_kind"];

// Keep in sync with serverActions.bodySizeLimit in next.config.ts.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Shared persist→generate→collect→insert→redirect core. Both the paste path and
// the upload path hand off here so PDF/Word use the SAME generation path as
// pasted text (docs/PIPELINE.md). The generation logic is unchanged — only the
// ingestion stage in front of it differs.
async function createDeckFromContent(
  supabase: SupabaseServerClient,
  userId: string,
  kind: SourceKind,
  title: string,
  content: string,
): Promise<GenState> {
  // 1. Persist the source (kept for grounding / provenance — see docs/PIPELINE.md).
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({ user_id: userId, kind, title, content })
    .select("id")
    .single();
  if (srcErr || !source) return { error: srcErr?.message ?? "Could not save source." };

  // 2. Generate (skeleton: one synchronous Sonnet call; production = async Batch).
  let generated;
  try {
    generated = await generateCards(content);
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
    .insert({ user_id: userId, name: title })
    .select("id")
    .single();
  if (colErr || !collection) {
    return { error: colErr?.message ?? "Could not create collection." };
  }

  // 4. Insert cards as pending, awaiting review.
  const rows = generated.map((c) => ({
    user_id: userId,
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
  return createDeckFromContent(supabase, user.id, "paste", title, text);
}

export async function generateFromFile(
  _prev: GenState,
  formData: FormData,
): Promise<GenState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a PDF or .docx file." };
  }
  if (!isSupported(file.name)) {
    return { error: "Only PDF and .docx files are supported." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is too large (max 25 MB)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // "Complex layout" toggle → force the layout-aware Docling parser. Otherwise
  // auto-select (MarkItDown fast path, Docling fallback on low-yield extraction).
  const mode: ParseMode = formData.get("complex") ? "docling" : "auto";

  let markdown: string;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await parseToMarkdown(bytes, file.name, { mode });
    markdown = result.markdown;
  } catch (e) {
    return {
      error: "Could not read that file: " + (e instanceof Error ? e.message : "unknown error"),
    };
  }
  if (markdown.trim().length < 20) {
    return { error: "We couldn't extract enough text from that file." };
  }

  const ext = extensionOf(file.name); // "pdf" | "docx" (validated above)
  const kind: SourceKind = ext === "pdf" ? "pdf" : "docx";
  const title = file.name.replace(/\.(pdf|docx)$/i, "") || file.name;
  return createDeckFromContent(supabase, user.id, kind, title, markdown);
}
