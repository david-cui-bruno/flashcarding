import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STUDY_COLUMNS, type StudyCard } from "@/lib/study/study-card";
import { StudyGate } from "./study-gate";
import { StudyDeckClient } from "./study-deck-client";

// STUDY_COLUMNS (lib/study/study-card) carries the full FSRS state — the session
// runs the scheduler client-side to preview grade intervals and re-queue
// learning-step cards (Anki-style). Display fields too.

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
    // Exact COUNT queries (not row fetches) so big decks aren't capped by the PostgREST
    // max-rows limit (1000) — a deck can have many thousands of cards.
    const nowIso = new Date().toISOString();
    const countBase = () =>
      supabase
        .from("cards")
        .select("*", { count: "exact", head: true })
        .eq("collection_id", collectionId)
        .in("review_status", ["accepted", "edited"]);
    const [cramRes, newRes, learnRes, dueRes] = await Promise.all([
      countBase(),
      countBase().eq("fsrs_state", "new").lte("due", nowIso),
      countBase().in("fsrs_state", ["learning", "relearning"]).lte("due", nowIso),
      countBase().eq("fsrs_state", "review").lte("due", nowIso),
    ]);
    const nw = newRes.count ?? 0;
    const learning = learnRes.count ?? 0;
    const due = dueRes.count ?? 0;
    const cram = cramRes.count ?? 0;

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

  // Page past the PostgREST max-rows cap (1000) so the WHOLE deck loads — no daily limit
  // (docs/SCHEDULING.md: new cards are uncapped). Small decks return in a single page.
  const nowIso = new Date().toISOString();
  const PAGE = 1000;
  async function fetchPage(from: number) {
    const base = supabase
      .from("cards")
      .select(STUDY_COLUMNS)
      .eq("collection_id", collectionId)
      .in("review_status", ["accepted", "edited"]);
    // Secondary sort by id → deterministic pagination. Without it, Postgres can skip or
    // duplicate rows with tied due/created_at across .range() page boundaries (>1000 cards).
    const q =
      mode === "scheduled"
        ? base.lte("due", nowIso).order("due", { ascending: true }).order("id", { ascending: true })
        : base.order("created_at", { ascending: true }).order("id", { ascending: true });
    return (await q.range(from, from + PAGE - 1)).data ?? [];
  }
  const cards: Awaited<ReturnType<typeof fetchPage>> = [];
  for (let from = 0; ; from += PAGE) {
    const page = await fetchPage(from);
    cards.push(...page);
    if (page.length < PAGE) break;
  }

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
    audio_path: c.audio_path,
  }));

  return <StudyDeckClient deckId={deck.id} name={deck.name} cards={studyCards} mode={mode} />;
}
