# CLAUDE.md — ORbit Enterprise Density & Design System Project

## Project Context

ORbit is a surgical analytics platform built with **Next.js, Tailwind CSS, Supabase, and TypeScript**. The current UI at 100% browser zoom feels too large and spacious. The goal: make the current 80% zoom appearance become the new 100% zoom default — a denser, more information-rich layout appropriate for enterprise surgical analytics software.

This project is not just a "zoom" change. It's an opportunity to align ORbit with enterprise-grade design standards used by tools like Linear, Stripe Dashboard, Vercel, and Salesforce Lightning — software built for professionals who live in the product 8+ hours a day and need maximum information density without sacrificing clarity.

**This is a multi-phase project. Do NOT skip phases or combine them. Commit after each phase. Run mandatory tests after each phase.**

**Do NOT use creative frontend design skills or artistic styling guidance.** ORbit is enterprise healthcare software — it must be predictable, consistent, and invisible. The Enterprise Design Principles below are the sole design authority.

---

## Enterprise Design Principles

These principles govern EVERY decision in this project. When in doubt, refer back here.

### 1. The 8px Grid System

All spacing (padding, margin, gap) must align to an **8px base grid** with 4px half-steps for tight relationships. This is the same system used by Material Design, Apple HIG, and most enterprise design systems (Salesforce Lightning, IBM Carbon, Red Hat).

**The scale:**
```
4px   — tight association (icon-to-label, related inline elements)
8px   — default internal spacing (within components)
12px  — compact component padding (dense table cells, small cards)
16px  — standard component padding (cards, form fields, list items)
24px  — section spacing (between related groups)
32px  — major section breaks
48px  — page-level section separation
64px  — hero/header spacing
```

**The internal ≤ external rule:** Spacing inside a component must never exceed spacing between components. A card's internal padding (16px) should be less than the gap between cards (24px). This creates visual grouping via Gestalt proximity.

### 2. Information Density — Dense but Not Cramped

Enterprise users (surgeons, facility admins) need to see and compare data without excessive scrolling. The design should:

- **Prioritize scan-ability** — users scan tables and dashboards, they don't read linearly
- **Use progressive disclosure** — show summary data upfront, expand for details on demand
- **Minimize whitespace waste** — every pixel of empty space should serve a purpose (grouping, hierarchy, breathing room) not just be "default padding"
- **Keep data tables tight** — 36-40px row heights for data tables (not 48-56px), with 12px cell padding
- **Use compact variants** — smaller buttons, badges, and form inputs in data-dense contexts

### 3. Visual Hierarchy Through Typography, Not Decoration

Enterprise apps achieve hierarchy through font size, weight, and color — not through excessive borders, shadows, backgrounds, or decorative elements.

**Typography scale (post-density scaling):**
```
10px  — fine print, timestamps, tertiary metadata
11px  — captions, helper text, table headers (uppercase)
12px  — secondary body text, table cells, compact UI
13px  — primary body text (after 80% scale, this is the new "base")
14px  — emphasized body, card titles
16px  — section headings, modal titles
18px  — page subtitles
20px  — page titles
24px  — dashboard hero numbers, large display values
```

**Weight usage:**
- Regular (400) — body text, table cells
- Medium (500) — labels, table headers, nav items
- Semibold (600) — card titles, section headings
- Bold (700) — page titles only (use sparingly)

### 4. Color as Data, Not Decoration

In enterprise surgical analytics, color conveys meaning:
- **Semantic colors only** — green=success/on-time, amber=warning/delayed, red=error/critical, blue=info/primary action
- **Neutral palette dominance** — 80%+ of the UI should be slate/gray. Color draws the eye to what matters
- **Consistent shade usage** — pick ONE shade per semantic meaning and enforce it globally. Never use red-500 for errors on one page and red-700 on another
- **3:1 minimum for UI components** against adjacent colors (WCAG 2.1 AA)
- **4.5:1 minimum for body text** against background (WCAG 2.1 AA)
- **7:1 target for critical data** — surgical timing data, scores, alerts

### 5. Accessibility Is Not Optional

