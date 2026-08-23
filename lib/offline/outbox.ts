import type { FsrsUpdate } from "@/lib/scheduling/fsrs";
import { OUTBOX_STORE, idbAdd, idbCount, idbDelete, idbGetAll, idbPut, idbAvailable } from "./idb";

// One review the user performed while the gradeCard server action was unreachable
// (offline, or a transient server failure). Replayed in insertion order by
// lib/offline/replay.ts once connectivity returns.
//
// `id` is a client-generated UUID that doubles as the study_reviews primary key,
// making replay idempotent: a retry after a half-applied send upserts the same row
// (gradeCard uses ON CONFLICT DO NOTHING). `reviewedAt` carries the honest study
// time so metrics/retention stay correct, and lets the server skip a stale card
// update if a newer review already landed from another device.
export type OutboxEntry = {
  seq?: number; // IndexedDB autoIncrement key — insertion order = replay order
  id: string;
  cardId: string;
  deckId: string;
  grade: 1 | 2 | 3 | 4;
  mode: "scheduled" | "cram";
  update?: FsrsUpdate;
  reviewedAt: string;
  attempts: number;
};

// Storage interface so the replay logic is unit-testable with an in-memory store
// (scripts/test-offline-outbox.ts) while production uses IndexedDB.
export interface OutboxStore {
  all(): Promise<OutboxEntry[]>; // in seq (insertion) order
  add(entry: Omit<OutboxEntry, "seq">): Promise<OutboxEntry>;
  update(entry: OutboxEntry): Promise<void>;
  remove(seq: number): Promise<void>;
  count(): Promise<number>;
}

export function createIdbOutboxStore(): OutboxStore {
  return {
    async all() {
      if (!idbAvailable()) return [];
      const entries = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
      return entries.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    },
    async add(entry) {
      const seq = await idbAdd(OUTBOX_STORE, entry);
      return { ...entry, seq: seq as number };
    },
    async update(entry) {
      await idbPut(OUTBOX_STORE, entry);
    },
    async remove(seq) {
      await idbDelete(OUTBOX_STORE, seq);
    },
    async count() {
      if (!idbAvailable()) return 0;
      return idbCount(OUTBOX_STORE);
    },
  };
}
