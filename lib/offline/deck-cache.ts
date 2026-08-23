import type { StudyCard } from "@/lib/study/study-card";
import { DECKS_STORE, idbAvailable, idbDelete, idbGet, idbGetAll, idbPut } from "./idb";

// Per-deck cache of every STUDYABLE card (review_status accepted/edited) with its
// full FSRS state — enough to rebuild both study modes offline:
//   due queue  = cards with due <= now (the session's prioritize() orders them)
//   cram queue = all cards (shuffled by the session)
//
// Write paths (write-through, lib/offline/sync.ts):
//   - refreshDeckCaches() replaces each deck's cache from the server (library load)
//   - a study session merges its server-fetched queue in on mount (freshest data)
//   - each scheduled grade patches the card in place so an offline reopen of the
//     deck reflects everything already studied this session
export type CachedDeck = {
  deckId: string;
  name: string;
  cards: StudyCard[];
  cachedAt: string;
};

export async function getCachedDeck(deckId: string): Promise<CachedDeck | undefined> {
  if (!idbAvailable()) return undefined;
  return idbGet<CachedDeck>(DECKS_STORE, deckId);
}

export async function getAllCachedDecks(): Promise<CachedDeck[]> {
  if (!idbAvailable()) return [];
  const decks = await idbGetAll<CachedDeck>(DECKS_STORE);
  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

// Full replace — the caller fetched the deck's complete studyable set, so this also
// clears cards deleted or rejected server-side.
export async function saveCachedDeck(deck: CachedDeck): Promise<void> {
  if (!idbAvailable()) return;
  await idbPut(DECKS_STORE, deck);
}

export async function deleteCachedDeck(deckId: string): Promise<void> {
  if (!idbAvailable()) return;
  await idbDelete(DECKS_STORE, deckId);
}

// Upsert a partial card set (e.g. a due-mode session queue) into the cache without
// losing the not-due cards a full refresh captured.
export async function mergeCachedCards(
  deckId: string,
  name: string,
  cards: StudyCard[],
): Promise<void> {
  if (!idbAvailable()) return;
  const existing = await idbGet<CachedDeck>(DECKS_STORE, deckId);
  const byId = new Map((existing?.cards ?? []).map((c) => [c.id, c]));
  for (const c of cards) byId.set(c.id, c);
  await idbPut(DECKS_STORE, {
    deckId,
    name,
    cards: [...byId.values()],
    cachedAt: new Date().toISOString(),
  } satisfies CachedDeck);
}

export async function patchCachedCard(
  deckId: string,
  cardId: string,
  patch: Partial<StudyCard>,
): Promise<void> {
  if (!idbAvailable()) return;
  const deck = await idbGet<CachedDeck>(DECKS_STORE, deckId);
  if (!deck) return;
  const i = deck.cards.findIndex((c) => c.id === cardId);
  if (i === -1) return;
  deck.cards[i] = { ...deck.cards[i], ...patch };
  await idbPut(DECKS_STORE, deck);
}

export async function removeCachedCard(deckId: string, cardId: string): Promise<void> {
  if (!idbAvailable()) return;
  const deck = await idbGet<CachedDeck>(DECKS_STORE, deckId);
  if (!deck) return;
  deck.cards = deck.cards.filter((c) => c.id !== cardId);
  await idbPut(DECKS_STORE, deck);
}

// The due queue for an offline scheduled session (the session's own prioritize()
// re-orders learning-step cards; a due-ordered base matches the server query).
export function dueCards(deck: CachedDeck, now: Date = new Date()): StudyCard[] {
  const nowMs = now.getTime();
  return deck.cards
    .filter((c) => Date.parse(c.due) <= nowMs)
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
}
