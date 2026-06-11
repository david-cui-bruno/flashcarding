import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StudyClient, ModeTabs, type StudyCard } from "./study-client";

const STUDY_COLUMNS =
  "id, term, definition, source_span, prompt_direction, lapses, fsrs_state";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: modeParam } = await searchParams;
  const mode: "scheduled" | "cram" = modeParam === "cram" ? "cram" : "scheduled";

  const supabase = await createClient();

  // Both modes only ever study cards the user has accepted/edited. The difference is the
  // queue: scheduled = only cards FSRS says are due now; cram = everything, any time.
  const base = supabase
    .from("cards")
    .select(STUDY_COLUMNS)
    .in("review_status", ["accepted", "edited"]);

  const { data: cards } =
    mode === "scheduled"
      ? await base.lte("due", new Date().toISOString()).order("due", { ascending: true })
      : await base.order("created_at", { ascending: true });

  if (!cards || cards.length === 0) {
    return (
      <div className="space-y-4">
        <ModeTabs mode={mode} />
        {mode === "scheduled" ? (
          <p className="text-neutral-500">
            Nothing due right now — your schedule is clear. 🎉{" "}
            <Link href="/study?mode=cram" className="underline">
              Cram any deck
            </Link>
            ,{" "}
            <Link href="/review" className="underline">
              review pending cards
            </Link>
            , or{" "}
            <Link href="/new" className="underline">
              add more
            </Link>
            .
          </p>
        ) : (
          <p className="text-neutral-500">
            No cards to cram yet.{" "}
            <Link href="/review" className="underline">
              Review pending cards
            </Link>{" "}
            or{" "}
            <Link href="/new" className="underline">
              add more
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  return <StudyClient cards={cards as StudyCard[]} mode={mode} />;
}
