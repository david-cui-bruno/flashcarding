import Link from "next/link";
import { Layers, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// The pre-session gate: pick Study-due (FSRS schedule) or Cram-all (no reschedule).
export function StudyGate({
  deckId,
  name,
  triplet,
  dueTotal,
  cramTotal,
}: {
  deckId: string;
  name: string;
  triplet: { nw: number; learning: number; due: number };
  dueTotal: number;
  cramTotal: number;
}) {
  const empty = cramTotal === 0;
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-[18px] flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Layers className="size-7" />
        </span>
        <h1 className="text-2xl font-semibold leading-tight">{name}</h1>

        {!empty && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-[1.05rem] font-semibold tabular-nums">
              <span className="text-new">{triplet.nw}</span>
              <Plus />
              <span className="text-learning">{triplet.learning}</span>
              <Plus />
              <span className="text-due">{triplet.due}</span>
            </span>
            <span className="text-[0.76rem] text-muted-foreground">new · learning · due</span>
          </div>
        )}

        {empty ? (
          <p className="mt-8 text-sm text-muted-foreground">
            This deck has no cards to study yet.
          </p>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-3">
              {dueTotal > 0 ? (
                <Button asChild size="lg" className="w-full justify-between">
                  <Link href={`/study/${deckId}?mode=due`}>
                    <span className="flex items-center gap-2">
                      <Play className="size-[18px] fill-current" strokeWidth={0} />
                      Study due
                    </span>
                    <span className="font-semibold tabular-nums">{dueTotal}</span>
                  </Link>
                </Button>
              ) : (
                <Button size="lg" disabled className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Play className="size-[18px] fill-current" strokeWidth={0} />
                    Study due
                  </span>
                  <span className="text-sm">Nothing due</span>
                </Button>
              )}

              <Button asChild variant="outline" className="w-full justify-between">
                <Link href={`/study/${deckId}?mode=cram`}>
                  <span className="flex items-center gap-2">
                    <RotateCcw className="size-[17px]" />
                    Cram all
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">{cramTotal} cards</span>
                </Link>
              </Button>
            </div>
            <p className="mt-3.5 text-[0.74rem] text-muted-foreground">
              Cram reviews everything without touching your schedule.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Plus() {
  return <span className={cn("mx-1.5 font-normal text-muted-foreground")}>+</span>;
}
