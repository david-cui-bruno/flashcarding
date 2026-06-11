import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY admin client. Uses the service-role key, which BYPASSES row-level
// security — never import this into client components. The generation pipeline
// uses it to write cards/jobs on the user's behalf (see docs/PIPELINE.md).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