Enterprise healthcare software sold to ASCs must meet WCAG 2.2 Level AA:

- **Minimum click targets:** 24×24 CSS pixels (WCAG 2.2), but target 32×32px for comfort in surgical contexts where users may have gloves or be rushing
- **Focus indicators:** 2px visible outline with 3:1 contrast against surrounding content
- **Keyboard navigation:** every interactive element reachable via Tab, operable via Enter/Space
- **No color-only differentiation:** status must be conveyed through text/icon + color, never color alone
- **Text resizability:** UI must remain functional at 200% browser zoom (even after our 80% base change)

### 6. Consistency Is the Product

Enterprise users develop muscle memory. Every page should feel like the same product:
- Same button sizes, styles, and placement patterns across all pages
- Same table structure (header style, row height, cell padding, action placement)
- Same card anatomy (title position, padding, footer actions)
- Same empty states (icon + heading + body + CTA)
- Same loading states (skeleton screens, not spinners in data contexts)
- Same error handling (toast positions, error message format, retry patterns)

---

## Mandatory Testing After Every Phase

**Every phase must pass all three test levels before committing. No exceptions.**

### Level 1: Unit Tests

Verify individual components and tokens work in isolation.

```bash
# Run after any token/component changes
npm run test          # or: npx jest --passWithNoTests
npx tsc --noEmit      # TypeScript compilation — zero errors
npm run lint          # ESLint — zero errors, zero warnings
npm run build         # Next.js build — zero errors
```

**What to unit test:**
- Design token exports — verify all expected keys exist and values are correct types
- Component rendering — each shared component in `components/ui/` renders without crashing
- Token consumption — components correctly apply token values (spot-check)
- Utility functions — any helpers for spacing calculation, color mapping, etc.

**If unit tests don't exist yet:** Phase 1 should create a basic test harness. At minimum:
- A test file for `lib/design-tokens.ts` that validates the shape and types of the exported tokens
- A smoke test for each `components/ui/` component that confirms it renders
- Use Jest + React Testing Library (already standard for Next.js)

### Level 2: Integration Tests

Verify that components work together within pages and that the design system is applied correctly.

```bash
# Visual regression baseline (if using Playwright or Cypress)
npx playwright test     # or equivalent

# Manual integration checks (print results, do not skip)
echo "=== INTEGRATION CHECKLIST ==="
echo "[ ] Dashboard renders without layout breaks"
echo "[ ] Data tables display with correct row height and cell padding"
echo "[ ] Navigation sidebar is fully visible and clickable"
echo "[ ] All modals open, display content, and close correctly"
echo "[ ] Form inputs are reachable and functional"
echo "[ ] Charts (Tremor) render with readable labels and axes"
echo "[ ] Toast notifications appear in correct position"
echo "[ ] Empty states display correctly with CTAs"
```

**What to integration test:**
- Page-level rendering — each priority page loads without console errors
- Layout integrity — sidebar + content area + header compose correctly at 1440px, 1920px, 2560px widths
- Component interplay — buttons inside cards inside modals inside pages all inherit correct sizing
- Data flow — Supabase queries still return and display data correctly (density change should not affect data fetching, but verify)

### Level 3: Workflow Tests

Verify that real user workflows still function end-to-end after changes.

**Critical ORbit workflows to test after each phase:**

```
WORKFLOW 1: Surgeon views today's cases
  → Login → Dashboard → Cases list → Filter by date → Click case → View case detail
  → VERIFY: All text readable, table rows clickable, milestone timeline visible

WORKFLOW 2: Admin reviews analytics
  → Login → Analytics → Scorecards → Select surgeon → View pillars
  → VERIFY: Charts render, scores display, date range selector works

WORKFLOW 3: Settings configuration
  → Login → Settings → Toggle a setting → Verify auto-save indicator
  → VERIFY: Toggle targets are large enough, save indicators visible

WORKFLOW 4: Case detail deep dive
  → Navigate to any case → Expand milestones → Check timestamps → View flags
  → VERIFY: Timeline readable at new density, no text truncation hiding critical data

WORKFLOW 5: Admin management
  → Admin pages → Tables with actions → Click edit → Modal opens
  → VERIFY: Table action buttons reachable, modals properly sized
```

