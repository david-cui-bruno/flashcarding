import { createClient } from "@/lib/supabase/server";
import { getMetricsDashboard } from "@/lib/metrics/server";
import type { ReviewMode } from "@/lib/metrics/graduation";

export const dynamic = "force-dynamic";

const MODE_TITLE: Record<ReviewMode, string> = {
  "review-all": "Review-all",
  "spot-check": "Spot-check",
  trust: "Trust",
};

function pct(x: number | null): string {
  return x === null ? "—" : `${(x * 100).toFixed(0)}%`;
}

export default async function MetricsPage() {
  const supabase = await createClient();
  const m = await getMetricsDashboard(supabase);
  const { editRate, retention, mode, config } = m;

  const retDelta =
    retention.rolling.rate === null
      ? null
      : retention.rolling.rate - retention.target;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Metrics</h1>
        <p className="text-sm text-neutral-500">
          How well the generator matches your taste, and whether you&apos;re retaining what
          you study.
        </p>
      </div>

      {/* Current review mode (graduation ladder, docs/METRICS.md) */}
      <section className="rounded border p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            Review mode
          </span>
          <span className="rounded bg-black px-2 py-0.5 text-xs font-medium text-white">
            {MODE_TITLE[mode.mode]}
          </span>
        </div>
        <p className="mt-2 text-sm">{mode.reason}</p>
        <Ladder current={mode.mode} config={config} />
      </section>

      {/* Metric B — edit rate */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Card quality — edit rate (lower is better)
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={`Rolling (last ${config.ROLLING_WINDOW})`}
            value={pct(editRate.rolling)}
            sub={`${editRate.rollingReviewed} reviewed`}
          />
          <Stat
            label="All time"
            value={pct(editRate.overall)}
            sub={`${editRate.overallReviewed} reviewed`}
          />
        </div>

        <div className="rounded border">
          <div className="border-b px-3 py-2 text-xs font-medium text-neutral-500">
            Per batch (most recent first)
          </div>
          {editRate.perBatch.length === 0 ? (
            <Empty>No reviewed batches yet.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {editRate.perBatch.slice(0, 12).map((b) => (
                <li key={b.batchKey} className="flex items-center justify-between px-3 py-2">
                  <span className="text-neutral-600">
                    {b.changed} edited/rejected of {b.reviewed}
                  </span>
                  <span className="font-medium">{pct(b.rate)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Metric A — retention */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Retention vs {pct(retention.target)} target (higher is better)
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={`Rolling (last ${config.RETENTION_ROLLING_WINDOW})`}
            value={pct(retention.rolling.rate)}
            sub={
              retDelta === null
                ? `${retention.rolling.reviewed} reviews`
                : `${retDelta >= 0 ? "+" : ""}${(retDelta * 100).toFixed(0)} pts vs target · ${retention.rolling.reviewed} reviews`
            }
          />
          <Stat
            label="All time"
            value={pct(retention.overall.rate)}
            sub={`${retention.overall.reviewed} reviews`}
          />
        </div>

        <div className="rounded border">
          <div className="border-b px-3 py-2 text-xs font-medium text-neutral-500">
            Per collection
          </div>
          {retention.perCollection.length === 0 ? (
            <Empty>No scheduled reviews yet.</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {retention.perCollection.map((c) => (
                <li
                  key={c.collectionId ?? "none"}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="truncate text-neutral-600">
                    {c.name ?? "Unassigned"}{" "}
                    <span className="text-neutral-400">({c.reviewed})</span>
                  </span>
                  <span className="font-medium">{pct(c.rate)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-3 text-sm text-neutral-400">{children}</p>;
}

function Ladder({
  current,
  config,
}: {
  current: ReviewMode;
  config: { SPOT_CHECK_EDIT_RATE: number; TRUST_EDIT_RATE: number };
}) {
  const steps: { mode: ReviewMode; label: string }[] = [
    { mode: "review-all", label: "Review all" },
    { mode: "spot-check", label: `Spot-check (<${pct(config.SPOT_CHECK_EDIT_RATE)})` },
    { mode: "trust", label: `Trust (<${pct(config.TRUST_EDIT_RATE)})` },
  ];
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      {steps.map((s, idx) => (
        <span key={s.mode} className="flex items-center gap-2">
          <span
            className={
              s.mode === current
                ? "rounded bg-black px-2 py-0.5 font-medium text-white"
                : "rounded border px-2 py-0.5 text-neutral-500"
            }
          >
            {s.label}
          </span>
          {idx < steps.length - 1 && <span className="text-neutral-300">→</span>}
        </span>
      ))}
    </div>
  );
}
