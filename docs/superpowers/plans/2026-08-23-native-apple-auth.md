# Native Apple Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the deployed RevenueCat work and add native Sign in with Apple that creates a complete Dory account through Supabase.

**Architecture:** A small Swift Capacitor plugin performs AuthenticationServices authorization with a hashed nonce. The hosted Next.js client exchanges the identity token and raw nonce through Supabase, then calls an authenticated idempotent profile-provisioning route before entering the app.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase JS/SSR, Capacitor 8, Swift 5, AuthenticationServices, Node `assert` behavior tests.

**Spec:** `docs/superpowers/specs/2026-08-23-dory-app-store-launch-design.md`

## Global Constraints

- Brand is Dory; infrastructure retains `cardstock` and `carding` names.
- Bundle ID is exactly `com.learndory.app`.
- Native Apple credentials and identity tokens must never be logged or committed.
- Username/password login remains available.
- Apple account linking is not part of version 1.
- Profile provisioning must be idempotent and must not overwrite an existing row.
- Every behavior change begins with a failing test and ends with a focused commit.

---

### Task 1: Preserve the deployed RevenueCat implementation

**Files:**
- Modify: `.env.example`
- Modify: `.vercelignore`
- Modify: `app/(app)/layout.tsx`
- Modify: `app/(app)/new/page.tsx`
- Modify: `app/(app)/settings/settings-client.tsx`
- Modify: `app/api/billing/revenuecat/route.ts`
- Create: `components/billing/pro-plans-view.tsx`
- Create: `components/billing/revenuecat-provider.tsx`
- Create: `lib/billing/revenuecat-client.ts`
- Create: `lib/billing/revenuecat-core.ts`
- Create: `lib/billing/revenuecat-webhook.ts`
- Modify: `lib/supabase/proxy.ts`
- Modify: `mobile/package.json`
- Modify: `mobile/ios/App/CapApp-SPM/Package.swift`
- Modify: `mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Create: `scripts/test-proxy-public-paths.ts`
- Create: `scripts/test-revenuecat.ts`

**Interfaces:**
- Consumes: RevenueCat entitlement `pro`, products `com.learndory.pro.monthly` and `com.learndory.pro.annual`.
- Produces: native purchase/restore UI and authenticated webhook synchronization.

- [ ] **Step 1: Re-run the billing behavior tests**

Run:

```bash
pnpm exec tsx scripts/test-proxy-public-paths.ts
pnpm exec tsx scripts/test-entitlements.ts
pnpm exec tsx scripts/test-revenuecat.ts
```

Expected: each script exits 0 and prints its success line.

- [ ] **Step 2: Re-run build verification**

Run:

```bash
pnpm typecheck
NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY=appl_McYLNXKdJrttWFWAinIxJaRpFPp pnpm build
cd mobile && npm run build:sim
```

Expected: TypeScript, Next.js, and Xcode all exit 0.

- [ ] **Step 3: Commit only the RevenueCat implementation**

Run:

```bash
git add .env.example .vercelignore tsconfig.json package.json pnpm-lock.yaml \
  'app/(app)/layout.tsx' 'app/(app)/new/page.tsx' \
  'app/(app)/settings/settings-client.tsx' app/api/billing/revenuecat/route.ts \
  components/billing lib/billing/revenuecat-client.ts lib/billing/revenuecat-core.ts \
  lib/billing/revenuecat-webhook.ts lib/supabase/proxy.ts mobile/package.json \
  mobile/ios/App/CapApp-SPM/Package.swift \
  mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved \
  scripts/test-proxy-public-paths.ts scripts/test-revenuecat.ts
