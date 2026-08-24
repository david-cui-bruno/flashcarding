import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import {
  apnsHost,
  apnsRequestHeaders,
  buildApnsPayload,
  classifyApnsResponse,
  createApnsProviderToken,
} from "../lib/push/apns";

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

console.log("native push behavior ok");
