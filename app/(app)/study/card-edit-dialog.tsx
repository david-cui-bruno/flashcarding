"use client";

import { useState } from "react";
import { editCardInStudy, createSiblingCard } from "./actions";

type Card = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
  collection_id: string;
};

type Props = {
  card: Card;
  /** Called after the dialog closes, whether saved or cancelled. */
  onClose: () => void;
};

/**
 * Edit dialog for a card during study. Only exposes term + definition
 * (the two writable fields per CARD-QUALITY.md). Source span is shown
 * read-only for context. Saving clears the flagged state server-side.
 *
 * Also provides "Add sibling" to create a new card with the same term.
 */
export function CardEditDialog({ card, onClose }: Props) {
  const [term, setTerm] = useState(card.term);
  const [definition, setDefinition] = useState(card.definition);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sibling creation mode
  const [siblingMode, setSiblingMode] = useState(false);
  const [siblingDef, setSiblingDef] = useState("");
  const [siblingBusy, setSiblingBusy] = useState(false);

  const save = async () => {
    if (!term.trim() && !definition.trim()) {
      setError("Term and definition can't both be empty.");
      return;
    }
    setBusy(true);
    setError(null);
    await editCardInStudy(card.id, term.trim(), definition.trim());
    setBusy(false);
    onClose();
  };

  const saveSibling = async () => {
    if (!siblingDef.trim()) {
      setError("Definition can't be empty.");
      return;
    }
    setSiblingBusy(true);
    setError(null);
    // First save pending edits to the current card
    await editCardInStudy(card.id, term.trim(), definition.trim());
    // Then create the sibling
    await createSiblingCard(card.collection_id, term.trim(), siblingDef.trim());
    setSiblingBusy(false);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-md rounded-lg border bg-white shadow-lg">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Edit card</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!siblingMode ? (
            <>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Term</label>
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Definition</label>
                <textarea
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  rows={3}
                  className="w-full rounded border px-2 py-1.5 text-sm"
                />
              </div>

              {/* Source span — read-only context */}
              {card.source_span && (
                <div className="rounded bg-neutral-50 border-l-2 border-neutral-300 px-3 py-2">
                  <p className="text-xs text-neutral-400 mb-0.5">Source</p>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    &ldquo;{card.source_span}&rdquo;
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={busy}
                  onClick={save}
                  className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  disabled={busy}
                  onClick={onClose}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    setSiblingMode(true);
                  }}
                  className="ml-auto text-xs text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                >
                  + Add sibling fact
                </button>
              </div>
            </>
          ) : (
            /* Sibling creation mode */
            <>
              <p className="text-xs text-neutral-500">
                New card will share the same term:{" "}
                <span className="font-medium text-neutral-800">{term || card.term}</span>
              </p>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  New definition (one atomic fact)
                </label>
                <textarea
                  value={siblingDef}
                  onChange={(e) => setSiblingDef(e.target.value)}
                  rows={3}
                  placeholder="Type the new fact…"
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  autoFocus
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  disabled={siblingBusy}
                  onClick={saveSibling}
                  className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  Save &amp; add
                </button>
                <button
                  disabled={siblingBusy}
                  onClick={() => {
                    setSiblingMode(false);
                    setError(null);
                  }}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
