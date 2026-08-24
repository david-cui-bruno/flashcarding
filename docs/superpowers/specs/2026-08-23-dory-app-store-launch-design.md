# Dory App Store Launch Design

## Objective

Finish the remaining work in `DIRECTIVE.md` and submit Dory for iOS review with
native authentication, native subscriptions, offline study, haptics, native
reminders, truthful store metadata, and a reproducible release process.

The shipped product remains Dory. Existing infrastructure keeps its legacy
`cardstock` and `carding` names.

## Scope

This launch program is split into independently verifiable stages:

1. Preserve the deployed RevenueCat work in source control.
2. Add native Sign in with Apple and provision a Dory profile for Apple users.
3. Add an APNs delivery path for the existing reminder feature.
4. Add the public marketing page and prepare App Store metadata.
5. Verify the app on a physical iPhone and generate real simulator screenshots.
6. Configure the signed-in Apple, Supabase, Vercel, and domain consoles.
7. Archive, upload, distribute through TestFlight, and submit for App Review.
8. Update all current-state documentation.

Banking details, tax answers, legal attestations, Apple multi-factor challenges,
and subjective physical-device observations must come from the account holder.
Automation may navigate and fill known non-sensitive values, but it must pause at
those exact inputs rather than invent them.

## Source-Control Strategy

All launch work lives on `codex/dory-app-store-launch`, created from `main` while
preserving the already-deployed RevenueCat working tree. Changes are committed in
reviewable stages. The final pull request targets `main` and is merged only after
the complete verification suite passes.

The first implementation commit contains the RevenueCat work already deployed to
production. Later commits isolate Apple authentication, APNs, marketing/assets,
and release documentation.

## Native Sign in with Apple

### User experience

The login page keeps username/password login and adds a standards-compliant
“Sign in with Apple” option when the page is running inside the native iOS shell.
Web users do not see a button that cannot complete a native authorization flow.
Cancellation leaves the user on the login page; all other errors produce a short,
actionable message without exposing tokens or Apple identifiers.

### Native bridge

A focused Capacitor plugin named `DoryNative` is implemented in Swift with
Apple's `AuthenticationServices` framework. Its `signInWithApple` method:

- accepts a SHA-256 nonce supplied by the web client;
- requests email and full name through `ASAuthorizationAppleIDProvider`;
- presents the system authorization controller from the current view controller;
- returns the identity token, Apple user identifier, and first-sign-in name fields;
- maps user cancellation separately from actual failures; and
- never logs credentials or identity tokens.

The web client generates a cryptographically random raw nonce and passes only its
SHA-256 digest to Apple. After native authorization, it calls Supabase
`signInWithIdToken({ provider: "apple", token, nonce: rawNonce })`. This follows
Supabase's native guidance and avoids the six-month Apple OAuth client-secret
rotation required by a web OAuth flow.

### Profile provisioning

Apple authentication can create a Supabase Auth user that has no row in the
existing `profiles` table. A session-authenticated provisioning endpoint creates
that missing profile idempotently with a stable internal username derived from the
user UUID. If Apple supplies a name on first authorization, the client stores it
in Supabase user metadata. Existing profile rows are never overwritten.

Account linking between an existing username account and a new Apple identity is
out of scope for version 1; silently merging identities would risk joining the
wrong study data.

### Apple and Supabase configuration

The App ID `com.learndory.app` gains the Sign in with Apple capability. The iOS
target gains the Sign in with Apple entitlement and uses automatic signing. The
Supabase Apple provider is enabled with the native bundle ID accepted as an ID
token audience. No Apple credential is committed to the repository.

## Native Push Notifications

### Why this is required

The current reminder path is standards-based Web Push. A hosted page inside
Capacitor's WKWebView cannot be treated as a Safari-installed PWA, so App Store
review notes must not claim native reminders until an APNs path exists.

### Client registration

The app adds the official Capacitor 8 `@capacitor/push-notifications` plugin. The
iOS target gains the Push Notifications capability and required delegate hooks.
The Settings reminder controls select the platform transport:

- browser/PWA: keep the existing `PushSubscription` behavior;
- native iOS: request notification permission, register with APNs, and store the
  returned token for the signed-in user.

The `DoryNative` bridge reports whether the current build is `development` or
`production`, so sandbox tokens are never sent to the production APNs endpoint.
Tokens are refreshed whenever APNs registration returns a value and removed when
the user disables reminders or signs out.

### Storage and server delivery

A migration adds `native_push_tokens` with owner-scoped RLS, a unique device token,
the user ID, APNs environment, and timestamps. Generated TypeScript database types
are updated in the same change.

The reminder runner keeps Web Push and adds APNs as a second transport. APNs uses
token authentication over HTTP/2 with sensitive Vercel variables:

- `APNS_AUTH_KEY`
- `APNS_KEY_ID`
- `APPLE_TEAM_ID`
- `APNS_TOPIC=com.learndory.app`

