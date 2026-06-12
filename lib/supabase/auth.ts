import type { SupabaseClient } from "@supabase/supabase-js";

// Verified session claims, decoded from the access-token JWT.
// `sub` is the user id; Supabase also embeds user_metadata in the token.
export type SessionClaims = {
  sub: string;
  email?: string;
  user_metadata?: { username?: string; [k: string]: unknown };
  [k: string]: unknown;
};

// Authenticate a request WITHOUT a network round trip on the hot path.
//
// `getClaims()` cryptographically verifies the JWT locally using the project's
// asymmetric (ES256) signing key, cached from the JWKS endpoint (fetched once per
// serverless instance, then reused). It only falls back to a network `getUser()`
// if it genuinely can't verify locally — so it is exactly as trustworthy as
// `getUser()`, but ~free for us. It also routes through `getSession()`, which
// still refreshes an expiring token and re-persists the cookies.
//
// Returns the verified claims, or null when there is no valid session.
export async function getSessionClaims(
  supabase: SupabaseClient,
): Promise<SessionClaims | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims as SessionClaims | undefined) ?? null;
}
