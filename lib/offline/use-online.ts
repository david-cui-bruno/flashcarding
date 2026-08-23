"use client";

import { useEffect, useState } from "react";

// Connectivity as React state. SSR/hydration-safe: starts true (the server can't
// know), then syncs to navigator.onLine on mount and tracks the online/offline
// events. `navigator.onLine === false` is trustworthy ("definitely offline");
// `true` only means "maybe online" — callers treat it as a hint, and the outbox
// (lib/offline/sync.ts) handles the true-but-unreachable case by queueing failures.
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
