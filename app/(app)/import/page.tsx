"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseQuizletExport } from "@/lib/import/quizlet";
import { importPastedCards } from "./actions";
import { ApkgUploader } from "./apkg-uploader";

type ImportMode = "paste" | "quizlet";
type SeparatorPreset = "tab" | "comma" | "custom";

const separatorValue = (preset: SeparatorPreset, custom: string, fallback: string) => {
  if (preset === "tab") return "\t";
  if (preset === "comma") return ",";
  return custom || fallback;
};

export default function ImportPage() {
  const [state, action, pending] = useActionState(importPastedCards, null);
  const [mode, setMode] = useState<ImportMode>("paste");
  const [text, setText] = useState("");
  const [termPreset, setTermPreset] = useState<SeparatorPreset>("tab");
  const [rowPreset, setRowPreset] = useState<SeparatorPreset>("tab");
  const [customTermSeparator, setCustomTermSeparator] = useState("::");
  const [customRowSeparator, setCustomRowSeparator] = useState("||");

  const termSeparator = separatorValue(termPreset, customTermSeparator, "\t");
  const rowSeparator = rowPreset === "tab" ? "\n" : separatorValue(rowPreset, customRowSeparator, "\n");
  const preview = useMemo(
    () => parseQuizletExport(text, { termSeparator, rowSeparator }),
    [rowSeparator, termSeparator, text],
  );
  const showQuizlet = mode === "quizlet";
  const blockingIssue = preview.issues.find((issue) => issue.code === "empty_input" || issue.code === "single_column");

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-2xl md:pt-6">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">Import cards</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-[0.95rem]">
            Paste cards you already have, including Quizlet exports. They&rsquo;re added as-is, no AI.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-2xl border bg-card p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`rounded-xl px-3 py-2 ${mode === "paste" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Paste / CSV
          </button>
          <button
            type="button"
            onClick={() => setMode("quizlet")}
            className={`rounded-xl px-3 py-2 ${showQuizlet ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Quizlet
          </button>
        </div>

        <form action={action} className="space-y-5">
          <input type="hidden" name="importMode" value={mode} />
          {showQuizlet && <input type="hidden" name="termSeparator" value={termSeparator} />}
          {showQuizlet && <input type="hidden" name="rowSeparator" value={rowSeparator} />}

          <div className="space-y-1.5">
            <Label htmlFor="deckName">Deck name</Label>
            <Input id="deckName" name="deckName" placeholder="e.g. Biology 101" maxLength={120} disabled={pending} />
          </div>

          {showQuizlet && (
            <div className="rounded-2xl border bg-muted/30 p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Quizlet export settings</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  In Quizlet, choose Export, then paste the exported text here. Public Quizlet links are not fetched because
                  Quizlet commonly blocks server requests.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <SeparatorControl
                  label="Between term and definition"
                  name="term"
                  preset={termPreset}
                  customValue={customTermSeparator}
                  onPresetChange={setTermPreset}
                  onCustomChange={setCustomTermSeparator}
                />
                <SeparatorControl
                  label="Between rows"
                  name="row"
                  preset={rowPreset}
                  customValue={customRowSeparator}
                  onPresetChange={setRowPreset}
                  onCustomChange={setCustomRowSeparator}
                  tabLabel="New line"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="text">{showQuizlet ? "Quizlet export text" : "Cards"}</Label>
            <Textarea
              id="text"
              name="text"
              required
              rows={12}
              disabled={pending}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="font-mono text-sm"
              placeholder={
                showQuizlet
                  ? "hola\thello\ngracias\tthank you"
                  : "hola\thello\ngracias\tthank you\n\n…or comma-separated:\nphoton, a quantum of light"
              }
            />
            <p className="text-xs text-muted-foreground">
              {showQuizlet
                ? "Quizlet defaults to tabs between term and definition, and new lines between rows."
                : "One card per line. The first tab or comma splits term / definition."}
            </p>
          </div>

          {showQuizlet && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Preview</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{preview.cards.length} cards</span>
              </div>
              {blockingIssue ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {blockingIssue.message}
                </p>
              ) : preview.cards.length > 0 ? (
                <div className="mt-3 max-h-56 divide-y overflow-auto rounded-xl border text-sm">
                  {preview.cards.slice(0, 5).map((card, index) => (
                    <div key={`${card.term}-${index}`} className="grid gap-1 p-3 md:grid-cols-2 md:gap-4">
                      <div className="font-medium">{card.term}</div>
                      <div className="text-muted-foreground whitespace-pre-wrap">{card.definition}</div>
                    </div>
                  ))}
                  {preview.cards.length > 5 && <div className="p-3 text-xs text-muted-foreground">+ {preview.cards.length - 5} more</div>}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Paste an export to preview cards before importing.</p>
              )}
            </div>
          )}

          {state?.error && (
            <p role="alert" aria-live="assertive" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || (showQuizlet && preview.cards.length === 0)}>
              <ClipboardPaste className="size-4" />
              {pending ? "Importing…" : showQuizlet ? `Import ${preview.cards.length || "Quizlet"} cards` : "Import cards"}
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

function SeparatorControl({
  label,
  name,
  preset,
  customValue,
  onPresetChange,
  onCustomChange,
  tabLabel = "Tab",
}: {
  label: string;
  name: string;
  preset: SeparatorPreset;
  customValue: string;
  onPresetChange: (preset: SeparatorPreset) => void;
  onCustomChange: (value: string) => void;
  tabLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 text-xs">
        {([
          ["tab", tabLabel],
          ["comma", "Comma"],
          ["custom", "Custom"],
        ] as const).map(([value, display]) => (
          <button
            key={value}
            type="button"
            onClick={() => onPresetChange(value)}
            className={`rounded-full border px-3 py-1 ${preset === value ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
          >
            {display}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <Input
          aria-label={`Custom separator ${name}`}
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
          placeholder={name === "row" ? "e.g. ||" : "e.g. ::"}
          className="font-mono text-sm"
        />
      )}
    </div>
  );
}
