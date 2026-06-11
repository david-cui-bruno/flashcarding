import Link from "next/link";
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
      .select("id, term, definition, source_span, review_status")
      .eq("collection_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("collections").select("id, name").neq("id", id).order("name"),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <Link href="/library" className="text-neutral-500 hover:text-black">
          ← Library
        </Link>
      </div>
      <CollectionDetailClient
        collectionId={collection.id}
        collectionName={collection.name}
        cards={(cards as DetailCard[]) ?? []}
        otherCollections={others ?? []}
      />
    </div>
  );
}
