"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  isNativeAppleAvailable,
  signInWithNativeApple,
} from "@/lib/auth/apple-native";
import { createClient } from "@/lib/supabase/client";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

function subscribeToPlatform(): () => void {
  return () => undefined;
}

function unavailableDuringServerRender(): boolean {
  return false;
}

export function AppleSignInButton() {
  const router = useRouter();
  const available = useSyncExternalStore(
    subscribeToPlatform,
    isNativeAppleAvailable,
    unavailableDuringServerRender,
  );
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!available) {
    return null;
  }

  async function handleSignIn() {
    const supabase = createClient();
    let signedIn = false;

    setPending(true);
    setErrorMessage(null);

    try {
      const { credential, rawNonce } = await signInWithNativeApple();
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });

      if (signInError) {
        throw signInError;
      }
      signedIn = true;

      const userMetadata = {
        ...(credential.givenName ? { given_name: credential.givenName } : {}),
        ...(credential.familyName ? { family_name: credential.familyName } : {}),
      };

      if (Object.keys(userMetadata).length > 0) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: userMetadata,
        });

        if (updateError) {
          throw updateError;
        }
      }

      const profileResponse = await fetch("/api/auth/apple/profile", {
        method: "POST",
      });

      if (!profileResponse.ok) {
        await supabase.auth.signOut();
        signedIn = false;
        throw new Error("Could not finish setting up your account.");
      }

      router.replace("/library");
      router.refresh();
    } catch (error) {
      if (signedIn) {
        await supabase.auth.signOut();
      }

      if (errorCode(error) !== "APPLE_CANCELED") {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not sign in with Apple. Try again.",
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200" />
        <span>or</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={handleSignIn}
        className="flex w-full items-center justify-center gap-2 rounded bg-black py-2.5 font-medium text-white disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          
        </span>
        {pending ? "Signing in…" : "Sign in with Apple"}
      </button>

      {errorMessage && (
        <p role="alert" aria-live="assertive" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
