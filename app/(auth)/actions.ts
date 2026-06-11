"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  usernameToEmail,
  validateUsername,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/username";
import type { AuthState } from "@/lib/auth/types";

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Username and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  // Don't leak which half was wrong.
  if (error) return { error: "Invalid username or password." };

  redirect("/library");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  const email = usernameToEmail(username);
  const admin = createAdminClient();

  // Create the user pre-confirmed (no inbox for the synthetic address).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) {
    const taken = /already|exist|registered|duplicate/i.test(error?.message ?? "");
    return { error: taken ? "That username is taken." : "Could not create account. Try again." };
  }

  // Mirror the username into profiles. If this fails, roll back the auth user so we
  // never leave a half-created account that can sign in but has no profile row.
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: data.user.id, username });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    const taken = /duplicate|unique|exist/i.test(profileError.message);
    return { error: taken ? "That username is taken." : "Could not create account. Try again." };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  // Account exists at this point; if auto sign-in fails, send them to log in.
  if (signInError) return { error: "Account created — please log in." };

  redirect("/library");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
