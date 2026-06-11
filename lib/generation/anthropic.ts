import Anthropic from "@anthropic-ai/sdk";

// The generation model. Fixed to Sonnet 4.6 by docs/ARCHITECTURE.md ("AI
// generation: Claude claude-sonnet-4-6"); Opus 4.8 is a measured fallback
// decided from the edit rate, not assumed here.
export const GENERATION_MODEL = "claude-sonnet-4-6";

// Lazily constructed so importing this module (e.g. during `next build`) never
// requires ANTHROPIC_API_KEY — it's only needed when generation actually runs.
// Server-only: the key (read from env) must never reach the browser.
let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}
