import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

export type Plan = "free" | "pro";
export type Entitlement = { plan: Plan; active: boolean };

type EntitlementClient = Pick<SupabaseClient<Database>, "from">;

export class ProRequiredError extends Error {
  readonly code = "PRO_REQUIRED";
  readonly status = 402;

  constructor(message = "Dory Pro unlocks AI card generation.") {
    super(message);
    this.name = "ProRequiredError";
  }
}

function isActivePro(plan: string | null, expiresAt: string | null): boolean {
  if (plan !== "pro") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function getEntitlement(
  userId: string,
  client?: EntitlementClient,
): Promise<Entitlement> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();

  if (error || !data) return { plan: "free", active: false };

  const active = isActivePro(data.plan, data.plan_expires_at);
  return active ? { plan: "pro", active: true } : { plan: "free", active: false };
}

export async function requirePro(userId: string, client?: EntitlementClient): Promise<Entitlement> {
  const entitlement = await getEntitlement(userId, client);
  if (!entitlement.active) throw new ProRequiredError();
  return entitlement;
}

export function isProRequiredError(error: unknown): error is ProRequiredError {
  return error instanceof ProRequiredError || (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "PRO_REQUIRED"
  );
}
