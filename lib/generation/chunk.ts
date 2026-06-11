// Stage 0 of docs/PIPELINE.md: normalized source text → semantic chunks.
//
// We chunk for QUALITY, not capacity (PIPELINE: "to keep model attention high").
// Sonnet 4.6 has a 1M-token window, so a paste never overflows it — but asking
// the model to mine atomic facts from a huge wall of text dilutes attention and
// misses cards. Smaller, semantically coherent chunks generate denser, better
// decks. Each chunk becomes one Batch API request.

// ~5,000 chars ≈ ~1,300 tokens — a few paragraphs. Small enough to keep
// attention high, large enough to amortize the per-request prompt overhead and
// give the model local context for decomposing entities.
const TARGET_CHARS = 5000;
// A single paragraph longer than this is hard-split rather than left to blow
// past the target on its own.
const MAX_CHARS = Math.round(TARGET_CHARS * 1.6);

// Split into paragraph-ish blocks on blank lines. A lone markdown heading isn't
// merged here — it simply accumulates into the same chunk as the paragraphs
// that follow it (see chunkSource), which keeps a heading with its section.
function toBlocks(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

// Hard-split an oversized block on sentence boundaries (falling back to a raw
// character cut) so no single chunk is unreasonably large.
function splitOversized(block: string): string[] {
  if (block.length <= MAX_CHARS) return [block];
  const sentences = block.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [block];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf && buf.length + s.length > TARGET_CHARS) {
      out.push(buf.trim());
      buf = "";
    }
    if (s.length > MAX_CHARS) {
      // A single monster sentence — chop it on character boundaries.
      for (let i = 0; i < s.length; i += TARGET_CHARS) {
        out.push(s.slice(i, i + TARGET_CHARS).trim());
      }
    } else {
      buf += s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

/**
 * Chunk normalized source text into semantic sections. Deterministic and pure.
 * Short inputs return a single chunk. Headings stay with their following text;
 * paragraphs are never split mid-paragraph unless a paragraph alone exceeds the
 * ceiling.
 */
export function chunkSource(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= TARGET_CHARS) return [trimmed];

  const blocks = toBlocks(trimmed).flatMap(splitOversized);

  const chunks: string[] = [];
  let buf = "";
  for (const block of blocks) {
    if (buf && buf.length + block.length + 2 > TARGET_CHARS) {
      chunks.push(buf.trim());
      buf = "";
    }
    buf = buf ? `${buf}\n\n${block}` : block;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}
