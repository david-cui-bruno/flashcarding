import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/lib/supabase/auth";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  // Locally-verified claims (no network). The proxy already gates auth; this is a
  // defense-in-depth check and gives us the username straight from the token.
  const claims = await getSessionClaims(supabase);
  if (!claims) redirect("/login");

  const username = claims.user_metadata?.username ?? "you";

  // "To triage" badge = freshly-generated cards still pending review.
  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("review_status", "pending");

  return (
    <>
      <AppShell username={username} triageCount={count ?? 0}>
        {children}
      </AppShell>
      <Toaster />
    </>
  );
}
