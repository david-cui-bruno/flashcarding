import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/push/reminders";

// Daily study reminders. NOTE: nothing schedules this yet — it runs 0× until a
// scheduler is wired up, so it sends no notifications today. The job is idempotent
// per local day (at most one push per user per day), so when it IS wired, an
// infrequent cadence is plenty — hourly is fine; the old "every 5–15 min" was only
// to tighten how close to the chosen time the push lands. Trigger with the shared
// CRON_SECRET, e.g.:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders
// Works with Supabase pg_cron + pg_net, Vercel Cron, GitHub Actions, etc.
export const dynamic = "force-dynamic"; // never cached; always evaluates "now"

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if unset
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get("key") === secret;
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runReminders(new Date());
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[carding] reminder cron failed:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message ?? "reminder run failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
