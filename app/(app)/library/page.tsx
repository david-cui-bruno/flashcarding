import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, cards(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Library</h1>
        <Link href="/new" className="rounded bg-black px-3 py-1.5 text-sm text-white">
          New cards
        </Link>
      </div>

      {!collections || collections.length === 0 ? (
        <p className="text-neutral-500">
          No collections yet.{" "}
          <Link href="/new" className="underline">
            Generate some cards
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y rounded border">
          {collections.map((c) => {
            const count = (c.cards as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <span>{c.name}</span>
                <span className="text-sm text-neutral-500">{count} cards</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
