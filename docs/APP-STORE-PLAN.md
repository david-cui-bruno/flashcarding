# Dory — App Store Productization Plan

_Living doc. Created 2026-08-23. Captures the strategy for shipping Dory as a paid
iOS App Store app. See `HANDOFF.md` for current infra state and `mobile/` for the
Capacitor shell._

## Positioning

**"Anki with AI, without the $25 sticker shock."**

- The wedge is the existing product thesis: AI generates high-quality atomic cards
  (see `docs/CARD-QUALITY.md`), FSRS schedules them. Nobody wants to hand-write cards.
- `.apkg` import (already shipped) makes switching from Anki painless. That is the
  moat-crossing feature: Anki users keep their decks and history investment.
- "Cheaper than AnkiMobile" is the tiebreaker, not the headline. Anki desktop is
  free, so the comparison targets AnkiMobile buyers ($24.99 one-time, verified
  2026) and people who bounced off Anki's complexity.
- Secondary competitor: Knowt Ultra (~$149.99/yr, verified 2026). Dory undercuts
  massively.

## Pricing (proposed, NOT final — owner decision pending)

AI inference costs scale per user, so a one-time price below $24.99 loses money on
heavy users. Proposed model:

| Tier | Price | Gets |
|---|---|---|
| Free | $0 | Unlimited study + FSRS + `.apkg`/CSV import |
| Pro | ~$3.99/mo or ~$29.99/yr | AI card generation, taste-feedback loop |

- Apple takes 15% (Small Business Program, under $1M/yr) — enroll after developer
  account exists.
- Implementation: StoreKit 2 direct or RevenueCat. Gate = server-side check on
  generation endpoints (entitlement in Supabase `profiles`), not client-side.

## App Store requirements checklist

| Item | Status | Notes |
|---|---|---|
| Capacitor iOS shell | ✅ builds + renders prod in Simulator | `mobile/`, app ID `com.learndory.app` |
| Apple Developer account | ❌ | $99/yr, ~2 day approval. Longest lead time — start first. |
| Guideline 4.2 (no thin wrappers) | ❌ | Needs native value: offline study cache, native push, haptics, StoreKit |
| Sign in with Apple | ❌ | Mandatory because app has third-party login (Supabase auth) |
| In-app purchase | ❌ | Digital goods must use IAP; no external payment links |
| Privacy policy + nutrition label | ❌ | Needs a URL; declare data collection (auth, study data, uploaded docs) |
| `learndory.com` domain | ❌ not registered | Wanted for marketing page + privacy policy + support URL |
| App Store assets | ❌ | Screenshots (6.7"/6.1"), description, keywords. Icon exists (`assets/`) |

## Guideline 4.2 mitigation (native value in the shell)

Minimum credible set, roughly in build order:

1. **Offline study**: cache due-card queue + review logging when offline, sync on
   reconnect. Biggest real user value (study on subway). Largest work item.
2. **Native push** via APNs (replace/augment web push for the wrapped app).
3. **Haptics** on grade buttons (trivial via Capacitor Haptics plugin).
4. **StoreKit subscription** (required for monetization anyway).
5. Sign in with Apple (required anyway).

## Sequence

1. Enroll Apple Developer Program (owner action: Apple ID + $99 + DUNS not needed
   for individual).
2. Register `learndory.com`; static marketing + privacy page.
3. Native-value work in `mobile/` (list above).
4. Subscription entitlement in Supabase + server-side gating of `/api/generate*`.
5. TestFlight beta (internal, then external).
6. App Store review submission. Expect one 4.2 pushback cycle; have the native
   feature list ready in Review Notes.

## Open decisions (owner)

- [ ] Pricing: confirm free/Pro split and price points.
- [ ] RevenueCat vs raw StoreKit 2.
- [ ] Offline scope for v1 (read-only cram vs full due-queue sync).
- [ ] Android later? Capacitor makes it cheap, but App Store first.
