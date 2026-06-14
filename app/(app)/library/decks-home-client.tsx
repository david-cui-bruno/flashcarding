"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  Play,
  Plus,
  MoreHorizontal,
  Settings2,
  Pencil,
  Trash2,
  Check,
  Inbox,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { renameCollection, deleteCollection } from "./actions";

export type DeckSummary = {
  id: string;
  name: string;
  total: number;
  studyable: number;
  dueNow: number;
  state: "due" | "new" | "caught-up" | "none";
};

export function DecksHome({ decks, triageCount }: { decks: DeckSummary[]; triageCount: number }) {
  const [renameTarget, setRenameTarget] = useState<DeckSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeckSummary | null>(null);

  const empty = decks.length === 0;

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        {/* Mobile-only triage row (web shows it in the sidebar) */}
        {triageCount > 0 && (
          <Link
            href="/review"
            className="mb-6 flex items-center gap-3 rounded-xl bg-accent p-3.5 text-accent-foreground md:hidden"
          >
            <span className="flex size-10 items-center justify-center rounded-[11px] bg-card text-primary shadow-sm">
              <Inbox className="size-[19px]" />
            </span>
            <span className="flex-1 leading-tight">
              <span className="block text-sm font-semibold">To triage</span>
              <span className="block text-[0.76rem] opacity-85">Review freshly-generated cards</span>
            </span>
            <Badge className="bg-card font-semibold text-accent-foreground tabular-nums">
              {triageCount}
            </Badge>
            <ChevronRight className="size-[18px] opacity-70" />
          </Link>
        )}

        <div className="flex items-end justify-between pb-6">
          <div>
            <h1 className="text-2xl font-medium tracking-tight md:text-3xl">Decks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {empty ? "Make your first deck from a document." : "Pick a deck to study."}
            </p>
          </div>
        </div>

        {empty ? (
          <EmptyState />
        ) : (
          <>
            {/* WEB: grid of tiles with counts */}
            <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-3">
              {decks.map((d) => (
                <DeckTile
                  key={d.id}
                  deck={d}
                  onRename={() => setRenameTarget(d)}
                  onDelete={() => setDeleteTarget(d)}
                />
              ))}
              <NewDeckTile />
            </div>

            {/* MOBILE: clean list, no numbers */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {decks.map((d) => (
                <DeckRow
                  key={d.id}
                  deck={d}
                  onRename={() => setRenameTarget(d)}
                  onDelete={() => setDeleteTarget(d)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <RenameDialog target={renameTarget} onClose={() => setRenameTarget(null)} />
      <DeleteDialog
        target={deleteTarget}
        decks={decks}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* --------------------------------- tiles ---------------------------------- */

const stateColor: Record<DeckSummary["state"], string> = {
  due: "text-primary",
  new: "text-new",
  "caught-up": "",
  none: "",
};

// A deck tile that FLIPS in place to choose Study-due vs Cram (replaces the
// separate gate screen on the web grid). The card metaphor is literal: it's a
// card, it flips. The stacked-paper edges peek below to read as a deck.
// Reduced-motion users get an instant face swap (no rotate). The /study/[id]
// gate route remains as the fallback (deep links, mobile list rows).
function DeckTile({
  deck,
  onRename,
  onDelete,
}: {
  deck: DeckSummary;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const lit = deck.state === "due" || deck.state === "new";
  const faceShadow = lit
    ? "border-transparent shadow-[0_0_0_1.5px_var(--ring),0_2px_8px_-2px_rgba(15,23,42,.08)]"
    : "border border-border/70 shadow-[0_2px_6px_-1px_rgba(15,23,42,.06),0_1px_2px_rgba(15,23,42,.04)]";

  return (
    <div className="group relative h-[176px] [perspective:1200px]">
      {/* stacked-paper edges peeking below — the "deck" metaphor (same proportions) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-5 bottom-0 h-4 translate-y-[6px] rounded-b-[14px] border border-border/50 bg-card" />
      <div aria-hidden className="pointer-events-none absolute inset-x-3 bottom-0 h-4 translate-y-[3px] rounded-b-[14px] border border-border/70 bg-card" />

      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
          flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* FRONT */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <div
            className={cn(
              "relative flex h-full flex-col gap-4 rounded-xl bg-card p-5 transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_30px_-10px_rgba(15,23,42,.18)]",
              faceShadow,
            )}
          >
            {/* clicking the card flips it; the ⋯ sits above and opens the menu instead */}
            <button
              onClick={() => setFlipped(true)}
              aria-label={`${deck.name} — choose how to study`}
              aria-expanded={flipped}
              className="absolute inset-0 z-0 rounded-xl"
            />
            <ManageMenu deck={deck} onRename={onRename} onDelete={onDelete}>
              <button
                className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-55 transition hover:bg-muted hover:opacity-100"
                aria-label="Manage deck"
              >
                <MoreHorizontal className="size-[18px]" />
              </button>
            </ManageMenu>

            <span
              className={cn(
                "flex size-[42px] items-center justify-center rounded-[13px]",
                lit ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Layers className="size-[21px]" />
            </span>

            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium leading-snug">{deck.name}</span>
                {deck.state === "new" && (
                  <Badge className="bg-success-soft px-1.5 py-0.5 text-[0.62rem] text-success">new</Badge>
                )}
              </div>
              <div className="text-[0.78rem] text-muted-foreground tabular-nums">{deck.total} cards</div>
            </div>

            <div className="flex items-end justify-between">
              {deck.state === "caught-up" ? (
                <Badge className="gap-1 bg-success-soft text-success">
                  <Check className="size-3" strokeWidth={2.5} />
                  caught up
                </Badge>
              ) : deck.state === "none" ? (
                <span />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("text-[1.9rem] font-semibold leading-none tracking-tight tabular-nums", stateColor[deck.state])}>
                    {deck.dueNow}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">{deck.state === "new" ? "new" : "due"}</span>
                </div>
              )}
              <span
                className={cn(
                  "flex size-[34px] items-center justify-center rounded-full transition-colors",
                  lit
                    ? "bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Play className="size-[15px] fill-current" strokeWidth={0} />
              </span>
            </div>
          </div>
        </div>

        {/* BACK — Study due / Cram all */}
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div
            onKeyDown={(e) => e.key === "Escape" && setFlipped(false)}
            className={cn("flex h-full flex-col rounded-xl bg-card p-4", faceShadow)}
          >
            <button
              onClick={() => setFlipped(false)}
              className="flex w-fit items-center gap-1 rounded-md py-0.5 pr-2 text-[0.74rem] text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back to deck"
            >
              <ChevronLeft className="size-4" />
              back
            </button>
            <div className="truncate px-1 pt-0.5 text-center text-sm font-medium">{deck.name}</div>

            <div className="flex flex-1 flex-col justify-center gap-2">
              {deck.studyable === 0 ? (
                <p className="text-center text-xs text-muted-foreground">No cards to study yet</p>
              ) : (
                <>
                  {deck.dueNow > 0 ? (
                    <Button asChild size="sm" className="w-full justify-between">
                      <Link href={`/study/${deck.id}?mode=due`}>
                        <span className="flex items-center gap-1.5">
                          <Play className="size-3.5 fill-current" strokeWidth={0} />
                          Study due
                        </span>
                        <span className="font-semibold tabular-nums">{deck.dueNow}</span>
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" disabled className="w-full justify-between">
                      <span className="flex items-center gap-1.5">
                        <Play className="size-3.5 fill-current" strokeWidth={0} />
                        Study due
                      </span>
                      <span className="text-xs">none</span>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="w-full justify-between">
                    <Link href={`/study/${deck.id}?mode=cram`}>
                      <span className="flex items-center gap-1.5">
                        <RotateCcw className="size-3.5" />
                        Cram all
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{deck.studyable}</span>
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckRow({
  deck,
  onRename,
  onDelete,
}: {
  deck: DeckSummary;
  onRename: () => void;
  onDelete: () => void;
}) {
  const lit = deck.state === "due" || deck.state === "new";
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_3px_rgba(15,23,42,.05)]",
        lit && "border-transparent shadow-[0_0_0_1.5px_var(--ring),0_2px_8px_-2px_rgba(15,23,42,.08)]",
      )}
    >
      <Link href={`/study/${deck.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={`Study ${deck.name}`} />
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          lit ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Layers className="size-[22px]" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate font-medium">{deck.name}</div>
        <div className="text-[0.78rem] text-muted-foreground tabular-nums">{deck.total} cards</div>
      </div>
      <span
        className={cn(
          "z-10 flex size-[34px] items-center justify-center rounded-full",
          lit ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Play className="size-[15px] fill-current" strokeWidth={0} />
      </span>
      <ManageMenu deck={deck} onRename={onRename} onDelete={onDelete}>
        <button
          className="z-10 flex size-[30px] items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
          aria-label="Manage deck"
        >
          <MoreHorizontal className="size-[18px]" />
        </button>
      </ManageMenu>
    </div>
  );
}

function NewDeckTile() {
  return (
    <Link
      href="/new"
      className="flex h-[176px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-5 text-muted-foreground transition-colors hover:bg-muted/40"
    >
      <span className="flex size-[42px] items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Plus className="size-[22px]" />
      </span>
      <span className="text-sm font-medium">New deck</span>
      <span className="text-[0.72rem]">Paste, upload, or import</span>
    </Link>
  );
}

function ManageMenu({
  deck,
  onRename,
  onDelete,
  children,
}: {
  deck: DeckSummary;
  onRename: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/collections/${deck.id}`}>
            <Settings2 className="size-4" />
            Manage cards
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTimeout(onRename, 0)}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(onDelete, 0)}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Layers className="size-7" />
      </span>
      <div>
        <p className="font-medium">No decks yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Generate cards from a document to get started.</p>
      </div>
      <Button asChild>
        <Link href="/new">
          <Plus className="size-[17px] " />
          New deck
        </Link>
      </Button>
    </div>
  );
}

/* -------------------------------- dialogs --------------------------------- */

function RenameDialog({ target, onClose }: { target: DeckSummary | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the field whenever a new target opens.
  const [seen, setSeen] = useState<string | null>(null);
  if (target && target.id !== seen) {
    setSeen(target.id);
    setName(target.name);
    setError(null);
  }

  function save() {
    if (!target) return;
    startTransition(async () => {
      const res = await renameCollection(target.id, name);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename deck</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="deck-name">Name</Label>
          <Input
            id="deck-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !name.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  decks,
  onClose,
}: {
  target: DeckSummary | null;
  decks: DeckSummary[];
  onClose: () => void;
}) {
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const others = decks.filter((d) => d.id !== target?.id);
  const hasCards = (target?.total ?? 0) > 0;

  function run(cardAction: "delete" | "move") {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCollection(target.id, cardAction, moveTarget || undefined);
      if (res.error) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{target?.name}”?</DialogTitle>
          <DialogDescription>
            {hasCards
              ? `This deck has ${target?.total} card${target?.total === 1 ? "" : "s"}. Move them to another deck, or delete everything.`
              : "This deck is empty and will be removed."}
          </DialogDescription>
        </DialogHeader>

        {hasCards && others.length > 0 && (
          <div className="grid gap-2">
            <Label>Move cards to</Label>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a deck…" />
              </SelectTrigger>
              <SelectContent>
                {others.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onClose} disabled={pending} className="sm:mr-auto">
            Cancel
          </Button>
          {hasCards && others.length > 0 && (
            <Button onClick={() => run("move")} disabled={pending || !moveTarget}>
              Move &amp; delete deck
            </Button>
          )}
          <Button variant="destructive" onClick={() => run("delete")} disabled={pending}>
            {hasCards ? "Delete deck + cards" : "Delete deck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