**Testing must happen at these viewports:**
- 1440 × 900 (common laptop)
- 1920 × 1080 (standard desktop)
- 2560 × 1440 (large monitor)
- 1024 × 768 (minimum supported — verify graceful degradation)

**Testing must happen in these browsers:**
- Chrome (primary)
- Safari (secondary — many healthcare facilities use Macs)
- Firefox (tertiary)

### Test Failure Protocol

If ANY test level fails:
1. **Stop.** Do not proceed to the next phase.
2. Fix the failing test. If the fix is trivial (<10 min), fix inline.
3. If non-trivial, log it in `KNOWN_ISSUES.md` with the exact symptom, the phase it was discovered in, and the affected page/component.
4. A phase is only complete when all three test levels pass.

---

## Phase 0: Codebase Analysis & Design Token Audit

> **Goal:** Before changing anything, analyze the entire codebase to understand what exists, what's inconsistent, and what needs to become the single source of truth.

### 0a. Map Existing Design Token Sources

Scan for ALL files that define design values:

```bash
# Find all potential design token / theme / constant files
grep -rl "spacing\|fontSize\|fontWeight\|radius\|shadow\|zIndex\|colors\|palette" \
  --include="*.ts" --include="*.tsx" --include="*.css" \
  lib/ components/ app/ styles/ hooks/ utils/ types/ constants/ config/ \
  2>/dev/null | sort

# Check CSS custom properties
grep -rn "^--" app/globals.css

# Check tailwind config for custom theme extensions
cat tailwind.config.ts

# Check for any existing token/theme files
find . -type f \( -name "*theme*" -o -name "*token*" -o -name "*constants*" -o -name "*design*" \) \
  -not -path "./node_modules/*" -not -path "./.next/*"
```

### 0b. Audit Inline Values

```bash
# Find px values in CSS (these won't scale with rem)
grep -rn "[0-9]\+px" app/globals.css --include="*.css" | head -50

# Find inline style objects with pixel values
grep -rn "style={{" --include="*.tsx" --include="*.ts" | head -30

# Find hardcoded Tailwind spacing — check for inconsistency
grep -rn "className=" --include="*.tsx" | grep -oP '(?:p|m|gap|space)-\d+' | sort | uniq -c | sort -rn | head -30

# Find font-size classes in use
grep -rn "className=" --include="*.tsx" | grep -oP 'text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)' | sort | uniq -c | sort -rn

# Find hardcoded hex colors bypassing Tailwind
grep -rn "#[0-9a-fA-F]\{3,6\}" --include="*.tsx" --include="*.ts" | grep -v "node_modules\|\.next" | head -30

# Audit for inconsistent semantic colors
grep -rn "text-red-\|bg-red-" --include="*.tsx" | grep -oP '(text|bg)-red-\d+' | sort | uniq -c | sort -rn
grep -rn "text-green-\|bg-green-\|text-emerald-\|bg-emerald-" --include="*.tsx" | grep -oP '(text|bg)-(green|emerald)-\d+' | sort | uniq -c | sort -rn
grep -rn "text-amber-\|bg-amber-\|text-yellow-\|bg-yellow-" --include="*.tsx" | grep -oP '(text|bg)-(amber|yellow)-\d+' | sort | uniq -c | sort -rn
```

### 0c. Audit Grid Alignment

```bash
# Extract all Tailwind spacing values used
grep -rn "className=" --include="*.tsx" | \
  grep -oP '(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-[xy])-\d+' | \
  sort | uniq -c | sort -rn | head -40

# Check for non-8px-grid values (Tailwind: 1=4px, 2=8px, 3=12px, 4=16px)
# Values like p-5 (20px), p-7 (28px) break the 8px grid
echo "=== Potentially non-grid values ==="
grep -rn "className=" --include="*.tsx" | grep -oP '(?:p|m|gap)-(?:5|7|9|11)(?:\s|")' | sort | uniq -c | sort -rn
```

### 0d. Audit Accessibility Baseline

