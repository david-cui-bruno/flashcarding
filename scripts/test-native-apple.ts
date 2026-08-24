import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureAppleProfile } from "../lib/auth/apple-profile";
import {
  createRawNonce,
  profileInsertForAppleUser,
  profileUsernameForAppleUser,
  sha256Hex,
} from "../lib/auth/apple-native";

async function main() {
  const nonce = createRawNonce();
  assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    await sha256Hex("dory"),
    "5cb8ad155351b80ef8385b3beabce3be352abb773ba9f4e44854c814188a0936",
  );
  assert.equal(
    profileUsernameForAppleUser("7a20f0f2-32ea-4055-9b68-58d368913c8c"),
    "apple_7a20f0f232ea40559b6858d368913c8c",
  );
  assert.deepEqual(
    profileInsertForAppleUser("7a20f0f2-32ea-4055-9b68-58d368913c8c"),
    {
      id: "7a20f0f2-32ea-4055-9b68-58d368913c8c",
      username: "apple_7a20f0f232ea40559b6858d368913c8c",
    },
  );

  const swiftPlugin = readFileSync(
    resolve("mobile/ios/App/App/DoryNativePlugin.swift"),
    "utf8",
  );
  assert.match(swiftPlugin, /import AuthenticationServices/);
  assert.match(swiftPlugin, /jsName\s*=\s*"DoryNative"/);
  assert.match(swiftPlugin, /CAPPluginMethod\(name:\s*"signInWithApple"/);
  assert.match(swiftPlugin, /request\.nonce\s*=\s*call\.getString\("nonce"\)/);
  assert.match(swiftPlugin, /APPLE_CANCELED/);

  const bridgeController = readFileSync(
    resolve("mobile/ios/App/App/DoryBridgeViewController.swift"),
    "utf8",
  );
  assert.match(
    bridgeController,
    /bridge\?\.registerPluginInstance\(DoryNativePlugin\(\)\)/,
  );

  const sceneDelegate = readFileSync(
    resolve("mobile/ios/App/App/SceneDelegate.swift"),
    "utf8",
  );
  assert.match(sceneDelegate, /DoryBridgeViewController\(\)/);

  const entitlements = readFileSync(
    resolve("mobile/ios/App/App/App.entitlements"),
    "utf8",
  );
  assert.match(entitlements, /com\.apple\.developer\.applesignin/);

  const xcodeProject = readFileSync(
    resolve("mobile/ios/App/App.xcodeproj/project.pbxproj"),
    "utf8",
  );
  assert.match(xcodeProject, /DoryNativePlugin\.swift in Sources/);
  assert.match(xcodeProject, /DoryBridgeViewController\.swift in Sources/);
  assert.equal(
    xcodeProject.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)?.length,
    2,
  );

  const profileRoute = readFileSync(
    resolve("app/api/auth/apple/profile/route.ts"),
    "utf8",
  );
  assert.match(profileRoute, /auth\.getUser\(\)/);
  assert.match(profileRoute, /ensureAppleProfile/);
  assert.match(profileRoute, /status:\s*401/);
  assert.match(profileRoute, /identity\.provider\s*===\s*"apple"/);
  assert.match(profileRoute, /status:\s*403/);

  const appleButton = readFileSync(
    resolve("components/auth/apple-sign-in-button.tsx"),
    "utf8",
  );
  assert.match(appleButton, /useSyncExternalStore\([\s\S]*isNativeAppleAvailable/);
  assert.match(appleButton, /signInWithNativeApple\(\)/);
  assert.match(appleButton, /signInWithIdToken/);
  assert.match(appleButton, /provider:\s*"apple"/);
  assert.match(appleButton, /auth\.updateUser/);
  assert.match(appleButton, /fetch\("\/api\/auth\/apple\/profile"/);
  assert.match(appleButton, /auth\.signOut/);
  assert.match(appleButton, /router\.replace\("\/library"\)/);

  const loginPage = readFileSync(resolve("app/(auth)/login/page.tsx"), "utf8");
  assert.match(loginPage, /<AppleSignInButton\s*\/>/);

  let insertCount = 0;
  const existing = await ensureAppleProfile(
    {
      findByUserId: async () => ({ username: "already_here" }),
      insert: async () => {
        insertCount += 1;
        return null;
      },
    },
    "existing-user",
  );
  assert.deepEqual(existing, { username: "already_here" });
  assert.equal(insertCount, 0);

  const created = await ensureAppleProfile(
    {
      findByUserId: async () => null,
      insert: async () => null,
    },
    "7a20f0f2-32ea-4055-9b68-58d368913c8c",
  );
  assert.deepEqual(created, {
    username: "apple_7a20f0f232ea40559b6858d368913c8c",
  });

  let raceReadCount = 0;
  const raced = await ensureAppleProfile(
    {
      findByUserId: async () => {
        raceReadCount += 1;
        return raceReadCount === 1 ? null : { username: "race_winner" };
      },
      insert: async () => ({ code: "23505", message: "duplicate key" }),
    },
    "raced-user",
  );
  assert.deepEqual(raced, { username: "race_winner" });
  assert.equal(raceReadCount, 2);

  console.log("native apple helpers ok");
}

void main();
