"use server";

import { createClient } from "@/lib/supabase/server";
import { schedule, calculateNextInterval } from "@/lib/scheduling/fsrs";
import type { Card } from "@/lib/types/domain";

export async function gradeCard(cardId: string, grade: 1 | 2 | 3 | 4): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: card } = await supabase.from("cards").select("*").eq("id", cardId).single();
  if (!card) return;

  const now = new Date();
  const update = schedule(card as Card, grade, now);

  // Derive the human-readable interval for logging.
  const { days: intervalDays } = calculateNextInterval(
    grade,
    {
      stability: (card as Card).stability,
      difficulty: (card as Card).difficulty,
      lastReview: (card as Card).last_review,
      elapsedDays: (card as Card).elapsed_days,
      reps: (card as Card).reps,
      lapses: (card as Card).lapses,
      fsrsState: (card as Card).fsrs_state,
      scheduledDays: (card as Card).scheduled_days,
    },
    now,
  );

  await supabase.from("cards").update(update).eq("id", cardId);
  await supabase.from("study_reviews").insert({
    user_id: user.id,
    card_id: cardId,
    grade,
    mode: "scheduled",
    interval_days: intervalDays,
  });
}
