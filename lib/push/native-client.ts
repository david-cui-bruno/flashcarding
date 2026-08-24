import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { getNativeBuildEnvironment } from "@/lib/auth/apple-native";
import {
  nativePushTokenInsert,
  type ApnsEnvironment,
} from "./native-types";

type ListenerHandle = { remove(): Promise<void> };
type NativePushEvent = "registration" | "registrationError";

export type NativePushPluginLike = {
  addListener(
    eventName: NativePushEvent,
    listener: (value: unknown) => void,
  ): Promise<ListenerHandle>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
};

export type NativePushRegistration = {
  token: string;
  environment: ApnsEnvironment;
};

export function pushUiMode(input: {
  isNativeIOS: boolean;
  browserSupported: boolean;
  isIOSBrowser: boolean;
  isStandalone: boolean;
}): {
  supported: boolean;
  needsInstallOnIOS: boolean;
  showInstall: boolean;
} {
  return {
    supported: input.isNativeIOS || input.browserSupported,
    needsInstallOnIOS:
      !input.isNativeIOS && input.isIOSBrowser && !input.isStandalone,
    showInstall: !input.isNativeIOS && !input.isStandalone,
  };
}

function registrationToken(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("value" in value)) {
    return null;
  }

  return typeof value.value === "string" ? value.value : null;
}

function registrationError(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return "Native notification registration failed";
}

export async function registerNativePushWithPlugin(
  plugin: NativePushPluginLike,
  getEnvironment: () => Promise<{ environment: ApnsEnvironment }>,
): Promise<NativePushRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let resolveToken: (token: string) => void = () => undefined;
  let rejectToken: (error: Error) => void = () => undefined;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const registrationHandle = await plugin.addListener("registration", (value) => {
    const token = registrationToken(value);
    if (token) resolveToken(token);
    else rejectToken(new Error("Native registration returned an invalid token"));
  });
  const errorHandle = await plugin.addListener("registrationError", (value) => {
    rejectToken(new Error(registrationError(value)));
  });

  try {
    const permission = await plugin.requestPermissions();
    if (permission.receive !== "granted") {
      throw new Error("Notifications are not allowed on this iPhone");
    }

    const { environment } = await getEnvironment();
    await plugin.register();
    const token = await Promise.race([
      tokenPromise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Native notification registration timed out")),
          15_000,
        );
      }),
    ]);

    nativePushTokenInsert("native-registration", token, environment);
    return { token, environment };
  } finally {
    if (timeout) clearTimeout(timeout);
    await Promise.all([registrationHandle.remove(), errorHandle.remove()]);
  }
}

export function isNativeIOS(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function registerNativePush(): Promise<NativePushRegistration> {
  if (!isNativeIOS()) {
    throw new Error("Native notifications are available only in the Dory iPhone app");
  }

  return registerNativePushWithPlugin(
    PushNotifications as unknown as NativePushPluginLike,
    getNativeBuildEnvironment,
  );
}

export async function unregisterNativePush(): Promise<void> {
  await PushNotifications.unregister();
}

let notificationActionListenerInstalled = false;

export async function installNativeNotificationActionListener(): Promise<void> {
  if (!isNativeIOS() || notificationActionListenerInstalled) return;

  await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    () => {
      window.location.assign("/library");
    },
  );
  notificationActionListenerInstalled = true;
}
