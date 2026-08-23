"use client";

import { createClient } from "@/lib/supabase/client";
import { gradeCard } from "@/app/(app)/study/actions";
import type { FsrsUpdate } from "@/lib/scheduling/fsrs";
import { STUDY_COLUMNS, type StudyCard } from "@/lib/study/study-card";
import { META_STORE, DECKS_STORE, idbAvailable, idbClear, idbGet, idbPut } from "./idb";
import { saveCachedDeck, deleteCachedDeck, getAllCachedDecks } from "./deck-cache";
import { createIdbOutboxStore, type OutboxEntry } from "./outbox";
import { replayOutbox, type FailureKind, type ReplayResult } from "./replay";

// Client-side orchestration of Dory's offline study support:
//   queueReview()       — a grade that couldn't reach the server goes to the outbox
//   syncOutbox()        — ordered, idempotent replay of the outbox via gradeCard
//   refreshDeckCaches() — write-through cache of every deck's studyable cards
// Wired by <OfflineSync/> (app-wide: replay on load + 'online') and the study
// session (queue on failure, patch cache on grade).

const outboxStore = createIdbOutboxStore();

/* -------------------------------- outbox -------------------------------- */

export const OUTBOX_EVENT = "dory-outbox-change";

function announceOutbox() {
  if (typeof window === "undefined") return;
  void outboxStore.count().then((count) => {
    window.dispatchEvent(new CustomEvent(OUTBOX_EVENT, { detail: { count } }));
  });
}

export function getOutboxCount(): Promise<number> {
  return outboxStore.count();
}

export async function queueReview(review: {
  // Reuse the id of a failed live attempt so a half-applied send stays idempotent
  // on replay; omitted for a never-attempted (known-offline) review.
  id?: string;
  cardId: string;
  deckId: string;
  grade: 1 | 2 | 3 | 4;
  mode: "scheduled" | "cram";
  update?: FsrsUpdate;
  reviewedAt: string;
}): Promise<void> {
  await outboxStore.add({
    id: review.id ?? crypto.randomUUID(),
    cardId: review.cardId,
    deckId: review.deckId,
    grade: review.grade,
    mode: review.mode,
    update: review.update,
    reviewedAt: review.reviewedAt,
    attempts: 0,
  });
  announceOutbox();
}

// gradeCard's receipt mapped onto replay semantics. A server-action call that
// can't reach the server at all throws (fetch failure) → "offline".
class ReplayFailure extends Error {
  constructor(public kind: FailureKind) {
    super(`replay failure: ${kind}`);
  }
}

async function sendEntry(entry: OutboxEntry): Promise<void> {
  const receipt = await gradeCard(entry.cardId, entry.grade, entry.mode, entry.update, {
    reviewId: entry.id,
    reviewedAt: entry.reviewedAt,
  });
  if (receipt.status === "ok") return;
  if (receipt.status === "card_missing") throw new ReplayFailure("permanent");
  // "unauthenticated" = session hiccup, not the review's fault: keep it queued.
  throw new ReplayFailure(receipt.status === "unauthenticated" ? "offline" : "transient");
}

function classify(err: unknown): FailureKind {
  if (err instanceof ReplayFailure) return err.kind;
  // A thrown server-action call = the POST never completed. If the browser knows
  // it's offline, trust that; otherwise assume a transient network blip → also
  // retry-later ("offline" never burns attempts).
  return "offline";
}

let syncing: Promise<ReplayResult> | null = null;

// Replay the outbox (no-op when empty or already running). Safe to call eagerly:
// on app load, on 'online', and after every grade that had queued predecessors.
export function syncOutbox(): Promise<ReplayResult> {
  if (!idbAvailable()) return Promise.resolve({ sent: 0, dropped: 0, remaining: 0 });
  if (syncing) return syncing;
  syncing = replayOutbox(outboxStore, sendEntry, classify)
    .then((result) => {
      if (result.sent > 0 || result.dropped > 0) announceOutbox();
      return result;
    })
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

/* ------------------------------ deck caches ------------------------------ */

type CacheMeta = { key: "owner"; userId: string };

// Caches are per-user; if a different account signs in on this browser, wipe them
// so one user's cards never surface in another's offline library.
async function ensureCacheOwner(userId: string): Promise<void> {
  const meta = await idbGet<CacheMeta>(META_STORE, "owner");
  if (meta && meta.userId !== userId) {
    await idbClear(DECKS_STORE);
  }
  if (!meta || meta.userId !== userId) {
    await idbPut(META_STORE, { key: "owner", userId } satisfies CacheMeta);
  }
}

// Write-through refresh of every deck's studyable cards (called from the library,
// where the user already paid for a fresh server render). Full replace per deck +
// removal of decks deleted server-side. Paged past PostgREST's 1000-row cap.
export async function refreshDeckCaches(): Promise<void> {
  if (!idbAvailable() || typeof navigator === "undefined" || !navigator.onLine) return;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await ensureCacheOwner(user.id);

  const { data: collections } = await supabase.from("collections").select("id, name");
  if (!collections) return;

  const PAGE = 1000;
  const cardsByDeck = new Map<string, StudyCard[]>();
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase
      .from("cards")
      .select(`collection_id, ${STUDY_COLUMNS}`)
      .in("review_status", ["accepted", "edited"])
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !page) return; // partial data → don't clobber a good cache
    for (const { collection_id, ...card } of page) {
      if (!collection_id) continue;
      const list = cardsByDeck.get(collection_id) ?? [];
      list.push(card as StudyCard);
      cardsByDeck.set(collection_id, list);
    }
    if (page.length < PAGE) break;
  }

  const cachedAt = new Date().toISOString();
  const liveIds = new Set(collections.map((c) => c.id));
  for (const c of collections) {
    await saveCachedDeck({
      deckId: c.id,
      name: c.name,
      cards: cardsByDeck.get(c.id) ?? [],
      cachedAt,
    });
  }
  // Drop caches for decks deleted server-side.
  for (const cached of await getAllCachedDecks()) {
    if (!liveIds.has(cached.deckId)) await deleteCachedDeck(cached.deckId);
  }
}

// Library-load write-through, throttled so rapid hub navigation doesn't refetch
// every card on each visit. Module-level state = once per minute per page session.
let lastRefresh = 0;
export function refreshDeckCachesThrottled(minIntervalMs = 60_000): Promise<void> {
  const now = Date.now();
  if (now - lastRefresh < minIntervalMs) return Promise.resolve();
  lastRefresh = now;
  return refreshDeckCaches().catch(() => {
    lastRefresh = 0; // failed — allow an immediate retry on the next visit
  });
}
