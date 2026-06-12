import { getAnthropic } from "./anthropic";

// A short, human deck title from the cards a run produced. Paste-decks would
// otherwise be named from the first 80 chars of the pasted text (ugly); this asks
// the model for a clean 2–5 word title instead. Runs on the async completion path
// (lib/generation/process.ts), so it adds no latency to the user's "Make cards" click.
//
// Uses Haiku (fast + cheap) — this is a trivial labeling task, not card generation
// (which stays on Sonnet per docs/ARCHITECTURE.md). Falls back to `fallback` on any
// error or empty result, so a title is always set.
const TITLE_MODEL = "claude-haiku-4-5-20251001";

export async function generateDeckTitle(
  cards: { term: string }[],
  fallback: string,
): Promise<string> {
  if (cards.length === 0) return fallback;
  try {
    const sample = cards
      .slice(0, 30)
      .map((c) => `- ${c.term}`)
      .join("\n");
    const msg = await getAnthropic().messages.create({
      model: TITLE_MODEL,
      max_tokens: 24,
      messages: [
        {
          role: "user",
          content:
            `These are flashcard terms from a single document:\n\n${sample}\n\n` +
            `Give a short, specific deck title (2–5 words, Title Case) naming the topic. ` +
            `Reply with ONLY the title — no quotes, no trailing punctuation.`,
        },
      ],
    });
    const block = msg.content.find((b) => b.type === "text");
    const title =
      block && block.type === "text"
        ? block.text.trim().replace(/^["']+|["'.]+$/g, "").trim().slice(0, 80)
        : "";
    return title || fallback;
  } catch {
    return fallback;
  }
}
