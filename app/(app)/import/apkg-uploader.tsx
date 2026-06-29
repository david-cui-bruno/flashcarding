"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { parseApkg, fieldToText, type ParsedApkg } from "@/lib/apkg/parse-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const BUCKET = "card-audio";
const CONCURRENCY = 6;

const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
  ".m4a": "audio/mp4", ".opus": "audio/opus", ".flac": "audio/flac",
};
function audioExt(name: string): string {
  const m = name.toLowerCase().match(/\.(mp3|ogg|wav|m4a|opus|flac)$/);
  return m ? m[0] : ".mp3";
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

type CardRow = {
  id: string;
  user_id: string;
  collection_id: string;
  term: string;
  definition: string;
  source_span: null;
  review_status: "accepted";
  prompt_direction: "term_to_definition";
  reps: number;
  fsrs_state: "new";
  lapses: number;
  stability: number;
  difficulty: number;
  due: string;
  last_review: null;
  audio_path: string | null;
};

export function ApkgUploader() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedApkg | null>(null);
  const [deckName, setDeckName] = useState("");
  const [frontIdx, setFrontIdx] = useState(0);
  const [backIdx, setBackIdx] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ phase: string; done: number; total: number } | null>(null);

  const fieldCount = parsed
    ? Math.max(parsed.fieldNames.length, ...parsed.notes.map((n) => n.fields.length))
    : 0;
  const fieldLabel = (i: number) => parsed?.fieldNames[i] || `Field ${i + 1}`;
  const audioCount = parsed ? parsed.notes.filter((n) => n.sound && parsed.sounds.has(n.sound)).length : 0;

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setParsed(null);
    setParsing(true);
    try {
      const p = await parseApkg(await file.arrayBuffer());
      setParsed(p);
      setDeckName(p.deckName);
      setFrontIdx(0);
      setBackIdx(p.fieldNames.length > 1 ? 1 : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that .apkg file.");
    } finally {
      setParsing(false);
    }
  }

  async function doImport() {
    const p = parsed;
    if (!p || importing) return;
    setImporting(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const uid = user.id;

      const { data: col, error: colErr } = await supabase
        .from("collections")
        .insert({ user_id: uid, name: deckName.trim() || "Imported deck" })
        .select("id")
        .single();
      if (colErr || !col) throw new Error(colErr?.message ?? "Could not create the deck.");

      const base = Date.now() - 30 * 86400_000;
      const rows: CardRow[] = [];
      const uploads: { id: string; sound: string }[] = [];
      for (let i = 0; i < p.notes.length; i++) {
        const n = p.notes[i];
        const front = fieldToText(n.fields[frontIdx] ?? "");
        const back = fieldToText(n.fields[backIdx] ?? "");
        const term = front || back;
        if (!term) continue; // need a prompt
        const id = crypto.randomUUID();
        let audio_path: string | null = null;
        if (n.sound && p.sounds.has(n.sound)) {
          audio_path = `${uid}/${id}${audioExt(n.sound)}`;
          uploads.push({ id, sound: n.sound });
        }
        rows.push({
          id,
          user_id: uid,
          collection_id: col.id,
          term,
          definition: front ? back : "",
          source_span: null,
          review_status: "accepted" as const,
          prompt_direction: "term_to_definition" as const,
          reps: 0,
          fsrs_state: "new" as const,
          lapses: 0,
          stability: 0,
          difficulty: 0,
          due: new Date(base + i).toISOString(),
          last_review: null,
          audio_path,
        });
      }
      if (rows.length === 0) throw new Error("No importable cards — the chosen front field was empty.");

      // Upload audio straight to storage (bypasses the 4.5MB serverless body limit).
      if (uploads.length) {
        setProgress({ phase: "Uploading audio", done: 0, total: uploads.length });
        let done = 0;
        await mapPool(uploads, CONCURRENCY, async (u) => {
          const bytes = p.sounds.get(u.sound)!;
          const ext = audioExt(u.sound);
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(`${uid}/${u.id}${ext}`, bytes, { contentType: TYPES[ext] ?? "audio/mpeg", upsert: true });
          if (upErr) {
            const r = rows.find((x) => x.id === u.id);
            if (r) r.audio_path = null; // non-fatal — keep the card, drop its audio
          }
          setProgress({ phase: "Uploading audio", done: ++done, total: uploads.length });
        });
      }

      setProgress({ phase: "Saving cards", done: 0, total: rows.length });
      for (let i = 0; i < rows.length; i += 500) {
        const { error: insErr } = await supabase.from("cards").insert(rows.slice(i, i + 500));
        if (insErr) {
          await supabase.from("cards").delete().eq("collection_id", col.id);
          await supabase.from("collections").delete().eq("id", col.id);
          throw new Error(insErr.message);
        }
        setProgress({ phase: "Saving cards", done: Math.min(i + 500, rows.length), total: rows.length });
      }

      toast.success(`Imported ${rows.length} cards.`);
      router.push(`/collections/${col.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setImporting(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept=".apkg"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      {!parsed ? (
        <Button type="button" variant="outline" disabled={parsing} onClick={() => fileRef.current?.click()}>
          {parsing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {parsing ? "Reading deck…" : "Choose an .apkg file"}
        </Button>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="apkgDeckName">Deck name</Label>
            <Input
              id="apkgDeckName"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              maxLength={120}
              disabled={importing}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="frontField">Front (prompt)</Label>
              <select
                id="frontField"
                value={frontIdx}
                disabled={importing}
                onChange={(e) => setFrontIdx(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Array.from({ length: fieldCount }, (_, i) => (
                  <option key={i} value={i}>{fieldLabel(i)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="backField">Back (answer)</Label>
              <select
                id="backField"
                value={backIdx}
                disabled={importing}
                onChange={(e) => setBackIdx(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {Array.from({ length: fieldCount }, (_, i) => (
                  <option key={i} value={i}>{fieldLabel(i)}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{parsed.notes.length}</span> cards
            {audioCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground tabular-nums">{audioCount}</span> with audio
              </>
            )}
          </p>

          {parsed.notes[0] && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Preview</div>
              <div className="mt-1 font-medium">{fieldToText(parsed.notes[0].fields[frontIdx] ?? "") || "—"}</div>
              <div className="text-muted-foreground">{fieldToText(parsed.notes[0].fields[backIdx] ?? "") || "—"}</div>
            </div>
          )}

          {progress && (
            <div className="space-y-1.5">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground tabular-nums">
                {progress.phase}… {progress.done}/{progress.total}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={doImport} disabled={importing}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              {importing ? "Importing…" : `Import ${parsed.notes.length} cards`}
            </Button>
            {!importing && (
              <Button type="button" variant="ghost" onClick={() => { setParsed(null); setError(null); }}>
                Choose a different file
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
