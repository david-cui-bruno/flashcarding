import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getReviewMode } from "@/lib/metrics/server";
import { partitionPendingForReview } from "@/lib/metrics/graduation";
import { ReviewClient } from "./review-client";

export default async function ReviewPage() {
  const supabase = await createClient();

  // The graduation ladder (docs/METRICS.md) decides how much of each batch the user reviews.
  const [decision, { data: cards }] = await Promise.all([
    getReviewMode(supabase),
    supabase
      .from("cards")
      .select("id, term, definition, source_span")
      .eq("review_status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  if (!cards || cards.length === 0) {
    return (
      <p className="text-neutral-500">
        No cards to review.{" "}
        <Link href="/new" className="underline">
          Generate more
        </Link>{" "}
        or{" "}
        <Link href="/study" className="underline">
          study
        </Link>
        .
      </p>
    );
  }

  const { toReview, autoAccept } = partitionPendingForReview(
    cards.map((c) => c.id),
    decision.mode,
  );
  const toReviewSet = new Set(toReview);

  return (
    <ReviewClient
      mode={decision.mode}
      modeReason={decision.reason}
      cards={cards.filter((c) => toReviewSet.has(c.id))}
      autoAcceptIds={autoAccept}
    />
  );
}
