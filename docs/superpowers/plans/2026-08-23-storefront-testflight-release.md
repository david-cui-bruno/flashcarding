# Storefront and TestFlight Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Dory's truthful marketing presence, produce accepted App Store assets from real builds, complete account metadata, upload to TestFlight, and submit version 1.0 for review.

**Architecture:** The public Next.js root is the canonical marketing page, repository-backed metadata is the source for App Store Connect, and deterministic simulator capture scripts create real screenshots at accepted Apple dimensions. The release uses automatic Xcode signing and a staged TestFlight-to-review workflow.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Playwright/simulator automation, Xcode 26, App Store Connect, Vercel, Namecheap.

**Spec:** `docs/superpowers/specs/2026-08-23-dory-app-store-launch-design.md`

## Global Constraints

- Pricing remains Free plus Pro at $3.99/month or $29.99/year.
- Marketing claims describe only verified product behavior.
- Screenshots show real Dory UI and contain no alpha channel.
- Primary screenshots use an accepted current 6.9-inch size; the secondary set uses an accepted 6.1-inch size.
- Demo credentials remain `demo` / `password12` and appear only in review metadata, not public marketing copy.
- App submission waits for account-holder banking, tax, legal, and contact confirmations.
- Every repository change ends with verification and a focused commit.

---

### Task 1: Build and test the public marketing page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `lib/supabase/proxy.ts`
- Modify: `scripts/test-proxy-public-paths.ts`
- Create: `components/marketing/product-preview.tsx`
- Create: `app/opengraph-image.tsx`

**Interfaces:**
- Produces: a public `/` route, authenticated redirect from `/` to `/library`, and Open Graph metadata.

- [ ] **Step 1: Add the failing public-root assertion**

Add to `scripts/test-proxy-public-paths.ts`:

```ts
assert.equal(isPublicPath("/"), true);
```

Run: `pnpm exec tsx scripts/test-proxy-public-paths.ts`

Expected: failure because `/` is not public.

- [ ] **Step 2: Make the root public without changing authenticated behavior**

Add `path === "/"` to `isPublicPath`. Keep the existing authenticated redirect in
`updateSession` so authenticated root requests still go to `/library`.

- [ ] **Step 3: Replace the scaffold page**

Build a server-rendered landing page with:

- header: Dory logo, `Log in`, and `Start free`;
- hero: “Remember what you read.” and a concise AI-card/FSRS explanation;
- real product preview composed from existing Dory card/deck visual language;
- three verified features: grounded AI generation, Anki-compatible study, offline review;
- pricing: Free and Pro cards using the confirmed prices;
- final CTA and footer links to privacy, support, login, and signup.

Use existing design tokens from `app/globals.css`; do not add a second theme system.

- [ ] **Step 4: Add metadata and an OG image**

Set site metadata in `app/layout.tsx` for `metadataBase: new URL("https://learndory.com")`,
title template, description, and Open Graph/Twitter cards. Generate a 1200×630
`ImageResponse` with the Dory wordmark, cerulean background, and hero statement.

- [ ] **Step 5: Verify marketing behavior**

Run:

```bash
pnpm exec tsx scripts/test-proxy-public-paths.ts
pnpm exec eslint app/page.tsx app/layout.tsx lib/supabase/proxy.ts \
  components/marketing/product-preview.tsx app/opengraph-image.tsx
pnpm typecheck
pnpm build
```

Start the app on port 3411 and verify with Playwright that `/` returns the hero for
an anonymous context, `/login` remains available, and the demo session reaches
`/library`.

- [ ] **Step 6: Commit the marketing page**

```bash
git add app/page.tsx app/layout.tsx app/opengraph-image.tsx \
  components/marketing/product-preview.tsx lib/supabase/proxy.ts \
  scripts/test-proxy-public-paths.ts
git diff --cached --check
git commit -m "feat: publish Dory marketing page"
```

- [ ] **Step 7: Deploy and verify the combined web candidate**

Run:

```bash
vercel --prod --yes --scope framewise-health
curl -sS -o /dev/null -w '%{http_code}\n' https://learndory.com/
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  https://learndory.com/api/billing/revenuecat \
  -H 'content-type: application/json' \
  --data '{"event":{"app_user_id":"verification-only"}}'
```

Expected: Vercel reports Ready, the public root returns 200, and the unsigned
RevenueCat route returns 401 without redirecting. If either live check fails, keep
the prior Ready deployment aliased to `learndory.com` while correcting the branch.

---

### Task 2: Create canonical App Store metadata

**Files:**
- Create: `docs/app-store/metadata.md`
- Create: `docs/app-store/privacy-label.md`
- Create: `docs/app-store/review-notes.md`

**Interfaces:**
- Produces: exact English (U.S.) strings and answers for App Store Connect and TestFlight.

- [ ] **Step 1: Write metadata with enforced limits**

Use these fixed short fields:

```text
Name: Dory — AI Flashcards
Subtitle: Remember what you read
Primary category: Education
Secondary category: Productivity
Support URL: https://learndory.com/support
Marketing URL: https://learndory.com
Privacy URL: https://learndory.com/privacy
```

