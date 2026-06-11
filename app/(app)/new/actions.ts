"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitGenerationBatch } from "@/lib/generation/submit";
import { selectFewShotExamples } from "@/lib/feedback";
import { parseToMarkdown, extensionOf, isSupported, type ParseMode } from "@/lib/ingestion";
import type { Database } from "@/lib/types/database";

type GenState = { error: string } | null;
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SourceKind = Database["public"]["Enums"]["source_kind"];

// Keep in sync with serverActions.bodySizeLimit in next.config.ts.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// Shared ASYNCHRONOUS generation core (docs/PIPELINE.md, ARCHITECTURE "Batch API").
// Both the paste path and the upload path hand off here, so PDF/Word use the SAME async
// Batch pipeline as pasted text — only the ingestion stage in front of it differs. Persist
// the source, create a generation_jobs row, submit the batch, and hand off to the job's live
// status page (the client subscribes via Realtime). Never blocks on the model — collection
// creation and card insertion happen when the batch completes (lib/generation/process.ts).
async function startDeckGeneration(
  supabase: SupabaseServerClient,
  userId: string,
  kind: SourceKind,
  title: string,
  content: string,
): Promise<GenState> {
  // 1. Persist the source (kept for grounding / provenance — docs/PIPELINE.md).
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({ user_id: userId, kind, title, content })
    .select("id")
    .single();
  if (srcErr || !source) return { error: srcErr?.message ?? "Could not save source." };

  // 2. Create the job row up front so the client has something to subscribe to,
  //    even if submission fails.
  const { data: job, error: jobErr } = await supabase
    .from("generation_jobs")
    .insert({ user_id: userId, source_id: source.id, status: "queued" })
    .select("id")
    .single();
  if (jobErr || !job) return { error: jobErr?.message ?? "Could not start generation." };

  // 3. Submit the batch (chunk → extract→draft per chunk). The user's past review
  //    actions tune the prompt as dynamic few-shot examples (lib/feedback).
  try {
    const examples = await selectFewShotExamples({
      client: supabase,
      userId,
      sourceText: content,
    });
    const submitted = await submitGenerationBatch(content, examples);
    if (!submitted) throw new Error("Source produced no content to generate from.");

    await supabase
      .from("generation_jobs")
      .update({ status: "running", anthropic_batch_id: submitted.batchId })
      .eq("id", job.id);
  } catch (e) {
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error:
          "Could not submit generation: " +
          (e instanceof Error ? e.message : "unknown error"),
      })
      .eq("id", job.id);
    // Still hand off to the job page, which surfaces the failure.
  }

  // 4. Hand off to the job's live status page (must be outside try/catch —
  //    redirect() throws a control-flow signal that has to propagate).
  redirect(`/new/${job.id}`);
}

// Paste path: generate from pasted text / markdown.
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
  return startDeckGeneration(supabase, user.id, "paste", title, text);
}

// Upload path: PDF/.docx → markdown (ingestion sidecar) → same async pipeline.
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
  return startDeckGeneration(supabase, user.id, kind, title, markdown);
}
