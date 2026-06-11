import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "proxy" convention (formerly "middleware"); same behavior.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Run on everything except Next internals, static image assets, and the public
  // PWA files (service worker + manifest) that must load without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
