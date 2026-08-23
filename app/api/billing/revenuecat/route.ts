import { createAdminClient } from "@/lib/supabase/admin";

const SECRET_HEADER = "x-revenuecat-signature";

type RevenueCatEvent = {
  event?: {
    app_user_id?: string;
    type?: string;
    expiration_at_ms?: number | null;
    entitlement_ids?: string[];
  };
};

function isProEvent(event: NonNullable<RevenueCatEvent["event"]>) {
  return event.entitlement_ids?.includes("pro") ?? true;
}

function planFor(event: NonNullable<RevenueCatEvent["event"]>) {
  if (["EXPIRATION", "CANCELLATION", "BILLING_ISSUE"].includes(event.type ?? "")) {
    return { plan: "free", plan_expires_at: null, plan_source: "revenuecat" } as const;
  }
  const expires = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  return { plan: "pro", plan_expires_at: expires, plan_source: "revenuecat" } as const;
}

// RevenueCat wiring later:
// 1. Set REVENUECAT_WEBHOOK_SECRET in Vercel and RevenueCat's webhook config.
// 2. Configure the Pro entitlement identifier as "pro".
// 3. Use the Supabase auth user id as RevenueCat app_user_id from the mobile/web client.
// 4. Point RevenueCat webhooks at POST /api/billing/revenuecat.
export async function POST(request: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expected) return Response.json({ error: "RevenueCat webhook is not configured." }, { status: 500 });

  const supplied = request.headers.get(SECRET_HEADER) ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== expected) return Response.json({ error: "Unauthorized." }, { status: 401 });

  let payload: RevenueCatEvent;
  try {
    payload = (await request.json()) as RevenueCatEvent;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = payload.event;
  if (!event?.app_user_id) return Response.json({ error: "Missing app_user_id." }, { status: 400 });
  if (!isProEvent(event)) return Response.json({ ok: true, ignored: true });

  const { error } = await createAdminClient()
    .from("profiles")
    .update(planFor(event))
    .eq("id", event.app_user_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
