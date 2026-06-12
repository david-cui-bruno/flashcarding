// Keep the user signed in across browser restarts ("never sign in again").
//
// @supabase/ssr sets the auth (access + refresh token) cookies with default options,
// which behave like session cookies. We force a long max-age so they persist. 400 days
// is the practical ceiling — browsers (per the cookie spec) clamp persistent cookies to
// ~400 days. The proxy re-applies this on every request, so the window slides forward
// each visit: as long as the user opens the app within 400 days, they stay logged in
// indefinitely (the Supabase refresh token has no expiry by default).
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days, in seconds

// Returns the cookie options with a long max-age — EXCEPT when the cookie is being
// cleared (empty value, or an explicit maxAge of 0), which is how sign-out removes the
// session. Extending those would make logout impossible.
export function longLived<O extends { maxAge?: number }>(value: string, options: O): O {
  if (!value || options.maxAge === 0) return options;
  return { ...options, maxAge: SESSION_COOKIE_MAX_AGE };
}
