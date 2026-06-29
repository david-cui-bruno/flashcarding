// Import an Anki .apkg deck into a user's account as a new card type that BYPASSES the
// AI generation pipeline (lands as already-`accepted` new cards). Built for Chinese decks
// like Spoonfed: front = Hanzi + Pinyin, back = English + audio. Existing native audio is
// kept; missing audio is filled with Google TTS (lib/tts/google.ts). Run locally with the
// service-role key (a 76MB/7k-card/4.6k-file import is wrong for a serverless upload).
//
// Run:
//   set -a; . ./.env.local; set +a; \
//   pnpm exec tsx scripts/import-apkg.ts \
//     --apkg .context/attachments/02i6gK/Spoonfed_Chinese.apkg \
//     --user demo [--deck "Spoonfed Chinese"] [--limit 20]
//
// Re-running replaces any same-named deck for that user (cards cascade).
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { usernameToEmail } from "../lib/auth/username";
import { synthesizeMp3 } from "../lib/tts/google";

// ---- args ----
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const APKG = arg("apkg", ".context/attachments/02i6gK/Spoonfed_Chinese.apkg")!;
const USERNAME = arg("user", "demo")!;
const DECK_OVERRIDE = arg("deck");
const limitArg = arg("limit");
const LIMIT = limitArg !== undefined ? Number(limitArg) : undefined;
const WORKDIR = arg("workdir", ".context/apkg-import")!;
const CONCURRENCY = 8;
const BUCKET = "card-audio";

type Note = {
  idx: number;
  hanzi: string;
  pinyin: string;
  english: string;
  audioDiskPath: string | null;
  audioMissing: boolean;
};

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Run N async tasks with bounded concurrency, preserving input order in the output.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  // 1. Parse the apkg → manifest (stdlib Python, no deps).
  console.log(`Parsing ${APKG} …`);
  const summary = execFileSync("python3", ["scripts/apkg/parse-apkg.py", APKG, WORKDIR], {
    encoding: "utf-8",
  });
  console.log(summary.trim());
  const manifest = JSON.parse(readFileSync(path.join(WORKDIR, "manifest.json"), "utf-8")) as {
    deckName: string;
    notes: Note[];
  };
  let notes = manifest.notes;
  if (LIMIT !== undefined) notes = notes.slice(0, LIMIT);
  const deckName = DECK_OVERRIDE ?? manifest.deckName;
  console.log(`Importing ${notes.length} cards into deck "${deckName}" for user "${USERNAME}"`);

  // 2. Resolve target user.
  const email = usernameToEmail(USERNAME);
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users.find((u) => u.email === email);
  if (!user) throw new Error(`No user "${USERNAME}" (${email}). Create the account first.`);
  const uid = user.id;

  // 3. Replace any same-named deck (idempotent re-runs).
  const { data: prior } = await admin
    .from("collections")
    .select("id")
    .eq("user_id", uid)
    .eq("name", deckName);
  for (const c of prior ?? []) {
    await admin.from("cards").delete().eq("collection_id", c.id);
    await admin.from("collections").delete().eq("id", c.id);
    console.log(`replaced existing deck ${c.id}`);
  }
  const { data: col, error: colErr } = await admin
    .from("collections")
    .insert({ user_id: uid, name: deckName })
    .select("id")
    .single();
  if (colErr || !col) throw colErr ?? new Error("collection insert failed");
  const collectionId = col.id;

  // 4. For each note: get audio bytes (native file or TTS), upload, build the card row.
  // Stagger `due` a few seconds into the PAST by apkg index so scheduled study (orders by
  // `due` asc, filters due<=now) surfaces them in the original Spoonfed sequence.
  const dueBase = Date.now() - 30 * 86400_000;
  let usedNative = 0,
    usedTts = 0,
    audioFailed = 0,
    done = 0;

  const rows = await mapPool(notes, CONCURRENCY, async (n) => {
    const id = randomUUID();
    const term = n.pinyin ? `${n.hanzi}\n${n.pinyin}` : n.hanzi;
    const definition = n.english || "(no translation)";
    const objectPath = `${uid}/${id}.mp3`;

    let audioPath: string | null = null;
    try {
      let bytes: Buffer;
      if (n.audioDiskPath) {
        bytes = readFileSync(n.audioDiskPath);
        usedNative++;
      } else {
        bytes = await synthesizeMp3(n.hanzi);
        usedTts++;
      }
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(objectPath, bytes, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw upErr;
      audioPath = objectPath;
    } catch (err) {
      audioFailed++;
      console.warn(`audio failed for #${n.idx} (${n.hanzi}): ${(err as Error).message}`);
    }

    if (++done % 250 === 0) console.log(`  …${done}/${notes.length}`);
    return {
      id,
      user_id: uid,
      collection_id: collectionId,
      term,
      definition,
      audio_path: audioPath,
      source_span: null,
      review_status: "accepted" as const,
      prompt_direction: "term_to_definition" as const,
      reps: 0,
      fsrs_state: "new" as const,
      lapses: 0,
      stability: 0,
      difficulty: 0,
      due: new Date(dueBase + n.idx).toISOString(),
      last_review: null,
    };
  });

  // 5. Insert cards in chunks.
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await admin.from("cards").insert(chunk);
    if (error) throw error;
    console.log(`  inserted ${Math.min(i + 500, rows.length)}/${rows.length} cards`);
  }

  console.log(
    `\n✅ done. deck="${deckName}" id=${collectionId} cards=${rows.length} ` +
      `(native audio: ${usedNative}, TTS: ${usedTts}, audio failed: ${audioFailed})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
