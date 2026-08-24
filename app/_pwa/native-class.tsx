"use client";

import { useEffect } from "react";
import { isNativeApp, nativePlatform } from "@/lib/native";

// Adds `native-app` (+ `native-ios` / `native-android`) to <html> when running
// inside the Capacitor shell, so CSS/components can adapt (safe areas,
// app-mode chrome). Runs once on mount; the class set is stable for the life
// of the page since the shell never changes at runtime.
export function NativeClass() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const el = document.documentElement;
    el.classList.add("native-app", `native-${nativePlatform()}`);
  }, []);
  return null;
}
