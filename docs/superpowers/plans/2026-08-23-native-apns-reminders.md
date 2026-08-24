# Native APNs Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Dory's daily reminder system from Web Push to real iOS push notifications through APNs without regressing PWA reminders.

**Architecture:** The official Capacitor push plugin obtains device tokens, the existing Settings screen stores them through owner-scoped server actions, and the reminder runner fans out across Web Push and APNs. A server-only HTTP/2 APNs client signs short-lived ES256 provider tokens from Vercel secrets.

**Tech Stack:** Capacitor 8 Push Notifications, Next.js 16 server actions, Supabase/Postgres RLS, Node HTTP/2 and crypto, Apple Push Notification service.

**Spec:** `docs/superpowers/specs/2026-08-23-dory-app-store-launch-design.md`

## Global Constraints

- Existing Web Push behavior remains available for browsers and installed PWAs.
- Native tokens are owner-scoped and never exposed to another user.
- Sandbox and production tokens use their matching APNs endpoint.
- APNs keys live only in Apple downloads, local secret storage, and Vercel sensitive environment variables.
- A reminder is marked sent only after at least one transport accepts it.
- Notification taps navigate to `/library`.
- Every behavior change begins with a failing test and ends with a focused commit.

---

### Task 1: Add native token storage and Capacitor support

