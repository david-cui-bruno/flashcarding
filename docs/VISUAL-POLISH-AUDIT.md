# Visual Polish Audit

Audit of `public/mockups/mobile-home.html`, `public/mockups/mobile-study.html`, and `public/mockups/web-home-a.html` against six visual-polish dimensions. Every issue is tagged with its mockup, category, and severity (high / medium / low).

---

## 1. Spacing & Rhythm

### mobile-home.html

| # | Issue | Severity |
|---|-------|----------|
| S-MH-1 | `nav` vertical padding is `10px` top/bottom — off the 4 px grid (should be `8px` or `12px`). | medium |
| S-MH-2 | `.today-card` uses `margin: 16px 16px 0` for outer positioning, but its inner padding is `24px 20px`. The result is a `16 + 20 = 36 px` effective left offset for card content versus `16px` for the streak row below — breaks horizontal rhythm. | high |
| S-MH-3 | `.streak-row` left padding is `16px` while `.today-card` content starts at `36px` from screen edge — the streak chips and card body are not optically aligned. | high |
| S-MH-4 | `.collection-list` gap is `10px` — off the 4 px grid. Should be `8px` or `12px`. | low |
| S-MH-5 | `.section-title` padding-top is `24px` but padding-bottom is `10px` — inconsistent asymmetry that lacks clear intent; should follow a deliberate spacing scale (e.g., `24px` / `12px`). | low |
| S-MH-6 | FAB `bottom` is hard-coded to `calc(60px + 24px)` — the `60px` is a magic number for the tab-bar height; should reference a spacing token or CSS custom property. | low |

### mobile-study.html

| # | Issue | Severity |
|---|-------|----------|
| S-MS-1 | `.study-header` padding is `12px 16px` but `.card-area` padding is `20px 16px` — vertical header padding is 4 px shorter than content; minor but noticeable seam. | low |
| S-MS-2 | `.interval-row` and `.grade-row` share the same `gap: 8px` and are directly adjacent with no visual separator; they read as one block rather than label + control pairs. | medium |
| S-MS-3 | `.card-source` `bottom: 14px` is off the 4 px grid (should be `12px` or `16px`). | low |
| S-MS-4 | No spacing between `.source-panel` and the bottom of the scroll area — content bleeds to viewport edge on shorter phones. | medium |

### web-home-a.html

| # | Issue | Severity |
|---|-------|----------|
| S-WA-1 | `.stats-row` `margin-bottom` is `28px` — off the 4 px grid. Should be `24px` or `32px`. | low |
| S-WA-2 | `.main` uses `padding: 32px` while `.sidebar` uses `padding: 24px 0` with items at `padding: 8px 20px` — the horizontal content baseline in main (32 px) vs sidebar (20 px) creates an unbalanced cross-panel rhythm. | medium |
| S-WA-3 | `.right-panel` padding is `24px 20px` — inconsistent with main's `32px`; fine as a deliberate narrower gutter but never codified as a token. | low |
| S-WA-4 | `.table-head` padding is `10px 20px` while `.table-row` padding is `14px 20px` — the 4 px discrepancy makes the header appear to float rather than anchor the table. | medium |

---

## 2. Typography

### mobile-home.html

| # | Issue | Severity |
|---|-------|----------|
| T-MH-1 | `body` `line-height: 1.4` — below the required minimum of 1.5 for body copy. | high |
| T-MH-2 | `.nav-logo` `letter-spacing: 0` — product name / heading should carry `letter-spacing: -0.02em` at this weight. | medium |
| T-MH-3 | `.section-title` `letter-spacing: 0` — section headings at 17 px/600 weight should use `letter-spacing: -0.01em`. | medium |
| T-MH-4 | `.today-sub` `line-height: 1.3` — body-level supporting text below the hero count should be ≥ 1.5. | medium |
| T-MH-5 | `.collection-name` `line-height: 1.3` — card label text should be ≥ 1.5 to handle wrapping gracefully. | medium |
| T-MH-6 | `.collection-meta` `line-height: 1.3` — same issue; secondary metadata should be ≥ 1.5. | low |

### mobile-study.html

| # | Issue | Severity |
|---|-------|----------|
| T-MS-1 | `.study-title` `letter-spacing: 0` — 16 px/600 heading should use `letter-spacing: -0.01em`. | medium |
| T-MS-2 | `.card-term` `letter-spacing` unset — 22 px/700 answer term deserves `letter-spacing: -0.02em` for polish. | medium |
| T-MS-3 | `.card-source` `line-height: 1.4` — source quote text should be ≥ 1.5. | low |
| T-MS-4 | `.show-answer-btn` `letter-spacing: 0` — CTA button label benefits from `letter-spacing: 0.01em` for legibility at medium weight. | low |
| T-MS-5 | `.grade-label` is 10 px — below the practical minimum of 11 px for readable UI labels; risks being illegible on non-retina screens. | high |

