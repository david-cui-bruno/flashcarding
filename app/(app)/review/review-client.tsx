"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { autoAcceptCards, keepCard, rejectCard, editCard } from "./actions";
import type { ReviewMode } from "@/lib/metrics/graduation";

type PendingCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
};

type Dir = "right" | "left" | "up";
const SWIPE_THRESHOLD = 90; // px past which a release commits the action
const TAP_SLOP = 8; // px of movement still counted as a tap (→ edit)
const EXIT_MS = 220;

const MODE_LABEL: Record<ReviewMode, string> = {
  "review-all": "Reviewing every card",
  "spot-check": "Spot-check — reviewing a sample of this batch",
  trust: "Trust mode — new cards go straight into your deck",
};

export function ReviewClient({
  mode,
  modeReason,
  cards,
  autoAcceptIds,
}: {
  mode: ReviewMode;
  modeReason: string;
  cards: PendingCard[];
  autoAcceptIds: string[];
}) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "edit" | "reject">("none");
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [reason, setReason] = useState("");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<Dir | null>(null);

  const start = useRef<{ x: number; y: number } | null>(null);
  const acceptedOnce = useRef(false);

  // Auto-accept the cards this mode doesn't ask the user to review (once, on mount).
  useEffect(() => {
    if (acceptedOnce.current) return;
    acceptedOnce.current = true;
    if (autoAcceptIds.length > 0) void autoAcceptCards(autoAcceptIds);
  }, [autoAcceptIds]);

  const card = i < cards.length ? cards[i] : null;
  const interactive = card !== null && !busy && !leaving && panel === "none";

  // Fire the action + play the exit animation, then advance to the next card.
  async function commit(dir: Dir, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setDrag(null);
    setLeaving(dir);
    await Promise.all([fn(), new Promise((r) => setTimeout(r, EXIT_MS))]);
    setI((n) => n + 1);
    setPanel("none");
    setReason("");
    setLeaving(null);
    setBusy(false);
  }

  const keep = () => card && commit("right", () => keepCard(card.id));
  const confirmReject = () =>
    card && commit("left", () => rejectCard(card.id, reason));
  const saveEdit = () =>
    card && commit("up", () => editCard(card.id, term, definition));

  function startEdit() {
    if (!card) return;
    setTerm(card.term);
    setDefinition(card.definition);
    setDrag(null);
    setPanel("edit");
  }
  function openReject() {
    setDrag(null);
    setPanel("reject");
  }

  // --- pointer (swipe) handling ---
  function onPointerDown(e: PointerEvent) {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  }
  function onPointerMove(e: PointerEvent) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }
  function onPointerUp() {
    const d = drag;
    start.current = null;
    setDrag(null);
    if (!d) return;
    const { x, y } = d;
    if (y < -SWIPE_THRESHOLD && Math.abs(y) > Math.abs(x)) startEdit();
    else if (x > SWIPE_THRESHOLD) void keep();
    else if (x < -SWIPE_THRESHOLD) openReject();
    else if (Math.hypot(x, y) < TAP_SLOP) startEdit(); // tap = edit
    // otherwise: small drag → snaps back (drag already cleared)
  }

  // Keyboard parity for desktop / accessibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!interactive) return;
      if (e.key === "ArrowRight") void keep();
      else if (e.key === "ArrowLeft") openReject();
      else if (e.key === "ArrowUp") startEdit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, i]);

  const banner = (
    <div className="flex items-center justify-between gap-3 rounded border bg-neutral-50 px-3 py-2 text-xs">
      <div>
        <span className="font-medium">{MODE_LABEL[mode]}</span>
        <span className="text-neutral-500"> · {modeReason}</span>
      </div>
      <Link href="/metrics" className="shrink-0 underline">
        Metrics
      </Link>
    </div>
  );

  if (!card) {
    const msg =
      mode === "trust"
        ? "Trust mode is on — new cards were added to your deck automatically."
        : i === 0
          ? "Nothing to review in this batch."
          : "All reviewed 🎉";
    return (
      <div className="space-y-4">
        {banner}
        <p>{msg}</p>
        <Link href="/study" className="underline">
          Study now
        </Link>
      </div>
    );
  }

  // transform for the active card
  const transform = leaving
    ? leaving === "right"
      ? "translateX(120%) rotate(18deg)"
      : leaving === "left"
        ? "translateX(-120%) rotate(-18deg)"
        : "translateY(-120%)"
    : drag
      ? `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)`
      : "none";

  const dx = drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const showKeep = dx > 24 && Math.abs(dx) > Math.abs(dy);
  const showNope = dx < -24 && Math.abs(dx) > Math.abs(dy);
  const showEdit = dy < -24 && Math.abs(dy) >= Math.abs(dx);

  return (
    <div className="space-y-4">
      {banner}
      <p className="text-sm text-neutral-500">
        {i + 1} / {cards.length} · swipe → keep · ← reject · ↑/tap edit
      </p>

      {panel === "edit" ? (
        <div className="space-y-2 rounded border p-4">
          <label className="block text-xs text-neutral-500">Term</label>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full rounded border px-2 py-1"
          />
          <label className="block text-xs text-neutral-500">Definition</label>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={3}
            className="w-full rounded border px-2 py-1"
          />
          <div className="flex gap-2 pt-2">
            <button
              disabled={busy}
              onClick={saveEdit}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Save &amp; keep
            </button>
            <button
              disabled={busy}
              onClick={() => setPanel("none")}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="relative touch-none select-none">
          {/* swipe hint overlays */}
          <Hint show={showKeep} className="left-3 border-green-500 text-green-600">
            KEEP
          </Hint>
          <Hint show={showNope} className="right-3 border-red-500 text-red-600">
            REJECT
          </Hint>
          <Hint show={showEdit} className="left-1/2 -translate-x-1/2 border-blue-500 text-blue-600">
            EDIT
          </Hint>
          <div
            key={card.id}
            data-testid="review-card"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              transform,
              transition: drag ? "none" : `transform ${EXIT_MS}ms ease, opacity ${EXIT_MS}ms ease`,
              opacity: leaving ? 0 : 1,
              cursor: "grab",
            }}
            className="rounded border bg-white p-4 shadow-sm"
          >
            <div className="text-lg font-medium">{card.term}</div>
            <div className="mt-1">{card.definition}</div>
            {card.source_span && (
              <div className="mt-3 border-l-2 pl-3 text-sm text-neutral-500">
                &ldquo;{card.source_span}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}

      {panel === "reject" ? (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What was wrong? (optional — feeds the generator)"
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={confirmReject}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              disabled={busy}
              onClick={() => setPanel("none")}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : panel === "none" ? (
        // Buttons mirror the swipes — desktop + accessibility.
        <div className="flex gap-2">
          <button
            disabled={!interactive}
            onClick={keep}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Keep →
          </button>
          <button
            disabled={!interactive}
            onClick={startEdit}
            className="rounded border px-4 py-2 text-sm"
          >
            ↑ Edit
          </button>
          <button
            disabled={!interactive}
            onClick={openReject}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600"
          >
            ← Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Hint({
  show,
  className,
  children,
}: {
  show: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{ opacity: show ? 1 : 0 }}
      className={`pointer-events-none absolute top-3 z-10 rounded border-2 px-2 py-0.5 text-sm font-bold uppercase transition-opacity ${className ?? ""}`}
    >
      {children}
    </span>
  );
}
