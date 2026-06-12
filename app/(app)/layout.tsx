import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const username = (user.user_metadata?.username as string | undefined) ?? "you";

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