git diff --cached --check
git commit -m "feat: finish native RevenueCat billing"
```

Expected: the spec commit remains separate and the billing commit contains no secret.

---

### Task 2: Define and test the native Apple bridge contract

**Files:**
- Create: `lib/auth/apple-native.ts`
- Create: `scripts/test-native-apple.ts`
- Create: `mobile/ios/App/App/DoryNativePlugin.swift`
- Modify: `mobile/ios/App/App.xcodeproj/project.pbxproj`
- Create: `mobile/ios/App/App/App.entitlements`

**Interfaces:**
- Produces: `createRawNonce(): string`, `sha256Hex(value: string): Promise<string>`, `profileUsernameForAppleUser(userId: string): string`, `isNativeAppleAvailable(): boolean`, and `signInWithNativeApple(): Promise<NativeAppleCredential>`.
- Native bridge method: `DoryNative.signInWithApple({ nonce: string })` returns `{ identityToken, user, email?, givenName?, familyName? }`.

- [ ] **Step 1: Write the failing behavior test**

Create `scripts/test-native-apple.ts` with these assertions:

```ts
import assert from "node:assert/strict";
import {
  createRawNonce,
  profileUsernameForAppleUser,
  sha256Hex,
} from "../lib/auth/apple-native";

const nonce = createRawNonce();
assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
assert.equal(
  await sha256Hex("dory"),
  "6c786a7829fe45689a65f92dce5a43c053df44f0ecad0c85042b49bb6892bec5",
);
assert.equal(
  profileUsernameForAppleUser("7a20f0f2-32ea-4055-9b68-58d368913c8c"),
  "apple_7a20f0f232ea40559b6858d368913c8c",
);
console.log("native apple helpers ok");
```

- [ ] **Step 2: Run the test and verify the red state**

Run: `pnpm exec tsx scripts/test-native-apple.ts`

Expected: failure because `lib/auth/apple-native.ts` does not exist.

- [ ] **Step 3: Implement the TypeScript bridge**

Create `lib/auth/apple-native.ts` using `registerPlugin` from `@capacitor/core`.
Generate 32 random bytes with `crypto.getRandomValues`, encode as base64url without
padding, hash with `crypto.subtle.digest("SHA-256", ...)`, and normalize profile
usernames by removing UUID hyphens and prefixing `apple_`.

The exported credential type is:

```ts
export type NativeAppleCredential = {
  identityToken: string;
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
};
```

`isNativeAppleAvailable()` returns true only when
`Capacitor.isNativePlatform()` and `Capacitor.getPlatform() === "ios"`.

- [ ] **Step 4: Implement the Swift plugin**

Create `DoryNativePlugin.swift` as a `CAPPlugin`, `CAPBridgedPlugin`, and
`ASAuthorizationControllerDelegate`. Set `identifier = "DoryNativePlugin"`,
`jsName = "DoryNative"`, and expose `signInWithApple` in `pluginMethods`. Keep
pending calls in a dictionary keyed by callback ID. Decode `identityToken` as
UTF-8, return first-sign-in name fields, and reject cancellation with code
`APPLE_CANCELED`.

The request setup is exactly:

```swift
let request = ASAuthorizationAppleIDProvider().createRequest()
request.requestedScopes = [.fullName, .email]
request.nonce = call.getString("nonce")
let controller = ASAuthorizationController(authorizationRequests: [request])
controller.delegate = self
controller.presentationContextProvider = self
controller.performRequests()
```

Register the Swift file in the Xcode target. Add `App.entitlements` containing:

```xml
<key>com.apple.developer.applesignin</key>
<array><string>Default</string></array>
```

Set `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` for Debug and Release.

- [ ] **Step 5: Verify helpers and the simulator build**

Run:

```bash
pnpm exec tsx scripts/test-native-apple.ts
pnpm typecheck
cd mobile && npm run build:sim
```

Expected: helper test prints `native apple helpers ok`; both builds exit 0.

- [ ] **Step 6: Commit the bridge contract**

```bash
git add lib/auth/apple-native.ts scripts/test-native-apple.ts \
  mobile/ios/App/App/DoryNativePlugin.swift mobile/ios/App/App/App.entitlements \
  mobile/ios/App/App.xcodeproj/project.pbxproj
git diff --cached --check
git commit -m "feat: add native Apple authentication bridge"
```

---

### Task 3: Exchange Apple credentials and provision profiles

**Files:**
- Create: `components/auth/apple-sign-in-button.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Create: `app/api/auth/apple/profile/route.ts`
- Modify: `lib/push/types.ts`
- Modify: `scripts/test-native-apple.ts`

