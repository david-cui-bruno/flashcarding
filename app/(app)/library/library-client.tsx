"use client";

import { useState } from "react";
import Link from "next/link";
import { createCollection, renameCollection, deleteCollection } from "./actions";

export type CollectionSummary = {
  id: string;
  name: string;
  count: number;
};

export function LibraryClient({ collections }: { collections: CollectionSummary[] }) {
  // Manual busy flag (matches review-client/study-client). Avoids a shared
  // useTransition "pending" that stays asserted through the revalidation refresh
  // and would disable unrelated controls. revalidatePath drives the in-place refresh.
  const [busy, setBusy] = useState(false);

  // New-collection form.
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // One row is "active" at a time, either being renamed or being deleted.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const resetRow = () => {
    setEditId(null);
    setDeleteId(null);
    setRowError(null);
  };

  const create = async () => {
    setCreateError(null);
    setBusy(true);
    const res = await createCollection(newName);
    setBusy(false);
    if (res.error) setCreateError(res.error);
    else setNewName("");
  };

  const startEdit = (c: CollectionSummary) => {
    resetRow();
    setEditId(c.id);
    setEditName(c.name);
  };

  const saveEdit = async (id: string) => {
    setRowError(null);
    setBusy(true);
    const res = await renameCollection(id, editName);
    setBusy(false);
    if (res.error) setRowError(res.error);
    else resetRow();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Library</h1>
        <Link href="/new" className="rounded bg-black px-3 py-1.5 text-sm text-white">
          New cards
        </Link>
      </div>

      {/* Create a collection (an empty one is a valid move target). */}
      <div className="space-y-1">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
            placeholder="New collection name…"
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
          <button
            disabled={busy || !newName.trim()}
            onClick={create}
            className="shrink-0 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </div>

      {collections.length === 0 ? (
        <p className="text-neutral-500">
          No collections yet. Create one above, or{" "}
          <Link href="/new" className="underline">
            generate some cards
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y rounded border">
          {collections.map((c) => {
            const others = collections.filter((o) => o.id !== c.id);
            return (
              <li key={c.id} className="px-4 py-3">
                {editId === c.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(c.id);
                        if (e.key === "Escape") resetRow();
                      }}
                      autoFocus
                      className="w-full rounded border px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busy || !editName.trim()}
                        onClick={() => saveEdit(c.id)}
                        className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        disabled={busy}
                        onClick={resetRow}
                        className="rounded border px-3 py-1 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                    {rowError && <p className="text-sm text-red-600">{rowError}</p>}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/collections/${c.id}`}
                      className="min-w-0 flex-1 truncate hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="shrink-0 text-sm text-neutral-500">{c.count} cards</span>
                    <div className="flex shrink-0 gap-2 text-sm">
                      <button onClick={() => startEdit(c)} className="text-neutral-600 hover:text-black">
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          resetRow();
                          setDeleteId(c.id);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {deleteId === c.id && (
                  <DeleteConfirm
                    collection={c}
                    others={others}
                    busy={busy}
                    error={rowError}
                    onCancel={resetRow}
                    onConfirm={async (cardAction, targetId) => {
                      setRowError(null);
                      setBusy(true);
                      const res = await deleteCollection(c.id, cardAction, targetId);
                      setBusy(false);
                      if (res.error) setRowError(res.error);
                      else resetRow();
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DeleteConfirm({
  collection,
  others,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  collection: CollectionSummary;
  others: CollectionSummary[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (cardAction: "delete" | "move", targetId?: string) => void;
}) {
  const hasCards = collection.count > 0;
  // Default to moving cards when there's somewhere to move them; otherwise delete.
  const [cardAction, setCardAction] = useState<"delete" | "move">(
    hasCards && others.length > 0 ? "move" : "delete",
  );
  const [targetId, setTargetId] = useState(others[0]?.id ?? "");

  return (
    <div className="mt-3 space-y-3 rounded border border-red-200 bg-red-50 p-3 text-sm">
      <p className="font-medium">Delete “{collection.name}”?</p>

      {hasCards && (
        <div className="space-y-2">
          <p className="text-neutral-600">
            It has {collection.count} card{collection.count === 1 ? "" : "s"}. What should happen to
            them?
          </p>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`disp-${collection.id}`}
              checked={cardAction === "move"}
              disabled={others.length === 0}
              onChange={() => setCardAction("move")}
            />
            <span className={others.length === 0 ? "text-neutral-400" : ""}>
              Move them to
            </span>
            <select
              value={targetId}
              disabled={cardAction !== "move" || others.length === 0}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded border px-1 py-0.5 disabled:opacity-50"
            >
              {others.length === 0 ? (
                <option value="">(no other collection)</option>
              ) : (
                others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`disp-${collection.id}`}
              checked={cardAction === "delete"}
              onChange={() => setCardAction("delete")}
            />
            <span>Delete the cards too</span>
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button
          disabled={busy || (hasCards && cardAction === "move" && !targetId)}
          onClick={() => onConfirm(cardAction, cardAction === "move" ? targetId : undefined)}
          className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
        >
          {hasCards && cardAction === "move" ? "Move cards & delete" : "Delete"}
        </button>
        <button disabled={busy} onClick={onCancel} className="rounded border px-3 py-1">
          Cancel
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
