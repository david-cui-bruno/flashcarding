import { profileInsertForAppleUser } from "./apple-native";

export type AppleProfile = {
  username: string;
};

export type AppleProfileWriteError = {
  code?: string;
  message: string;
};

export type AppleProfileRepository = {
  findByUserId(userId: string): Promise<AppleProfile | null>;
  insert(
    profile: ReturnType<typeof profileInsertForAppleUser>,
  ): Promise<AppleProfileWriteError | null>;
};

export async function ensureAppleProfile(
  repository: AppleProfileRepository,
  userId: string,
): Promise<AppleProfile> {
  const existing = await repository.findByUserId(userId);

  if (existing) {
    return existing;
  }

  const profile = profileInsertForAppleUser(userId);
  const insertError = await repository.insert(profile);

  if (!insertError) {
    return { username: profile.username };
  }

  const isUniqueConflict =
    insertError.code === "23505" ||
    /duplicate|unique|already exists/i.test(insertError.message);

  if (isUniqueConflict) {
    const racedProfile = await repository.findByUserId(userId);

    if (racedProfile) {
      return racedProfile;
    }
  }

  throw new Error(`Could not provision Apple profile: ${insertError.message}`);
}
