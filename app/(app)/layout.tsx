import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const username = (user.user_metadata?.username as string | undefined) ?? "you";

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-4 border-b px-4 py-3 text-sm">
        <Link href="/library" className="font-semibold">
          Carding
        </Link>
        <Link href="/new" className="text-neutral-600 hover:text-black">
          New
        </Link>
        <Link href="/review" className="text-neutral-600 hover:text-black">
          Review
        </Link>
        <Link href="/study" className="text-neutral-600 hover:text-black">
          Study
        </Link>
        <Link href="/metrics" className="text-neutral-600 hover:text-black">
          Metrics
        </Link>
        <span className="ml-auto text-neutral-500">{username}</span>
        <form action={logout}>
          <button type="submit" className="text-neutral-600 underline hover:text-black">
            Log out
          </button>
        </form>
      </nav>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}
