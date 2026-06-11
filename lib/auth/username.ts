// Username/password auth (docs/ARCHITECTURE.md): Supabase Auth is email-based, so a
// username maps to a synthetic email. Usernames are case-insensitive.
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@carding.local`;
}
