import {
  hasActiveProEntitlement,
  selectProPackages,
  type RevenueCatPackage,
} from "./revenuecat-core";

type CustomerInfoLike = Parameters<typeof hasActiveProEntitlement>[0];

export type PurchasesBridge = {
  isConfigured(): Promise<{ isConfigured: boolean }>;
  configure(options: { apiKey: string; appUserID: string }): Promise<void>;
  getAppUserID(): Promise<{ appUserID: string }>;
  logIn(options: { appUserID: string }): Promise<{ customerInfo: CustomerInfoLike }>;
  getOfferings(): Promise<{
    current?: { availablePackages?: RevenueCatPackage[] } | null;
  }>;
  getCustomerInfo(): Promise<{ customerInfo: CustomerInfoLike }>;
  purchasePackage(options: {
    aPackage: RevenueCatPackage;
  }): Promise<{ customerInfo: CustomerInfoLike }>;
  restorePurchases(): Promise<{ customerInfo: CustomerInfoLike }>;
};

export type ProPackages = ReturnType<typeof selectProPackages>;
export type ProPlan = keyof ProPackages;

export class RevenueCatBilling {
  private packages: ProPackages = { monthly: null, annual: null };

  constructor(
    private readonly purchases: PurchasesBridge,
    private readonly apiKey: string,
  ) {}

  async initialize(appUserID: string) {
    const { isConfigured } = await this.purchases.isConfigured();
    if (!isConfigured) {
      await this.purchases.configure({ apiKey: this.apiKey, appUserID });
    } else {
      const current = await this.purchases.getAppUserID();
      if (current.appUserID !== appUserID) {
        await this.purchases.logIn({ appUserID });
      }
    }

    const [offerings, { customerInfo }] = await Promise.all([
      this.purchases.getOfferings(),
      this.purchases.getCustomerInfo(),
    ]);
    this.packages = selectProPackages(offerings);
    return { packages: this.packages, isPro: hasActiveProEntitlement(customerInfo) };
  }

  async purchase(plan: ProPlan) {
    const selected = this.packages[plan];
    if (!selected) throw new Error("This Dory Pro plan is not available right now.");
    const { customerInfo } = await this.purchases.purchasePackage({ aPackage: selected });
    return hasActiveProEntitlement(customerInfo);
  }

  async restore() {
    const { customerInfo } = await this.purchases.restorePurchases();
    return hasActiveProEntitlement(customerInfo);
  }
}
