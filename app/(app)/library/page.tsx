import { createClient } from "@/lib/supabase/server";
import { DecksHome, type DeckSummary } from "./decks-home-client";

// "Decks" home — the hub. Each deck links to its study gate; ⋯ opens manage.
// We aggregate per-deck counts so a deck with cards due can show the accent ring
// and count, and freshly-made decks read as "new".
export default async function LibraryPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: collections }, { data: cards }] = await Promise.all([
    supabase.from("collections").select("id, name").order("created_at", { ascending: false }),
    supabase.from("cards").select("collection_id, review_status, due, reps"),
  ]);

  type Agg = { total: number; studyable: number; dueNow: number; studied: boolean };
  const agg = new Map<string, Agg>();
  let triageCount = 0;
  for (const c of cards ?? []) {
    if (c.review_status === "pending") triageCount++;
    if (!c.collection_id) continue;
    const a = agg.get(c.collection_id) ?? { total: 0, studyable: 0, dueNow: 0, studied: false };
    a.total++;
    const studyable = c.review_status === "accepted" || c.review_status === "edited";
    if (studyable) {
      a.studyable++;
      if (c.due && c.due <= nowIso) a.dueNow++;
      if ((c.reps ?? 0) > 0) a.studied = true;
    }
    agg.set(c.collection_id, a);
  }

  const decks: DeckSummary[] = (collections ?? []).map((c) => {
    const a = agg.get(c.id) ?? { total: 0, studyable: 0, dueNow: 0, studied: false };
    let state: DeckSummary["state"] = "none";
    if (a.dueNow > 0) state = a.studied ? "due" : "new";
    else if (a.studyable > 0) state = "caught-up";
    return { id: c.id, name: c.name, total: a.total, dueNow: a.dueNow, state };
  });

  return <DecksHome decks={decks} triageCount={triageCount} />;
}