Provider JWTs are short-lived and cached within a warm function. A `410` response
or an unregistered-device reason prunes the token. The daily deduplication marker
is written only when at least one transport accepts a notification. The existing
“only notify when cards are due” rule remains unchanged.

Notification taps navigate to the Dory library, where the user chooses a deck;
the obsolete global `/study` route is not used as the destination.

## Public Marketing Page and Support

The placeholder root page becomes a public, responsive Dory landing page using
the existing cerulean/slate design system and real product UI. It communicates:

- turn documents into grounded, atomic flashcards;
- study with FSRS and Anki-compatible imports;
- study free, with AI generation in Pro;
- Pro pricing of $3.99 monthly or $29.99 annually; and
- privacy, support, login, and account-creation links.

Unauthenticated visitors may view `/`; authenticated users visiting `/` continue
to redirect to `/library`. The marketing page does not make unverified claims
about accuracy, savings, or notification support.

Namecheap forwarding maps `support@learndory.com` to an owner-confirmed inbox.
The destination address is requested at the point it is required and is not stored
in the repository.

## App Store Metadata and Screenshots

Canonical English (U.S.) metadata is stored under `docs/app-store/` so App Store
Connect values are reproducible. It includes name, subtitle, promotional text,
description, keywords, support URL, marketing URL, privacy URL, categories, age
rating rationale, privacy-label answers, TestFlight notes, and App Review notes.

Review Notes explicitly identify native value: offline study and queued sync,
haptics, StoreKit subscriptions through RevenueCat, native Sign in with Apple, and
APNs reminders. They include the existing demo account and concise steps to reach
each feature.

Screenshots are captured from signed release-candidate simulator builds using
seeded demo data. The required primary set targets Apple's current 6.9-inch
portrait size, with an additional accepted 6.1-inch set. Each PNG has no alpha
channel and shows real app UI. The planned sequence is:

1. Deck library with meaningful due counts.
2. AI source capture.
3. Generated-card triage.
4. Focused FSRS study.
5. Learning metrics or Pro plan selection.

No generated mock UI is represented as an in-app screenshot.

## Device Verification

The connected iPhone is built and installed with the development profile after
Apple capabilities are active. Verification records evidence for:

- username login and native Apple login;
- monthly and annual sandbox purchase visibility;
- successful sandbox purchase and restore;
- airplane-mode launch, deck access, study, and later review-outbox replay;
- haptic feedback on grade actions;
- APNs permission, token registration, test delivery, and notification tap; and
- account/session persistence across relaunch.

Automation drives builds, installation, logs, and test sends. The owner confirms
felt haptics, visible notification presentation, and any Apple purchase sheet or
MFA interaction that cannot be observed programmatically.

## Build, TestFlight, and Submission

The Capacitor server URL moves from the legacy Vercel hostname to
`https://learndory.com`, with only the production Dory domains allowed for
navigation. The release build uses version `1.0` and an incremented unique build
number.

Before upload, the release candidate must pass:

- behavior tests for Apple auth helpers, profile provisioning, APNs mapping, and
  reminder transport selection;
- changed-file lint and `git diff --check`;
- `pnpm typecheck`;
- `pnpm build`;
- `npx cap sync ios`;
- an iOS simulator build; and
- an unsigned live webhook check plus the existing authenticated RevenueCat test.

The app is archived for a generic iOS device with automatic signing, validated,
and uploaded to App Store Connect. After Apple finishes processing, the build is
assigned to an internal TestFlight group with beta description and feedback email.
External beta review is optional for this owner-led first pass.

App Store Connect is completed with screenshots, metadata, privacy answers,
subscription associations, export-compliance answers, review contact details, and
the selected build. Submission occurs only after the account holder has supplied
required banking/tax information and confirmed any legal attestations.

## Error Handling and Rollback

- Native Apple cancellation is a neutral result; no error toast is shown.
- A failed Apple token exchange signs out the partial session and leaves existing
  username login usable.
- APNs failures affect only reminders and never block study or purchase flows.
- Bad or expired push tokens are pruned; transient failures remain for retry.
- RevenueCat remains the source of truth for subscription state.
- Every external configuration change is verified in its console before moving on.
- If a production deployment fails its live checks, the last ready Vercel deployment
  remains available for immediate alias rollback.

## Documentation Completion

`DIRECTIVE.md`, `HANDOFF.md`, and `docs/APP-STORE-PLAN.md` are updated from verified
evidence. A directive checkbox is checked only after its live or device-level test
passes. Apple-controlled states such as Small Business approval and App Review
remain explicitly pending until Apple changes them.

## Success Criteria

The launch program is complete when:

- all repository changes are merged to `main` and the matching web build is live;
- native Apple login, purchases/restores, offline study, haptics, and APNs reminders
  are verified on the owner's iPhone;
- App Store metadata and accepted-size screenshots are saved and uploaded;
- a processed build is available to the owner in TestFlight;
- banking/tax and legal forms are complete; and
- version 1.0 is submitted to App Review with no known missing required field.

