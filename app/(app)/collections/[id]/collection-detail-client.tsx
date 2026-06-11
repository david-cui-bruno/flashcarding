"use client";

import { useState } from "react";
import Link from "next/link";
import { updateCard, deleteCard, moveCards } from "./actions";
import type { Database } from "@/lib/types/database";

export type DetailCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
  review_status: Database["public"]["Enums"]["review_status"];
};

type OtherCollection = { id: string; name: string };

const STATUS_STYLE: Record<DetailCard["review_status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  edited: "bg-blue-100 text-blue-700",
  rejected: "bg-neutral-200 text-neutral-500",
};

export function CollectionDetailClient({
  collectionId,
  collectionName,
  cards,
  otherCollections,
}: {
  collectionId: string;
  collectionName: string;
  cards: DetailCard[];
  otherCollections: OtherCollection[];
}) {
  // Manual busy flag (matches review-client/study-client). A shared useTransition
  // "pending" stays asserted through the revalidation refresh, which would leave
  // unrelated buttons disabled right after an action. revalidatePath still drives
  // the in-place refresh after each mutation.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState(otherCollections[0]?.id ?? "");

  const [editId, setEditId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editDef, setEditDef] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const clearActive = () => {
    setEditId(null);
    setDeleteId(null);
    setError(null);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = cards.length > 0 && selected.size === cards.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(cards.map((c) => c.id)));
  };

  const startEdit = (c: DetailCard) => {
    clearActive();
    setEditId(c.id);
    setEditTerm(c.term);
    setEditDef(c.definition);
  };

  const saveEdit = async (id: string) => {
    setError(null);
    setBusy(true);
    const res = await updateCard(id, collectionId, editTerm, editDef);
    setBusy(false);
    if (res.error) setError(res.error);
    else clearActive();
  };

  const confirmDelete = async (id: string) => {
    setError(null);
    setBusy(true);
    const res = await deleteCard(id, collectionId);
    setBusy(false);
    if (res.error) setError(res.error);
    else {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      clearActive();
    }
  };

  const doMove = async () => {
    if (selected.size === 0 || !moveTarget) return;
    setError(null);
    setBusy(true);
    const res = await moveCards([...selected], moveTarget, collectionId);
    setBusy(false);
    if (res.error) setError(res.error);
    else setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="min-w-0 truncate text-xl font-semibold">{collectionName}</h1>
        <span className="shrink-0 text-sm text-neutral-500">
          {cards.length} card{cards.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {cards.length === 0 ? (
        <p className="text-neutral-500">
          No cards in this collection.{" "}
          <Link href="/new" className="underline">
            Generate some
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Bulk-select + move toolbar. */}
          <div className="flex flex-wrap items-center gap-3 rounded border bg-neutral-50 px-3 py-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all
            </label>
            <span className="text-neutral-500">{selected.size} selected</span>
            <div className="ml-auto flex items-center gap-2">
              {otherCollections.length === 0 ? (
                <span className="text-neutral-400">No other collection to move to</span>
              ) : (
                <>
                  <span className="text-neutral-500">Move to</span>
                  <select
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                    className="rounded border px-1 py-0.5"
                  >
                    {otherCollections.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={busy || selected.size === 0}
                    onClick={doMove}
                    className="rounded bg-black px-3 py-1 text-white disabled:opacity-50"
                  >
                    Move
                  </button>
                </>
              )}
            </div>
          </div>

          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id} className="rounded border p-3">
                {editId === c.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs text-neutral-500">Term</label>
                    <input
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <label className="block text-xs text-neutral-500">Definition</label>
                    <textarea
                      value={editDef}
                      onChange={(e) => setEditDef(e.target.value)}
                      rows={3}
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        disabled={busy || !editTerm.trim() || !editDef.trim()}
                        onClick={() => saveEdit(c.id)}
                        className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        disabled={busy}
                        onClick={clearActive}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.term}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${STATUS_STYLE[c.review_status]}`}
                        >
                          {c.review_status}
                        </span>
                      </div>
                      <div className="mt-1 text-sm">{c.definition}</div>
                      {c.source_span && (
                        <div className="mt-2 border-l-2 pl-3 text-sm text-neutral-500">
                          “{c.source_span}”
                        </div>
                      )}
                      {deleteId === c.id ? (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <span className="text-red-600">Delete this card?</span>
                          <button
                            disabled={busy}
                            onClick={() => confirmDelete(c.id)}
                            className="rounded bg-red-600 px-2 py-0.5 text-white disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            disabled={busy}
                            onClick={clearActive}
                            className="rounded border px-2 py-0.5"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2 flex gap-3 text-sm">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-neutral-600 hover:text-black"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              clearActive();
                              setDeleteId(c.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
