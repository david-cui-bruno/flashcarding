export const PRO_ENTITLEMENT_ID = "pro";
export const PRO_MONTHLY_PRODUCT_ID = "com.learndory.pro.monthly";
export const PRO_ANNUAL_PRODUCT_ID = "com.learndory.pro.annual";

export type RevenueCatPackage = {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
  };
};

type OfferingsLike = {
  current?: {
    availablePackages?: RevenueCatPackage[];
  } | null;
};

export function selectProPackages(offerings: OfferingsLike) {
  const packages = offerings.current?.availablePackages ?? [];
  return {
    monthly:
      packages.find(
        (item) =>
          item.identifier === "$rc_monthly" &&
          item.product.identifier === PRO_MONTHLY_PRODUCT_ID,
      ) ?? null,
    annual:
      packages.find(
        (item) =>
          item.identifier === "$rc_annual" && item.product.identifier === PRO_ANNUAL_PRODUCT_ID,
      ) ?? null,
  };
}

type CustomerInfoLike = {
  entitlements?: {
    active?: Record<string, { isActive?: boolean }>;
  };
};

export function hasActiveProEntitlement(customerInfo: CustomerInfoLike) {
  return customerInfo.entitlements?.active?.[PRO_ENTITLEMENT_ID]?.isActive === true;
}

export function isPurchaseCancelled(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    (error as { userCancelled?: unknown }).userCancelled === true
  );
}

type CapacitorPlatform = {
  isNativePlatform(): boolean;
  getPlatform(): string;
};

export function isNativeIOS(capacitor: CapacitorPlatform) {
  return capacitor.isNativePlatform() && capacitor.getPlatform() === "ios";
}
