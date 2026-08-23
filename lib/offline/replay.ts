import type { OutboxEntry, OutboxStore } from "./outbox";

// Replay queued offline reviews, strictly in insertion order.
//
// Ordering matters per card: a card graded three times offline must land in that
// order so the final FSRS state matches what the learner saw. We replay the whole
// queue sequentially and STOP at the first retryable failure (rather than skipping
// ahead), which preserves relative order across retries. The caller classifies each
// failure:
//
//   "offline"   — network-level failure. Nothing is wrong with the entry; stop and
//                 retry the whole queue later. Does NOT count toward attempts (a
//                 spotty connection must never burn through a review's retries).
//   "transient" — the server answered but couldn't apply it (unexpected DB error).
//                 Counts toward attempts; at MAX_ATTEMPTS the entry is dropped so a
//                 poison pill can't dam the queue forever.
//   "permanent" — the server rejected it definitively (e.g. the card was deleted →
//                 FK violation). Dropped immediately; replay continues.
export const MAX_ATTEMPTS = 8;

export type FailureKind = "offline" | "transient" | "permanent";

export type ReplaySender = (entry: OutboxEntry) => Promise<void>;

export type ReplayResult = { sent: number; dropped: number; remaining: number };

export async function replayOutbox(
  store: OutboxStore,
  send: ReplaySender,
  classify: (err: unknown) => FailureKind = () => "transient",
): Promise<ReplayResult> {
  const entries = await store.all();
  let sent = 0;
  let dropped = 0;

  for (const entry of entries) {
    try {
      await send(entry);
      if (entry.seq !== undefined) await store.remove(entry.seq);
      sent++;
    } catch (err) {
      const kind = classify(err);
      if (kind === "offline") break; // back offline — retry everything later, no count

      if (kind === "permanent") {
        if (entry.seq !== undefined) await store.remove(entry.seq);
        dropped++;
        continue; // later entries are unrelated — keep going
      }

      // transient
      const attempts = (entry.attempts ?? 0) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        if (entry.seq !== undefined) await store.remove(entry.seq);
        dropped++;
        continue;
      }
      await store.update({ ...entry, attempts });
      break; // preserve order: don't send later entries past a failed one
    }
  }

  return { sent, dropped, remaining: await store.count() };
}
