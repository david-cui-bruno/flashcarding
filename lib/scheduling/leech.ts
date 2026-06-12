import type { Card } from "@/lib/types/domain";

// A leech is a card the user keeps failing. We reuse FSRS's own lapse counter (the
// `lapses` column, incremented each time a "review" card is graded Again), the same
// signal modern Anki uses for leech detection.
//
// We surface earlier than Anki's default of 8 lapses, though: in Cardstock a leech is
// treated as a *bad-card* signal to route into the feedback loop (docs/SCHEDULING.md),
// not a study-throttling mechanism, so we want it in front of the user sooner. Tunable.
export const LEECH_LAPSE_THRESHOLD = 4;

// A card has tripped the leech flag once it has lapsed at least this many times.
export function isLeech(card: Pick<Card, "lapses">): boolean {
  return card.lapses >= LEECH_LAPSE_THRESHOLD;
}

// How many more lapses until this card trips the leech flag (0 = already a leech).
export function lapsesUntilLeech(card: Pick<Card, "lapses">): number {
  return Math.max(0, LEECH_LAPSE_THRESHOLD - card.lapses);
}
