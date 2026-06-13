/**
 * app/api/metrics/refresh/route.ts
 *
 * POST /api/metrics/refresh              → force-recompute global snapshot
 * POST /api/metrics/refresh?collection=:id → force-recompute per-deck snapshot
 *
 * Ignores the 15-minute TTL floor. Intended for post-generation-job webhooks
 * and for tests.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshMetrics } from "@/lib/feedback/metrics";

export async function POST(req: NextRequest) {
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
    const metrics = await refreshMetrics(user.id, collectionId);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("[metrics/refresh] POST failed:", err);
    return NextResponse.json(
      { error: "Failed to refresh metrics" },
      { status: 500 }
    );
  }
}