**Interfaces:**
- Consumes: `signInWithNativeApple`, `sha256Hex`, and a browser Supabase client.
- Produces: `POST /api/auth/apple/profile` returning `{ ok: true, username }` for an authenticated Apple user.

- [ ] **Step 1: Extend the failing test for profile payloads**

Add a pure helper `profileInsertForAppleUser(userId)` to the planned module and
assert:

```ts
assert.deepEqual(
  profileInsertForAppleUser("7a20f0f2-32ea-4055-9b68-58d368913c8c"),
  {
    id: "7a20f0f2-32ea-4055-9b68-58d368913c8c",
    username: "apple_7a20f0f232ea40559b6858d368913c8c",
  },
);
```

Run: `pnpm exec tsx scripts/test-native-apple.ts`

Expected: failure because `profileInsertForAppleUser` is not exported.

- [ ] **Step 2: Implement the provisioning route**

`POST /api/auth/apple/profile` uses `createClient()` from
`@/lib/supabase/server`, calls `auth.getUser()`, returns 401 without a user, checks
for an existing profile, and inserts `profileInsertForAppleUser(user.id)` only
when missing. A uniqueness conflict is re-read before returning an error.

- [ ] **Step 3: Implement the login button**

The client component:

1. returns `null` when `isNativeAppleAvailable()` is false;
2. generates a raw nonce and its SHA-256 hex digest;
3. calls native Apple authorization with the digest;
4. calls `supabase.auth.signInWithIdToken({ provider: "apple", token, nonce })`;
5. stores available first-sign-in names with `auth.updateUser`;
6. POSTs `/api/auth/apple/profile`;
7. signs out if provisioning fails; and
8. navigates with `router.replace("/library")` and `router.refresh()`.

Render the Apple button below an `or` separator in the existing login form.

- [ ] **Step 4: Verify the web boundary**

Run:

```bash
pnpm exec tsx scripts/test-native-apple.ts
pnpm exec eslint components/auth/apple-sign-in-button.tsx \
  'app/(auth)/login/page.tsx' app/api/auth/apple/profile/route.ts lib/auth/apple-native.ts
pnpm typecheck
pnpm build
```

Expected: all commands exit 0; normal web login remains rendered in the build.

- [ ] **Step 5: Commit the complete web flow**

```bash
git add components/auth/apple-sign-in-button.tsx 'app/(auth)/login/page.tsx' \
  app/api/auth/apple/profile/route.ts lib/auth/apple-native.ts lib/push/types.ts \
  scripts/test-native-apple.ts
git diff --cached --check
git commit -m "feat: sign in with Apple through Supabase"
```

---

### Task 4: Configure Apple and Supabase, then perform an on-device auth check

**Files:**
- Modify: none in the repository unless Xcode refreshes signing metadata.

**Interfaces:**
- Consumes: Apple App ID `com.learndory.app`, Supabase project `tmqgknkshpkxojvdhejq`.
- Produces: an enabled Apple provider and a signed development build capable of native authorization.

- [ ] **Step 1: Enable the Apple capability**

In Apple Developer Certificates, Identifiers & Profiles, edit the App ID
`com.learndory.app`, enable Sign in with Apple as the primary App ID, save, and
verify the capability remains shown after reload.

- [ ] **Step 2: Enable the Supabase provider**

In Supabase Authentication → Providers → Apple, enable the provider and include
`com.learndory.app` as an accepted client ID. Leave server-to-server notification
URL blank. Save and verify the provider remains enabled after reload.

- [ ] **Step 3: Refresh automatic signing and install**

Run:

```bash
cd mobile
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'id=00008120-001409341EF1A01E' \
  -allowProvisioningUpdates build
```

Expected: Xcode obtains a profile containing the Apple entitlement and builds for
David's connected iPhone.

- [ ] **Step 4: Verify native authorization**

Install and launch the app, tap Sign in with Apple, complete the Apple sheet, and
verify `/library` loads. Confirm Supabase has both an Auth user identity with
provider `apple` and one matching `profiles` row. Log out and sign in again to
confirm the profile route is idempotent.

- [ ] **Step 5: Record verified state**

Update the Sign in with Apple line in `DIRECTIVE.md` only after the device flow
passes. Do not mark the physical-device section complete yet.
