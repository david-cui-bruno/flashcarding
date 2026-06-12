// Distill the user's REJECT feedback into a few candidate card-quality principles —
// the human-in-the-loop way to let rejects steer the generator (docs/DESIGN.md).
//
// Why a script and not an auto-loop: the deterministic gate already removes broken
// cards, so review-rejects reflect TASTE. We surface recurring patterns as POSITIVELY
// framed candidate principles for you to approve — nothing is applied automatically.
// Approve the ones you agree with by adding them to docs/CARD-QUALITY.md and mirroring
// into lib/generation/prompt.ts (CARD_GENERATION_SYSTEM). Negative "avoid this" examples
// are deliberately NOT injected into the prompt (they backfire).
//
// Run: set -a; . ./.env.local; set +a; pnpm exec tsx scripts/distill-rejects.ts [username]
import { createClient } from "@supabase/supabase-js";
import { getAnthropic, GENERATION_MODEL } from "../lib/generation/anthropic";
import { usernameToEmail } from "../lib/auth/username";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

type Reject = { term: string | null; definition: string | null; reason: string | null };

// Strip the source prefix study/collection rejects carry, and drop the generic
// auto-reason so it doesn't masquerade as real signal.
function cleanReason(raw: string | null): string | null {
  if (!raw) return null;
  const r = raw.replace(/^\[(study|collection)\]\s*/i, "").trim();
  if (!r || /^flagged bad during study$/i.test(r)) return null;
  return r;
}

async function main() {
  const username = process.argv[2];
  let userId: string | undefined;
  if (username) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list?.users.find((x) => x.email === usernameToEmail(username));
    if (!u) {
      console.error(`No user "${username}".`);
      process.exit(1);
    }
    userId = u.id;
    console.log(`Distilling rejects for ${username}\n`);
  } else {
    console.log("Distilling rejects across ALL users (pass a username to scope to one).\n");
  }

  let q = admin
    .from("generation_feedback")
    .select("reason, card:cards(term, definition)")
    .eq("action", "rejected")
    .order("created_at", { ascending: false })
    .limit(150);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as unknown as { reason: string | null; card: Reject | null }[];
  const rejects = rows.map((r) => ({
    term: r.card?.term ?? null,
    definition: r.card?.definition ?? null,
    reason: cleanReason(r.reason),
  }));
  const withReason = rejects.filter((r) => r.reason);

  console.log(`${rejects.length} rejected card(s), ${withReason.length} with a written reason.`);
  if (rejects.length < 3) {
    console.log("Not enough reject feedback yet to find patterns — come back after more reviewing.");
    return;
  }

  const lines = rejects
    .filter((r) => r.term || r.reason)
    .map((r, i) => {
      const card = r.term ? `${r.term} → ${r.definition ?? ""}`.trim() : "(card deleted)";
      return `${i + 1}. ${card}${r.reason ? `  | reason: ${r.reason}` : ""}`;
    })
    .join("\n");

  const prompt =
    `You are helping curate flashcard-generation guidelines for ONE user, based on cards they REJECTED during review. ` +
    `A deterministic quality gate already removes structurally broken cards, so these rejections reflect the user's TASTE ` +
    `(granularity, usefulness, phrasing) — not basic errors.\n\n` +
    `Rejected cards (and the user's reasons, when given):\n${lines}\n\n` +
    `Distill these into AT MOST 5 general, actionable principles for writing cards this user will keep. Strict rules:\n` +
    `- Include a principle ONLY if a recurring pattern supports it across MULTIPLE rejections. Ignore one-offs.\n` +
    `- Phrase each POSITIVELY ("Prefer…", "Write…"), never as "avoid" — these may go into a generation prompt, where negatives backfire.\n` +
    `- Be specific and actionable; no generic advice like "make good cards".\n` +
    `- If there is no clear recurring pattern, say so and return fewer (or zero) principles. Do not invent.\n` +
    `For each principle, note how many rejections support it. Output a short numbered list only.`;

  const msg = await getAnthropic().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.find((b) => b.type === "text");

  console.log("\n──────── CANDIDATE PRINCIPLES (review before applying) ────────\n");
  console.log(text && text.type === "text" ? text.text.trim() : "(no output)");
  console.log(
    "\n───────────────────────────────────────────────────────────────\n" +
      "These are CANDIDATES. Add the ones you agree with to docs/CARD-QUALITY.md,\n" +
      "then mirror them into lib/generation/prompt.ts (CARD_GENERATION_SYSTEM).\n" +
      "Nothing was applied automatically.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
