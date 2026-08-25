// One-way Anki → Dory sync engine (docs/INTEGRATIONS.md §1, v1 scope).
//
// Mapping mirrors the .apkg importer (lib/apkg/parse-client.ts + app/(app)/import/
// apkg-uploader.tsx): one Anki NOTE → one Dory card, term = first field, definition =
// second field (by the note type's field order), landing as already-`accepted` new
// cards that bypass the AI pipeline. Unlike the importer (which keeps no link back to
// Anki and duplicates on re-import), sync stores `cards.anki_note_id` +
// `cards.anki_note_mod` and `collections.anki_deck_id` (migration
// 20260825030000_anki_sync_ids), so re-runs are incremental: unchanged notes are
// skipped via mod timestamps, edited notes update in place, renamed decks rename the
// collection. Deletions in Anki and media files are NOT synced in v1 (deferred).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/types/database";
import { AnkiConnectClient, AnkiConnectError, deckQuery, type NoteInfo } from "./ankiconnect";

type Db = SupabaseClient<Database>;

export type SyncProgress = (message: string) => void;

export type DeckSyncResult = {
  deckName: string;
  ankiDeckId: number;
  collectionId: string;
  notesInAnki: number;
  added: number;
  updated: number;
  unchanged: number;
  skippedEmpty: number;
};

export type SyncSummary = {
  decks: DeckSyncResult[];
  added: number;
  updated: number;
  unchanged: number;
};

const CHUNK = 500; // ids per AnkiConnect call / rows per Supabase batch

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Anki fields are HTML (possibly with cloze + [sound:] tokens). Node has no DOMParser,
// so this is a regex-based mirror of lib/apkg/parse-client.ts fieldToText.
export function ankiFieldToText(html: string): string {
  return html
    .replace(/\{\{c\d+::([^}]*?)(?:::[^}]*)?\}\}/g, "$1") // cloze {{c1::text::hint}} → text
    .replace(/\[sound:[^\]]+\]/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:div|p|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** term/definition from a note, exactly like the apkg importer's default field mapping. */
export function noteToCardContent(note: NoteInfo): { term: string; definition: string } | null {
  const ordered = Object.values(note.fields).sort((a, b) => a.order - b.order);
  const front = ankiFieldToText(ordered[0]?.value ?? "");
  const back = ankiFieldToText(ordered[1]?.value ?? "");
  const term = front || back;
  if (!term) return null; // need a prompt (importer skips these too)
  return { term, definition: front ? back : "" };
}

/** Find-or-create the Dory collection for an Anki deck; renames follow Anki. */
async function ensureCollection(
  db: Db,
  userId: string,
  deckName: string,
  ankiDeckId: number,
): Promise<string> {
  const { data: existing, error: selErr } = await db
    .from("collections")
    .select("id, name")
    .eq("user_id", userId)
    .eq("anki_deck_id", ankiDeckId)
    .maybeSingle();
  if (selErr) throw new Error(`collections lookup failed: ${selErr.message}`);
  if (existing) {
    if (existing.name !== deckName) {
      const { error } = await db.from("collections").update({ name: deckName }).eq("id", existing.id);
      if (error) throw new Error(`collection rename failed: ${error.message}`);
    }
    return existing.id;
  }
  const { data: created, error: insErr } = await db
    .from("collections")
    .insert({ user_id: userId, name: deckName, anki_deck_id: ankiDeckId })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(`collection create failed: ${insErr?.message}`);
  return created.id;
}

/** Existing synced cards for these Anki note ids (any collection — notes can move decks). */
async function fetchExisting(
  db: Db,
  userId: string,
  noteIds: number[],
): Promise<Map<number, { id: string; mod: number; collectionId: string | null }>> {
  const map = new Map<number, { id: string; mod: number; collectionId: string | null }>();
  for (const chunk of chunks(noteIds, CHUNK)) {
    const { data, error } = await db
      .from("cards")
      .select("id, anki_note_id, anki_note_mod, collection_id")
      .eq("user_id", userId)
      .in("anki_note_id", chunk);
    if (error) throw new Error(`cards lookup failed: ${error.message}`);
    for (const row of data ?? []) {
      if (row.anki_note_id != null) {
        map.set(row.anki_note_id, {
          id: row.id,
          mod: row.anki_note_mod ?? 0,
          collectionId: row.collection_id,
        });
      }
    }
  }
  return map;
}

/** id → mod for all notes; falls back to notesInfo when the add-on lacks notesModTime. */
async function fetchModTimes(anki: AnkiConnectClient, noteIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  for (const chunk of chunks(noteIds, CHUNK)) {
    try {
      for (const { noteId, mod } of await anki.notesModTime(chunk)) map.set(noteId, mod);
    } catch (e) {
      if (e instanceof AnkiConnectError && e.kind === "plugin-missing") {
        for (const n of await anki.notesInfo(chunk)) if (n.noteId) map.set(n.noteId, n.mod ?? 0);
      } else {
        throw e;
      }
    }
  }
  return map;
}

