import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type PackageFixture = {
  identifier: string;
  product: { identifier: string; priceString: string };
};

async function main() {
  const corePath = "../lib/billing/revenuecat-core";
  const clientPath = "../lib/billing/revenuecat-client";
  const viewPath = "../components/billing/pro-plans-view";
  const webhookPath = "../lib/billing/revenuecat-webhook";
  const core = await import(corePath).catch(() => ({}));
  const client = await import(clientPath).catch(() => ({}));
  const view = await import(viewPath).catch(() => ({}));
  const webhook = await import(webhookPath).catch(() => ({}));

  assert.equal(
    typeof core.selectProPackages,
    "function",
    "RevenueCat offerings need a selector for Dory's monthly and annual packages",
  );
  assert.equal(
    typeof core.isNativeIOS,
    "function",
    "App Store purchases must stay disabled outside the native iOS shell",
  );
  assert.equal(
    typeof webhook.subscriptionUpdateForEvent,
    "function",
    "RevenueCat webhooks need an explicit subscription-state mapper",
  );
  assert.equal(
    typeof client.RevenueCatBilling,
    "function",
    "the native plugin needs a user-identified purchase and restore adapter",
  );
  assert.equal(
    typeof view.ProPlansView,
    "function",
    "the upgrade surface needs a reusable monthly/annual purchase and restore view",
  );

  const monthly: PackageFixture = {
    identifier: "$rc_monthly",
    product: { identifier: "com.learndory.pro.monthly", priceString: "$3.99" },
  };
  const annual: PackageFixture = {
    identifier: "$rc_annual",
    product: { identifier: "com.learndory.pro.annual", priceString: "$29.99" },
  };
  const unrelated: PackageFixture = {
    identifier: "$rc_lifetime",
    product: { identifier: "other.product", priceString: "$99.99" },
  };

  assert.deepEqual(
    core.selectProPackages({ current: { availablePackages: [unrelated, annual, monthly] } }),
    { monthly, annual },
    "the paywall uses only the configured Dory subscription products",
  );
  assert.equal(
    core.isNativeIOS({ isNativePlatform: () => true, getPlatform: () => "ios" }),
    true,
  );
  assert.equal(
    core.isNativeIOS({ isNativePlatform: () => false, getPlatform: () => "web" }),
    false,
  );
  assert.equal(
    core.isNativeIOS({ isNativePlatform: () => true, getPlatform: () => "android" }),
    false,
  );
  assert.deepEqual(
    core.selectProPackages({ current: null }),
    { monthly: null, annual: null },
    "a missing offering renders an unavailable state instead of purchasing the wrong product",
  );

  assert.equal(
    core.hasActiveProEntitlement({ entitlements: { active: { pro: { isActive: true } } } }),
    true,
  );

  const calls: Array<{ method: string; value?: unknown }> = [];
  const activeCustomerInfo = { entitlements: { active: { pro: { isActive: true } } } };
  const plugin = {
    async isConfigured() {
      return { isConfigured: false };
    },
    async configure(value: unknown) {
      calls.push({ method: "configure", value });
    },
    async getAppUserID() {
      return { appUserID: "user-1" };
    },
    async logIn(value: unknown) {
      calls.push({ method: "logIn", value });
      return { customerInfo: activeCustomerInfo, created: false };
    },
    async getOfferings() {
      return { current: { availablePackages: [annual, monthly] } };
    },
    async getCustomerInfo() {
      return { customerInfo: { entitlements: { active: {} } } };
    },
    async purchasePackage(value: { aPackage: PackageFixture }) {
      calls.push({ method: "purchasePackage", value });
      return { customerInfo: activeCustomerInfo, productIdentifier: value.aPackage.product.identifier };
    },
    async restorePurchases() {
      calls.push({ method: "restorePurchases" });
      return { customerInfo: activeCustomerInfo };
    },
  };
  const billing = new client.RevenueCatBilling(plugin, "public-apple-key");
  const initial = await billing.initialize("user-1");
  assert.deepEqual(initial.packages, { monthly, annual });
  assert.equal(initial.isPro, false);
  assert.deepEqual(calls[0], {
    method: "configure",
    value: { apiKey: "public-apple-key", appUserID: "user-1" },
  });
  assert.equal(await billing.purchase("monthly"), true);
  assert.deepEqual(calls.at(-1), {
    method: "purchasePackage",
    value: { aPackage: monthly },
  });
  assert.equal(await billing.restore(), true);
  assert.deepEqual(calls.at(-1), { method: "restorePurchases" });

  const alreadyConfiguredPlugin = {
    ...plugin,
    async isConfigured() {
      return { isConfigured: true };
    },
    async getAppUserID() {
      return { appUserID: "someone-else" };
    },
  };
  const existingBilling = new client.RevenueCatBilling(alreadyConfiguredPlugin, "public-apple-key");
  await existingBilling.initialize("user-1");
  assert.deepEqual(calls.at(-1), { method: "logIn", value: { appUserID: "user-1" } });

  const plansMarkup = renderToStaticMarkup(
    createElement(view.ProPlansView, {
      available: true,
      ready: true,
      isPro: false,
      busy: null,
      monthlyPrice: "$3.99",
      annualPrice: "$29.99",
      status: null,
      onPurchase() {},
      onRestore() {},
    }),
  );
  assert.match(plansMarkup, /Dory Pro/);
  assert.match(plansMarkup, /\$3\.99/);
  assert.match(plansMarkup, /\$29\.99/);
  assert.match(plansMarkup, /Restore purchases/);

  const activeMarkup = renderToStaticMarkup(
    createElement(view.ProPlansView, {
      available: true,
      ready: true,
      isPro: true,
      busy: null,
      monthlyPrice: "$3.99",
      annualPrice: "$29.99",
      status: null,
      onPurchase() {},
      onRestore() {},
    }),
  );
  assert.match(activeMarkup, /Pro is active/);
  assert.equal(
    core.hasActiveProEntitlement({ entitlements: { active: {} } }),
    false,
  );
  assert.equal(core.isPurchaseCancelled({ userCancelled: true }), true);
  assert.equal(core.isPurchaseCancelled(new Error("Store unavailable")), false);

  const expiresAt = Date.parse("2026-09-23T00:00:00.000Z");
  const graceEndsAt = Date.parse("2026-09-25T00:00:00.000Z");

  assert.deepEqual(
    webhook.subscriptionUpdateForEvent({
      type: "INITIAL_PURCHASE",
      product_id: "com.learndory.pro.monthly",
      entitlement_ids: ["pro"],
      expiration_at_ms: expiresAt,
    }),
    {
      plan: "pro",
      plan_expires_at: "2026-09-23T00:00:00.000Z",
      plan_source: "revenuecat",
    },
  );
  assert.deepEqual(
    webhook.subscriptionUpdateForEvent({
      type: "CANCELLATION",
      product_id: "com.learndory.pro.annual",
      entitlement_ids: ["pro"],
      expiration_at_ms: expiresAt,
    }),
    {
      plan: "pro",
      plan_expires_at: "2026-09-23T00:00:00.000Z",
      plan_source: "revenuecat",
    },
    "cancelling renewal keeps Pro active through the paid period",
  );
  assert.deepEqual(
    webhook.subscriptionUpdateForEvent({
      type: "BILLING_ISSUE",
      product_id: "com.learndory.pro.monthly",
      entitlement_ids: ["pro"],
      expiration_at_ms: expiresAt,
      grace_period_expiration_at_ms: graceEndsAt,
    }),
    {
      plan: "pro",
      plan_expires_at: "2026-09-25T00:00:00.000Z",
      plan_source: "revenuecat",
    },
    "billing grace periods keep access until the grace period expires",
  );
  assert.deepEqual(
    webhook.subscriptionUpdateForEvent({
      type: "EXPIRATION",
      product_id: "com.learndory.pro.monthly",
      entitlement_ids: ["pro"],
      expiration_at_ms: expiresAt,
    }),
    { plan: "free", plan_expires_at: null, plan_source: "revenuecat" },
  );
  assert.equal(
    webhook.subscriptionUpdateForEvent({
      type: "RENEWAL",
      product_id: "unrelated.product",
      entitlement_ids: ["other"],
      expiration_at_ms: expiresAt,
    }),
    null,
    "unrelated products and entitlements cannot grant Dory Pro",
  );

  console.log("RevenueCat billing behavior ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
