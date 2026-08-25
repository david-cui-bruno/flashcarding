# DIRECTIVE — Critical Path to App Store Submission

_Supersedes the "Remaining work" section of DIRECTIVE.md. Updated 2026-08-25 after
the design-system + integrations ship. Everything below the line is ordered by
dependency: each step unlocks the next. Owner steps are marked 👤; agent steps 🤖._

## Current state (all verified live)

learndory.com serves the app with the locked design system (Schibsted Grotesk +
Switzer 200 numbers, A2 home, F study). Offline study, Pro entitlements +
RevenueCat webhook, Quizlet import, and AnkiConnect sync v1 (`pnpm sync:anki`,
merged via PR #29) are shipped. iOS shell builds; a TestFlight build exists with
testers invited. Pricing locked: $2.99/mo, $19.99/yr.

## Critical path (in order)

### 1. 👤 App Store Connect: subscription products  ~20 min · UNLOCKS 2,3
In App Store Connect → Dory app → Subscriptions:
- Create group "Dory Pro"
- Add auto-renewable products:
  - `dory_pro_monthly` — $2.99/mo
  - `dory_pro_yearly` — $19.99/yr
- Localized display name/description; attach both to the group
- Also: Users & Access → Agreements: ensure Paid Apps agreement is signed
- Then: enroll in the Small Business Program (15% commission)
Agent can drive the browser with you; the Apple login/MFA is yours.

### 2. 🤖 RevenueCat wiring  ~half day · needs 1
- RevenueCat project + entitlement id `pro`, attach both products
- `REVENUECAT_WEBHOOK_SECRET` in Vercel env; webhook →
  `POST https://learndory.com/api/billing/revenuecat` (handler already live,
  secret-gated, proxy-exempted)
- Capacitor RevenueCat SDK in `mobile/`; `app_user_id` = Supabase user id
- Paywall UI on the PRO_REQUIRED error (design per mockup 06 with locked type)

### 3. 🤖 Sign in with Apple  ~half day · parallel with 2
- Enable capability on `com.learndory.app` in Xcode + Apple provider in
  Supabase Auth; button on welcome/login per mockup 01
- Required by Apple because third-party login exists

### 4. 👤+🤖 Real-device pass  ~30 min of owner time · needs current TestFlight
On the owner's iPhone via TestFlight:
- Airplane mode → open app → study a cached deck → reconnect → verify reviews
  sync (the ONLY unverified guideline-4.2 claim; everything else is proven)
- Feel check: haptics on grades, edge-to-edge safe areas, fonts
Agent preps a fresh build first if 5 has landed by then.

### 5. 🤖 App-mode chrome (native feel)  ~1 day · parallel with 2/3
- In-shell (`.native-app`): hide web chrome, tab bar per locked system
  (Decks · Stats · + · Review · Profile), welcome + 3-swipe onboarding
  (mockups 01/02 in locked type)
- Then rebuild shell + new TestFlight upload for step 4

### 6. 🤖 Store assets  ~half day · needs 5 for screenshots
- 6.7" + 6.1" screenshots from the app-mode build
- Description/keywords: "Anki with AI" positioning, import hooks
  (.apkg, Quizlet, AnkiConnect), $19.99/yr < AnkiMobile's one-time price
- Review Notes preempting 4.2: offline study, haptics, push, native IAP,
  demo account `demo` / `password12`

### 7. 👤+🤖 Submit  · needs all above
- TestFlight external beta (optional but wise: 1 week)
- Submit for review; expect one 4.2 conversation, answer with the native
  feature list

## Not on the critical path (do anytime / after launch)
- support@learndory.com forward (👤 Namecheap login, 30 s)
- Anki sync v2: media, revlog import, deletions, two-way merge, menu-bar daemon
- Quizlet share-link best-effort fetch
- Android (Capacitor makes it cheap later)
- Reading-mode study theme (mockup H) as a premium delighter

## The one-line version
**Owner does App Store Connect subscriptions (1) and a phone test (4); agent
does everything else (2, 3, 5, 6); then submit (7).**
