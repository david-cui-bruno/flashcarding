"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type Status = Database["public"]["Enums"]["generation_status"];
type JobRow = Database["public"]["Tables"]["generation_jobs"]["Row"];

const POLL_INTERVAL_MS = 2500;
const isTerminal = (s: Status) => s === "succeeded" || s === "failed";

export function GeneratingClient({
  jobId,
  initialStatus,
  initialCardsGenerated,
  initialError,
}: {
  jobId: string;
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
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Generation failed</h1>
        <p className="text-sm text-red-600">{error ?? "Something went wrong."}</p>
        <Link href="/new" className="inline-block underline">
          Try again
        </Link>
      </div>
    );
  }

  if (status === "succeeded") {
    // Reached only when 0 cards cleared the gate (otherwise we redirect above).
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">No cards generated</h1>
        <p className="text-sm text-neutral-500">
          None of the generated cards passed the quality gate. Try pasting richer
          or longer material.
        </p>
        <Link href="/new" className="inline-block underline">
          Generate again
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Generating cards…</h1>
      <p className="text-sm text-neutral-500">
        Your source was submitted for asynchronous generation. This page will
        jump to review as soon as the cards are ready — you can safely leave and
        come back.
      </p>
      <div
        className="h-1 w-40 animate-pulse rounded bg-neutral-300"
        aria-hidden
      />
    </div>
  );
}
