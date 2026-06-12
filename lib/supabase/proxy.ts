import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { longLived } from "./cookies";

// Refreshes the Supabase session cookie on every request and gates routes:
// unauthenticated users are sent to /login; authenticated users are kept out of
// the auth pages and the bare root. Standard @supabase/ssr pattern, used by the
// root proxy.ts (Next 16's middleware convention).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, longLived(value, options)),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path === "/signup";
  // Public to the proxy: PWA assets must load before sign-in (or the app isn't
  // installable), and the reminder cron authenticates itself via CRON_SECRET.
  const isPublic =
    isAuthRoute ||
    path === "/sw.js" ||
    path === "/manifest.webmanifest" ||
    path.startsWith("/icons/") ||
    path.startsWith("/api/cron/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && (isAuthRoute || path === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/library";
    return NextResponse.redirect(url);
  }

  return response;
}
