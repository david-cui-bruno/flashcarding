# Design Refinement Tasks

Generated from `docs/VISUAL-POLISH-AUDIT.md`. Items are grouped by mockup and ordered high → medium → low within each group. Implement high-severity items before shipping any screen to production.

---

## mobile-home.html

### High priority

- [ ] **[T-MH-1]** Set `body { line-height: 1.5; }` — current 1.4 fails the ≥ 1.5 requirement for body copy.
- [ ] **[C-MH-1]** Change `.tab-label` color from `#999` to `#6b6b6b` or darker — `#999` on white is 2.8:1, fails WCAG AA. Target ≥ 4.5:1.
- [ ] **[C-MH-3]** Change `.text-muted` / `.collection-meta` color from `#999` to a value passing 4.5:1 on `#f9f9f8` — use `#6b6b6b` at minimum.
- [ ] **[D-MH-1]** Increase `.nav-icon-btn` to `width: 44px; height: 44px` to meet the minimum mobile touch target.
- [ ] **[D-MH-2]** Give each `.tab-item` a minimum height of `44px` — pad or adjust icon + label sizing.
- [ ] **[D-MH-3]** Increase `.today-cta` to at least `44px` height by changing padding to `12px 24px`.
- [ ] **[F-MH-1]** Add `font-variant-numeric: tabular-nums` to `.today-count`.
- [ ] **[F-MH-4]** Replace fixed `padding-bottom: 20px` on `.tab-bar` with `padding-bottom: max(20px, env(safe-area-inset-bottom))`.
- [ ] **[F-MH-5]** Add a global `:focus-visible` ring: `:focus-visible { outline: 2px solid var(--sage); outline-offset: 2px; }` — propagates to all interactive elements.
- [ ] **[I-MH-1]** Add `:hover { background: rgba(0,0,0,0.05); }`, `:active { background: rgba(0,0,0,0.1); }`, and `transition: background 150ms ease` to `.nav-icon-btn`.
- [ ] **[I-MH-2]** Add `transition: background 150ms ease, transform 100ms ease` and `:active { transform: scale(0.97); }` to `.today-cta`.
- [ ] **[I-MH-4]** Add `transition: box-shadow 150ms ease, transform 100ms ease` and `:active { transform: scale(0.95); }` to `.fab`.

### Medium priority

