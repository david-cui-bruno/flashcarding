import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";
import type {
  ApnsEnvironment,
  NativePushPayload,
  PushDeliveryResult,
} from "./native-types";

const PROVIDER_TOKEN_MAX_AGE_SECONDS = 50 * 60;

let cachedProviderToken:
  | {
      token: string;
      issuedAt: number;
      keyId: string;
      teamId: string;
      privateKey: string;
    }
  | undefined;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function apnsHost(environment: ApnsEnvironment): string {
  return environment === "development"
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
}

export function classifyApnsResponse(
  status: number,
  reason: string | null,
): PushDeliveryResult {
  if (status === 200) {
    return "sent";
  }

  if (
    status === 410 ||
    reason === "BadDeviceToken" ||
    reason === "DeviceTokenNotForTopic" ||
    reason === "Unregistered"
  ) {
    return "expired";
  }

  return "error";
}

export function createApnsProviderToken(
  now = Math.floor(Date.now() / 1000),
): string {
  const keyId = requiredEnvironment("APNS_KEY_ID");
  const teamId = requiredEnvironment("APPLE_TEAM_ID");
  const privateKey = requiredEnvironment("APNS_AUTH_KEY").replaceAll("\\n", "\n");

  if (
    cachedProviderToken &&
    cachedProviderToken.keyId === keyId &&
    cachedProviderToken.teamId === teamId &&
    cachedProviderToken.privateKey === privateKey &&
    now >= cachedProviderToken.issuedAt &&
    now - cachedProviderToken.issuedAt < PROVIDER_TOKEN_MAX_AGE_SECONDS
  ) {
    return cachedProviderToken.token;
  }

  const encodedHeader = encodeJson({ alg: "ES256", kid: keyId });
  const encodedClaims = encodeJson({ iss: teamId, iat: now });
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  const token = `${signingInput}.${signature}`;

  cachedProviderToken = {
    token,
    issuedAt: now,
    keyId,
    teamId,
    privateKey,
  };

  return token;
}

export function buildApnsPayload(payload: NativePushPayload): {
  aps: {
    alert: { title: string; body: string };
    sound: "default";
  };
  url: string;
} {
  return {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
    },
    url: payload.url ?? "/library",
  };
}

export function apnsRequestHeaders(
  deviceToken: string,
  providerToken: string,
  topic: string,
): Record<string, string> {
  return {
    ":method": "POST",
    ":path": `/3/device/${deviceToken}`,
    authorization: `bearer ${providerToken}`,
    "apns-topic": topic,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "content-type": "application/json",
  };
}

export async function sendApns(
  deviceToken: string,
  environment: ApnsEnvironment,
  payload: NativePushPayload,
): Promise<PushDeliveryResult> {
  const providerToken = createApnsProviderToken();
  const topic = process.env.APNS_TOPIC?.trim() || "com.learndory.app";

  return new Promise((resolve) => {
    const client = connect(`https://${apnsHost(environment)}`);
    const request = client.request(
      apnsRequestHeaders(deviceToken, providerToken, topic),
    );
    let settled = false;
    let status = 0;
    let responseBody = "";

    function finish(result: PushDeliveryResult, destroy = false) {
      if (settled) return;
      settled = true;

      if (destroy) {
        client.destroy();
      } else {
        client.close();
      }

      resolve(result);
    }

    client.once("error", () => finish("error", true));
    request.once("error", () => finish("error", true));
    request.setTimeout(15_000, () => finish("error", true));
    request.setEncoding("utf8");
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.on("data", (chunk: string) => {
      responseBody += chunk;
    });
    request.once("end", () => {
      let reason: string | null = null;

      if (responseBody) {
        try {
          const parsed = JSON.parse(responseBody) as { reason?: unknown };
          reason = typeof parsed.reason === "string" ? parsed.reason : null;
        } catch {
          reason = null;
        }
      }

      finish(classifyApnsResponse(status, reason));
    });

    request.end(JSON.stringify(buildApnsPayload(payload)));
  });
}
