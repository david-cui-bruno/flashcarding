import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getReviewMode } from "@/lib/metrics/server";
import { partitionPendingForReview } from "@/lib/metrics/graduation";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl font-medium">No cards to review.</p>
        <p className="text-sm text-muted-foreground">
          Freshly generated cards land here for a quick triage.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/new">Generate more</Link>
          </Button>
          <Button asChild>
            <Link href="/library">Back to decks</Link>
          </Button>
        </div>
      </div>
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
