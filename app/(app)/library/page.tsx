import { createClient } from "@/lib/supabase/server";
import { LibraryClient, type CollectionSummary } from "./library-client";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("id, name, cards(count)")
    .order("created_at", { ascending: false });

  const collections: CollectionSummary[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    count: (c.cards as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  return <LibraryClient collections={collections} />;
}
