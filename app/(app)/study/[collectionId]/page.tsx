import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { previewIntervals } from "@/lib/scheduling/fsrs";
import { StudyGate } from "./study-gate";
import { StudyDeckClient, type StudyCard } from "./study-deck-client";

// Full FSRS state is needed to preview grade intervals; display fields too.
const STUDY_COLUMNS =
  "id, term, definition, prompt_direction, lapses, fsrs_state, due, stability, difficulty, elapsed_days, scheduled_days, reps, last_review";

export default async function DeckStudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { collectionId } = await params;
  const { mode: modeParam } = await searchParams;
  const supabase = await createClient();

  // RLS scopes to the owner; a miss means not-yours / gone.
  const { data: deck } = await supabase
    .from("collections")
    .select("id, name")
    .eq("id", collectionId)
    .single();
  if (!deck) notFound();

  // No mode chosen → the gate (Study due / Cram all).
  if (modeParam !== "due" && modeParam !== "cram") {
    const nowIso = new Date().toISOString();
    const { data: cards } = await supabase
      .from("cards")
      .select("fsrs_state, due")
      .eq("collection_id", collectionId)
      .in("review_status", ["accepted", "edited"]);

    let nw = 0,
      learning = 0,
      due = 0,
      cram = 0;
    for (const c of cards ?? []) {
      cram++;
      if (c.due && c.due <= nowIso) {
        if (c.fsrs_state === "new") nw++;
        else if (c.fsrs_state === "learning" || c.fsrs_state === "relearning") learning++;
        else due++;
      }
    }

    return (
      <StudyGate
        deckId={deck.id}
        name={deck.name}
        triplet={{ nw, learning, due }}
        dueTotal={nw + learning + due}
        cramTotal={cram}
      />
    );
  }

  const mode: "scheduled" | "cram" = modeParam === "cram" ? "cram" : "scheduled";
  const base = supabase
    .from("cards")
    .select(STUDY_COLUMNS)
    .eq("collection_id", collectionId)
    .in("review_status", ["accepted", "edited"]);

  const { data: cards } =
    mode === "scheduled"
      ? await base.lte("due", new Date().toISOString()).order("due", { ascending: true })
      : await base.order("created_at", { ascending: true });

  const now = new Date();
  const studyCards: StudyCard[] = (cards ?? []).map((c) => ({
    id: c.id,
    term: c.term,
    definition: c.definition,
    prompt_direction: c.prompt_direction,
    lapses: c.lapses,
    fsrs_state: c.fsrs_state,
    // Cram never reschedules, so previews would mislead — only compute for scheduled.
    intervals: mode === "scheduled" ? previewIntervals(c) : null,
  }));

  return <StudyDeckClient deckId={deck.id} name={deck.name} cards={studyCards} mode={mode} />;
}
