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
        <p className="text-sm text-neutral-500">Log in to study your cards.</p>

        <div className="space-y-1">
          <label htmlFor="username" className="block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
            required
            disabled={pending}
            aria-invalid={state?.error ? true : undefined}
            className="w-full rounded border px-3 py-2 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={state?.error ? true : undefined}
            className="w-full rounded border px-3 py-2 disabled:opacity-60"
          />
        </div>

        {state?.error && (
          <p role="alert" aria-live="assertive" className="text-sm text-red-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
        >
          {pending ? "Logging in…" : "Log in"}
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
