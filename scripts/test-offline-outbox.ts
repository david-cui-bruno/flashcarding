// Unit test for the offline review outbox replay (lib/offline/replay.ts) with an
// in-memory store and a mocked sender — simulates going offline, transient server
// errors, permanent failures (deleted card), and reconnection.
// Run: pnpm exec tsx scripts/test-offline-outbox.ts
import assert from "node:assert/strict";
import { replayOutbox, MAX_ATTEMPTS, type FailureKind } from "../lib/offline/replay";
import type { OutboxEntry, OutboxStore } from "../lib/offline/outbox";

function memoryStore(initial: Omit<OutboxEntry, "seq">[] = []): OutboxStore & {
  entries: OutboxEntry[];
} {
  let nextSeq = 1;
  const entries: OutboxEntry[] = initial.map((e) => ({ ...e, seq: nextSeq++ }));
  return {
    entries,
    async all() {
      return [...entries].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    },
    async add(entry) {
      const withSeq = { ...entry, seq: nextSeq++ };
      entries.push(withSeq);
      return withSeq;
    },
    async update(entry) {
      const i = entries.findIndex((e) => e.seq === entry.seq);
      if (i !== -1) entries[i] = entry;
    },
    async remove(seq) {
      const i = entries.findIndex((e) => e.seq === seq);
      if (i !== -1) entries.splice(i, 1);
    },
    async count() {
      return entries.length;
    },
  };
}

let n = 0;
function review(cardId: string, grade: 1 | 2 | 3 | 4 = 3): Omit<OutboxEntry, "seq"> {
  return {
    id: `review-${++n}`,
    cardId,
    deckId: "deck-1",
    grade,
    mode: "scheduled",
    update: undefined,
    reviewedAt: new Date(Date.now() + n * 1000).toISOString(),
    attempts: 0,
  };
}

class Failure extends Error {
  constructor(public kind: FailureKind) {
    super(kind);
  }
}
const classify = (err: unknown): FailureKind => (err instanceof Failure ? err.kind : "transient");

async function testHappyPath() {
  const store = memoryStore([review("a"), review("a"), review("b")]);
  const sent: string[] = [];
  const r = await replayOutbox(store, async (e) => void sent.push(e.id), classify);
  assert.deepEqual(sent, ["review-1", "review-2", "review-3"], "sends in insertion order");
  assert.equal(r.sent, 3);
  assert.equal(r.dropped, 0);
  assert.equal(r.remaining, 0);
  console.log("✓ happy path: ordered send, queue drained");
}

async function testOfflineStopsWithoutBurningAttempts() {
  const store = memoryStore([review("a"), review("a"), review("b")]);
  // Network dies on the second entry.
  let calls = 0;
  const r = await replayOutbox(
    store,
    async () => {
      calls++;
      if (calls >= 2) throw new Failure("offline");
    },
    classify,
  );
  assert.equal(r.sent, 1);
  assert.equal(r.remaining, 2, "unsent entries stay queued");
  assert.equal(store.entries[0].attempts, 0, "offline failures never count as attempts");
  // Order preserved: the failed entry is still ahead of the later one.
  const remaining = await store.all();
  assert.deepEqual(
    remaining.map((e) => e.id),
    ["review-5", "review-6"],
    "relative order preserved across an offline stop",
  );
  console.log("✓ offline: stops at first failure, keeps order, burns no attempts");
}

async function testReconnectDrains() {
  const store = memoryStore([review("a"), review("a")]);
  let online = false;
  const send = async (e: OutboxEntry) => {
    if (!online) throw new Failure("offline");
    sent.push(e.id);
  };
  const sent: string[] = [];
  const r1 = await replayOutbox(store, send, classify);
  assert.equal(r1.sent, 0);
  assert.equal(r1.remaining, 2);
  online = true; // reconnect
  const r2 = await replayOutbox(store, send, classify);
  assert.equal(r2.sent, 2);
  assert.equal(r2.remaining, 0);
  console.log("✓ reconnect: second replay drains the queue in order");
}

async function testPermanentFailureDropsAndContinues() {
  const store = memoryStore([review("deleted-card"), review("b")]);
  const sent: string[] = [];
  const r = await replayOutbox(
    store,
    async (e) => {
      if (e.cardId === "deleted-card") throw new Failure("permanent");
      sent.push(e.id);
    },
    classify,
  );
  assert.equal(r.dropped, 1, "permanently-failing entry dropped");
  assert.equal(r.sent, 1, "later entries still sent");
  assert.equal(r.remaining, 0);
  console.log("✓ permanent failure (deleted card): dropped immediately, queue continues");
}

async function testTransientRetriesThenDrops() {
  const store = memoryStore([review("flaky"), review("b")]);
  const failAlways = async (e: OutboxEntry) => {
    if (e.cardId === "flaky") throw new Failure("transient");
  };
  // Each replay counts one attempt and stops (order preserved: "b" waits behind).
  for (let i = 1; i < MAX_ATTEMPTS; i++) {
    const r = await replayOutbox(store, failAlways, classify);
    if (i < MAX_ATTEMPTS - 1) {
      assert.equal(r.remaining, 2, `attempt ${i}: both entries still queued`);
      assert.equal(store.entries[0].attempts, i);
      assert.equal(r.sent, 0, "b never jumps the queue past a retryable failure");
    }
  }
  // MAX_ATTEMPTS reached → poison pill dropped, b proceeds.
  const r = await replayOutbox(store, failAlways, classify);
  assert.equal(r.dropped, 1, "poison pill dropped at MAX_ATTEMPTS");
  assert.equal(r.sent, 1, "b sent after the pill was dropped");
  const remaining = await store.all();
  assert.equal(remaining.length, 0, "poison pill dropped and b sent");
  console.log("✓ transient poison pill: retried, then dropped at MAX_ATTEMPTS without damming");
}

async function testMixedPerCardOrdering() {
  // Two cards interleaved; card a graded 3x offline must apply in order.
  const store = memoryStore([review("a", 1), review("b", 3), review("a", 3), review("a", 4)]);
  const perCard = new Map<string, number[]>();
  const r = await replayOutbox(
    store,
    async (e) => {
      const list = perCard.get(e.cardId) ?? [];
      list.push(e.grade);
      perCard.set(e.cardId, list);
    },
    classify,
  );
  assert.equal(r.sent, 4);
  assert.deepEqual(perCard.get("a"), [1, 3, 4], "per-card grade order preserved");
  console.log("✓ interleaved cards: per-card order preserved");
}

async function main() {
  await testHappyPath();
  await testOfflineStopsWithoutBurningAttempts();
  await testReconnectDrains();
  await testPermanentFailureDropsAndContinues();
  await testTransientRetriesThenDrops();
  await testMixedPerCardOrdering();
  console.log("\nAll offline outbox replay tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
