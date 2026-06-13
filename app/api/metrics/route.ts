/**
 * app/api/metrics/route.ts
 *
 * GET  /api/metrics                 → global (all-decks) snapshot
 * GET  /api/metrics?collection=:id  → per-deck snapshot
 *
 * See docs/ANALYTICS.md §7 for the response shape and refresh cadence.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMetrics } from "@/lib/feedback/metrics";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collectionId =
    req.nextUrl.searchParams.get("collection") ?? null;

  try {
    const metrics = await getMetrics(user.id, collectionId);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("[metrics] GET failed:", err);
    return NextResponse.json(
      { error: "Failed to compute metrics" },
      { status: 500 }
    );
  }
}
