// Seed a demo user with decks spanning every UI state, for visual verification of
// the rebuilt UI. Run: set -a; . ./.env.local; set +a; pnpm exec tsx scripts/seed-demo.ts
// Login: username "demo", password "password12".
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "../lib/auth/username";

const USERNAME = "demo";
const PASSWORD = "password12";
const email = usernameToEmail(USERNAME);

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const now = Date.now();
const days = (n: number) => new Date(now + n * 86400_000).toISOString();

type CardSeed = {
  term: string;
  definition: string;
  source_span?: string;
  status?: "pending" | "accepted" | "edited" | "rejected";
  reps?: number;
  state?: "new" | "learning" | "review" | "relearning";
  dueDays?: number;
  lapses?: number;
};

function buildCards(userId: string, collectionId: string, seeds: CardSeed[]) {
  return seeds.map((s) => ({
    user_id: userId,
    collection_id: collectionId,
    term: s.term,
    definition: s.definition,
    source_span: s.source_span ?? null,
    review_status: s.status ?? "accepted",
    prompt_direction: "definition_to_term" as const,
    reps: s.reps ?? 0,
    fsrs_state: s.state ?? "new",
    lapses: s.lapses ?? 0,
    stability: s.reps ? 12 : 0,
    difficulty: s.reps ? 5 : 0,
    due: days(s.dueDays ?? 0),
    last_review: s.reps ? days(-2) : null,
  }));
}

async function main() {
  // Idempotent: drop any prior demo user (cards cascade on delete).
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
    console.log("removed prior demo user");
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: USERNAME },
  });
  if (cErr || !created.user) throw cErr ?? new Error("no user");
  const uid = created.user.id;
  await admin.from("profiles").insert({ id: uid, username: USERNAME });
  console.log("created demo user", uid);

  const decks: Record<string, CardSeed[]> = {
    "Architecture History": [
      { term: "Sea Ranch (Condominium One)", definition: "A 1963–65 residential complex on the Sonoma coast by MLTW.", reps: 4, state: "review", dueDays: -1, source_span: "built between 1963 and 1965 … designed by MLTW" },
      { term: "Bauhaus", definition: "German school (1919–1933) unifying craft and fine art; founded by Walter Gropius.", reps: 3, state: "review", dueDays: -1 },
      { term: "Brutalism", definition: "Mid-century style emphasizing raw exposed concrete (béton brut).", reps: 5, state: "review", dueDays: -2 },
      { term: "Flying buttress", definition: "An external arched support transferring roof thrust to a pier.", reps: 2, state: "review", dueDays: 0 },
      { term: "Postmodern architecture", definition: "Reaction against International Style austerity; ornament and context return.", reps: 3, state: "review", dueDays: 4 },
      { term: "International Style", definition: "1920s–30s modernism: volume over mass, regularity, no ornament.", reps: 2, state: "review", dueDays: 6 },
    ],
    "Spanish — Travel": [
      { term: "el aeropuerto", definition: "the airport", reps: 2, state: "review", dueDays: -1 },
      { term: "la estación", definition: "the station", reps: 2, state: "review", dueDays: 0 },
      { term: "¿Cuánto cuesta?", definition: "How much does it cost?", reps: 0, state: "new", dueDays: 0 },
      { term: "la llave", definition: "the key", reps: 0, state: "new", dueDays: 0 },
      { term: "la factura", definition: "the bill / invoice", reps: 3, state: "review", dueDays: 5 },
    ],
    "Cardiac Anatomy": [
      { term: "Left ventricle", definition: "Pumps oxygenated blood into the systemic circulation via the aorta.", reps: 5, state: "review", dueDays: 3 },
      { term: "Mitral valve", definition: "Bicuspid valve between the left atrium and left ventricle.", reps: 4, state: "review", dueDays: 4 },
      { term: "SA node", definition: "The heart's natural pacemaker, in the right atrium.", reps: 6, state: "review", dueDays: 7 },
    ],
    "The Sea Ranch": [
      { term: "MLTW", definition: "Moore, Lyndon, Turnbull, Whitaker — the firm behind Sea Ranch.", reps: 0, state: "new", dueDays: 0, source_span: "the firm MLTW" },
      { term: "Shed roof", definition: "A single-sloped roof, characteristic of the Sea Ranch vernacular.", reps: 0, state: "new", dueDays: 0 },
      { term: "Rough-sawn wood", definition: "Unfinished timber cladding used to weather into the landscape.", reps: 0, state: "new", dueDays: 0 },
      // pending → feeds the triage queue / review screen
      { term: "Condominium One", definition: "The first cluster of ten units at the Sea Ranch (1965).", status: "pending", source_span: "Condominium One … 1965" },
      { term: "Lawrence Halprin", definition: "The landscape architect who created the Sea Ranch ecological plan.", status: "pending", source_span: "ecological guidelines" },
      { term: "Sonoma County", definition: "The California county on whose coast the Sea Ranch sits.", status: "pending", source_span: "Sonoma County coast of California" },
    ],
  };

  for (const [name, seeds] of Object.entries(decks)) {
    const { data: col } = await admin
      .from("collections")
      .insert({ user_id: uid, name })
      .select("id")
      .single();
    if (!col) throw new Error("collection insert failed: " + name);
    const rows = buildCards(uid, col.id, seeds);
    const { error } = await admin.from("cards").insert(rows);
    if (error) throw error;
    console.log(`seeded "${name}" (${rows.length} cards)`);
  }

  console.log("\n✅ done. Login: demo / password12");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