```bash
# Buttons without accessible text
grep -rn "<button" --include="*.tsx" | grep -v "aria-label\|aria-labelledby\|>.*<" | head -20

# Images without alt text
grep -rn "<img\|<Image" --include="*.tsx" | grep -v "alt=" | head -20

# Color-only status indicators (no text/icon companion)
grep -rn "bg-red-\|bg-green-\|bg-amber-" --include="*.tsx" | grep -v "text-\|aria-\|sr-only\|title=" | head -20

# onClick on non-interactive elements
grep -rn "onClick=" --include="*.tsx" | grep -v "<button\|<a \|<input\|<select\|role=" | head -20
```

### 0e. Produce Audit Report

Output a summary to the terminal before proceeding:

1. **Token sources found** — every file that defines design values
2. **Conflicts** — different files defining the same thing differently
3. **Grid alignment** — % of spacing values on 8px grid
4. **Color inconsistencies** — different shades for same semantic meaning
5. **Inline violations** — count of hardcoded px, inline styles, hex colors
6. **Accessibility gaps** — missing labels, color-only indicators, small targets

**Do NOT proceed to Phase 1 until this audit is complete and printed.**

### Phase 0 Testing
Run Level 1 tests (build, lint, typecheck should pass — no code changed). Document current state as baseline.

---

## Phase 1: Consolidate Design Tokens (Single Source of Truth)

> **Goal:** Create ONE canonical token file. Eliminate all other sources of truth.

### 1a. Create `lib/design-tokens.ts`

This file becomes the single source of truth. Must implement the 8px grid and enterprise typography scale. Structure it with:

- `spacing` — 8px grid values mapping to Tailwind classes
- `fontSize` — the typography scale defined in Enterprise Principles §3
- `fontWeight` — 4-tier weight system
- `lineHeight` — tight/snug/normal/relaxed
- `radius` — none/sm/md/lg/xl/full
- `shadow` — none/xs/sm/md/lg (subtle — enterprise apps use minimal shadow)
- `zIndex` — layering scale
- `colors.status` — semantic colors with text/bg/dot/border variants
- `colors.role` — user role badge colors (surgeon, admin, nurse, etc.)
- `colors.ui` — primary/secondary/muted/heading/body/border
- `components` — sizing standards for button/input/table/badge/card/modal/sidebar
- `a11y` — accessibility minimums (non-negotiable)

**Adapt values based on Phase 0 findings.** See Enterprise Design Principles for the target values.

### 1b. Update `app/globals.css` Custom Properties

CSS custom properties in `:root` should mirror tokens for non-Tailwind contexts.

### 1c. Reconcile `tailwind.config.ts`

Extend Tailwind with ORbit semantic tokens where useful.

### 1d. Remove Duplicate Sources

Delete or redirect any other files defining spacing, colors, typography independently. Replace their exports with re-exports from `lib/design-tokens.ts`.

### 1e. Create Basic Test Harness

If unit tests don't exist:
- Install Jest + React Testing Library
- Create token validation tests (shape, types, 8px grid compliance, a11y minimums)
- Create smoke tests for `components/ui/` components

**Commit: `chore: consolidate design tokens into single source of truth`**

### Phase 1 Testing
- **Level 1:** `npm run build && npx tsc --noEmit && npm run lint` + new token unit tests
- **Level 2:** No visual regressions (tokens consolidated, no values changed yet)
- **Level 3:** Quick smoke: login → dashboard → case detail

---

## Phase 2: Root Font Size Scaling

> **Goal:** Make the 80% zoom view the new 100% baseline.

### 2a. Set Root Font Size

In `app/globals.css`:

```css
html { font-size: 80%; }
```

This single line proportionally shrinks ALL Tailwind rem-based utilities.

### 2b. Identify What Won't Scale

```bash
# px values that won't scale
grep -n "px" app/globals.css | grep -v "border\|outline\|shadow\|--" | head -30

# Inline style pixel values
grep -rn "style=" --include="*.tsx" | grep -oP "'?\d+px'?" | sort | uniq -c | sort -rn

# Fixed arbitrary Tailwind values
grep -rn "\[.*px\]" --include="*.tsx" | head -30

# Viewport-relative units
grep -rn "vh\|vw\|dvh\|svh" --include="*.css" --include="*.tsx" | grep -v node_modules | head -20
```