- [ ] **[S-MH-2 + S-MH-3]** Reconcile horizontal rhythm: either give `.today-card` a `margin: 16px` and use `padding: 24px 16px` inside (so card content starts at 32 px from the left edge, same as a full-bleed card), or change the streak row and section titles to also use `padding-left: 36px` to align with card body text. Pick one system and apply it everywhere.
- [ ] **[T-MH-2]** Add `letter-spacing: -0.02em` to `.nav-logo`.
- [ ] **[T-MH-3]** Add `letter-spacing: -0.01em` to `.section-title`.
- [ ] **[T-MH-4]** Set `line-height: 1.5` on `.today-sub`.
- [ ] **[T-MH-5]** Set `line-height: 1.5` on `.collection-name`.
- [ ] **[C-MH-2]** Replace `--border: #e4e4e4` with a sage-tinted neutral, e.g., `#e2e7e2`.
- [ ] **[C-MH-4]** Audit active tab label color — `var(--sage)` (#7c9a7e) on white is 3.0:1; either darken the active color to `var(--sage-mid)` (#5a7d5c) or bold the label to pass 3:1 for large text.
- [ ] **[D-MH-4]** Standardize all SVG stroke widths to `1.5` — change `.collection-icon svg { stroke-width: 1.5; }` to match nav icons.
- [ ] **[F-MH-2]** Add `font-variant-numeric: tabular-nums` to `.streak-chip strong`.
- [ ] **[F-MH-3]** Add `font-variant-numeric: tabular-nums` to `.collection-due`.
- [ ] **[I-MH-3]** Add `transition: background 150ms ease` and `:hover { background: var(--surface-2, #f5f5f5); }` to `.collection-card`.
- [ ] **[I-MH-5]** Define disabled-state styles: `[disabled] { opacity: 0.45; cursor: not-allowed; pointer-events: none; }`.

### Low priority

- [ ] **[S-MH-4]** Change `.collection-list` gap from `10px` to `8px` or `12px` to stay on the 4 px grid.
- [ ] **[S-MH-5]** Align `.section-title` padding to a deliberate asymmetric value on the grid (e.g., `padding: 24px 16px 12px`).
- [ ] **[S-MH-6]** Replace the magic-number `calc(60px + 24px)` on `.fab` with a CSS custom property `--tab-bar-height: 60px`.
- [ ] **[D-MH-5]** Increase the SVG icon inside `.collection-icon` from `18px` to `20px` for a ~50% fill ratio against the 40 px container.
- [ ] **[T-MH-6]** Set `line-height: 1.5` on `.collection-meta`.

---

## mobile-study.html

### High priority

- [ ] **[T-MS-5]** Increase `.grade-label` font-size from `10px` to `11px` minimum.
- [ ] **[C-MS-1]** Darken `.card-face-label` from `#999` to `#6b6b6b` — current ratio 2.8:1 fails WCAG AA.
- [ ] **[C-MS-2]** Darken `.flip-hint` from `#999` to `#6b6b6b` — same contrast failure.
- [ ] **[C-MS-3]** Darken `.interval-hint` from `#999` to `#6b6b6b`.
- [ ] **[D-MS-1]** Increase `.back-btn` to `44px × 44px` — use negative margin or transparent padding to expand the hit area without changing visual size.
- [ ] **[F-MS-1]** Add `font-variant-numeric: tabular-nums` to `.study-progress-text`.
- [ ] **[F-MS-4]** Add global `:focus-visible` ring (same as mobile-home task F-MH-5; apply once in shared CSS).
- [ ] **[F-MS-5]** Add `pointer-events: none` to `.grade-btn:disabled` in addition to `opacity: 0.4` to prevent double-submission.
- [ ] **[I-MS-2]** Add `transition: background 150ms ease` and `:hover { background: #333; }` and `:active { transform: scale(0.98); }` to `.show-answer-btn`.
- [ ] **[I-MS-3]** Add `transition: background 150ms ease, border-color 150ms ease, transform 100ms ease` and `:active { transform: scale(0.96); }` to `.grade-btn`.

### Medium priority

- [ ] **[S-MS-2]** Add a visible separation between the interval hint row and the grade button row — either `gap: 4px` between them inside a column-direction wrapper, or a `margin-bottom: 4px` on `.interval-row`.
- [ ] **[S-MS-4]** Add `padding-bottom: 32px` (or more) to `.card-area` or `.bottom-pad` so content is not flush with the viewport on small screens.
- [ ] **[T-MS-1]** Add `letter-spacing: -0.01em` to `.study-title`.
- [ ] **[T-MS-2]** Add `letter-spacing: -0.02em` to `.card-term`.
- [ ] **[D-MS-2]** Increase `.grade-btn` padding to `12px 4px` to bring height to ~44px; on narrow screens add `min-height: 44px`.
- [ ] **[D-MS-4]** Add `padding-top: 32px` to `.flashcard` content area so body text cannot collide with the absolutely-positioned `.card-face-label`.
- [ ] **[D-MS-5]** Add `min-width: 0` and `overflow: hidden` safeguards on grade button columns; consider `min-height: 44px` on `.grade-btn`.
- [ ] **[F-MS-3]** Animate the card answer reveal — wrap the answer section in a container with `opacity: 0; transition: opacity 200ms ease` and set `opacity: 1` when `shown` becomes true.
- [ ] **[F-MS-6]** Add `aria-describedby` linking each `.grade-btn` to its corresponding `.interval-hint` so screen-reader users hear the scheduled interval.
- [ ] **[I-MS-1]** Add `:hover { background: rgba(0,0,0,0.04); }` and `transition: background 150ms ease` to `.back-btn`.
- [ ] **[I-MS-4]** Add `cursor: not-allowed; pointer-events: none` to `.grade-btn:disabled`.
- [ ] **[I-MS-5]** Add `transition: width 300ms ease` to `.progress-fill` so progress animates between cards.

### Low priority

- [ ] **[S-MS-1]** Align `.study-header` vertical padding to `16px` to match `.card-area`, or align `.card-area` to `12px` — pick one and document it as the surface padding token.
- [ ] **[S-MS-3]** Change `.card-source` `bottom: 14px` to `bottom: 12px` or `bottom: 16px` to stay on the 4 px grid.
- [ ] **[T-MS-3]** Set `line-height: 1.5` on `.card-source`.
- [ ] **[T-MS-4]** Add `letter-spacing: 0.01em` to `.show-answer-btn`.
- [ ] **[C-MS-4]** Replace the hard-coded `#c8deca` border on `.source-panel` with a design token — add `--sage-border: #c8deca` to `:root`.
- [ ] **[C-MS-5]** Change `.progress-track` background from pure `#e4e4e4` to the sage-tinted border token (`#e2e7e2`).
- [ ] **[D-MS-3]** Standardize stroke-width: change `.back-btn svg { stroke-width: 1.5; }` to match the icon system.
- [ ] **[F-MS-2]** Add `font-variant-numeric: tabular-nums` to `.grade-num`.

---

## web-home-a.html

### High priority

- [ ] **[C-WA-1]** Darken `.th` table header text from `#888` to `#5e5e5e` — `#888` on `#f0f0ee` is 3.5:1, fails AA. Target ≥ 4.5:1.
- [ ] **[C-WA-2]** Darken `--text-muted` from `#888` to `#5e5e5e` across the board — used in stat labels, today-sub, streak-label, all failing 4.5:1 on white.
- [ ] **[C-WA-6]** Darken sidebar active item text from `var(--sage-mid)` (#5a7d5c) to `#3d5e3f` or similar so text on `#edf3ee` exceeds 4.5:1 (current ≈ 3.8:1).
- [ ] **[D-WA-2]** Increase `.row-study-btn` to at least `32px` height (padding `8px 12px`) for desktop; `36px` preferred.
- [ ] **[F-WA-1]** Add `font-variant-numeric: tabular-nums` to `.today-big`.
- [ ] **[F-WA-2]** Add `font-variant-numeric: tabular-nums` to `.stat-value`.
- [ ] **[F-WA-3]** Add `font-variant-numeric: tabular-nums` to `.row-num` and `.row-due`.
- [ ] **[F-WA-6]** Add global `:focus-visible` ring (share with mobile definitions in a design-system base stylesheet).
- [ ] **[I-WA-2]** Add `:hover { background: #333; }`, `transition: background 150ms ease`, and `:focus-visible` ring to `.nav-btn`.
- [ ] **[I-WA-5]** Add `transition: background 150ms ease` and `:hover { background: var(--sage-mid); }` and `:active { transform: scale(0.98); }` to `.study-now-btn`.
- [ ] **[I-WA-7]** Set a shared transition standard: `transition: all 150ms ease` (or specific properties) as a comment/variable in the stylesheet, and apply to all interactive elements.

### Medium priority

- [ ] **[S-WA-2]** Unify horizontal rhythm: either bump sidebar item padding to `8px 32px` to match main's `32px` baseline, or reduce main padding to `24px`. Document the chosen value as `--panel-x: 24px`.
- [ ] **[S-WA-4]** Change `.table-head` padding from `10px 20px` to `12px 20px` to match the 4 px grid and reduce the gap between header and first row.
- [ ] **[T-WA-1]** Add `letter-spacing: -0.02em` to `.section-h1`.
- [ ] **[T-WA-2]** Add `letter-spacing: -0.02em` to `.nav-logo`.
- [ ] **[C-WA-3]** Replace `--border: #e5e5e5` with a sage-tinted neutral `#e2e7e2`.
- [ ] **[C-WA-4]** Replace `--surface-2: #f0f0ee` with `#edf3ee` (the existing `--sage-light` token) for consistent panel tinting.
- [ ] **[D-WA-1]** Increase `.nav-btn` to `40px` height: `padding: 9px 16px`.
- [ ] **[D-WA-3]** Unify sidebar icon size to `18px` to match mobile collection icons.
- [ ] **[D-WA-5]** Add `title` attributes to each heatmap cell containing the day's date and count (e.g., `title="Jun 10 — 42 cards reviewed"`); add a screen-reader-only summary.
- [ ] **[F-WA-4]** Add `font-variant-numeric: tabular-nums` to `.streak-num`.
- [ ] **[F-WA-5]** Add `font-variant-numeric: tabular-nums` to `.sidebar-item .badge`.
- [ ] **[F-WA-7]** Add `role="img"` and `aria-label` to the heatmap container describing the overall data (e.g., "Activity heatmap: 13 weeks of study history").
- [ ] **[F-WA-8]** Increase nav background opacity from `0.9` to `0.95` or add a subtle bottom `box-shadow` so body text scrolling behind the nav stays hidden rather than semi-visible.
- [ ] **[I-WA-1]** Add `:hover { color: var(--text); }` and `transition: color 150ms ease` to `.nav-link`.
- [ ] **[I-WA-3]** Add `:hover { background: var(--sage-light); color: var(--sage-mid); }` and `transition: background 120ms ease, color 120ms ease` to `.sidebar-item`.
- [ ] **[I-WA-4]** Add `:hover { background: #fafafa; }` and `transition: background 120ms ease` to `.table-row`.
- [ ] **[I-WA-6]** Add `transition: background 150ms ease` and `:hover { background: #c5d8c6; }` to `.row-study-btn`.

### Low priority

- [ ] **[S-WA-1]** Change `.stats-row` `margin-bottom` from `28px` to `24px` or `32px`.
- [ ] **[S-WA-3]** Document `--panel-x-narrow: 20px` as the right-panel horizontal padding token.
- [ ] **[T-WA-3]** Set `line-height: 1.5` on `.stat-label`.
- [ ] **[T-WA-4]** Set `line-height: 1.5` on `.today-sub`.
- [ ] **[C-WA-5]** Replace hard-coded `#c5d8c6` on `.row-study-btn` border with the `--sage-border` token (defined in mobile-study tasks).
- [ ] **[D-WA-4]** Narrow the Retention column from `80px` to `72px` in the grid template for better proportional balance.
