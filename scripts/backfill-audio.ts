// Backfill audio for cards that have none (audio_path null) — e.g. transient TTS failures
// during import, or any card whose front is Chinese. Generates Google TTS from the hanzi
// (the first line of `term`) and uploads to the card-audio bucket. Run locally:
//   set -a; . ./.env.local; set +a; \
//   pnpm exec tsx scripts/backfill-audio.ts --user demo [--deck "Spoonfed Chinese"]
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "../lib/auth/username";
import { synthesizeMp3 } from "../lib/tts/google";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const USERNAME = arg("user", "demo")!;
const DECK = arg("deck");
const BUCKET = "card-audio";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users.find((u) => u.email === usernameToEmail(USERNAME));
  if (!user) throw new Error(`No user "${USERNAME}"`);
  const uid = user.id;

  let q = admin.from("cards").select("id, term").eq("user_id", uid).is("audio_path", null);
  if (DECK) {
    const { data: col } = await admin
      .from("collections")
      .select("id")
      .eq("user_id", uid)
      .eq("name", DECK)
      .single();
    if (!col) throw new Error(`No deck "${DECK}" for ${USERNAME}`);
    q = q.eq("collection_id", col.id);
  }
  const { data: cards, error } = await q;
  if (error) throw error;
  console.log(`${cards?.length ?? 0} cards missing audio`);

  let fixed = 0,
    failed = 0;
  for (const c of cards ?? []) {
    const hanzi = c.term.split("\n")[0];
    try {
      const bytes = await synthesizeMp3(hanzi);
      const objectPath = `${uid}/${c.id}.mp3`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(objectPath, bytes, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw upErr;
      const { error: updErr } = await admin.from("cards").update({ audio_path: objectPath }).eq("id", c.id);
      if (updErr) throw updErr;
      fixed++;
      console.log(`  ✓ ${hanzi}`);
    } catch (err) {
      failed++;
      console.warn(`  ✗ ${hanzi}: ${(err as Error).message}`);
    }
  }
  console.log(`\n✅ backfilled ${fixed}, failed ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
