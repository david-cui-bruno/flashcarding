import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudyClient } from "./study-client";

export default async function StudyPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, term, definition, source_span")
    .in("review_status", ["accepted", "edited"])
    .lte("due", now)
    .order("due", { ascending: true })
    .limit(100);

  if (!cards || cards.length === 0) {
    return (
      <p className="text-neutral-500">
        Nothing due right now.{" "}
        <Link href="/review" className="underline">
          Review pending cards
        </Link>{" "}
        or{" "}
        <Link href="/new" className="underline">
          add more
        </Link>
        .
      </p>
    );
  }
  return <StudyClient cards={cards} />;
}
