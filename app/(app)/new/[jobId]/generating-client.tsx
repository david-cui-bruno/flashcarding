"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Status = Database["public"]["Enums"]["generation_status"];
type JobRow = Database["public"]["Tables"]["generation_jobs"]["Row"];

const POLL_INTERVAL_MS = 2500;
const isTerminal = (s: Status) => s === "succeeded" || s === "failed";

export function GeneratingClient({
  jobId,
  title,
  initialStatus,
  initialCardsGenerated,
  initialError,
}: {
  jobId: string;
  title: string;
  initialStatus: Status;
  initialCardsGenerated: number;
  initialError: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [cardsGenerated, setCardsGenerated] = useState(initialCardsGenerated);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (isTerminal(status)) return;

    let cancelled = false;
    let pollInFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const supabase = createClient();

    const apply = (s: Status, cards: number, err: string | null) => {
      if (cancelled) return;
      setStatus(s);
      setCardsGenerated(cards);
      setError(err);
    };

    // Realtime: instant update when the job row changes (cross-device too).
    const channel = supabase
      .channel(`generation_job:${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generation_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as JobRow;
          apply(row.status, row.cards_generated, row.error);
        },
      )
      .subscribe();

    // Polling: this is what actually advances the batch (no always-on worker).
    const poll = async () => {
      if (cancelled || pollInFlight) return;
      pollInFlight = true;
      try {
        const res = await fetch("/api/jobs/poll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        const out = (await res.json()) as {
          status?: Status;
          cardsGenerated?: number;
          error?: string;
        };
        if (out.status) {
          apply(
            out.status,
            out.cardsGenerated ?? cardsGenerated,
            out.error ?? null,
          );
        }
      } catch {
        // Network blip — keep polling.
      } finally {
        pollInFlight = false;
        if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // jobId is stable for the lifetime of this page; we intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Navigate to review once cards have landed.
  useEffect(() => {
    if (status === "succeeded" && cardsGenerated > 0) {
      router.replace("/review");
    }
  }, [status, cardsGenerated, router]);

  if (status === "failed") {
    return (
      <Centered>
        <h1 className="text-xl font-semibold">Generation failed</h1>
        <p className="max-w-sm text-sm text-destructive">{error ?? "Something went wrong."}</p>
        <Button asChild className="mt-1">
          <Link href="/new">Try again</Link>
        </Button>
      </Centered>
    );
  }

  if (status === "succeeded") {
    // Reached only when 0 cards cleared the gate (otherwise we redirect above).
    return (
      <Centered>
        <h1 className="text-xl font-semibold">No cards generated</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          None of the generated cards passed the quality gate. Try pasting richer or longer material.
        </p>
        <Button asChild className="mt-1">
          <Link href="/new">Generate again</Link>
        </Button>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-7 flex flex-col items-center text-center">
        <span className="mb-5 flex size-[58px] items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <FileText className="size-[26px]" />
        </span>
        <h1 className="max-w-[24ch] text-xl font-semibold leading-snug">Making cards from {title}</h1>
        <p className="mt-2.5 text-sm text-muted-foreground">
          About 30 seconds — you can leave and come back.
        </p>
      </div>

      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Generating
        </span>
        <span className="text-xs font-semibold text-primary tabular-nums">
          {cardsGenerated > 0 ? `${cardsGenerated} cards so far` : "Working…"}
        </span>
      </div>
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-3/5 animate-pulse rounded-full bg-primary" />
      </div>

      {/* skeleton card rows streaming in */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
              <span className="size-2 animate-pulse rounded-full bg-primary" />
            </div>
            <div className="mb-2 h-2.5 w-full animate-pulse rounded bg-muted" />
            <div className="h-2.5 animate-pulse rounded bg-muted" style={{ width: `${65 - n * 12}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {children}
    </div>
  );
}
