import { Check, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProPlan } from "@/lib/billing/revenuecat-client";

export type ProPlansViewProps = {
  available: boolean;
  ready: boolean;
  isPro: boolean;
  busy: ProPlan | "restore" | null;
  monthlyPrice?: string;
  annualPrice?: string;
  status: string | null;
  compact?: boolean;
  onPurchase(plan: ProPlan): void;
  onRestore(): void;
};

export function ProPlansView({
  available,
  ready,
  isPro,
  busy,
  monthlyPrice = "$3.99",
  annualPrice = "$29.99",
  status,
  compact = false,
  onPurchase,
  onRestore,
}: ProPlansViewProps) {
  return (
    <Card className="border-primary/25 bg-accent">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start gap-3">
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Dory Pro</h2>
              {isPro && <Badge className="bg-primary text-primary-foreground">Pro is active</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              AI card generation, while unlimited study, FSRS, and imports stay free.
            </p>
          </div>
        </div>

        {!isPro && (
          <div className="mt-4">
            {!available ? (
              <p className="text-sm text-muted-foreground">
                Subscriptions are available in the Dory app for iPhone.
              </p>
            ) : !ready ? (
              <p className="text-sm text-muted-foreground">Loading App Store plans…</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto justify-between bg-background px-4 py-3"
                  disabled={busy !== null}
                  onClick={() => onPurchase("monthly")}
                >
                  <span className="text-left">
                    <span className="block font-semibold">Monthly</span>
                    <span className="block text-xs font-normal text-muted-foreground">Cancel anytime</span>
                  </span>
                  <span>{monthlyPrice}/mo</span>
                </Button>
                <Button
                  type="button"
                  className="h-auto justify-between px-4 py-3"
                  disabled={busy !== null}
                  onClick={() => onPurchase("annual")}
                >
                  <span className="text-left">
                    <span className="block font-semibold">Annual</span>
                    <span className="block text-xs font-normal opacity-85">Best value</span>
                  </span>
                  <span>{annualPrice}/yr</span>
                </Button>
              </div>
            )}

            {available && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                disabled={busy !== null}
                onClick={onRestore}
              >
                <RotateCcw className="size-4" />
                {busy === "restore" ? "Restoring…" : "Restore purchases"}
              </Button>
            )}
          </div>
        )}

        {isPro && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
            <Check className="size-4" />
            AI card generation is unlocked.
          </p>
        )}

        {status && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            {status}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
