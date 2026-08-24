// Native-shell detection. The Capacitor shell injects window.Capacitor; use this
// to branch app-mode behavior (hide web-only chrome, native paywall vs web
// upgrade link, etc.). Dependency-free by design — same pattern as lib/haptics.ts.

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() ?? false;
}

/** iOS/Android inside the shell; "web" everywhere else. */
export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}
