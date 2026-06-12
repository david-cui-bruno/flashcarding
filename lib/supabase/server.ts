import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { longLived } from "./cookies";

// Server Supabase client (anon key + user session via cookies). RLS-enforced.
// In Next.js 16 `cookies()` is async.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, longLived(value, options)),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware refreshes the session.
          }
        },
      },
    },
  );
}
