"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importPastedCards } from "./actions";
import { ApkgUploader } from "./apkg-uploader";

export default function ImportPage() {
  const [state, action, pending] = useActionState(importPastedCards, null);

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-2xl md:pt-6">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">Import cards</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-[0.95rem]">
            Paste cards you already have — one per line,{" "}
            <span className="font-medium text-foreground">term, definition</span>{" "}
            (or tab-separated). They&rsquo;re added as-is, no AI. Works great with a Quizlet export.
          </p>
        </div>

        <form action={action} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="deckName">Deck name</Label>
            <Input id="deckName" name="deckName" placeholder="e.g. Biology 101" maxLength={120} disabled={pending} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="text">Cards</Label>
            <Textarea
              id="text"
              name="text"
              required
              rows={12}
              disabled={pending}
              className="font-mono text-sm"
              placeholder={"hola\thello\ngracias\tthank you\n\n…or comma-separated:\nphoton, a quantum of light"}
            />
            <p className="text-xs text-muted-foreground">
              One card per line. The first tab or comma splits term / definition (so commas inside a
              definition are fine).
            </p>
          </div>

          {state?.error && (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              <ClipboardPaste className="size-4" />
              {pending ? "Importing…" : "Import cards"}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/new">Generate from a document instead</Link>
            </Button>
          </div>
        </form>

        <div className="my-8 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or upload an Anki deck
          <span className="h-px flex-1 bg-border" />
        </div>

        <div>
          <h2 className="text-lg font-semibold">From an Anki .apkg</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Cards (and any audio) import straight from the file — parsed in your browser, no upload
            limit. Pick which fields become the front and back.
          </p>
          <ApkgUploader />
        </div>
      </div>
    </div>
  );
}
