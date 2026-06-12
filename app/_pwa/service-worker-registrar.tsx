"use client";

import { useEffect } from "react";

// Registers the service worker so Cardstock is installable and can receive pushes.
// Renders nothing; mounted once in the root layout.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => {
        // Non-fatal: the app still works as a normal web app without the SW.
        console.error("[carding] service worker registration failed:", err);
      });
  }, []);

  return null;
}