### web-home-a.html

| # | Issue | Severity |
|---|-------|----------|
| T-WA-1 | `.section-h1` `letter-spacing: 0` — 22 px/700 heading should use `letter-spacing: -0.02em`. | medium |
| T-WA-2 | `.nav-logo` `letter-spacing: 0` — same as mobile-home; logo wordmark at 700 weight should use `letter-spacing: -0.02em`. | medium |
| T-WA-3 | `.stat-label` `line-height: 1.4` — below 1.5 minimum. | low |
| T-WA-4 | `.today-sub` `line-height: 1.4` — below 1.5 minimum. | low |
| T-WA-5 | `.row-meta` wraps at 12 px with no explicit `line-height`; inherits body `1.6` which is fine, but explicit setting prevents drift. | low |

---

## 3. Color & Contrast

### mobile-home.html

| # | Issue | Severity |
|---|-------|----------|
| C-MH-1 | `.tab-label` color `#999` on white `#fff` — contrast ratio ≈ 2.8:1, fails WCAG AA (4.5:1 required for normal text). | high |
| C-MH-2 | `.border: #e4e4e4` is a pure neutral gray. Should be a sage-tinted neutral (e.g., `#e2e7e2`) to maintain the product's warm-green palette identity. | medium |
| C-MH-3 | `.text-muted: #999` on the `#f9f9f8` background — contrast ≈ 2.5:1, fails WCAG AA. Used on `.collection-meta`. | high |
| C-MH-4 | Active tab icon uses `var(--sage)` (#7c9a7e) on white `#fff` — contrast ≈ 3.0:1, passes 3:1 for large/bold but barely, and the 10 px tab label fails. | medium |

### mobile-study.html

| # | Issue | Severity |
|---|-------|----------|
| C-MS-1 | `.card-face-label` color `#999` on white `#fff` — contrast ≈ 2.8:1, fails WCAG AA 4.5:1. | high |
| C-MS-2 | `.flip-hint` color `#999` on `#f9f9f8` — contrast ≈ 2.5:1, fails WCAG AA. | high |
| C-MS-3 | `.interval-hint` color `#999` on `#f9f9f8` — same failure. | high |
| C-MS-4 | `.source-panel` border uses a one-off hard-coded value `#c8deca`, not derived from a design token. | low |
| C-MS-5 | `progress-track` background `#e4e4e4` is a pure neutral; should be a tinted neutral (sage-family, e.g., `#e0e8e0`). | low |

### web-home-a.html

| # | Issue | Severity |
|---|-------|----------|
| C-WA-1 | `.th` (table headers) color `#888` on `surface-2` `#f0f0ee` — contrast ≈ 3.5:1, fails WCAG AA 4.5:1 for normal-size text. | high |
| C-WA-2 | `.text-muted: #888` on `#ffffff` (white surface) — contrast ≈ 3.5:1, fails WCAG AA. Used widely in stat labels, today-sub, streak-label. | high |
| C-WA-3 | `--border: #e5e5e5` is pure neutral; should be sage-tinted (e.g., `#e2e7e2`) for palette cohesion. | medium |
| C-WA-4 | `--surface-2: #f0f0ee` is intended as a tinted neutral but reads as warm-gray without a discernible sage influence; should shift toward `#edf3ee` (the sage-light token already defined). | medium |
| C-WA-5 | `.row-study-btn` border `#c5d8c6` is a one-off color not tracked as a token. | low |
| C-WA-6 | Sidebar active item uses `var(--sage-light)` (#edf3ee) as background — contrast of `var(--sage-mid)` text (#5a7d5c) on that background ≈ 3.8:1, fails AA 4.5:1. | high |

---

## 4. Micro-interactions

### mobile-home.html

| # | Issue | Severity |
|---|-------|----------|
| I-MH-1 | `.nav-icon-btn` has no `:hover`, `:active`, or `:focus-visible` state. Any tap/click produces no visual feedback. | high |
| I-MH-2 | `.today-cta` (Start studying) has no `transition` — color/scale change on press will be instant and jarring. | high |
| I-MH-3 | `.collection-card` has no hover or active state and no `transition` property. | medium |
| I-MH-4 | `.fab` has no `transition` and no `:focus-visible` ring — the primary action button has zero interactive affordance. | high |
| I-MH-5 | No disabled state styling is defined for any interactive element; `busy`-state buttons lack `cursor: not-allowed` and reduced opacity. | medium |

### mobile-study.html

| # | Issue | Severity |
|---|-------|----------|
| I-MS-1 | `.back-btn` has no `:hover`, `:active`, or `:focus-visible` state. | medium |
| I-MS-2 | `.show-answer-btn` has no `transition` — the primary CTA should have `transition: background 150ms ease, transform 100ms ease`. | high |
| I-MS-3 | `.grade-btn` elements have no `transition` — the four grading buttons are the most-tapped elements in the entire app and need a crisp `150ms` response (background, border-color, scale). | high |
| I-MS-4 | `.grade-btn:disabled` uses `opacity: 0.4` but no `cursor: not-allowed` and no `pointer-events: none` — double-tap possible during async `gradeCard` call. | medium |
| I-MS-5 | `.progress-fill` width change has no `transition` — the progress bar will jump rather than animate between cards. | medium |
| I-MS-6 | No `:focus-visible` ring defined on any interactive element in this mockup. | high |

### web-home-a.html

| # | Issue | Severity |
|---|-------|----------|
| I-WA-1 | `.nav-link` has no `:hover` state and no `transition`. | medium |
| I-WA-2 | `.nav-btn` has no `:hover`, `:active`, or `:focus-visible` state. | high |
| I-WA-3 | `.sidebar-item` has no `:hover` or `:active` state — only the `.active` variant is styled. | medium |
| I-WA-4 | `.table-row` has no `:hover` state — a clickable table row should highlight on hover with `transition: background 120ms ease`. | medium |
| I-WA-5 | `.study-now-btn` has no `transition`, `:hover`, or `:focus-visible` state. | high |
| I-WA-6 | `.row-study-btn` has no `transition` and no `:focus-visible` ring. | medium |
| I-WA-7 | All transition durations are absent (target: 150–200 ms for interactive elements, 300 ms max for larger animations). | high |

---

## 5. Density & Alignment

### mobile-home.html

| # | Issue | Severity |
|---|-------|----------|
| D-MH-1 | `.nav-icon-btn` width/height is `36px` — below the 44 px minimum touch target on mobile. | high |
| D-MH-2 | `.tab-item` effective touch target height is ~36 px (4 px padding × 2 + 24 px icon + 14 px label) — below 44 px minimum. | high |
| D-MH-3 | `.today-cta` button height is ~40 px (10 px padding × 2 + 20 px line-height) — below 44 px minimum for a primary CTA. | high |
| D-MH-4 | All SVG icons in `.sidebar-item` use `stroke-width: 1.5`; collection icons inside `.collection-icon` use `stroke-width: 2` — inconsistent icon stroke weight across a single screen. | medium |
| D-MH-5 | `.collection-icon` is 40 × 40 px containing an 18 × 18 px SVG — the icon occupies 45% of the container width, which is optically too small; standard padding-to-icon ratio is ~60–70% fill. | low |

### mobile-study.html

| # | Issue | Severity |
|---|-------|----------|
| D-MS-1 | `.back-btn` is `36 × 36 px` — below 44 px minimum. | high |
| D-MS-2 | `.grade-btn` padding `10px 4px` gives ~42 px height — barely under 44 px; at small widths the tap target is also narrow. | medium |
| D-MS-3 | `.back-btn` uses `stroke-width: 2` while `.grade-btn` icon area uses none; nav header mixes stroke weights with the rest of the study screen. | low |
| D-MS-4 | `.card-face-label` is `position: absolute` at `top: 16px` — it risks overlapping with short `card-definition` text on cards with ≤ 2 lines of content, since the card has no minimum padding clearance from the label. | medium |
| D-MS-5 | Grade button grid `grid-template-columns: repeat(4, 1fr)` — on 375 px or narrower screens each button is ~86 px wide, giving only ~4 px effective tap padding. Needs a minimum column width or explicit min-width. | medium |

### web-home-a.html

| # | Issue | Severity |
|---|-------|----------|
| D-WA-1 | `.nav-btn` height is ~34 px (7 px × 2 padding + ~20 px line-height) — below even the 36 px desktop soft minimum; 40 px recommended. | medium |
| D-WA-2 | `.row-study-btn` height is ~28 px — far too small for a clickable control even on desktop. Recommended minimum 32 px; 36 px preferred. | high |
| D-WA-3 | `.sidebar-item` icon `width: 16px` while collection list icons in mobile-home use 18 px — inconsistent icon sizing across the two surfaces representing the same collections. | medium |
| D-WA-4 | Table columns `grid-template-columns: 1fr 80px 80px 80px 120px` — number columns use equal 80 px width but "Retention" values (e.g., "91%") are shorter than "Cards" values (e.g., "211"); optical centering would benefit from narrowing the Retention column to 72 px. | low |
| D-WA-5 | Heatmap cells have no tooltip or `aria-label` — no way to read cell values; data is purely decorative for now but will be unreadable at `gap: 3px` on non-retina displays. | medium |

---

## 6. "Feel" Details

### mobile-home.html

| # | Issue | Severity |
|---|-------|----------|
| F-MH-1 | `.today-count` (the "24" hero number) has no `font-variant-numeric: tabular-nums` — number will shift width as it changes (e.g., 9→10), causing layout shift. | high |
| F-MH-2 | `.streak-chip strong` numbers (streak count, reviewed count) have no `font-variant-numeric: tabular-nums`. | medium |
| F-MH-3 | `.collection-due` due-count has no `font-variant-numeric: tabular-nums`. | medium |
| F-MH-4 | Tab bar uses `padding-bottom: 20px` as a fixed safe-area stand-in instead of `env(safe-area-inset-bottom)` — will overlap content on iPhone models with home indicator if not corrected. | high |
| F-MH-5 | No `focus-visible` ring defined globally or on any element — keyboard and assistive-technology users have no visible focus indicator. | high |
| F-MH-6 | `.nav-icon-btn` lacks `aria-label` population in the rendered HTML (present in the markup but no styling for a focus state means screen-reader users have no visual confirmation of focus). | medium |

### mobile-study.html

| # | Issue | Severity |
|---|-------|----------|
| F-MS-1 | `.study-progress-text` ("8 / 14") has no `font-variant-numeric: tabular-nums` — progress fraction will shift as numbers increase. | high |
| F-MS-2 | `.grade-num` (the 1–4 key labels) has no `font-variant-numeric: tabular-nums` — minor but consistent with the rule. | low |
| F-MS-3 | Card flip produces no animation — no `transition` or `transform` on the flashcard for the reveal; the answer just appears, which feels abrupt. | medium |
| F-MS-4 | No `focus-visible` ring on any element — same gap as mobile-home. | high |
| F-MS-5 | `.grade-btn:disabled` only uses `opacity: 0.4` but no `pointer-events: none` — a second rapid tap can fire the gradeCard action while the first is in-flight. | high |
| F-MS-6 | The grade buttons have no `aria-label` beyond their text content, and the associated interval hint above is not linked via `aria-describedby` — keyboard users cannot determine the scheduled interval without visual context. | medium |

### web-home-a.html

| # | Issue | Severity |
|---|-------|----------|
| F-WA-1 | `.today-big` ("24") has no `font-variant-numeric: tabular-nums`. | high |
| F-WA-2 | `.stat-value` (508, 24, 89%) has no `font-variant-numeric: tabular-nums` — layout shift as values update. | high |
| F-WA-3 | `.row-num` and `.row-due` table cells have no `font-variant-numeric: tabular-nums` — numbers in a table are the most important place for tabular numerals. | high |
| F-WA-4 | `.streak-num` has no `font-variant-numeric: tabular-nums`. | medium |
| F-WA-5 | `.sidebar-item .badge` count has no `font-variant-numeric: tabular-nums`. | medium |
| F-WA-6 | No `focus-visible` ring defined on any interactive element. | high |
| F-WA-7 | Heatmap cells have no `title`, `aria-label`, or accessible description — the widget is invisible to screen readers and communicates nothing about daily review counts. | medium |
| F-WA-8 | Sticky `topnav` uses `backdrop-filter: blur(8px)` with `background: rgba(255,255,255,0.9)` — the reduced opacity will cause text behind the nav to show through, potentially creating contrast failures for users scrolling through dense table rows. | medium |

---

## Summary by Severity

High (must fix before ship):
- T-MH-1, T-MS-5 (typography — body line-height, sub-minimum font size)
- C-MH-1, C-MH-3, C-MS-1, C-MS-2, C-MS-3, C-WA-1, C-WA-2, C-WA-6 (WCAG AA contrast failures)
- I-MH-1, I-MH-2, I-MH-4, I-MS-2, I-MS-3, I-MS-6, I-WA-2, I-WA-5, I-WA-7 (missing interactions on primary controls)
- D-MH-1, D-MH-2, D-MH-3, D-MS-1, D-WA-2 (sub-44px tap targets on mobile; sub-minimum on desktop)
- F-MH-1, F-MH-4, F-MH-5, F-MS-1, F-MS-4, F-MS-5, F-WA-1, F-WA-2, F-WA-3, F-WA-6 (tabular numerals on all counts; focus rings; safe-area insets; disabled guard)

Medium: S-MH-2, S-MH-3, S-MS-2, S-MS-4, S-WA-2, S-WA-4, T-MH-2–T-MH-5, T-MS-1–T-MS-2, T-WA-1–T-WA-2, C-MH-2, C-MH-4, C-WA-3, C-WA-4, I-MH-3, I-MH-5, I-MS-1, I-MS-4, I-MS-5, I-WA-1, I-WA-3–I-WA-6, D-MH-4, D-MS-2, D-MS-4, D-MS-5, D-WA-1, D-WA-3, D-WA-5, F-MH-2, F-MH-3, F-MH-6, F-MS-3, F-MS-6, F-WA-4, F-WA-5, F-WA-7, F-WA-8

Low: remaining items
