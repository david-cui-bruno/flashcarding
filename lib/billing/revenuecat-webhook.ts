import {
  PRO_ANNUAL_PRODUCT_ID,
  PRO_ENTITLEMENT_ID,
  PRO_MONTHLY_PRODUCT_ID,
} from "./revenuecat-core";

export type RevenueCatSubscriptionEvent = {
  type?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  entitlement_ids?: string[];
};

type SubscriptionUpdate = {
  plan: "free" | "pro";
  plan_expires_at: string | null;
  plan_source: "revenuecat";
};

const PRO_PRODUCT_IDS = new Set([PRO_MONTHLY_PRODUCT_ID, PRO_ANNUAL_PRODUCT_ID]);
const ACTIVE_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "REFUND_REVERSED",
  "CANCELLATION",
  "BILLING_ISSUE",
]);

function isDoryProEvent(event: RevenueCatSubscriptionEvent) {
  return (
    event.entitlement_ids?.includes(PRO_ENTITLEMENT_ID) === true ||
    (event.product_id ? PRO_PRODUCT_IDS.has(event.product_id) : false)
  );
}

function isoDate(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp).toISOString() : null;
}

export function subscriptionUpdateForEvent(
  event: RevenueCatSubscriptionEvent,
): SubscriptionUpdate | null {
  if (!isDoryProEvent(event)) return null;

  if (event.type === "EXPIRATION" || event.type === "REFUND") {
    return { plan: "free", plan_expires_at: null, plan_source: "revenuecat" };
  }
  if (!event.type || !ACTIVE_EVENT_TYPES.has(event.type)) return null;

  const activeUntil =
    event.type === "BILLING_ISSUE"
      ? event.grace_period_expiration_at_ms ?? event.expiration_at_ms
      : event.expiration_at_ms;

  return {
    plan: "pro",
    plan_expires_at: isoDate(activeUntil),
    plan_source: "revenuecat",
  };
}
