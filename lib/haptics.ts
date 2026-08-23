// Haptic feedback for study interactions. Works in the Capacitor iOS shell via
// the Haptics plugin when present, and degrades to the web Vibration API
// (Android browsers) or silently no-ops (desktop, iOS Safari, where neither
// exists). Kept dependency-free: the Capacitor global is injected by the
// native shell at runtime, so the web bundle needs no @capacitor packages.

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    Haptics?: {
      impact?: (opts: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>;
      notification?: (opts: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void>;
    };
  };
};

function capacitorHaptics() {
  if (typeof window === "undefined") return undefined;
  const cap = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return undefined;
  return cap.Plugins?.Haptics;
}

/** Light tap — card grade, flip. */
export function hapticTap() {
  const h = capacitorHaptics();
  if (h?.impact) {
    void h.impact({ style: "LIGHT" }).catch(() => {});
    return;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

/** Warning buzz — "Again" grade (the card lapsed). */
export function hapticLapse() {
  const h = capacitorHaptics();
  if (h?.notification) {
    void h.notification({ type: "WARNING" }).catch(() => {});
    return;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([15, 30, 15]);
  }
}
