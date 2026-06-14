import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudyGate } from "./study-gate";
import { StudyDeckClient, type StudyCard } from "./study-deck-client";

// Full FSRS state — the session runs the scheduler client-side to preview grade
// intervals and re-queue learning-step cards (Anki-style). Display fields too.
const STUDY_COLUMNS =
  "id, term, definition, prompt_direction, lapses, fsrs_state, due, stability, difficulty, elapsed_days, scheduled_days, reps, last_review, learning_steps";

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

  const studyCards: StudyCard[] = (cards ?? []).map((c) => ({
    id: c.id,
    term: c.term,
    definition: c.definition,
    prompt_direction: c.prompt_direction,
    lapses: c.lapses,
    fsrs_state: c.fsrs_state,
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    last_review: c.last_review,
    learning_steps: c.learning_steps,
  }));

  return <StudyDeckClient deckId={deck.id} name={deck.name} cards={studyCards} mode={mode} />;
}
