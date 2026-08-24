export type ApnsEnvironment = "development" | "production";

export type PushDeliveryResult = "sent" | "expired" | "error";

export type NativePushPayload = {
  title: string;
  body: string;
  url?: string;
};

const APNS_DEVICE_TOKEN = /^[0-9a-f]{64,}$/i;

export function nativePushTokenInsert(
  userId: string,
  token: string,
  environment: ApnsEnvironment,
): { user_id: string; token: string; environment: ApnsEnvironment } {
  if (!APNS_DEVICE_TOKEN.test(token)) {
    throw new Error("Invalid APNs device token");
  }

  if (environment !== "development" && environment !== "production") {
    throw new Error("Invalid APNs environment");
  }

  return { user_id: userId, token, environment };
}
