# DIRECTIVE — Ship Dory to the App Store

_Standing directive for any agent or session working on Dory. Created 2026-08-23.
Read HANDOFF.md for infra state and docs/APP-STORE-PLAN.md for strategy detail.
Update this file as items complete._

## Mission

Ship Dory to the iOS App Store as "Anki with AI, cheaper than AnkiMobile."
Free tier: unlimited study, FSRS, and Anki `.apkg` import. Pro ($2.99/mo or
$19.99/yr): AI card generation. Do not drift from the card-quality thesis
(docs/CARD-QUALITY.md is the keystone).

## Current state (verified 2026-08-23)

| Item | State |
|---|---|
| Web app | Live at https://learndory.com (Vercel project `cardstock`, SSL, www redirect) |
| iOS shell | `mobile/` Capacitor 8, `com.learndory.app`, builds + renders prod in Simulator |
| Offline study | Shipped: IndexedDB cache + review outbox, E2E-verified in Chromium |
| Entitlements | Shipped: `profiles.plan`, server-side `requirePro()` on generation, RevenueCat webhook stub at `/api/billing/revenuecat` |
| Privacy/support | Live: learndory.com/privacy, learndory.com/support |
| Haptics | Shipped (Capacitor Haptics + Vibration fallback) |
| Reminder cron | GitHub Actions hourly (`.github/workflows/reminder-cron.yml`, CRON_SECRET secret) |
| Apple Developer | Owner HAS an account. App Store Connect record + TestFlight build EXIST (owner invited testers 2026-08-24) |
| iOS mockups | `docs/design/app-mockups/` — 6 pages; owner reviewing direction (feels-like-website feedback led to native app-mode plan) |
| App-mode foundation | Shipped: `lib/native.ts`, `native-app` html class, edge-to-edge shell (contentInset never) |
| Billing webhook | `/api/billing/*` exempted from session proxy (was 307-blocked); returns 401 without secret |
| Domain email | NOT set up: add Namecheap forward support@learndory.com → owner inbox |

## Remaining work, in order

0. **App-mode UI** (BLOCKED on owner approving `docs/design/app-mockups/` direction)
   - Native tab bar (Decks / Stats / + / Review / Profile), welcome+onboarding
     flow, study screens per mockups — rendered by the web app under the
     `.native-app` class, served to the shell
1. **App Store Connect subscriptions** (app record + TestFlight already exist)
   - Create auto-renewable subscription group "Dory Pro": $2.99/mo + $19.99/yr
   - Enroll in the Small Business Program (15% cut)
2. **RevenueCat wiring**
   - Create RevenueCat project, entitlement id `pro`, attach both products
   - Set `REVENUECAT_WEBHOOK_SECRET` in Vercel env, point webhook at
     `POST https://learndory.com/api/billing/revenuecat`
   - Add RevenueCat Capacitor SDK to `mobile/`, use Supabase auth user id as
     `app_user_id`, add paywall UI on the PRO_REQUIRED error
3. **Sign in with Apple** (required: app has third-party login)
   - Supabase Auth supports it; add capability in Xcode + Apple provider in Supabase
4. **Real-device pass** (owner's iPhone)
   - Airplane-mode offline study in the WKWebView shell (the one unverified gap)
   - Haptics feel check, push notification test
5. **Store assets**
   - Screenshots 6.7" + 6.1", app description, keywords, marketing page on learndory.com
6. **TestFlight beta → submission**
   - In Review Notes, preempt guideline 4.2: list offline study, haptics, push,
     native IAP. Demo account: `demo` / `password12`

## Rules

- Brand is Dory; infra keeps legacy names (cardstock/carding). Do not rename infra.
- Deploy = `vercel --prod --yes --scope framewise-health` from repo root. Not git-connected.
- PRs to `main` via `gh pr merge --merge`. Never check out the GitHub default branch.
- Server-side gating only for Pro; never trust the client with plan state.
- Verify with evidence before claiming done: typecheck, build, and a live check.
