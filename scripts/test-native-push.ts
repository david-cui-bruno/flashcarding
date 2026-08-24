import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  apnsHost,
  apnsRequestHeaders,
  buildApnsPayload,
  classifyApnsResponse,
  createApnsProviderToken,
  isApnsConfigured,
  sendApns,
} from "../lib/push/apns";
import {
  reminderPayload,
  shouldMarkReminderSent,
} from "../lib/push/reminders";
import { nativePushTokenInsert } from "../lib/push/native-types";
import {
  pushUiMode,
  registerNativePushWithPlugin,
} from "../lib/push/native-client";

assert.equal(apnsHost("development"), "api.sandbox.push.apple.com");
assert.equal(apnsHost("production"), "api.push.apple.com");
assert.equal(classifyApnsResponse(200, null), "sent");
assert.equal(classifyApnsResponse(410, "Unregistered"), "expired");
assert.equal(classifyApnsResponse(400, "BadDeviceToken"), "expired");
assert.equal(classifyApnsResponse(429, "TooManyRequests"), "error");

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});
process.env.APNS_AUTH_KEY = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
process.env.APNS_KEY_ID = "DORYKEY123";
process.env.APPLE_TEAM_ID = "R45248279P";
assert.equal(isApnsConfigured(), true);
delete process.env.APNS_KEY_ID;
assert.equal(isApnsConfigured(), false);
process.env.APNS_KEY_ID = "DORYKEY123";

const providerToken = createApnsProviderToken(1_700_000_000);
const [encodedHeader, encodedClaims, encodedSignature] = providerToken.split(".");
assert.deepEqual(
  JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")),
  { alg: "ES256", kid: "DORYKEY123" },
);
assert.deepEqual(
  JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")),
  { iss: "R45248279P", iat: 1_700_000_000 },
);
assert.equal(
  verify(
    "sha256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(encodedSignature, "base64url"),
  ),
  true,
);

assert.deepEqual(
  buildApnsPayload({ title: "Dory", body: "Five cards are due." }),
  {
    aps: {
      alert: { title: "Dory", body: "Five cards are due." },
      sound: "default",
    },
    url: "/library",
  },
);
assert.deepEqual(
  apnsRequestHeaders("abc123", "provider-token", "com.learndory.app"),
  {
    ":method": "POST",
    ":path": "/3/device/abc123",
    authorization: "bearer provider-token",
    "apns-topic": "com.learndory.app",
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  },
);
assert.equal(shouldMarkReminderSent([]), false);
assert.equal(shouldMarkReminderSent(["error", "expired"]), false);
assert.equal(shouldMarkReminderSent(["error", "sent"]), true);
assert.deepEqual(reminderPayload(1), {
  title: "Dory",
  body: "1 card is due. Time to study.",
  url: "/library",
  tag: "carding-reminder",
});
assert.equal(reminderPayload(5).body, "5 cards are due. Time to study.");
assert.deepEqual(
  nativePushTokenInsert("user-1", "a".repeat(64), "development"),
  {
    user_id: "user-1",
    token: "a".repeat(64),
    environment: "development",
  },
);
assert.throws(
  () => nativePushTokenInsert("user-1", "a".repeat(63), "development"),
  /Invalid APNs device token/,
);
assert.throws(
  () => nativePushTokenInsert("user-1", "a".repeat(64), "sandbox" as never),
  /Invalid APNs environment/,
);
assert.deepEqual(
  pushUiMode({
    isNativeIOS: true,
    browserSupported: false,
    isIOSBrowser: true,
    isStandalone: false,
  }),
  { supported: true, needsInstallOnIOS: false, showInstall: false },
);
assert.deepEqual(
  pushUiMode({
    isNativeIOS: false,
    browserSupported: true,
    isIOSBrowser: true,
    isStandalone: false,
  }),
  { supported: true, needsInstallOnIOS: true, showInstall: true },
);

async function testNativeRegistration() {
  const activeTimeoutsBefore = process
    .getActiveResourcesInfo()
    .filter((resource) => resource === "Timeout").length;
  const eventOrder: string[] = [];
  const listeners: Record<string, (value: unknown) => void> = {};
  const token = "b".repeat(64);

  const registration = await registerNativePushWithPlugin(
    {
      async addListener(eventName, listener) {
        eventOrder.push(`listen:${eventName}`);
        listeners[eventName] = listener;
        return { remove: async () => undefined };
      },
      async requestPermissions() {
        eventOrder.push("permissions");
        return { receive: "granted" };
      },
      async register() {
        eventOrder.push("register");
        listeners.registration({ value: token });
      },
    },
    async () => {
      eventOrder.push("environment");
      return { environment: "development" };
    },
  );

  assert.deepEqual(registration, { token, environment: "development" });
  assert.deepEqual(eventOrder.slice(0, 5), [
    "listen:registration",
    "listen:registrationError",
    "permissions",
    "environment",
    "register",
  ]);
  assert.equal(
    process
      .getActiveResourcesInfo()
      .filter((resource) => resource === "Timeout").length,
    activeTimeoutsBefore,
  );

  const savedKeyId = process.env.APNS_KEY_ID;
  delete process.env.APNS_KEY_ID;
  assert.equal(
    await sendApns("c".repeat(64), "development", {
      title: "Dory",
      body: "Test",
    }),
    "error",
  );
  process.env.APNS_KEY_ID = savedKeyId;
}

void testNativeRegistration().then(() => {
  console.log("native push behavior ok");
});
