# Dory Mobile (iOS)

Capacitor 8 shell wrapping the live Dory web app for the App Store.

- **App ID:** `com.learndory.app`
- **Web content:** loaded remotely from prod (`server.url` in `capacitor.config.json`).
  There is no local bundle beyond the placeholder in `www/`.
- **Standalone npm package** (not part of the pnpm workspace) because Capacitor CLI
  manages its own native project sync.

## Build

```bash
npm install
npx cap sync ios
npm run build:sim         # simulator build via xcodebuild
npm run open              # open in Xcode
```

Verified: builds with Xcode 26.5 and renders the live app in the iOS Simulator
(spike from 2026-08-22, promoted into the repo).

## App Store readiness gaps (tracked in docs/APP-STORE-PLAN.md)

Apple guideline 4.2 rejects thin web wrappers. Before submission this shell needs
native value: offline study cache, native push, haptics on grade buttons, StoreKit
subscription, and Sign in with Apple.
