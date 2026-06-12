"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Sparkles, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateFromText, generateFromFile } from "./actions";

const MIN_TEXT = 20;

export default function NewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit = file !== null || text.trim().length >= MIN_TEXT;

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    setError(null);
    setFile(f);
  }

  function submit() {
    if (!canSubmit || pending) return;
    setError(null);
    startTransition(async () => {
      let res: { error: string } | null;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        res = await generateFromFile(null, fd);
      } else {
        const fd = new FormData();
        fd.set("text", text);
        res = await generateFromText(null, fd);
      }
      // Success redirects server-side; only an error returns here.
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-2xl md:pt-6">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold leading-tight md:text-3xl">Add a document</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-[0.95rem]">
            We&rsquo;ll turn it into atomic flashcards — a new deck is made from it.
          </p>
        </div>

        {/* drop zone */}
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <FileText className="size-[22px]" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-medium">{file.name}</div>
              <div className="text-[0.78rem] text-muted-foreground tabular-nums">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remove file">
              <X className="size-5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex w-full flex-col items-center gap-4 rounded-xl border-[1.5px] border-dashed px-8 py-12 text-center transition-colors",
              dragging ? "border-primary bg-accent" : "border-input hover:border-primary hover:bg-accent",
            )}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Upload className="size-[26px]" />
            </span>
            <span>
              <span className="font-medium md:text-base">
                Drop a PDF or Word doc here, or{" "}
                <span className="text-primary underline underline-offset-2">click to browse</span>
              </span>
              <span className="mt-1.5 block text-[0.82rem] text-muted-foreground">
                PDF · DOCX — up to 25 MB
              </span>
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />

        {/* or paste */}
        <div className="my-6 flex items-center gap-3.5 text-[0.78rem] font-medium text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or paste text
          <span className="h-px flex-1 bg-border" />
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a passage, lecture notes, an article…"
          rows={8}
          disabled={file !== null}
          className="min-h-36"
        />

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-7 flex items-center justify-between gap-3">
          <span className="text-[0.8rem] text-muted-foreground">
            A new deck will be named from your document.
          </span>
          <Button size="lg" disabled={!canSubmit || pending} onClick={submit}>
            <Sparkles className="size-[18px]" />
            {pending ? "Making cards…" : "Make cards"}
          </Button>
        </div>
      </div>
    </div>
  );
}
