import type { FewShotExample } from "./examples";

// Curated "house style" seed examples — the owner's own good cards (provided as
// Anki screenshots, 2026-06-11). They give the generator taste FROM DAY ONE, before
// any per-user feedback exists. selectFewShotExamples() backfills with these only
// when the user has fewer real kept/edited examples than the requested limit, so a
// real review history naturally takes over as it accumulates.
//
// The taste these encode (see docs/CARD-QUALITY.md):
//   • term  = the work/entity + attribution in parens — "Title (Creator[, language])"
//   • definition = ONE atomic, distinctive, recall-worthy fact, telegraphic
//   • refers back to the front via "title figure" / "title author" (don't restate it)
//   • often prefixed with the medium ("Poem:", "Book:")
// Studied in the default direction (definition → term) this is quiz-bowl recall:
// given the salient fact, name the work.
export const SEED_EXAMPLES: FewShotExample[] = [
  {
    term: "Coronation of Napoleon (David)",
    definition:
      "Joséphine de Beauharnais kneels in a submissive pose, receiving the crown from the title figure.",
    kind: "kept",
    before: null,
  },
  {
    term: "Danaë (Rembrandt)",
    definition: "Saskia was the original model but was later changed.",
    kind: "kept",
    before: null,
  },
  {
    term: "Death of Marat (David)",
    definition:
      "Title figure lies dead in his bathtub after being murdered by Charlotte Corday.",
    kind: "kept",
    before: null,
  },
  {
    term: "Mac Flecknoe (John Dryden, English)",
    definition: "Poem: attacks Thomas Shadwell and the title author.",
    kind: "kept",
    before: null,
  },
  {
    term: "The Pilgrim's Progress (John Bunyan, English)",
    definition:
      "Book: religious allegory depicting Christian's journey to the Celestial City from the City of Destruction.",
    kind: "kept",
    before: null,
  },
  {
    term: "To Lucasta, Going to the Wars (Richard Lovelace, English)",
    definition:
      "Speaker resolves to “with a stronger faith embrace / A sword, a horse, a shield.”",
    kind: "kept",
    before: null,
  },
  {
    term: "An Essay on Man (Alexander Pope, English)",
    definition: "Paired with the author's Moral Epistles.",
    kind: "kept",
    before: null,
  },
];
