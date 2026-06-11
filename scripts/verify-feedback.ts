// Verifies the feedback + metrics stream: the pure ladder/metric logic, then the real
// Supabase query paths the pages use (seed → compute → assert → cleanup).
//   set -a; . ./.env.local; set +a; pnpm exec tsx scripts/verify-feedback.ts
//
// NOTE: lib/metrics/* and lib/feedback/* use only relative + `import type` of the `@/`
// alias, so tsx (which doesn't resolve tsconfig paths at runtime) can import them directly.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/types/database";
import {
  editRate,
  type FeedbackEvent,
} from "../lib/metrics/edit-rate";
import { retention, type StudyReviewEvent } from "../lib/metrics/retention";
import {
  decideReviewMode,
  partitionPendingForReview,
} from "../lib/metrics/graduation";
import { getMetricsDashboard, getReviewMode } from "../lib/metrics/server";
import { selectFewShotExamples } from "../lib/feedback/examples";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : `  — ${JSON.stringify(detail)}`}`);
  if (!cond) failures++;
}
const approx = (a: number | null, b: number, eps = 1e-6) =>
  a !== null && Math.abs(a - b) < eps;

function fb(action: FeedbackEvent["action"], batchKey: string, t: number): FeedbackEvent {
  return { action, batchKey, createdAt: new Date(t).toISOString() };
}

// ─────────────────────────────── 1. PURE LOGIC ───────────────────────────────
function pureTests() {
  console.log("\n— pure logic —");

  check("editRate null on empty", editRate([]) === null);
  check(
    "editRate (edited+rejected)/reviewed",
    approx(
      editRate([
        fb("kept", "b", 1),
        fb("edited", "b", 2),
        fb("rejected", "b", 3),
        fb("kept", "b", 4),
      ]),
      0.5,
    ),
  );

  // retention: scheduled only, grade>=2 = recalled; cram excluded
  const sr = (grade: number, mode: "scheduled" | "cram"): StudyReviewEvent => ({
    grade,
    mode,
    reviewedAt: new Date(grade + (mode === "cram" ? 100 : 0)).toISOString(),
    collectionId: null,
  });
  const ret = retention([sr(1, "scheduled"), sr(3, "scheduled"), sr(4, "scheduled"), sr(1, "cram")]);
  check("retention excludes cram, grade>=2 recalled", approx(ret.rate, 2 / 3) && ret.reviewed === 3, ret);

  // ladder: < MIN_REVIEWED → review-all
  const few = Array.from({ length: 10 }, (_, i) => fb("kept", "b", i));
  check("ladder review-all when too few reviewed", decideReviewMode(few).mode === "review-all");

  // ladder: 25 reviewed in one batch, 3 changed = 12% → spot-check (rolling<15%, batch not <10%)
  const spot = Array.from({ length: 25 }, (_, i) =>
    fb(i < 3 ? "edited" : "kept", "B1", i),
  );
  check("ladder spot-check at ~12% rolling", decideReviewMode(spot).mode === "spot-check", decideReviewMode(spot));

  // ladder: 3 recent batches each 8 kept (0%) → trust
  const trust: FeedbackEvent[] = [];
  let t = 0;
  for (const bk of ["B1", "B2", "B3"]) for (let i = 0; i < 8; i++) trust.push(fb("kept", bk, t++));
  check("ladder trust when 3 batches under 10%", decideReviewMode(trust).mode === "trust", decideReviewMode(trust));

  // ladder: high edit rate → review-all even with enough samples
  const bad = Array.from({ length: 25 }, (_, i) => fb(i < 10 ? "rejected" : "kept", "B1", i));
  check("ladder review-all at 40%", decideReviewMode(bad).mode === "review-all");

  // partition
  const ids = Array.from({ length: 300 }, (_, i) => `card-${i}-uuid`);
  const all = partitionPendingForReview(ids, "review-all");
  check("partition review-all → review every card", all.toReview.length === 300 && all.autoAccept.length === 0);
  const none = partitionPendingForReview(ids, "trust");
  check("partition trust → auto-accept all", none.toReview.length === 0 && none.autoAccept.length === 300);
  const s1 = partitionPendingForReview(ids, "spot-check");
  const s2 = partitionPendingForReview(ids, "spot-check");
  const frac = s1.toReview.length / ids.length;
  check("partition spot-check ≈20%", frac > 0.12 && frac < 0.28, frac);
  check(
    "partition spot-check deterministic",
    JSON.stringify(s1.toReview) === JSON.stringify(s2.toReview) &&
      s1.toReview.length + s1.autoAccept.length === 300,
  );
}

// ─────────────────────────────── 2. LIVE DB ───────────────────────────────
async function liveTests() {
  console.log("\n— live (real Supabase) —");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient<Database>(url, svcKey, { auth: { persistSession: false } });

  const stamp = new Date().getTime(); // seed-time only; fine in a script
  const email = `verify-${stamp}@carding.local`;
  const password = "password123";
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `verify-${stamp}` },
  });
  if (cErr || !created.user) throw new Error("createUser failed: " + cErr?.message);
  const userId = created.user.id;

  try {
    // 4 batches (collections). c0 oldest carries the one edit; c1–c3 are recent + clean → trust.
    const batchNames = ["c0", "c1", "c2", "c3"];
    const collIds: Record<string, string> = {};
    for (const n of batchNames) {
      const { data } = await admin
        .from("collections")
        .insert({ user_id: userId, name: `verify ${n}` })
        .select("id")
        .single();
      collIds[n] = data!.id;
    }

    let ts = stamp - 1_000_000;
    const c1Cards: string[] = [];
    const c2Cards: string[] = [];
    const c3Cards: string[] = [];
    for (const n of batchNames) {
      for (let i = 0; i < 8; i++) {
        const isEdit = n === "c0" && i === 0;
        const { data: card } = await admin
          .from("cards")
          .insert({
            user_id: userId,
            collection_id: collIds[n],
            term: `${n} term ${i} (postmodern architecture)`,
            definition: `${n} fact ${i} about Sea Ranch`,
            review_status: isEdit ? "edited" : "accepted",
          })
          .select("id")
          .single();
        if (n === "c1") c1Cards.push(card!.id);
        if (n === "c2") c2Cards.push(card!.id);
        if (n === "c3") c3Cards.push(card!.id);
        await admin.from("generation_feedback").insert({
          user_id: userId,
          card_id: card!.id,
          action: isEdit ? "edited" : "kept",
          before: isEdit ? { term: "raw term", definition: "raw fact" } : null,
          after: isEdit ? { term: `${n} term ${i}`, definition: `${n} fact ${i}` } : null,
          created_at: new Date(ts++).toISOString(),
        });
      }
      ts += 1000;
    }

    // Retention: 20 scheduled (18 recalled, 2 lapses) → 90%; 3 cram lapses must be ignored.
    const studyCards = [...c1Cards, ...c2Cards, ...c3Cards];
    let rts = stamp - 500_000;
    for (let i = 0; i < 20; i++) {
      await admin.from("study_reviews").insert({
        user_id: userId,
        card_id: studyCards[i],
        grade: i < 2 ? 1 : 3,
        mode: "scheduled",
        reviewed_at: new Date(rts++).toISOString(),
      });
    }
    for (let i = 0; i < 3; i++) {
      await admin.from("study_reviews").insert({
        user_id: userId,
        card_id: studyCards[i],
        grade: 1,
        mode: "cram",
        reviewed_at: new Date(rts++).toISOString(),
      });
    }

    // User-scoped client (exercises RLS + the exact query path the pages use).
    const userClient: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
      auth: { persistSession: false },
    });
    const { error: sErr } = await userClient.auth.signInWithPassword({ email, password });
    if (sErr) throw new Error("signIn failed: " + sErr.message);

    const mode = await getReviewMode(userClient);
    check("live: mode = trust (3 clean recent batches)", mode.mode === "trust", mode);

    const dash = await getMetricsDashboard(userClient);
    check("live: overall edit rate ≈ 1/32", approx(dash.editRate.overall, 1 / 32, 1e-3), dash.editRate.overall);
    check("live: 32 reviewed", dash.editRate.overallReviewed === 32, dash.editRate.overallReviewed);
    check("live: 4 batches reported", dash.editRate.perBatch.length === 4, dash.editRate.perBatch.length);
    check("live: rolling retention = 90%", approx(dash.retention.rolling.rate, 0.9, 1e-6), dash.retention.rolling);
    check("live: retention counts 20 scheduled (cram excluded)", dash.retention.rolling.reviewed === 20, dash.retention.rolling.reviewed);
    check("live: per-collection retention present w/ names", dash.retention.perCollection.length === 3 && dash.retention.perCollection.every((c) => c.name?.startsWith("verify")), dash.retention.perCollection);

    // Few-shot helper (the generation stream's contract).
    const examples = await selectFewShotExamples({
      client: userClient,
      userId,
      sourceText: "Sea Ranch postmodern architecture in Sonoma County",
      limit: 10,
    });
    check("few-shot: returns examples", examples.length > 0, examples.length);
    check("few-shot: includes the edited example with before delta", examples.some((e) => e.kind === "edited" && e.before !== null), examples.filter((e) => e.kind === "edited"));
    check("few-shot: every example has term+definition", examples.every((e) => e.term && e.definition));

    // Partition against this user's (trusted) cards → all auto-accept.
    const part = partitionPendingForReview(studyCards, mode.mode);
    check("live: trust mode auto-accepts the batch", part.toReview.length === 0 && part.autoAccept.length === studyCards.length);
  } finally {
    await admin.auth.admin.deleteUser(userId); // cascade-deletes all seeded rows
    console.log("cleaned up test user");
  }
}

(async () => {
  await pureTests();
  await liveTests();
  console.log(`\n${failures === 0 ? "ALL PASSED ✅" : `${failures} CHECK(S) FAILED ❌`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
