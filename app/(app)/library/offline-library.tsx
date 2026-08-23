"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, CloudOff, Layers, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { dueCards, getAllCachedDecks, type CachedDeck } from "@/lib/offline/deck-cache";
import { getOutboxCount, OUTBOX_EVENT } from "@/lib/offline/sync";
import { StudyDeckClient } from "@/app/(app)/study/[collectionId]/study-deck-client";

// The library, offline: decks rebuilt from the IndexedDB cache (written through on
// every online library/study visit — lib/offline/sync.ts). Picking a deck starts the
// study session INLINE (no navigation — offline navigations can't reach the server;
// the service worker only guarantees /library itself). Due queue and cram both work;
// grades go to the outbox and sync on reconnect. Study-only by design: no offline
// generation, import, or triage (docs/APP-STORE-PLAN.md, guideline 4.2 scope).
export function OfflineLibrary() {
  const [decks, setDecks] = useState<CachedDeck[] | null>(null);
  const [pending, setPending] = useState(0);
  const [session, setSession] = useState<{ deck: CachedDeck; mode: "scheduled" | "cram" } | null>(
    null,
  );

  useEffect(() => {
    getAllCachedDecks().then(setDecks, () => setDecks([]));
    getOutboxCount().then(setPending, () => {});
    const onOutbox = (e: Event) => setPending((e as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener(OUTBOX_EVENT, onOutbox);
    return () => window.removeEventListener(OUTBOX_EVENT, onOutbox);
  }, []);

  if (session) {
    const queue =
      session.mode === "scheduled" ? dueCards(session.deck) : session.deck.cards;
    return (
      <div className="flex min-h-[calc(100vh-6rem)] flex-col md:min-h-screen">
        <div className="px-4 pt-4">
          <button
            onClick={() => setSession(null)}
            className="flex items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Decks
          </button>
        </div>
        <StudyDeckClient
          key={`${session.deck.deckId}-${session.mode}`}
          deckId={session.deck.deckId}
          name={session.deck.name}
          cards={queue}
          mode={session.mode}
          offline
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
          <span className="flex size-10 items-center justify-center rounded-[11px] bg-muted text-muted-foreground">
            <CloudOff className="size-[19px]" />
          </span>
          <div className="flex-1 leading-tight">
            <p className="text-sm font-semibold">You&rsquo;re offline</p>
            <p className="text-[0.76rem] text-muted-foreground">
              Study works from your cached decks.
              {pending > 0 &&
                ` ${pending} review${pending === 1 ? "" : "s"} will sync when you're back online.`}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between pb-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Decks</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pick a deck to study.</p>
          </div>
        </div>

        {decks === null ? null : decks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Layers className="size-7" />
            </span>
            <div>
              <p className="font-medium">Nothing cached yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the app online once and your decks will be available offline.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {decks.map((deck) => (
              <OfflineDeckRow
                key={deck.deckId}
                deck={deck}
                onStudy={(mode) => setSession({ deck, mode })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OfflineDeckRow({
  deck,
  onStudy,
}: {
  deck: CachedDeck;
  onStudy: (mode: "scheduled" | "cram") => void;
}) {
  const due = useMemo(() => dueCards(deck).length, [deck]);
  const total = deck.cards.length;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(15,23,42,.05)]",
        due > 0 && "border-transparent shadow-[0_0_0_1.5px_var(--ring),0_2px_8px_-2px_rgba(15,23,42,.08)]",
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          due > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Layers className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-medium">{deck.name}</div>
        <div className="text-[0.78rem] text-muted-foreground tabular-nums">
          {due > 0 ? `${due} due · ` : ""}
          {total} card{total === 1 ? "" : "s"}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={due === 0} onClick={() => onStudy("scheduled")}>
          <Play className="size-3.5 fill-current" strokeWidth={0} />
          Study due
        </Button>
        <Button size="sm" variant="outline" disabled={total === 0} onClick={() => onStudy("cram")}>
          <RotateCcw className="size-3.5" />
          Cram
        </Button>
      </div>
    </div>
  );
}
