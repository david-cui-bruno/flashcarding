"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "../actions";
import type { AuthState } from "@/lib/auth/types";
import { USERNAME_PATTERN, PASSWORD_MIN_LENGTH } from "@/lib/auth/username";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, null);
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form action={action} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create your Cardstock account</h1>

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
            minLength={3}
            maxLength={30}
            pattern={USERNAME_PATTERN}
            disabled={pending}
            aria-describedby="username-hint"
            aria-invalid={state?.error ? true : undefined}
            className="w-full rounded border px-3 py-2 disabled:opacity-60"
          />
          <p id="username-hint" className="text-xs text-neutral-500">
            3–30 characters: letters, digits, _ or -.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            disabled={pending}
            aria-describedby="password-hint"
            aria-invalid={state?.error ? true : undefined}
            className="w-full rounded border px-3 py-2 disabled:opacity-60"
          />
          <p id="password-hint" className="text-xs text-neutral-500">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
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
          {pending ? "Creating account…" : "Sign up"}
        </button>

        <p className="text-center text-sm">
          Have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
