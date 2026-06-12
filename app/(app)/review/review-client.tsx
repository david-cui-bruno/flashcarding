"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { autoAcceptCards, keepCard, rejectCard, editCard } from "./actions";
import type { ReviewMode } from "@/lib/metrics/graduation";

type PendingCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
};

const MODE_LABEL: Record<ReviewMode, string> = {
  "review-all": "Reviewing every card",
  "spot-check": "Spot-check — a sample of this batch",
  trust: "Trust mode — new cards go straight in",
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
  const router = useRouter();
  const [i, setI] = useState(0);
  const [panel, setPanel] = useState<"none" | "edit" | "reject">("none");
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [reason, setReason] = useState("");

  const acceptedOnce = useRef(false);
  useEffect(() => {
    if (acceptedOnce.current) return;
    acceptedOnce.current = true;
    if (autoAcceptIds.length > 0) void autoAcceptCards(autoAcceptIds);
  }, [autoAcceptIds]);

  const card = i < cards.length ? cards[i] : null;
  const interactive = card !== null && panel === "none";

  // Optimistic: advance immediately, persist the triage decision in the background.
  function commit(fn: () => Promise<void>) {
    void fn().catch(() => toast.error("Couldn't save that — try again."));
    setI((n) => n + 1);
    setPanel("none");
    setReason("");
  }

  const keep = () => card && commit(() => keepCard(card.id));
  const confirmReject = () => card && commit(() => rejectCard(card.id, reason));
  const saveEdit = () => card && commit(() => editCard(card.id, term, definition));

  function startEdit() {
    if (!card) return;
    setTerm(card.term);
    setDefinition(card.definition);
    setPanel("edit");
  }

  // Keyboard-first: ← reject · ↑ edit · → keep.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!interactive) return;
      if (e.key === "ArrowRight") void keep();
      else if (e.key === "ArrowLeft") setPanel("reject");
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        startEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, i]);

  if (!card) {
    const msg =
      mode === "trust"
        ? "Trust mode is on — new cards were added to your decks automatically."
        : i === 0
          ? "Nothing to review right now."
          : "All reviewed 🎉";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-xl font-medium">{msg}</p>
        <Button asChild onClick={() => router.refresh()}>
          <Link href="/library">Back to decks</Link>
        </Button>
      </div>
    );
  }

  const total = cards.length;
  const progress = Math.round((i / total) * 100);

  return (
    <div className="flex flex-1 flex-col">
      {/* top: mode + progress (extra right padding on mobile clears the close button) */}
      <div className="mx-auto w-full max-w-[720px] pl-6 pr-14 pt-6 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Badge variant="secondary" className="gap-1.5 bg-accent text-accent-foreground">
            <span className="size-1.5 rounded-full bg-current" />
            {MODE_LABEL[mode]}
          </Badge>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            <span className="text-primary">{i + 1}</span> / {total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {panel === "edit" ? (
        <div className="mx-auto mt-10 w-full max-w-md space-y-3 px-6">
          <div className="grid gap-1.5">
            <Label htmlFor="r-term">Term</Label>
            <Input id="r-term" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-def">Definition</Label>
            <Textarea id="r-def" value={definition} onChange={(e) => setDefinition(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={saveEdit}>Save &amp; keep</Button>
            <Button variant="ghost" onClick={() => setPanel("none")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* content anchored to the top — term + definition same size, no source */}
          <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
            <div className="w-full max-w-[620px]">
              <p className="text-2xl font-semibold leading-snug">{card.term}</p>
              <p className="mt-3.5 text-2xl leading-relaxed">{card.definition}</p>
            </div>
          </div>

          {/* bottom: keyboard-first chips */}
          <div className="flex flex-col items-center gap-3.5 px-6 pb-10">
            {panel === "reject" ? (
              <div className="w-full max-w-md space-y-2">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="What was wrong? (optional — helps tune future cards)"
                  autoFocus
                />
                {/* Nudge salvageable cards toward an edit: a before→after fix is a far
                    stronger signal for the generator than a reject (see docs/DESIGN.md). */}
                <p className="text-[0.76rem] text-muted-foreground">
                  Fixable?{" "}
                  <button
                    type="button"
                    onClick={startEdit}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Edit it instead
                  </button>{" "}
                  — your fix teaches the generator better than a reject.
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={confirmReject}>
                    Confirm reject
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPanel("none")}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3.5">
                  <Chip onClick={() => setPanel("reject")} className="text-destructive">
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-[0.8rem]">←</kbd>
                    Reject
                  </Chip>
                  <Chip onClick={startEdit}>
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-[0.8rem]">↑</kbd>
                    Edit
                  </Chip>
                  <Chip onClick={keep} className="text-due">
                    <kbd className="rounded bg-muted px-1.5 py-0.5 text-[0.8rem]">→</kbd>
                    Keep
                  </Chip>
                </div>
                <p className="text-[0.76rem] text-muted-foreground">
                  <span className="hidden md:inline">Use your arrow keys.</span>
                  <span className="md:hidden">Tap to triage.</span>
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
