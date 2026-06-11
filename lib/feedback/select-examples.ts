// ⚠️ STUB — coordination contract owned by the FEEDBACK + METRICS stream.
//
// The generation pipeline (docs/PIPELINE.md §5, "Feedback loop") injects the
// user's most relevant past review actions into the generation prompt as
// dynamic few-shot examples. The real selection logic — querying
// `generation_feedback` for the most relevant kept / edited / rejected examples
// — lives in this stream. Until it lands, this returns [] so generation runs
// with no few-shot block (identical to a brand-new user).
//
// The generation stream consumes ONLY `selectFewShotExamples` and the types
// below. Keep this signature stable when the real implementation replaces the
// body — see app/(app)/new/actions.ts and lib/generation/prompt.ts for callers.

// One past review action, shaped for prompt injection. Edits (before→after) are
// the strongest signal; rejections teach what to avoid (docs/PIPELINE.md §5).
export type FewShotExample =
  | { kind: "kept"; term: string; definition: string }
  | {
      kind: "edited";
      before: { term: string; definition: string };
      after: { term: string; definition: string };
    }
  | { kind: "rejected"; term: string; definition: string; reason?: string };

export type SelectExamplesInput = {
  userId: string;
  // The source text being generated from, so selection can favour topically
  // relevant examples over global ones.
  sourceText: string;
  // Upper bound on examples to inject (keeps the prompt prefix small).
  limit?: number;
};

export async function selectFewShotExamples(
  input: SelectExamplesInput,
): Promise<FewShotExample[]> {
  void input; // stub: real relevance selection lands in the feedback+metrics stream
  // No history yet → no examples (identical to a brand-new user).
  return [];
}