### 2c. Convert px → rem Where Needed

Divide px by 16, express as rem. **Keep as px:** 1px borders, shadows, outlines.

### 2d. Fix Viewport Units

Check sidebar height, modal overlays, full-page containers, login page. These should generally remain viewport-relative.

### 2e. Fix Third-Party Components

Tremor charts specifically — check labels, axes, legends, tooltips, container heights.

### 2f. Post-Scale Accessibility Verification

Verify button heights, table rows, and text sizes still meet minimums after 80% scaling. If small buttons drop below 24px visual, increase their rem values to compensate.

**Commit: `feat: apply 80% root font-size for denser UI baseline`**

### Phase 2 Testing
- **Level 1:** Build, typecheck, lint pass. Token tests pass. Components meet `a11y.minClickTarget`.
- **Level 2:** All priority pages render without breaks at 1440/1920/2560px. Tremor charts readable.
- **Level 3:** All 5 workflows functional. No text truncation hiding critical surgical data.

---

## Phase 3: Visual Audit & Component Fixes

> **Goal:** Page-by-page review. Fix what broke. Enforce enterprise design patterns.

### Priority pages (in order):
1. **Case Detail Page** — most-used page, complex layout with milestone timeline
2. **Dashboard / Home** — first thing users see, sets expectations
3. **Scorecards / Analytics** — data-dense, charts, comparative data
4. **Cases List** — primary data table
5. **Settings pages** — form layouts, toggle interfaces
6. **Admin pages** — tables + forms + modals
7. **Login page** — standalone layout, brand impression

### Per-page checklist:

**Layout & Density:**
- [ ] Content fills viewport productively — no excessive empty space
- [ ] Appropriate information density for data type
- [ ] Sidebar fully visible, items clickable
- [ ] Progressive disclosure where appropriate

**Typography:**
- [ ] Clear hierarchy: page title > section heading > card title > body > secondary
- [ ] Max 3-4 font sizes per page
- [ ] Readable at all target viewports
- [ ] No truncation hiding critical data

**Spacing & Grid:**
- [ ] All spacing on 8px grid (4px for tight associations)
- [ ] Internal ≤ external rule holds
- [ ] Consistent patterns across similar sections
- [ ] Tables: 8-12px vertical, 12-16px horizontal cell padding

**Color & Contrast:**
- [ ] Semantic colors correct (green=success, red=error, amber=warning)
- [ ] No conflicting usage
- [ ] 4.5:1 body text, 3:1 large text/UI components
- [ ] Status uses icon/text + color, never color alone

**Interactivity:**
- [ ] All click targets ≥ 24×24px
- [ ] Hover states provide feedback
- [ ] Focus indicators visible (2px, 3:1 contrast)
- [ ] Skeletons for data loading, spinners only for actions

**Components:**
- [ ] Buttons use consistent sizing from tokens
- [ ] Badges compact (20px height)
- [ ] Cards have uniform anatomy
- [ ] Empty states: icon + heading + body + CTA
- [ ] Tables have sticky headers for long lists

**Commit per page group: `fix: adjust [page-name] layout for new density baseline`**

### Phase 3 Testing
- **Level 1:** Build, typecheck, lint.
- **Level 2:** Each fixed page correct at all 3 viewports. No new console errors.
- **Level 3:** All 5 workflows verified.

---

## Phase 4: Documentation & Sync

> **Goal:** Future developers understand and maintain the system.

Create `docs/DESIGN_SYSTEM.md` covering:

- **Architecture** — `lib/design-tokens.ts` is canonical, how it relates to `globals.css` and `tailwind.config.ts`
- **Scaling mechanism** — `html { font-size: 80% }` and what it affects
- **The 8px grid** — rules, preferred values (4, 8, 12, 16, 24, 32, 48, 64), values to avoid (20, 28, 36)
- **Color rules** — one shade per semantic meaning, contrast minimums
- **Component sizing** — buttons (sm/md/lg heights), table rows, click targets
- **When px is acceptable** — borders, shadows, outlines, scrollbars
- **How to add new tokens** — add to `design-tokens.ts`, add CSS prop if needed, update docs
- **Design inspiration references** — Linear, Stripe, Vercel, Salesforce Lightning, Raycast