Write promotional text, full description, and a comma-separated keyword string
whose UTF-8 byte length is at most 100. The description leads with card generation
and studying, then explains import/offline/privacy and the Free/Pro split.

- [ ] **Step 2: Write privacy-label answers from actual data flow**

Document collection of account identifiers, user content, product interaction,
purchase history, and push tokens. Mark data as linked to identity where the schema
uses `user_id`; declare no tracking, no third-party advertising, and no sale of
data. Record Supabase, Vercel, RevenueCat, and Anthropic purposes without claiming
those vendors are App Store “data types.”

- [ ] **Step 3: Write TestFlight and App Review notes**

Include:

```text
Demo username: demo
Demo password: password12
```

Give numbered routes to offline study, haptics, native Apple login, native
subscriptions/restore, and APNs reminders. State that AI generation requires
network access and Pro. Include contact-field instructions that read
the account holder's existing App Store Connect contact fields at execution time;
do not invent a phone number.

- [ ] **Step 4: Validate field lengths and links**

Run a small Node command that reads the metadata file, asserts name and subtitle
are at most 30 characters, keywords at most 100 UTF-8 bytes, and all three URLs use
`https://learndory.com`.

- [ ] **Step 5: Commit metadata**

```bash
git add docs/app-store
git diff --cached --check
git commit -m "docs: prepare App Store metadata"
```

---

### Task 3: Point the native shell at the production domain and capture screenshots

**Files:**
- Modify: `mobile/capacitor.config.json`
- Create: `scripts/capture-app-store-screenshots.mjs`
- Create: `assets/app-store/README.md`
- Create: generated PNGs under `assets/app-store/iphone-6.9/`
- Create: generated PNGs under `assets/app-store/iphone-6.1/`

**Interfaces:**
- Produces: a shell loading `https://learndory.com` and five PNGs per device class.

- [ ] **Step 1: Update and sync the production URL**

Set:

```json
"server": {
  "url": "https://learndory.com",
  "allowNavigation": ["learndory.com", "www.learndory.com"]
}
```

Run: `cd mobile && npx cap sync ios && npm run build:sim`

Expected: sync and simulator build exit 0.

- [ ] **Step 2: Write the capture script**

The script accepts a simulator UDID and output directory, launches the installed
app with `xcrun simctl launch`, uses `xcrun simctl io <udid> screenshot`, and checks
each PNG with `sips -g pixelWidth -g pixelHeight -g hasAlpha`. It fails unless the
dimensions match the selected accepted size and `hasAlpha` is `no`.

Capture file names in this order:

```text
01-library.png
02-new-deck.png
03-review.png
04-study.png
05-metrics-or-pro.png
```

- [ ] **Step 3: Seed and capture the 6.9-inch set**

Boot the available iPhone 17 Pro Max simulator, install the release-candidate app,
sign in as the demo user, navigate to each planned state, and capture an accepted
portrait dimension reported in Apple's current screenshot specification.

- [ ] **Step 4: Capture the 6.1-inch set**

Boot the available iPhone 17e or another simulator whose native screenshot size is
one of Apple's accepted 6.1-inch portrait dimensions. Repeat the exact five states.

- [ ] **Step 5: Inspect every screenshot**

Open the ten PNGs visually. Reject any image with loading skeletons, private user
data, system alerts, clipped controls, empty decks, debug chrome, or inconsistent
status-bar state. Re-capture rejected images.

- [ ] **Step 6: Commit configuration and assets**

```bash
git add mobile/capacitor.config.json scripts/capture-app-store-screenshots.mjs \
  assets/app-store
git diff --cached --check
git commit -m "feat: prepare App Store screenshots"
```

---

### Task 4: Configure support forwarding and App Store Connect

**Files:**
- Modify: none unless verified values require metadata corrections.

**Interfaces:**
- Consumes: signed-in Namecheap and App Store Connect sessions, owner-confirmed support inbox and legal data.
- Produces: working support forwarding and a complete version 1.0 product page.

- [ ] **Step 1: Configure support forwarding**

In Namecheap Advanced DNS/Email Forwarding, create
`support@learndory.com → <owner-confirmed inbox>`. Send a test message and verify it
arrives before saving the destination as operationally complete.

- [ ] **Step 2: Complete banking and tax with the account holder**

Navigate to Agreements, Tax, and Banking. Fill known organization/account fields
from Apple records. Pause for the account holder to enter bank routing/account
numbers, tax classifications, taxpayer identifiers, certifications, and any legal
signature. Verify the Paid Apps agreement shows no missing banking/tax action.

- [ ] **Step 3: Enter App Store metadata**

Copy the canonical fields from `docs/app-store/metadata.md`, upload the 6.9-inch
screenshots, and upload the 6.1-inch set through Media Manager. Set privacy and
support URLs, categories, copyright, age rating, and content-rights answers.

- [ ] **Step 4: Complete App Privacy**

Enter the data types and purposes exactly from `privacy-label.md`. Confirm “Data
Used to Track You” remains empty and the public privacy URL resolves with HTTP 200.

- [ ] **Step 5: Associate subscriptions and review information**