export async function syncAnkiToDory(opts: {
  db: Db;
  userId: string;
  anki?: AnkiConnectClient;
  /** Only sync these deck names (exact match). Default: every non-empty deck. */
  decks?: string[];
  progress?: SyncProgress;
}): Promise<SyncSummary> {
  const anki = opts.anki ?? new AnkiConnectClient();
  const log: SyncProgress = opts.progress ?? (() => {});

  const apiVersion = await anki.version(); // throws not-running / plugin-missing early
  log(`connected to AnkiConnect (API v${apiVersion})`);

  const deckIds = await anki.deckNamesAndIds();
  let deckNames = Object.keys(deckIds).sort();
  if (opts.decks) {
    const wanted = new Set(opts.decks);
    deckNames = deckNames.filter((d) => wanted.has(d));
    const missing = opts.decks.filter((d) => !(d in deckIds));
    if (missing.length) throw new Error(`deck(s) not found in Anki: ${missing.join(", ")}`);
  }

  const summary: SyncSummary = { decks: [], added: 0, updated: 0, unchanged: 0 };

  for (const deckName of deckNames) {
    // deck:"…" matches subdecks too; sync each deck's own notes only, so a note in
    // "Parent::Child" lands once (in the Child collection, which carries the full path name).
    const childPrefix = `${deckName}::`;
    const noteIds = (await anki.findNotes(deckQuery(deckName))).sort((a, b) => a - b);
    if (noteIds.length === 0) continue;

    // Which of the deck-query notes actually live in THIS deck (not a subdeck)? Resolve via
    // notesInfo cards → cardsInfo deckName only when subdecks exist (cheap common case first).
    const hasSubdecks = deckNames.some((d) => d.startsWith(childPrefix));
    let ownNoteIds = noteIds;
    if (hasSubdecks) {
      ownNoteIds = [];
      for (const chunk of chunks(noteIds, CHUNK)) {
        const infos = await anki.notesInfo(chunk);
        const firstCards = infos.filter((n) => n.noteId).map((n) => n.cards[0]);
        const cardInfos = await anki.cardsInfo(firstCards);
        for (const c of cardInfos) if (c.cardId && c.deckName === deckName) ownNoteIds.push(c.note);
      }
      ownNoteIds.sort((a, b) => a - b);
      if (ownNoteIds.length === 0) continue;
    }

    log(`deck "${deckName}": ${ownNoteIds.length} note(s) in Anki`);
    const collectionId = await ensureCollection(opts.db, opts.userId, deckName, deckIds[deckName]);

    const existing = await fetchExisting(opts.db, opts.userId, ownNoteIds);
    const mods = await fetchModTimes(anki, ownNoteIds);

    const newIds: number[] = [];
    const changedIds: number[] = [];
    let unchanged = 0;
    for (const nid of ownNoteIds) {
      const prior = existing.get(nid);
      const mod = mods.get(nid) ?? 0;
      if (!prior) newIds.push(nid);
      else if (mod > prior.mod || prior.collectionId !== collectionId) changedIds.push(nid);
      else unchanged++;
    }

    const result: DeckSyncResult = {
      deckName,
      ankiDeckId: deckIds[deckName],
      collectionId,
      notesInAnki: ownNoteIds.length,
      added: 0,
      updated: 0,
      unchanged,
      skippedEmpty: 0,
    };

    // Stagger `due` into the past by note order so scheduled study preserves deck order
    // (same trick as the apkg importer).
    const dueBase = Date.now() - 30 * 86400_000;

    for (const chunk of chunks(newIds, CHUNK)) {
      const infos = await anki.notesInfo(chunk);
      const rows = [];
      for (const note of infos) {
        if (!note.noteId) continue; // deleted between findNotes and notesInfo
        const content = noteToCardContent(note);
        if (!content) {
          result.skippedEmpty++;
          continue;
        }
        rows.push({
          user_id: opts.userId,
          collection_id: collectionId,
          term: content.term,
          definition: content.definition,
          source_span: null,
          review_status: "accepted" as const,
          prompt_direction: "term_to_definition" as const,
          reps: 0,
          fsrs_state: "new" as const,
          lapses: 0,
          stability: 0,
          difficulty: 0,
          due: new Date(dueBase + ownNoteIds.indexOf(note.noteId)).toISOString(),
          last_review: null,
          anki_note_id: note.noteId,
          anki_note_mod: mods.get(note.noteId) ?? note.mod ?? 0,
        });
      }
      if (rows.length) {
        const { error } = await opts.db.from("cards").insert(rows);
        if (error) throw new Error(`cards insert failed: ${error.message}`);
        result.added += rows.length;
        log(`  + imported ${result.added}/${newIds.length} new`);
      }
    }

    for (const chunk of chunks(changedIds, CHUNK)) {
      const infos = await anki.notesInfo(chunk);
      for (const note of infos) {
        if (!note.noteId) continue;
        const prior = existing.get(note.noteId);
        const content = noteToCardContent(note);
        if (!prior || !content) {
          result.skippedEmpty += content ? 0 : 1;
          continue;
        }
        const { error } = await opts.db
          .from("cards")
          .update({
            term: content.term,
            definition: content.definition,
            collection_id: collectionId,
            anki_note_mod: mods.get(note.noteId) ?? note.mod ?? 0,
          })
          .eq("id", prior.id);
        if (error) throw new Error(`card update failed: ${error.message}`);
        result.updated++;
      }
      if (result.updated) log(`  ~ updated ${result.updated}/${changedIds.length} changed`);
    }

    log(
      `  deck done: +${result.added} new, ~${result.updated} updated, ${result.unchanged} unchanged` +
        (result.skippedEmpty ? `, ${result.skippedEmpty} empty skipped` : ""),
    );
    summary.decks.push(result);
    summary.added += result.added;
    summary.updated += result.updated;
    summary.unchanged += result.unchanged;
  }

  return summary;
}
