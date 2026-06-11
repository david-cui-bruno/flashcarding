"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "../actions";
import type { AuthState } from "@/lib/auth/types";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Carding</h1>
        <input
          name="username"
          placeholder="Username"
          autoComplete="username"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          className="w-full rounded border px-3 py-2"
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
        >
          {pending ? "…" : "Log in"}
        </button>
        <p className="text-center text-sm">
          No account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
