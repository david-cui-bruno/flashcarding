import { createBrowserClient } from "@supabase/ssr";
import { SESSION_COOKIE_MAX_AGE } from "./cookies";

// Browser Supabase client (anon key + user session). Safe for client components.
// Long-lived cookies so a client-side token refresh keeps the user signed in across
// browser restarts (the proxy re-applies the same max-age on every request). See cookies.ts.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: { maxAge: SESSION_COOKIE_MAX_AGE } },
  );
}
