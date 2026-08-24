"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import {
  isNativeIOS,
  isPurchaseCancelled,
  type RevenueCatPackage,
} from "@/lib/billing/revenuecat-core";
import {
  RevenueCatBilling,
  type ProPackages,
  type ProPlan,
  type PurchasesBridge,
} from "@/lib/billing/revenuecat-client";
import { ProPlansView } from "./pro-plans-view";

type BillingContextValue = {
  available: boolean;
  ready: boolean;
  isPro: boolean;
  packages: ProPackages;
  busy: ProPlan | "restore" | null;
  status: string | null;
  purchase(plan: ProPlan): Promise<void>;
  restore(): Promise<void>;
};

const BillingContext = createContext<BillingContextValue | null>(null);

type Props = {
  appUserID: string;
  apiKey: string;
  initialIsPro: boolean;
  children: React.ReactNode;
};

export function RevenueCatProvider({ appUserID, apiKey, initialIsPro, children }: Props) {
  const router = useRouter();
  const billingRef = useRef<RevenueCatBilling | null>(null);
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [isPro, setIsPro] = useState(initialIsPro);
  const [packages, setPackages] = useState<ProPackages>({ monthly: null, annual: null });
  const [busy, setBusy] = useState<ProPlan | "restore" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const canPurchase = isNativeIOS(Capacitor) && Boolean(apiKey);
    // Native platform detection is only reliable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailable(canPurchase);
    if (!canPurchase) {
      setReady(true);
      return;
    }

    let disposed = false;
    const billing = new RevenueCatBilling(Purchases as unknown as PurchasesBridge, apiKey);
    billingRef.current = billing;
    void billing
      .initialize(appUserID)
      .then((result) => {
        if (disposed) return;
        setPackages(result.packages);
        setIsPro((current) => current || result.isPro);
        setReady(true);
      })
      .catch(() => {
        if (disposed) return;
        setStatus("The App Store is unavailable right now. Please try again shortly.");
        setReady(true);
      });

    return () => {
      disposed = true;
      billingRef.current = null;
    };
  }, [apiKey, appUserID]);

  const value = useMemo<BillingContextValue>(
    () => ({
      available,
      ready,
      isPro,
      packages,
      busy,
      status,
      async purchase(plan) {
        const billing = billingRef.current;
        if (!billing) return;
        setBusy(plan);
        setStatus(null);
        try {
          const active = await billing.purchase(plan);
          setIsPro(active);
          setStatus(
            active
              ? "Purchase complete. Dory Pro is ready."
              : "Your purchase is processing. Pro access will appear shortly.",
          );
          router.refresh();
        } catch (error) {
          if (!isPurchaseCancelled(error)) {
            setStatus((error as Error)?.message ?? "The purchase could not be completed.");
          }
        } finally {
          setBusy(null);
        }
      },
      async restore() {
        const billing = billingRef.current;
        if (!billing) return;
        setBusy("restore");
        setStatus(null);
        try {
          const active = await billing.restore();
          setIsPro(active);
          setStatus(active ? "Purchases restored. Dory Pro is ready." : "No active Dory Pro purchase was found.");
          router.refresh();
        } catch (error) {
          setStatus((error as Error)?.message ?? "Purchases could not be restored.");
        } finally {
          setBusy(null);
        }
      },
    }),
    [available, busy, isPro, packages, ready, router, status],
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useRevenueCat() {
  const value = useContext(BillingContext);
  if (!value) throw new Error("useRevenueCat must be used inside RevenueCatProvider.");
  return value;
}

export function ProPlans({ compact = false }: { compact?: boolean }) {
  const billing = useRevenueCat();
  const monthly = billing.packages.monthly as RevenueCatPackage | null;
  const annual = billing.packages.annual as RevenueCatPackage | null;

  return (
    <ProPlansView
      available={billing.available}
      ready={billing.ready}
      isPro={billing.isPro}
      busy={billing.busy}
      monthlyPrice={monthly?.product.priceString}
      annualPrice={annual?.product.priceString}
      status={billing.status}
      compact={compact}
      onPurchase={(plan) => void billing.purchase(plan)}
      onRestore={() => void billing.restore()}
    />
  );
}
