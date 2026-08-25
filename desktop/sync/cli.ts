// CLI: one Anki → Dory sync pass (docs/INTEGRATIONS.md §1).
//
// Run from the repo root (deps + env live there):
//   set -a; . ./.env.local; set +a; pnpm sync:anki -- --user demo --password …
//
// Auth: the desktop shell wraps the deployed web app, so its auth IS Supabase auth
// (username → synthetic email, lib/auth/username.ts). The CLI signs in the same way —
// anon key + signInWithPassword — so every write is RLS-scoped to the signed-in user,
// exactly like the in-app importers. Credentials come from flags or env:
//   DORY_SYNC_USER / DORY_SYNC_PASSWORD  (or --user / --password)
// Supabase project comes from NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "../../lib/auth/username";
import type { Database } from "../../lib/types/database";
import { AnkiConnectError } from "./ankiconnect";
import { syncAnkiToDory } from "./engine";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}
function argAll(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < process.argv.length - 1; i++) {
    if (process.argv[i] === `--${name}`) out.push(process.argv[i + 1]);
  }
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set. Run from the repo root: set -a; . ./.env.local; set +a",
    );
  }
  const username = arg("user") ?? process.env.DORY_SYNC_USER;
  const password = arg("password") ?? process.env.DORY_SYNC_PASSWORD;
  if (!username || !password) {
    throw new Error("Missing credentials: pass --user/--password or set DORY_SYNC_USER/DORY_SYNC_PASSWORD.");
  }
  const decks = argAll("deck"); // repeatable; empty = all decks

  const db = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authErr } = await db.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (authErr || !auth.user) throw new Error(`Dory sign-in failed for "${username}": ${authErr?.message}`);
  console.log(`signed in to Dory as ${username} (${auth.user.id})`);

  const t0 = Date.now();
  const summary = await syncAnkiToDory({
    db,
    userId: auth.user.id,
    decks: decks.length ? decks : undefined,
    progress: (m) => console.log(m),
  });

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\nsync complete in ${secs}s — ${summary.decks.length} deck(s): ` +
      `+${summary.added} new, ~${summary.updated} updated, ${summary.unchanged} unchanged`,
  );
  await db.auth.signOut();
}

main().catch((e) => {
  if (e instanceof AnkiConnectError) {
    console.error(`\n[${e.kind}] ${e.message}`);
  } else {
    console.error(`\n${e instanceof Error ? e.message : e}`);
  }
  process.exit(1);
});