**Commit: `docs: add design system documentation`**

### Phase 4 Testing
- **Level 1:** Docs render, code blocks valid.
- **Level 2:** A new developer could implement a component correctly from docs alone.
- **Level 3:** Final full regression — all 5 critical workflows pass.

---

## Session Management Rules

### Token Budget
- **At 70% token utilization, STOP.** Do not start new phases or page audits.
- Use remaining 30% to:
  1. **Commit** all current work
  2. **Write `HANDOFF.md`** with: completed work, resume point, partial modifications, discovered issues, git branch/commit, test results
  3. **List next 3-5 actions** for the following session

### Between Sessions
- Start by reading this CLAUDE.md
- Check `git log --oneline -5`
- Read `HANDOFF.md` if it exists

---

## Important Constraints

### Do NOT:
- Use CSS `zoom` or `transform: scale()` — breaks layout/events
- Change Tailwind's base rem config — change root font-size instead
- Modify Tremor CSS without testing charts
- Go below 10px visual equivalent for any text
- Break Supabase auth or API integrations
- Use color alone to convey status
- Use more than 3-4 font sizes per page
- Add decorative shadows/borders where typography hierarchy suffices
- Skip testing — every phase has mandatory tests
- Use creative/artistic frontend design skills — ORbit is enterprise software, not a portfolio piece

### Do:
- Commit after every phase
- Print audit results before changes
- Test at 1440px, 1920px, 2560px viewports
- Test Chrome, Safari, Firefox
- Follow 8px grid for all spacing
- Use semantic tokens — never freestyle colors
- Ensure internal ≤ external spacing
- Add `aria-label` to icon-only buttons
- Use skeletons for data loading, spinners for actions only
- Keep git diffs reviewable

---

## File Reference

| File | Role |
|------|------|
| `lib/design-tokens.ts` | **CANONICAL** — single source of truth for all design values |
| `app/globals.css` | Root CSS, custom properties, Tailwind imports, Tremor config |
| `tailwind.config.ts` | Tailwind extensions (must align with design-tokens.ts) |
| `components/ui/` | Shared UI components (Badge, Button, Loading, StatusBadge, etc.) |
| `components/layouts/DashboardLayout.tsx` | Main app shell — sidebar + header + content |
| `components/layouts/Container.tsx` | Content wrapper |
| `app/layout.tsx` | Root layout (pages wrap themselves in DashboardLayout individually) |
| `docs/DESIGN_SYSTEM.md` | Design system docs for developers |
| `HANDOFF.md` | Session handoff notes (created between Claude Code sessions) |
| `KNOWN_ISSUES.md` | Issues discovered during testing, tracked for resolution |

### Design Inspiration

| Product | Learn from |
|---------|-----------|
| **Linear** | Density, keyboard-first, compact tables, minimal decoration |
| **Stripe Dashboard** | Typography hierarchy, clean analytics, centered layout |
| **Vercel** | Status patterns, minimal UI, monospace for data |
| **Salesforce Lightning** | Enterprise design system, role-based views, data tables |
| **Raycast** | Compact command UI, tight spacing |

---

## Success Criteria

1. ✅ 100% zoom looks like current 80% zoom
2. ✅ All values trace to `lib/design-tokens.ts`
3. ✅ No duplicate/conflicting token definitions
4. ✅ All spacing on 8px grid (4px half-steps)
5. ✅ All text meets WCAG AA contrast (4.5:1 body, 3:1 large/UI)
6. ✅ All click targets ≥ 24×24px (32px target for surgical context)
7. ✅ Semantic colors consistent — one shade per meaning
8. ✅ `docs/DESIGN_SYSTEM.md` enables new developers
9. ✅ All three test levels pass for every phase
10. ✅ No color-only status indicators
11. ✅ Tremor charts and third-party components render correctly post-scale