**Files:**
- Create: `supabase/migrations/20260824010000_native_push_tokens.sql`
- Modify: `lib/types/database.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `mobile/package.json`
- Modify: `mobile/ios/App/CapApp-SPM/Package.swift` through `cap sync`
- Modify: `mobile/ios/App/App/AppDelegate.swift`
- Modify: `mobile/ios/App/App/App.entitlements`
- Modify: `mobile/capacitor.config.json`
- Modify: `mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`

**Interfaces:**
- Produces: `native_push_tokens(user_id, token, environment, created_at, updated_at)` and the `PushNotifications` Capacitor bridge.

- [ ] **Step 1: Add the migration**

Create the table with this shape:

```sql
create table native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  environment text not null check (environment in ('development', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);
create index native_push_tokens_user_id_idx on native_push_tokens(user_id);
create trigger native_push_tokens_set_updated_at before update on native_push_tokens
  for each row execute function set_updated_at();
alter table native_push_tokens enable row level security;
create policy "native_push_tokens_owner" on native_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Install and sync the official plugin**

Run:

```bash
pnpm add @capacitor/push-notifications@^8.0.2
cd mobile
npm install @capacitor/push-notifications@^8.0.2
npx cap sync ios
```

Add the Capacitor registration delegate notifications exactly as documented:

```swift
func application(_ application: UIApplication,
                 didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(
        name: .capacitorDidRegisterForRemoteNotifications,
        object: deviceToken
    )
}

func application(_ application: UIApplication,
                 didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(
        name: .capacitorDidFailToRegisterForRemoteNotifications,
        object: error
    )
}
```

Add `aps-environment` to `App.entitlements`; automatic signing substitutes the
correct development or production value. Configure native foreground presentation
for `badge`, `sound`, `banner`, and `list`.

- [ ] **Step 3: Update generated database types**

Run:

```bash
supabase db push
supabase gen types typescript --linked > /tmp/dory-database-types.ts
```

Review the generated diff, then replace `lib/types/database.ts` with the generated
file using the repository's normal type-generation workflow. Confirm
`native_push_tokens` includes the exact migration columns.

- [ ] **Step 4: Verify schema and native dependency resolution**

Run:

```bash
pnpm typecheck
cd mobile && npm run build:sim
```

Expected: both commands exit 0 and Xcode resolves `CapacitorPushNotifications`.

- [ ] **Step 5: Commit the platform foundation**

```bash
git add supabase/migrations/20260824010000_native_push_tokens.sql \
  lib/types/database.ts package.json pnpm-lock.yaml mobile/package.json \
  mobile/capacitor.config.json mobile/ios/App/App/AppDelegate.swift \
  mobile/ios/App/App/App.entitlements mobile/ios/App/CapApp-SPM/Package.swift \
  mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
git diff --cached --check
git commit -m "feat: add native push registration foundation"
```

---

### Task 2: Implement and test APNs provider delivery

**Files:**
- Create: `lib/push/apns.ts`
- Create: `lib/push/native-types.ts`
- Create: `scripts/test-native-push.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `apnsHost(environment)`, `classifyApnsResponse(status, reason)`, `createApnsProviderToken(now)`, and `sendApns(token, environment, payload)`.
- `sendApns` returns `"sent" | "expired" | "error"`.

- [ ] **Step 1: Write the failing APNs behavior test**

Create `scripts/test-native-push.ts`:

```ts
import assert from "node:assert/strict";
import { apnsHost, classifyApnsResponse } from "../lib/push/apns";

assert.equal(apnsHost("development"), "api.sandbox.push.apple.com");
assert.equal(apnsHost("production"), "api.push.apple.com");
assert.equal(classifyApnsResponse(200, null), "sent");
assert.equal(classifyApnsResponse(410, "Unregistered"), "expired");
assert.equal(classifyApnsResponse(400, "BadDeviceToken"), "expired");
assert.equal(classifyApnsResponse(429, "TooManyRequests"), "error");
console.log("native push behavior ok");
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `pnpm exec tsx scripts/test-native-push.ts`

Expected: failure because `lib/push/apns.ts` does not exist.

- [ ] **Step 3: Implement APNs JWT creation**

Use Node `crypto.createPrivateKey` and `crypto.sign` with
`dsaEncoding: "ieee-p1363"`. Construct compact ES256 JWT segments with header
`{ alg: "ES256", kid: APNS_KEY_ID }` and claims
`{ iss: APPLE_TEAM_ID, iat: unixSeconds }`. Normalize escaped newlines in
`APNS_AUTH_KEY`. Cache the provider token for at most 50 minutes.

- [ ] **Step 4: Implement HTTP/2 delivery**

Connect to `https://${apnsHost(environment)}` with `node:http2`, POST to
`/3/device/${token}`, and send headers:

```ts
{
  ":method": "POST",
  ":path": `/3/device/${token}`,
  authorization: `bearer ${providerToken}`,
  "apns-topic": process.env.APNS_TOPIC ?? "com.learndory.app",
  "apns-push-type": "alert",
  "apns-priority": "10",
  "content-type": "application/json",
}
```

The JSON body is:

```ts
{
  aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
  url: payload.url ?? "/library",
}
```

Close the stream and session on success or failure; never log the token or key.

- [ ] **Step 5: Document required secrets and verify**

Add blank entries for `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APPLE_TEAM_ID`, and
`APNS_TOPIC` to `.env.example`.

Run:

```bash
pnpm exec tsx scripts/test-native-push.ts
pnpm exec eslint lib/push/apns.ts lib/push/native-types.ts scripts/test-native-push.ts
pnpm typecheck
```

Expected: behavior script prints `native push behavior ok`; lint and types exit 0.

- [ ] **Step 6: Commit provider delivery**

```bash
git add .env.example lib/push/apns.ts lib/push/native-types.ts scripts/test-native-push.ts
git diff --cached --check
git commit -m "feat: send reminders through APNs"
```

---

### Task 3: Register devices and fan out reminders

**Files:**
- Create: `lib/push/native-client.ts`
- Modify: `lib/push/store.ts`
- Modify: `lib/push/types.ts`
- Modify: `lib/push/reminders.ts`
- Modify: `app/(app)/settings/actions.ts`
- Modify: `app/(app)/settings/settings-client.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `mobile/ios/App/App/DoryNativePlugin.swift`
- Modify: `scripts/test-native-push.ts`

**Interfaces:**
- Produces: `registerNativePush()`, `saveNativePushTokenAction`, `removeNativePushTokenAction`, and dual-transport reminder summaries.
- `DoryNative.getBuildEnvironment()` returns `{ environment: "development" | "production" }`.

- [ ] **Step 1: Extend the failing behavior test**

Extract `shouldMarkReminderSent(results)` and assert:

```ts
assert.equal(shouldMarkReminderSent([]), false);
assert.equal(shouldMarkReminderSent(["error", "expired"]), false);
assert.equal(shouldMarkReminderSent(["error", "sent"]), true);
```

Run: `pnpm exec tsx scripts/test-native-push.ts`

Expected: failure because `shouldMarkReminderSent` is not exported.

- [ ] **Step 2: Add native token store operations**

Add session-scoped operations in `lib/push/store.ts`:

```ts
addNativePushToken(token: string, environment: ApnsEnvironment): Promise<void>
removeNativePushToken(token: string): Promise<void>
```

Upsert on `user_id,token`; validate token with `/^[0-9a-f]{64,}$/i`; accept only
the two environment values.

- [ ] **Step 3: Add native client registration**

`registerNativePush()` checks native iOS, attaches `registration` and
`registrationError` listeners before calling `requestPermissions()` and
`register()`, reads the native build environment, then returns the token and
environment. A notification-action listener navigates to `/library`.

- [ ] **Step 4: Route the Settings UI by platform**

Add `isNativeIOS` to `ClientEnv`. Native iOS uses the Capacitor permission and
registration path; browsers retain the existing service-worker path. The same
Enable/Disable/Test controls remain visible, and the installation advice is shown
only for Safari/PWA—not inside the native shell.

- [ ] **Step 5: Fan out in the server runner**

For each due user, fetch Web Push rows and native token rows. Send to both, collect
results, prune expired rows, and update `reminder_last_sent_on` only when
`shouldMarkReminderSent(results)` is true. Update the test payload URL from
`/study` to `/library`.

- [ ] **Step 6: Verify dual-transport behavior**

Run:

```bash
pnpm exec tsx scripts/test-native-push.ts
pnpm exec eslint lib/push/native-client.ts lib/push/store.ts lib/push/reminders.ts \
  'app/(app)/settings/actions.ts' 'app/(app)/settings/settings-client.tsx'
pnpm typecheck
pnpm build
cd mobile && npm run build:sim
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit registration and fan-out**

```bash
git add lib/push/native-client.ts lib/push/store.ts lib/push/types.ts \
  lib/push/reminders.ts 'app/(app)/settings/actions.ts' \
  'app/(app)/settings/settings-client.tsx' 'app/(app)/settings/page.tsx' \
  mobile/ios/App/App/DoryNativePlugin.swift scripts/test-native-push.ts
git diff --cached --check
git commit -m "feat: register iPhones for native reminders"
```

---

### Task 4: Configure APNs and verify on the connected iPhone

**Files:**
- Modify: none unless Apple capability refresh changes signing metadata.

**Interfaces:**
- Consumes: Apple APNs key, Team ID, Vercel production environment, connected iPhone.
- Produces: one accepted sandbox APNs notification and a recorded device token.

- [ ] **Step 1: Enable Push Notifications for the App ID**

Edit `com.learndory.app` in Apple Developer, enable Push Notifications, save, and
verify it remains enabled after reload.

- [ ] **Step 2: Create an APNs signing key**

Create a key restricted to Apple Push Notifications service, download the `.p8`
file once, and record its Key ID and the account Team ID in secure local state.
Never add the file to the repository.

- [ ] **Step 3: Set Vercel secrets**

Add all four variables to Vercel production as sensitive values, preserving
newlines in the `.p8` content. Redeploy with:

```bash
vercel --prod --yes --scope framewise-health
```

Expected: the deployment becomes Ready and `learndory.com` points at it.

- [ ] **Step 4: Build, install, and register**

Build to the connected iPhone with `-allowProvisioningUpdates`, launch Settings,
enable notifications, accept the system permission sheet, and verify one
`native_push_tokens` row exists for the signed-in user with environment
`development`.

- [ ] **Step 5: Send and observe a native test**

Tap `Send a test`. Verify APNs returns accepted status in server logs, a visible
notification reaches the iPhone, sound/haptic presentation occurs, and tapping it
opens Dory's library. The account holder confirms the physical presentation.

