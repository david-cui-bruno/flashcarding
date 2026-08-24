import { ensureAppleProfile } from "@/lib/auth/apple-profile";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const hasAppleIdentity = user.identities?.some(
    (identity) => identity.provider === "apple",
  );
  if (!hasAppleIdentity) {
    return Response.json({ error: "Apple identity required." }, { status: 403 });
  }

  try {
    const profile = await ensureAppleProfile(
      {
        async findByUserId(userId) {
          const { data, error } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", userId)
            .maybeSingle();

          if (error) {
            throw new Error(error.message);
          }

          return data;
        },
        async insert(profileInsert) {
          const { error } = await supabase.from("profiles").insert(profileInsert);

          return error
            ? { code: error.code, message: error.message }
            : null;
        },
      },
      user.id,
    );

    return Response.json({ ok: true, username: profile.username });
  } catch {
    return Response.json(
      { error: "Could not finish setting up your account." },
      { status: 500 },
    );
  }
}
