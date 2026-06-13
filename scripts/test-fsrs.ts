/**
 * scripts/test-fsrs.ts
 *
 * Smoke-test the FSRS scheduling engine without a database.
 * Run with: pnpm tsx scripts/test-fsrs.ts
 *
 * Verifies:
 *  - A new card graded Easy gets a multi-day interval.
 *  - A new card graded Again stays in relearning.
 *  - Repeated Good grades compound intervals correctly.
 *  - isLeech fires at the threshold.
 */

import {
  calculateNextInterval,
  getInitialCardState,
  isLeech,
  LEECH_THRESHOLD,
  type CardState,
} from "../lib/scheduling/fsrs";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1: initial state
// ---------------------------------------------------------------------------
console.log("\nTest 1 — initial card state");
const initial = getInitialCardState();
assert("stability starts at 0", initial.stability === 0);
assert("reps start at 0", initial.reps === 0);
assert("fsrsState is 'new'", initial.fsrsState === "new");

// ---------------------------------------------------------------------------
// Test 2: new card graded Easy → multi-day interval
// ---------------------------------------------------------------------------
console.log("\nTest 2 — new card graded Easy");
const easyInterval = calculateNextInterval(4, initial);
console.log(`  interval: ${easyInterval.days} days, relearning: ${easyInterval.relearning}`);
assert("days > 1 for Easy on a new card", easyInterval.days > 1);
assert("not in relearning after Easy", !easyInterval.relearning);

// ---------------------------------------------------------------------------
// Test 3: new card graded Again → relearning
// ---------------------------------------------------------------------------
console.log("\nTest 3 — new card graded Again");
const againInterval = calculateNextInterval(1, initial);
console.log(`  interval: ${againInterval.days} days, relearning: ${againInterval.relearning}`);
assert("relearning=true after Again on new card", againInterval.relearning);

// ---------------------------------------------------------------------------
// Test 4: compound intervals grow with Good
// ---------------------------------------------------------------------------
console.log("\nTest 4 — repeated Good grades compound");
let state: CardState = initial;
let prevDays = 0;
const now = new Date("2025-01-01T00:00:00Z");

for (let rep = 1; rep <= 5; rep++) {
  const interval = calculateNextInterval(3, state, now);
  console.log(`  rep ${rep}: ${interval.days} days`);

  // Simulate advancing time and building a new state for next rep.
  const nextReview = new Date(now.getTime() + interval.days * 86400000);
  state = {
    ...state,
    reps: state.reps + 1,
    lastReview: now.toISOString(),
    elapsedDays: interval.days,
    scheduledDays: interval.days,
    fsrsState: interval.relearning ? "relearning" : "review",
    // stability and difficulty would come from ts-fsrs via schedule(); we keep
    // them at 0 here just to test interval growth shape — not exact values.
  };
  // After the first rep interval increases (FSRS early intervals are 1-3 days
  // for new cards graded Good then grow).
  if (rep > 1) {
    assert(`rep ${rep} interval ≥ rep ${rep - 1} interval`, interval.days >= prevDays);
  }
  prevDays = interval.days;
}

// ---------------------------------------------------------------------------
// Test 5: leech detection
// ---------------------------------------------------------------------------
console.log("\nTest 5 — leech detection");
const almostLeech: CardState = { ...initial, lapses: LEECH_THRESHOLD - 1 };
const definiteLeech: CardState = { ...initial, lapses: LEECH_THRESHOLD };
assert("not a leech below threshold", !isLeech(almostLeech));
assert("leech at threshold", isLeech(definiteLeech));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
