import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativeAppleCredential = {
  identityToken: string;
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
};

type DoryNativePlugin = {
  signInWithApple(options: { nonce: string }): Promise<NativeAppleCredential>;
  getBuildEnvironment(): Promise<{
    environment: "development" | "production";
  }>;
};

const DoryNative = registerPlugin<DoryNativePlugin>("DoryNative");

function base64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function createRawNonce(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function profileUsernameForAppleUser(userId: string): string {
  return `apple_${userId.replaceAll("-", "").toLowerCase()}`;
}

export function profileInsertForAppleUser(userId: string): {
  id: string;
  username: string;
} {
  return {
    id: userId,
    username: profileUsernameForAppleUser(userId),
  };
}

export function isNativeAppleAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function signInWithNativeApple(): Promise<{
  credential: NativeAppleCredential;
  rawNonce: string;
}> {
  const rawNonce = createRawNonce();
  const credential = await DoryNative.signInWithApple({
    nonce: await sha256Hex(rawNonce),
  });

  return { credential, rawNonce };
}

export async function getNativeBuildEnvironment(): Promise<{
  environment: "development" | "production";
}> {
  return DoryNative.getBuildEnvironment();
}
