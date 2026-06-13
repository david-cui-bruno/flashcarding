"use server";

/**
 * Deck-level card counts for the study UI bottom bar.
 *
 * Three logical study modes (docs/SCHEDULING.md):
 *   - review_all  : show every accepted/edited card regardless of due date (cram)
 *   - spot_check  : show due cards + all learning/relearning cards (scheduled + in-progress)
 *   - trust       : show only cards strictly due today or earlier (strict scheduled)
 *
 * Counts returned:
 *   new       — cards never reviewed (fsrs_state = 'new')
 *   due       — cards whose `due` date is today or earlier in review/relearning state
 *   learning  — cards actively in a short learning step (fsrs_state in ['learning','relearning'])
 */

import { createClient } from "@/lib/supabase/server";

export type StudyMode = "review_all" | "spot_check" | "trust";

export type DeckCounts = {
  new: number;
  due: number;
  learning: number;
};

/**
 * Returns card counts for `collectionId` under the given study mode.
 * Only accepted/edited cards are counted (review_status in ['accepted','edited']).
 */
export async function countsByMode(
  collectionId: string,
  mode: StudyMode,
): Promise<DeckCounts> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Pull minimal fields to count client-side (GROUP BY via RPC is overkill here).
  let query = supabase
    .from("cards")
    .select("fsrs_state, due")
    .eq("collection_id", collectionId)
    .in("review_status", ["accepted", "edited"]);

  // For trust mode we only need due cards, so skip the rest up-front.
  if (mode === "trust") {
    query = query.lte("due", now);
  }

  const { data, error } = await query;
  if (error || !data) return { new: 0, due: 0, learning: 0 };

  let newCount = 0;
  let dueCount = 0;
  let learningCount = 0;

  for (const card of data) {
    const state = card.fsrs_state as string;
    const isOverdue = (card.due as string) <= now;

    if (state === "new") {
      newCount++;
      continue;
    }

    if (state === "learning" || state === "relearning") {
      // Learning-step cards always appear in the queue (they're short-interval).
      learningCount++;
      continue;
    }

    // state === "review"
    if (mode === "review_all") {
      // Cram mode: count all review-state cards.
      dueCount++;
    } else {
      // spot_check and trust: only overdue review cards count.
      if (isOverdue) dueCount++;
    }
  }

  return { new: newCount, due: dueCount, learning: learningCount };
}
