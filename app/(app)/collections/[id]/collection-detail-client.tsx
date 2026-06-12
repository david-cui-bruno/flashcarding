"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Plus,
  MoreVertical,
  Search,
  Pencil,
  Trash2,
  FolderInput,
  X,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import type { Database } from "@/lib/types/database";
import { updateCard, deleteCard, moveCards } from "./actions";
import { renameCollection, deleteCollection } from "../../library/actions";

type ReviewStatus = Database["public"]["Enums"]["review_status"];

export type DetailCard = {
  id: string;
  term: string;
  definition: string;
  source_span: string | null;
  review_status: ReviewStatus;
};

type OtherCollection = { id: string; name: string };

const STATUS_BADGE: Record<ReviewStatus, { label: string; cls: string }> = {
  pending: { label: "pending", cls: "" },
  accepted: { label: "accepted", cls: "bg-success-soft text-success" },
  edited: { label: "edited", cls: "bg-warning-soft text-warning" },
  rejected: { label: "rejected", cls: "text-muted-foreground line-through" },
};

export function CollectionDetailClient({
  collectionId,
  collectionName,
  cards,
  otherCollections,
  triplet,
}: {
  collectionId: string;
  collectionName: string;
  cards: DetailCard[];
  otherCollections: OtherCollection[];
  triplet: { nw: number; learning: number; due: number };
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteDeckOpen, setDeleteDeckOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) => c.term.toLowerCase().includes(q) || c.definition.toLowerCase().includes(q),
    );
  }, [cards, query]);

  const editing = editCardId ? cards.find((c) => c.id === editCardId) ?? null : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allShownSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  function toggleAll() {
    setSelected(allShownSelected ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function move(targetId: string) {
    if (selected.size === 0) return;
    startTransition(async () => {
      await moveCards([...selected], targetId, collectionId);
      setSelected(new Set());
      router.refresh();
    });
  }
  function runBulkDelete() {
    startTransition(async () => {
      for (const id of selected) await deleteCard(id, collectionId);
      setSelected(new Set());
      setBulkDelete(false);
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/library"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Decks
        </Link>

        {/* header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{collectionName}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground tabular-nums">{cards.length} cards</span>
              <span className="size-1 rounded-full bg-border" />
              <span className="text-[0.95rem] font-semibold tabular-nums">
                <span className="text-new">{triplet.nw}</span>
                <span className="mx-1 font-normal text-muted-foreground">+</span>
                <span className="text-learning">{triplet.learning}</span>
                <span className="mx-1 font-normal text-muted-foreground">+</span>
                <span className="text-due">{triplet.due}</span>
              </span>
              <span className="text-[0.78rem] text-muted-foreground">new · learning · due</span>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2.5">
            <Button asChild>
              <Link href={`/study/${collectionId}`}>
                <Play className="size-[17px] fill-current" strokeWidth={0} />
                Study
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/new">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add cards</span>
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Deck menu">
                  <MoreVertical className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onSelect={() => setTimeout(() => setRenameOpen(true), 0)}>
                  <Pencil className="size-4" />
                  Rename deck
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setTimeout(() => setDeleteDeckOpen(true), 0)}
                >
                  <Trash2 className="size-4" />
                  Delete deck
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
            <p className="font-medium">No cards in this deck.</p>
            <Button asChild>
              <Link href="/new">Generate some</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* toolbar */}
            <div className="flex items-center justify-between gap-3 pb-3 pt-8">
              <div className="relative max-w-[280px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards"
                  className="pl-9"
                />
              </div>
              <span className="text-[0.8rem] text-muted-foreground tabular-nums">
                {filtered.length} of {cards.length}
              </span>
            </div>

            {/* table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-11">
                      <Checkbox
                        checked={allShownSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-[34%]">Term</TableHead>
                    <TableHead>Definition</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const sel = selected.has(c.id);
                    const badge = STATUS_BADGE[c.review_status];
                    return (
                      <TableRow
                        key={c.id}
                        data-state={sel ? "selected" : undefined}
                        className={cn("cursor-pointer", sel && "bg-accent hover:bg-accent")}
                        onClick={() => setEditCardId(c.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={sel}
                            onCheckedChange={() => toggle(c.id)}
                            aria-label="Select card"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.term}</TableCell>
                        <TableCell>
                          <span className="line-clamp-2 text-muted-foreground">{c.definition}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("font-normal", badge.cls)}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <Button asChild variant="outline" className="mt-4 w-full border-dashed text-muted-foreground">
              <Link href="/new">
                <Plus className="size-4" />
                Add cards to this deck
              </Link>
            </Button>
          </>
        )}
      </div>

      {/* floating bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-20 mx-auto flex w-max items-center gap-2 rounded-full bg-foreground py-2 pl-5 pr-2 text-background shadow-[0_18px_48px_-18px_rgba(28,25,23,.55)] md:bottom-8">
          <span className="text-sm font-semibold tabular-nums">{selected.size} selected</span>
          <span className="h-5 w-px bg-background/20" />
          {otherCollections.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={pending}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.82rem] font-medium transition-colors hover:bg-background/15 disabled:opacity-50"
                >
                  <FolderInput className="size-[15px]" />
                  Move to deck
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top" className="max-h-64 w-56 overflow-y-auto">
                <DropdownMenuLabel>Move to…</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {otherCollections.map((o) => (
                  <DropdownMenuItem key={o.id} onSelect={() => move(o.id)}>
                    {o.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            disabled={pending}
            onClick={() => setBulkDelete(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.82rem] font-medium transition-colors hover:bg-background/15 disabled:opacity-50"
          >
            <Trash2 className="size-[15px]" />
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-background/15"
            aria-label="Clear selection"
          >
            <X className="size-[15px]" />
          </button>
        </div>
      )}

      <EditCardDialog
        card={editing}
        collectionId={collectionId}
        onClose={() => setEditCardId(null)}
      />

      <BulkDeleteDialog
        open={bulkDelete}
        count={selected.size}
        pending={pending}
        onConfirm={runBulkDelete}
        onClose={() => setBulkDelete(false)}
      />

      <RenameDeckDialog
        open={renameOpen}
        id={collectionId}
        currentName={collectionName}
        onClose={() => setRenameOpen(false)}
      />

      <DeleteDeckDialog
        open={deleteDeckOpen}
        id={collectionId}
        name={collectionName}
        cardCount={cards.length}
        others={otherCollections}
        onClose={() => setDeleteDeckOpen(false)}
        onDeleted={() => router.push("/library")}
      />
    </div>
  );
}

/* -------------------------------- dialogs --------------------------------- */

function EditCardDialog({
  card,
  collectionId,
  onClose,
}: {
  card: DetailCard | null;
  collectionId: string;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const [definition, setDefinition] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seen, setSeen] = useState<string | null>(null);

  if (card && card.id !== seen) {
    setSeen(card.id);
    setTerm(card.term);
    setDefinition(card.definition);
    setError(null);
  }

  function save() {
    if (!card) return;
    startTransition(async () => {
      const res = await updateCard(card.id, collectionId, term, definition);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <Dialog open={!!card} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit card</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="e-term">Term</Label>
            <Input id="e-term" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="e-def">Definition</Label>
            <Textarea id="e-def" value={definition} onChange={(e) => setDefinition(e.target.value)} rows={4} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !term.trim() || !definition.trim()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDeleteDialog({
  open,
  count,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  count: number;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {count} card{count === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>This can&rsquo;t be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDeckDialog({
  open,
  id,
  currentName,
  onClose,
}: {
  open: boolean;
  id: string;
  currentName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await renameCollection(id, name);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename deck</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="dn">Name</Label>
          <Input
            id="dn"
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

function DeleteDeckDialog({
  open,
  id,
  name,
  cardCount,
  others,
  onClose,
  onDeleted,
}: {
  open: boolean;
  id: string;
  name: string;
  cardCount: number;
  others: OtherCollection[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [moveTarget, setMoveTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasCards = cardCount > 0;

  function run(cardAction: "delete" | "move") {
    setError(null);
    startTransition(async () => {
      const res = await deleteCollection(id, cardAction, moveTarget || undefined);
      if (res.error) setError(res.error);
      else onDeleted();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>
            {hasCards
              ? `This deck has ${cardCount} card${cardCount === 1 ? "" : "s"}. Move them to another deck, or delete everything.`
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
                {others.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
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
