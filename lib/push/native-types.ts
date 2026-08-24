export type ApnsEnvironment = "development" | "production";

export type PushDeliveryResult = "sent" | "expired" | "error";

export type NativePushPayload = {
  title: string;
  body: string;
  url?: string;
};
