import { Check, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getMetricsDashboard } from "@/lib/metrics/server";
import type { ReviewMode } from "@/lib/metrics/graduation";

export const dynamic = "force-dynamic";

const MODE_TITLE: Record<ReviewMode, string> = {
  "review-all": "Review all",
  "spot-check": "Spot-check",
  trust: "Trust",
};

function pct(x: number | null): string {
  return x === null ? "—" : `${Math.round(x * 100)}%`;
}

export default async function MetricsPage() {
  const supabase = await createClient();
  const m = await getMetricsDashboard(supabase);
  const { editRate, retention, mode, config } = m;

  const retDelta = retention.rolling.rate === null ? null : retention.rolling.rate - retention.target;

  return (
    <div className="px-4 py-6 md:p-10">
      <div className="mx-auto max-w-[1040px]">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">Metrics</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              How well your cards are working — and how hard review is right now.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Review mode — ladder */}
          <section className="lg:col-span-12">
            <Card>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Review mode</h2>
                  <p className="mt-1 text-[0.8rem] text-muted-foreground">
                    Review effort drops automatically as the model earns trust.
                  </p>
                </div>
                <Badge className="shrink-0 bg-accent text-accent-foreground">
                  Currently · {MODE_TITLE[mode.mode]}
                </Badge>
              </div>
              <Ladder current={mode.mode} config={config} />
              <hr className="my-5 border-border" />
              <p className="text-sm leading-snug text-muted-foreground">{mode.reason}</p>
            </Card>
          </section>

          {/* Card quality — edit rate */}
          <section className="lg:col-span-7">
            <Card className="h-full">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Card quality</h2>
                <span className="text-[0.76rem] text-muted-foreground">edit rate · lower is better</span>
              </div>
              <div className="flex items-end gap-8">
                <BigStat value={pct(editRate.rolling)} label={`Rolling · last ${config.ROLLING_WINDOW} cards`} />
                <div className="border-l border-border pl-8">
                  <BigStat value={pct(editRate.overall)} label="All-time" muted />
                </div>
              </div>
              <hr className="my-5 border-border" />
              <div className="mb-2 flex items-end justify-between">
                <span className="text-[0.74rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Per batch
                </span>
                <span className="text-[0.74rem] text-muted-foreground">most recent →</span>
              </div>
              <BatchBars batches={editRate.perBatch} />
            </Card>
          </section>

          {/* Retention */}
          <section className="lg:col-span-5">
            <Card className="h-full">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Retention</h2>
                <span className="text-[0.76rem] text-muted-foreground">higher is better</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="text-6xl font-semibold leading-none tracking-tight text-primary tabular-nums">
                  {pct(retention.rolling.rate)}
                </div>
                {retDelta !== null && (
                  <Badge
                    className={cn(
                      "mb-2 gap-1",
                      retDelta >= 0 ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                    )}
                  >
                    {retDelta >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {retDelta >= 0 ? "+" : ""}
                    {Math.round(retDelta * 100)} pts
                  </Badge>
                )}
              </div>
              <p className="mt-3 text-[0.8rem] text-muted-foreground">
                {retDelta === null
                  ? `${retention.rolling.reviewed} scheduled reviews so far`
                  : `${retDelta >= 0 ? "At or above" : "Below"} your ${pct(retention.target)} target`}
              </p>
              <TargetBar rate={retention.rolling.rate} target={retention.target} />
            </Card>
          </section>

          {/* By deck */}
          <section className="lg:col-span-12">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">By deck</h2>
              <span className="text-[0.76rem] text-muted-foreground">retention</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {retention.perCollection.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No scheduled reviews yet.</p>
              ) : (
                retention.perCollection.map((c) => (
                  <div
                    key={c.collectionId ?? "none"}
                    className="flex items-center gap-3 border-b border-border px-5 py-3.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {c.name ?? "Unassigned"}
                    </span>
                    {c.rate === null ? (
                      <span className="text-[0.78rem] text-muted-foreground">too new</span>
                    ) : (
                      <>
                        <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-muted sm:block">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              c.rate >= retention.target ? "bg-primary" : "bg-warning",
                            )}
                            style={{ width: `${Math.round(c.rate * 100)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "w-12 text-right text-sm font-semibold tabular-nums",
                            c.rate < retention.target && "text-warning",
                          )}
                        >
                          {pct(c.rate)}
                        </span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-border bg-card px-6 py-6 md:px-7", className)}>{children}</div>;
}

function BigStat({ value, label, muted }: { value: string; label: string; muted?: boolean }) {
  return (
    <div>
      <div className={cn("text-5xl font-semibold leading-none tracking-tight tabular-nums", muted && "text-muted-foreground")}>
        {value}
      </div>
      <div className="mt-2 text-[0.78rem] text-muted-foreground">{label}</div>
    </div>
  );
}

function Ladder({
  current,
  config,
}: {
  current: ReviewMode;
  config: { SPOT_CHECK_EDIT_RATE: number; TRUST_EDIT_RATE: number };
}) {
  const order: ReviewMode[] = ["review-all", "spot-check", "trust"];
  const steps = [
    { mode: "review-all" as const, label: "Review all" },
    { mode: "spot-check" as const, label: `Spot-check (<${pct(config.SPOT_CHECK_EDIT_RATE)})` },
    { mode: "trust" as const, label: `Trust (<${pct(config.TRUST_EDIT_RATE)})` },
  ];
  const currentIdx = order.indexOf(current);

  return (
    <div className="flex items-center px-1">
      {steps.map((s, idx) => {
        const state = idx < currentIdx ? "done" : idx === currentIdx ? "active" : "pending";
        return (
          <div key={s.mode} className="flex flex-1 items-center last:flex-none">
            <div className="flex w-20 flex-col items-center gap-2.5">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border text-[0.82rem] font-semibold",
                  state === "active" && "border-primary bg-primary text-primary-foreground shadow-[0_8px_20px_-7px_rgba(94,125,110,.55)]",
                  state === "done" && "border-accent bg-accent text-accent-foreground",
                  state === "pending" && "border-border bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-4" strokeWidth={2.5} /> : idx + 1}
              </span>
              <span
                className={cn(
                  "text-center text-[0.78rem]",
                  state === "active" ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <span className={cn("mx-3 h-0.5 flex-1 rounded", idx < currentIdx ? "bg-accent-foreground/35" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BatchBars({ batches }: { batches: { batchKey: string; rate: number }[] }) {
  const shown = batches.slice(0, 8).reverse(); // oldest → newest (left → right)
  if (shown.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">No reviewed batches yet.</p>;
  }
  const max = Math.max(...shown.map((b) => b.rate), 0.05);
  return (
    <div className="flex h-16 items-end gap-1.5">
      {shown.map((b, idx) => (
        <div
          key={b.batchKey}
          title={pct(b.rate)}
          className={cn(
            "flex-1 rounded-t",
            idx === shown.length - 1 ? "bg-primary" : "bg-accent",
          )}
          style={{ height: `${Math.max((b.rate / max) * 100, 6)}%` }}
        />
      ))}
    </div>
  );
}

function TargetBar({ rate, target }: { rate: number | null; target: number }) {
  return (
    <div className="mt-5">
      <div className="relative h-2 overflow-visible rounded-full bg-muted">
        {rate !== null && (
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(rate * 100)}%` }} />
        )}
        <span
          className="absolute -top-1 bottom-[-4px] w-0.5 bg-muted-foreground/60"
          style={{ left: `${Math.round(target * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>0%</span>
        <span>{pct(target)} target</span>
        <span>100%</span>
      </div>
    </div>
  );
}
