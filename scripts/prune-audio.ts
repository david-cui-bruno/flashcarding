// Prune ORPHANED card-audio objects — storage keys that no DB card references (left behind
// when a deck is deleted/re-imported, since cards cascade but their audio files don't).
//
// SAFE BY DESIGN:
//   • dry-run by default — prints what it WOULD delete; pass --delete to actually remove.
//   • user-scoped (--user required) — only touches that user's <uid>/ folder.
//   • deletes only keys NOT referenced by ANY of the user's cards (checked deck-wide, so a
//     key still used by another deck is never removed). NB: an orphan's card is already gone,
//     so orphans can't be attributed to a deck — per-user is the safe unit, not per-deck.
//   • only considers *.mp3 keys; refuses to delete everything if 0 cards reference audio
//     (likely a query failure) unless --force.
//   • logs the count + a sample of keys before deleting.
//
// Run: set -a; . ./.env.local; set +a; pnpm exec tsx scripts/prune-audio.ts --user demo [--delete] [--force]
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "../lib/auth/username";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const USERNAME = arg("user");
const DELETE = flag("delete");
const FORCE = flag("force");
const BUCKET = "card-audio";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  if (!USERNAME) throw new Error("pass --user <username>");
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users.find((u) => u.email === usernameToEmail(USERNAME));
  if (!user) throw new Error(`No user "${USERNAME}"`);
  const uid = user.id;

  // 1. Referenced keys = every audio_path across ALL the user's cards (paginated past the
  //    1000-row cap, ordered by id for stable pagination).
  const referenced = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("cards")
      .select("audio_path")
      .eq("user_id", uid)
      .not("audio_path", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) if (r.audio_path) referenced.add(r.audio_path);
    if (data.length < 1000) break;
  }

  // 2. All storage keys under <uid>/ (paginated). Only *.mp3 (skip folder placeholders etc).
  const keys: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(uid, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const o of data) if (o.name.endsWith(".mp3")) keys.push(`${uid}/${o.name}`);
    if (data.length < 1000) break;
  }

  // 3. Orphans = stored keys with no referencing card.
  const orphans = keys.filter((k) => !referenced.has(k));
  console.log(`user="${USERNAME}" (${uid})`);
  console.log(`  stored .mp3 objects:     ${keys.length}`);
  console.log(`  referenced by cards:     ${referenced.size}`);
  console.log(`  ORPHANS (unreferenced):  ${orphans.length}`);
  if (orphans.length) console.log(`  sample:`, orphans.slice(0, 10));

  if (orphans.length === 0) {
    console.log("\n✅ nothing to prune.");
    return;
  }
  if (!DELETE) {
    console.log("\n(dry run — pass --delete to remove the orphans above)");
    return;
  }
  if (referenced.size === 0 && !FORCE) {
    throw new Error(
      `Refusing to delete ${orphans.length} objects: 0 cards reference audio for this user ` +
        `(possible query failure). Re-run with --force if this is truly intended.`,
    );
  }

  // 4. Delete in batches.
  let deleted = 0;
  for (let i = 0; i < orphans.length; i += 1000) {
    const batch = orphans.slice(i, i + 1000);
    const { error } = await admin.storage.from(BUCKET).remove(batch);
    if (error) throw error;
    deleted += batch.length;
    console.log(`  deleted ${deleted}/${orphans.length}`);
  }
  console.log(`\n✅ pruned ${deleted} orphaned audio objects.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
