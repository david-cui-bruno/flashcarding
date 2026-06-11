import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ReviewClient } from "./review-client";

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, term, definition, source_span")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true });

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
  return <ReviewClient cards={cards} />;
}