Attach the monthly and annual Dory Pro subscriptions to version 1.0 if App Store
Connect requests association. Enter review notes and contact details, select manual
release, and save without submitting until a processed build exists.

---

### Task 5: Build, verify, and upload version 1.0

**Files:**
- Modify: `mobile/ios/App/App.xcodeproj/project.pbxproj`
- Create: `mobile/ExportOptions.plist`

**Interfaces:**
- Produces: a validated App Store archive with `MARKETING_VERSION=1.0` and a unique build number.

- [ ] **Step 1: Set release identity**

Keep `MARKETING_VERSION = 1.0`; set `CURRENT_PROJECT_VERSION` to the next unused
integer shown in App Store Connect. Ensure Release uses automatic signing and the
correct developer team.

- [ ] **Step 2: Run the complete release verification suite**

Run:

```bash
pnpm exec tsx scripts/test-proxy-public-paths.ts
pnpm exec tsx scripts/test-entitlements.ts
pnpm exec tsx scripts/test-revenuecat.ts
pnpm exec tsx scripts/test-native-apple.ts
pnpm exec tsx scripts/test-native-push.ts
pnpm typecheck
pnpm build
cd mobile && npx cap sync ios && npm run build:sim
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Complete the physical-device release pass**

On the connected iPhone verify Apple login, monthly/annual offerings, sandbox
purchase, restore, offline launch/study/outbox replay, grade haptics, APNs test and
tap routing, and relaunch persistence. Record the account holder's confirmation of
physical haptics and notification presentation.

- [ ] **Step 4: Archive**

Run:

```bash
xcodebuild -project mobile/ios/App/App.xcodeproj -scheme App \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$PWD/mobile/output/Dory.xcarchive" \
  -allowProvisioningUpdates clean archive
```

Expected: `** ARCHIVE SUCCEEDED **` and the archive contains bundle ID
`com.learndory.app`, both entitlements, version 1.0, and the selected build number.

- [ ] **Step 5: Validate and upload**

Create `mobile/ExportOptions.plist` with method `app-store-connect`, automatic
signing, upload enabled, and symbol upload enabled. Export/upload with:

```bash
xcodebuild -exportArchive \
  -archivePath "$PWD/mobile/output/Dory.xcarchive" \
  -exportPath "$PWD/mobile/output/export" \
  -exportOptionsPlist "$PWD/mobile/ExportOptions.plist" \
  -allowProvisioningUpdates
```

Expected: upload success from Apple and a delivery record in App Store Connect.

- [ ] **Step 6: Commit release configuration**

```bash
git add mobile/ios/App/App.xcodeproj/project.pbxproj mobile/ExportOptions.plist
git diff --cached --check
git commit -m "chore: prepare Dory 1.0 release"
```

---

### Task 6: TestFlight, submission, documentation, and merge

**Files:**
- Modify: `/Users/davidcui824/Downloads/DIRECTIVE.md`
- Modify: `HANDOFF.md`
- Modify: `docs/APP-STORE-PLAN.md`

**Interfaces:**
- Consumes: processed App Store Connect build and all verification evidence.
- Produces: owner-accessible TestFlight build, submitted App Review version, current docs, and merged source.

- [ ] **Step 1: Complete build processing questions**

When Apple processing finishes, answer export-compliance questions truthfully for
the app's HTTPS usage and select the processed build for version 1.0.

- [ ] **Step 2: Enable internal TestFlight**

Enter beta description and feedback email, create an internal group named `Dory
Internal`, add the account holder, attach the build, and verify the build is
installable from TestFlight on the owner's iPhone.

- [ ] **Step 3: Submit version 1.0**

Resolve every App Store Connect warning. Add the build, subscriptions, screenshots,
privacy information, and review details to the submission. Present the final legal
submission confirmation to the account holder, then submit after confirmation.

- [ ] **Step 4: Update documentation from evidence**

Correct stale domain/mobile statements in `HANDOFF.md` and stale statuses in
`docs/APP-STORE-PLAN.md`. Check directive items only for device tests, TestFlight,
bank/tax, and submission states that actually passed. Keep Apple-controlled review
and Small Business states pending when applicable.

- [ ] **Step 5: Final repository verification**

Run the complete release suite from Task 5 Step 2 plus `git status --short` and
`git log --oneline origin/main..HEAD`. Confirm no secret, `.p8`, provisioning
profile, bank data, tax data, or personal contact information is staged.

- [ ] **Step 6: Commit documentation**

```bash
git add HANDOFF.md docs/APP-STORE-PLAN.md
git diff --cached --check
git commit -m "docs: record Dory App Store release state"
```

`DIRECTIVE.md` lives outside the repository; update it separately and verify its
checkboxes directly.

- [ ] **Step 7: Push, open, review, and merge the pull request**

```bash
git push -u origin codex/dory-app-store-launch
gh pr create --base main --head codex/dory-app-store-launch \
  --title "Ship Dory 1.0 for iOS" \
  --body-file docs/app-store/review-notes.md
gh pr checks --watch
gh pr merge --merge
```

Expected: required checks pass, the PR merges to `main`, and production is deployed
from the merged source if the final merged tree differs from the verified launch
deployment.
