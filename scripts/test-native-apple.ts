import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createRawNonce,
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

  const swiftPlugin = readFileSync(
    resolve("mobile/ios/App/App/DoryNativePlugin.swift"),
    "utf8",
  );
  assert.match(swiftPlugin, /import AuthenticationServices/);
  assert.match(swiftPlugin, /jsName\s*=\s*"DoryNative"/);
  assert.match(swiftPlugin, /CAPPluginMethod\(name:\s*"signInWithApple"/);
  assert.match(swiftPlugin, /request\.nonce\s*=\s*call\.getString\("nonce"\)/);
  assert.match(swiftPlugin, /APPLE_CANCELED/);

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
  assert.equal(
    xcodeProject.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g)?.length,
    2,
  );

  console.log("native apple helpers ok");
}

void main();
