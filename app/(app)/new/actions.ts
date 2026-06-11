"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitGenerationBatch } from "@/lib/generation/submit";
import { selectFewShotExamples } from "@/lib/feedback";

type GenState = { error: string } | null;

// Kicks off ASYNCHRONOUS generation (docs/PIPELINE.md, ARCHITECTURE "Batch
// API"): persist the source, create a generation_jobs row, submit the batch,
// and hand off to the job page where the client subscribes via Realtime. No
// blocking on the model — the user comes back to a finished deck.
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

  // 1. Persist the source (retained for grounding / provenance — PIPELINE).
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({ user_id: user.id, kind: "paste", title, content: text })
    .select("id")
    .single();
  if (srcErr || !source) return { error: srcErr?.message ?? "Could not save source." };

  // 2. Create the job row up front so the client has something to subscribe to,
  //    even if submission fails.
  const { data: job, error: jobErr } = await supabase
    .from("generation_jobs")
    .insert({ user_id: user.id, source_id: source.id, status: "queued" })
    .select("id")
    .single();
  if (jobErr || !job) return { error: jobErr?.message ?? "Could not start generation." };

  // 3. Submit the batch (chunk → extract→draft per chunk). The user's past
  //    review actions tune the prompt as dynamic few-shot examples.
  try {
    const examples = await selectFewShotExamples({
      client: supabase,
      userId: user.id,
      sourceText: text,
    });
    const submitted = await submitGenerationBatch(text, examples);
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
        error: "Could not submit generation: " +
          (e instanceof Error ? e.message : "unknown error"),
      })
      .eq("id", job.id);
    // Still hand off to the job page, which surfaces the failure.
  }

  // 4. Hand off to the job's live status page (must be outside try/catch —
  //    redirect() throws a control-flow signal that has to propagate).
  redirect(`/new/${job.id}`);
}
