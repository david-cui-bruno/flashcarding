// Parse an Anki .apkg ENTIRELY IN THE BROWSER. Vercel caps serverless request bodies at
// 4.5MB, so an apkg (media → tens of MB) can't be uploaded to a server action; the browser
// already holds the file, so we unzip + read the SQLite here, then write cards/audio straight
// to Supabase with the user's session (RLS). Owner's tailored bulk import stays in
// scripts/import-apkg.ts; this is the generic self-serve path.
import { unzipSync, strFromU8 } from "fflate";

export type ApkgNote = { fields: string[]; sound: string | null };
export type ParsedApkg = {
  deckName: string;
  fieldNames: string[]; // field names of the deck's dominant note type (for the mapping UI)
  notes: ApkgNote[];
  sounds: Map<string, Uint8Array>; // referenced sound filename → bytes
};

// sql.js (wasm) loaded on demand so it never ships in the initial bundle. The wasm is served
// from /public (copied by setup); see public/sql-wasm.wasm.
let sqlPromise: Promise<{ Database: new (data: Uint8Array) => SqlDb }> | null = null;
type SqlDb = { exec: (sql: string) => { values: unknown[][] }[]; close: () => void };
async function getSql() {
  if (!sqlPromise) {
    const initSqlJs = (await import("sql.js")).default;
    sqlPromise = initSqlJs({ locateFile: () => "/sql-wasm.wasm" }) as Promise<{
      Database: new (data: Uint8Array) => SqlDb;
    }>;
  }
  return sqlPromise;
}

const DB_NAMES = ["collection.anki21b", "collection.anki21", "collection.anki2"];
const SOUND_RE = /\[sound:([^\]]+)\]/;

export async function parseApkg(buf: ArrayBuffer): Promise<ParsedApkg> {
  const u8 = new Uint8Array(buf);

  // Pass 1: decompress only the DB + the media manifest (not the media blobs).
  const meta = unzipSync(u8, { filter: (f) => DB_NAMES.includes(f.name) || f.name === "media" });
  const dbBytes = DB_NAMES.map((n) => meta[n]).find(Boolean);
  if (!dbBytes) throw new Error("This file doesn't look like an Anki .apkg (no collection database).");

  const SQL = await getSql();
  const db = new SQL.Database(dbBytes);
  let deckName = "Imported deck";
  let fieldNames: string[] = [];
  const notes: ApkgNote[] = [];
  const refNames = new Set<string>();
  try {
    const col = db.exec("SELECT models, decks FROM col LIMIT 1");
    if (!col.length) throw new Error("This .apkg has an empty collection.");
    const models = JSON.parse(String(col[0].values[0][0])) as Record<
      string,
      { name: string; flds: { name: string; ord: number }[] }
    >;
    const decks = JSON.parse(String(col[0].values[0][1])) as Record<string, { name: string }>;
    deckName =
      Object.values(decks)
        .map((d) => d.name)
        .find((n) => n && n !== "Default") || "Imported deck";

    const res = db.exec("SELECT mid, flds FROM notes ORDER BY id ASC");
    const midCounts: Record<string, number> = {};
    if (res.length) {
      for (const row of res[0].values) {
        const mid = String(row[0]);
        midCounts[mid] = (midCounts[mid] ?? 0) + 1;
        const fields = String(row[1]).split("\x1f");
        let sound: string | null = null;
        for (const f of fields) {
          const m = f.match(SOUND_RE);
          if (m) {
            sound = m[1];
            break;
          }
        }
        if (sound) refNames.add(sound);
        notes.push({ fields, sound });
      }
      // field names from the most common note type (for the front/back mapping dropdowns)
      const dominant = Object.entries(midCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (dominant && models[dominant]) {
        fieldNames = [...models[dominant].flds].sort((a, b) => a.ord - b.ord).map((f) => f.name);
      }
    }
  } finally {
    db.close();
  }
  if (notes.length === 0) throw new Error("No notes found in this deck.");

  // Pass 2: decompress only the referenced sound files.
  const sounds = new Map<string, Uint8Array>();
  if (meta["media"] && refNames.size) {
    const manifest = JSON.parse(strFromU8(meta["media"])) as Record<string, string>;
    const origToNum: Record<string, string> = {};
    for (const [num, orig] of Object.entries(manifest)) origToNum[orig] = num;
    const wanted = new Set<string>();
    for (const name of refNames) if (origToNum[name]) wanted.add(origToNum[name]);
    if (wanted.size) {
      const blobs = unzipSync(u8, { filter: (f) => wanted.has(f.name) });
      for (const name of refNames) {
        const num = origToNum[name];
        if (num && blobs[num]) sounds.set(name, blobs[num]);
      }
    }
  }

  return { deckName, fieldNames, notes, sounds };
}

// Anki fields are HTML. Convert to plain text and drop [sound:]/<img> tokens.
export function fieldToText(html: string): string {
  const noTokens = html.replace(/\[sound:[^\]]+\]/g, "").replace(/<br\s*\/?>/gi, "\n");
  const doc = new DOMParser().parseFromString(noTokens, "text/html");
  return (doc.body.textContent || "").replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
