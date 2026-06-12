import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GeneratingClient } from "./generating-client";

// Live status page for an async generation job. The client subscribes to the
// generation_jobs row via Realtime and drives the batch to completion by polling
// /api/jobs/poll, then routes to /review when the cards land.
export default async function GeneratingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();

  const { data: job } = await supabase
    .from("generation_jobs")
    .select("id, status, cards_generated, error, sources(title)")
    .eq("id", jobId)
    .single();

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 text-center md:pt-24">
        <p className="text-xl font-medium">That generation job wasn&apos;t found.</p>
        <Link href="/new" className="text-sm text-primary underline">
          Start a new one
        </Link>
      </div>
    );
  }

  // Supabase types the to-one join as an array; take the first.
  const source = Array.isArray(job.sources) ? job.sources[0] : job.sources;

  return (
    <GeneratingClient
      jobId={job.id}
      title={source?.title ?? "your document"}
      initialStatus={job.status}
      initialCardsGenerated={job.cards_generated}
      initialError={job.error}
    />
  );
}
