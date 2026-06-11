// Username/password auth (docs/ARCHITECTURE.md): Supabase Auth is email-based, so a
// username maps to a synthetic email. Usernames are case-insensitive.
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@carding.local`;
}

// Letters, digits, underscore, hyphen; 3–30 chars. Kept in sync with the `pattern`
// attribute on the signup form so client and server agree. The hyphen is escaped so the
// string is valid both as `new RegExp(...)` and as the HTML pattern attribute, which modern
// Chromium compiles with the unicodeSets (`v`) flag — an unescaped `-` in a class throws there.
export const USERNAME_PATTERN = "^[A-Za-z0-9_\\-]{3,30}$";
const USERNAME_RE = new RegExp(USERNAME_PATTERN);
export const PASSWORD_MIN_LENGTH = 8;

// Returns an error message, or null if the username is acceptable.
export function validateUsername(username: string): string | null {
  if (!username) return "Username is required.";
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3–30 characters: letters, digits, _ or -.";
  }
  return null;
}
