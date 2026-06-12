import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectionDetailClient, type DetailCard } from "./collection-detail-client";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes to the owner; a miss means it's gone or not theirs.
  const { data: collection } = await supabase
    .from("collections")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!collection) notFound();

  const [{ data: cards }, { data: others }] = await Promise.all([
    supabase
      .from("cards")
      .select("id, term, definition, source_span, review_status, fsrs_state, due")
      .eq("collection_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("collections").select("id, name").neq("id", id).order("name"),
  ]);

  // Header count triplet (new + learning + due now), among studiable cards.
  const nowIso = new Date().toISOString();
  let nw = 0,
    learning = 0,
    due = 0;
  for (const c of cards ?? []) {
    const studyable = c.review_status === "accepted" || c.review_status === "edited";
    if (studyable && c.due && c.due <= nowIso) {
      if (c.fsrs_state === "new") nw++;
      else if (c.fsrs_state === "learning" || c.fsrs_state === "relearning") learning++;
      else due++;
    }
  }

  return (
    <CollectionDetailClient
      collectionId={collection.id}
      collectionName={collection.name}
      cards={(cards as DetailCard[]) ?? []}
      otherCollections={others ?? []}
      triplet={{ nw, learning, due }}
    />
  );
}
