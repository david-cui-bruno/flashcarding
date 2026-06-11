import { createClient } from "@/lib/supabase/server";
import { processBatch } from "@/lib/generation/process";

// POST /api/jobs/poll  { jobId }
//
// Advances one async generation job: checks the Anthropic batch and, once it has
// ended, gates + persists the cards (see lib/generation/process.ts). The client
// on the "generating" page calls this on an interval while it also subscribes to
// the generation_jobs row via Realtime — Realtime gives the instant cross-device
// update, this endpoint is what actually drives the batch to completion in a
// serverless deployment (no always-on worker). Safe to call repeatedly.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let jobId: string | undefined;
  try {
    const body = (await request.json()) as { jobId?: string };
    jobId = body.jobId;
  } catch {
    // fall through to the missing-jobId check
  }
  if (!jobId) {
    return Response.json({ error: "Missing jobId." }, { status: 400 });
  }

  // RLS scopes this to the caller's own jobs.
  const { data: job, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (error || !job) {
    return Response.json({ error: "Job not found." }, { status: 404 });
  }

  try {
    const outcome = await processBatch(supabase, job);
    return Response.json(outcome);
  } catch (e) {
    // Transient error (network / API blip) — leave the job running so the next
    // poll retries rather than wedging it.
    const message = e instanceof Error ? e.message : "Polling failed.";
    return Response.json({ status: "running", warning: message }, { status: 200 });
  }
}
