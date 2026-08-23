"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { syncOutbox } from "@/lib/offline/sync";

// App-wide offline-review sync: replays the IndexedDB outbox on app load and every
// time the browser comes back online. Renders nothing; mounted once in the (app)
// layout so queued reviews drain no matter which screen the user reopens on.
export function OfflineSync() {
  useEffect(() => {
    const sync = () => {
      void syncOutbox()
        .then((r) => {
          if (r.sent > 0) {
            toast.success(
              `Synced ${r.sent} offline review${r.sent === 1 ? "" : "s"}.`,
            );
          }
        })
        .catch(() => {});
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  return null;
}
