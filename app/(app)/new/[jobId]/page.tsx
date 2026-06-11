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
    .select("id, status, cards_generated, error")
    .eq("id", jobId)
    .single();

  if (!job) {
    return (
      <p className="text-neutral-500">
        That generation job wasn&apos;t found.{" "}
        <Link href="/new" className="underline">
          Start a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <GeneratingClient
      jobId={job.id}
      initialStatus={job.status}
      initialCardsGenerated={job.cards_generated}
      initialError={job.error}
    />
  );
}
