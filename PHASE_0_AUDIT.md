# Phase 0: Codebase Analysis & Design Token Audit

> Generated: 2026-02-12
> Project: ORbit (or-flow-app)
> Stack: Next.js 16.1.1, React 19, Tailwind CSS v4, Supabase, Vitest

---

## Table of Contents

1. [Token Source Inventory](#1-token-source-inventory)
2. [Conflicts Between Files](#2-conflicts-between-files)
3. [Color Inventory](#3-color-inventory)
4. [Spacing Inventory](#4-spacing-inventory)
5. [Inline Violation Inventory](#5-inline-violation-inventory)
6. [Accessibility Gaps](#6-accessibility-gaps)
7. [Third-Party Components](#7-third-party-components)
8. [Testing Baseline](#8-testing-baseline)
9. [Raw Terminal Output](#9-raw-terminal-output)

---

## 1. Token Source Inventory

### Primary: lib/design-tokens.ts (CANONICAL)

The intended single source of truth. Defines:

| Export | Lines | What it defines |
|--------|-------|-----------------|
| `spacing` | 17-26 | 8 values: xs(4px) through 4xl(96px) |
| `radius` | 31-39 | 7 values: none through full |
| `elevation` | 44-51 | Shadow Tailwind class references |
| `shadowValues` | 53-60 | Actual CSS shadow strings |
| `transition` | 65-70 | 4 timing values: fast/base/slow/slowest |
| `transitionClasses` | 72-78 | Tailwind transition utility combos |
| `statusColors` | 83-172 | 8 statuses: scheduled, in_progress, completed, delayed, cancelled, active, inactive, pending |
| `alertColors` | 177-206 | 4 types: info, success, warning, error |
| `roleColors` | 211-247 | 7 roles: surgeon, anesthesiologist, nurse, tech, admin, global_admin, facility_admin |
| `zIndex` | 252-262 | Layering scale: 0-1080 |
| `typography` | 267-293 | fontSize (8 sizes), fontWeight (4), lineHeight (3), fontFamily (2) |
| `breakpoints` | 298-304 | 5 responsive breakpoints |
| `animationDuration` | 309-316 | 6 timing values |
| `getStatusColors()` | 342-345 | Helper: status string → color classes |
| `getStatusLabel()` | 352-358 | Helper: status string → human label |
| `getAlertColors()` | 364-366 | Helper: variant → alert color classes |
| `getRoleColors()` | 372-375 | Helper: role string → role color classes |

**Missing from design-tokens.ts (needed for Phase 1):**
- `border` property on `roleColors` (staff-assignment.ts has it, design-tokens.ts doesn't)
- Surgeon data visualization palette
- Component sizing tokens (button heights, table row heights, badge heights)
- Click target minimums
- Typography: no 10px/11px/13px sizes for post-scaling ramp

### Secondary: app/globals.css

CSS custom properties and utility classes:

| Section | Lines | What it defines |
|---------|-------|-----------------|
| `:root` vars | 7-10 | --background (#fff), --foreground (#171717) |
| `@theme inline` Tremor tokens | 12-39 | 20 Tremor brand/bg/border/content color vars |
| Fill/stroke utilities | 46-207 | ~260 classes for Tremor chart colors (20+ color families) |
| Background legend utilities | 223-305 | Chart legend background colors |
| Text color utilities | 311-330 | Chart text colors |
| Dark mode | 331-335 | Minimal: 2 vars only (--background, --foreground) |
| Animations | 360-589 | @keyframes: shimmer, fadeIn, fadeOut, staggerFadeIn, pulse-ring, pulse-border |
| Button classes | 605-735 | .btn-primary, .btn-secondary, .btn-danger, .btn-success, .btn-ghost, .btn-sm, .btn-lg |
| Form classes | 738-811 | .input-base, .input-error, .label-base, .label-required, .input-helper, .input-error-text |
| Card classes | 814-846 | .card-base, .card-elevated, .card-header, .card-title, .card-content, .card-footer |
| Badge classes | 849-881 | .badge-base, .badge-primary, .badge-success, .badge-warning, .badge-error |
| Alert classes | 884-912 | .alert-base, .alert-info, .alert-success, .alert-warning, .alert-error |
| Table classes | 915-961 | .table-container, .table-base, .table-header, .table-header-cell, .table-row, .table-cell |
| Typography classes | 964-995 | .heading-1, .heading-2, .heading-3, .text-body, .text-secondary |
| Special effects | 464-526 | scrollbar, focus rings, hover-lift, glass morphism, gradient text |

### Duplicate/Conflicting Sources

| File | What it defines | Used by |
|------|----------------|---------|
| `types/staff-assignment.ts` (L56-82) | `ROLE_COLORS` (5 roles) + `getRoleColor()` | StaffAvatar, TeamMember, StaffMultiSelect |
| `types/block-scheduling.ts` (L133-146) | `SURGEON_COLOR_PALETTE` (12 hex) + `getNextColor()` | BlockPopover, BlockCard |
| `hooks/useSurgeonColors.ts` (L11-22) | `DEFAULT_COLORS` (10 hex) | BlockSidebar, block-schedule page |
| `app/admin/demo/page.tsx` (L97-104) | `SURGEON_COLORS` (8 Tailwind class sets) | Demo page only |

### Component-Level Inline Color Definitions

These 15+ files define their own color mappings instead of using design-tokens:

| File | What it defines |
|------|----------------|
| `components/ui/MetricCard.tsx` | `colorClasses` (5 color variants: blue, green, amber, red, slate) |
| `components/ui/Loading.tsx` | `sizeClasses` (5 sizes) + `colorClasses` (5 colors) |
| `components/ui/CardEnhanced.tsx` | `trendColors` (up/down/neutral) |
| `components/ui/Button.tsx` | `spinnerColors` per variant |
| `components/dashboard/RoomGridView.tsx` | `getStatusColor()` + `getStatusBgColor()` — duplicates design-tokens |
| `components/dashboard/PaceProgressBar.tsx` | `getPaceStatusColors()` — pace status colors |
| `components/cases/CompletedCaseView.tsx` | `bgColors`, `textColors`, `iconColors` per milestone status |
| `components/cases/TeamMember.tsx` | `roleColorClasses` inline object |
| `components/cases/StaffMultiSelect.tsx` | `ROLE_SECTIONS` with hardcoded role colors |
| `components/analytics/AnalyticsComponents.tsx` | `borderColors`, `iconBgColors`, `strokeColors`, `barColors` |
| `components/analytics/financials/OverviewTab.tsx` | `statusColors` inline |
| `app/settings/flags/page.tsx` | Severity color config (info/warning/critical with ring variants) |
| `app/settings/cancellation-reasons/page.tsx` | Category colors (patient, scheduling, clinical, external) |
| `app/analytics/flags/page.tsx` | `accentColors` + `chartColors` |
| `app/analytics/kpi/page.tsx` | `accentColors` + `chartColors` |
| `app/analytics/block-utilization/page.tsx` | `caseColors` array |

---

## 2. Conflicts Between Files

### CRITICAL: Role Colors — Two Different Systems

| Role | design-tokens.ts | staff-assignment.ts | Difference |
|------|-----------------|---------------------|------------|
| surgeon | bg-blue-**50** / text-blue-700 | bg-blue-**100** / text-blue-700 / border-blue-**300** | Background shade (50 vs 100), border exists only in staff-assignment |
| anesthesiologist | bg-**amber**-50 / text-**amber**-700 | bg-**orange**-100 / text-**orange**-700 / border-**orange**-300 | Entirely different color family (amber vs orange) |
| nurse | bg-emerald-**50** / text-emerald-700 | bg-emerald-**100** / text-emerald-700 / border-emerald-**300** | Background shade (50 vs 100), border |
| tech | bg-purple-**50** / text-purple-700 | bg-purple-**100** / text-purple-700 / border-purple-**300** | Background shade (50 vs 100), border |
| admin | bg-slate-**100** / text-slate-700 | bg-slate-**100** / text-slate-700 / border-slate-**300** | Match (except border exists only in staff-assignment) |

**Additional:** design-tokens.ts has `global_admin` and `facility_admin` roles that staff-assignment.ts lacks.
**Missing:** design-tokens.ts roleColors has no `border` property at all.

### CRITICAL: Surgeon Color Palettes — Three Sources

**Source 1: types/block-scheduling.ts SURGEON_COLOR_PALETTE (12 hex values)**
```
'#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4',
'#F97316', '#6366F1', '#14B8A6', '#EF4444', '#84CC16', '#A855F7'
```

**Source 2: hooks/useSurgeonColors.ts DEFAULT_COLORS (10 hex values)**
```
'#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
'#06B6D4', '#84CC16', '#F97316', '#6366F1'
```

**Source 3: app/admin/demo/page.tsx SURGEON_COLORS (8 Tailwind class sets)**
```
blue-100/800/200, emerald-100/800/200, amber-100/800/200, purple-100/800/200,
rose-100/800/200, cyan-100/800/200, orange-100/800/200, indigo-100/800/200
```

Differences: Different count (12 vs 10 vs 8), different ordering, different representation (hex vs Tailwind classes).

### MEDIUM: Status Colors Reimplemented Inline

`components/dashboard/RoomGridView.tsx` defines its own `getStatusColor()` and `getStatusBgColor()` functions that duplicate the purpose of `getStatusColors()` from design-tokens.ts. These may return different class combinations.

### MEDIUM: Alert vs Status Green Family Split

- `statusColors.in_progress` uses **emerald** (bg-emerald-50, text-emerald-700)
- `alertColors.success` uses **green** (bg-green-50, text-green-800)

Two different green families for related semantic meanings (success/in-progress).

### LOW: Severity Colors in Settings

`app/settings/flags/page.tsx` defines its own severity colors (info/warning/critical) with slightly different shade choices than alertColors (adds `ring-*` variants, uses -700 text instead of -800).

---

## 3. Color Inventory

### Blue (Primary/Info/Scheduled)

| Class | Count | Semantic Use |
|-------|-------|-------------|
| text-blue-600 | 325 | Links, primary actions, button text |
| border-blue-500 | 242 | Focus rings, active borders |
| bg-blue-50 | 193 | Status badges, info backgrounds |
| text-blue-700 | 158 | Role badge text, headings |
| bg-blue-600 | 127 | Primary button fills |
| bg-blue-100 | 87 | Deeper badge backgrounds |
| border-blue-200 | 86 | Light borders, badge borders |
| bg-blue-700 | 77 | Hover button fills |
| border-blue-600 | 62 | Active borders |
| bg-blue-500 | 52 | Dots, indicators |
| text-blue-800 | 39 | Dark emphasis text |
| text-blue-500 | 33 | Light action text |
| border-blue-300 | 18 | Medium borders |
| text-blue-900 | 15 | Very dark text |
| border-blue-100 | 14 | Very light borders |
| bg-blue-200 | 11 | Light fills |
| bg-blue-400 | 8 | Medium fills |
| border-blue-400 | 5 | Medium borders |
| text-blue-100 | 5 | Light text |
| text-blue-300 | 4 | Light text |
| text-blue-400 | 3 | Light text |
| text-blue-200 | 3 | Light text |
| bg-blue-300 | 1 | Rare |

**Consolidation needed:** 23 different blue shade/property combinations → target ~6 canonical

### Red (Error/Cancelled)

| Class | Count | Semantic Use |
|-------|-------|-------------|
| text-red-600 | 154 | Error text, destructive actions |
| bg-red-50 | 139 | Error backgrounds, cancelled status |
| text-red-500 | 86 | Error text (secondary pattern) |
| text-red-700 | 63 | Dark error text |
| border-red-200 | 54 | Error borders |
| bg-red-100 | 40 | Error badge backgrounds |
| bg-red-500 | 39 | Error dots, indicators |
| text-red-800 | 17 | Very dark error text |
| bg-red-600 | 14 | Destructive button fills |
| border-red-400 | 12 | Medium error borders |
| bg-red-700 | 12 | Dark fills |
| text-red-400 | 9 | Light error text |
| border-red-300 | 9 | Light error borders |
| bg-red-400 | 8 | Medium fills |
| border-red-500 | 6 | Medium borders |
| border-red-100 | 6 | Very light borders |
| text-red-900 | 5 | Very dark |
| bg-red-200 | 5 | Light fills |
| text-red-300 | 2 | Rare |
| text-red-200 | 1 | Rare |
| border-red-600 | 1 | Rare |
| bg-red-300 | 1 | Rare |

**Consolidation needed:** text-red-500 (86) vs text-red-600 (154) vs text-red-700 (63) for error text

### Emerald (Success/In-Progress — TO BE REPLACED WITH GREEN)

| Class | Count |
|-------|-------|
| text-emerald-600 | 123 |
| bg-emerald-50 | 114 |
| text-emerald-700 | 96 |
| bg-emerald-500 | 74 |
| border-emerald-200 | 51 |
| bg-emerald-100 | 48 |
| text-emerald-500 | 23 |
| text-emerald-800 | 14 |
| border-emerald-500 | 7 |
| border-emerald-300 | 7 |
| text-emerald-400 | 6 |
| bg-emerald-600 | 6 |
| bg-emerald-400 | 6 |
| text-emerald-900 | 5 |
| bg-emerald-700 | 5 |
| bg-emerald-200 | 4 |
| text-emerald-200 | 2 |
| border-emerald-100 | 2 |
| bg-emerald-300 | 2 |
| text-emerald-100 | 1 |

**Total emerald usages: ~596** — all need migration to green family

### Green (Currently minimal — will become the success color)

| Class | Count |
|-------|-------|
| text-green-600 | 25 |
| bg-green-100 | 12 |
| text-green-700 | 10 |
| bg-green-50 | 10 |
| border-green-200 | 9 |
| text-green-500 | 8 |
| bg-green-500 | 3 |
| bg-green-200 | 2 |
| text-green-900 | 1 |
| text-green-800 | 1 |
| border-green-600 | 1 |
| border-green-400 | 1 |
| bg-green-700 | 1 |
| bg-green-600 | 1 |

**Total green usages: ~85** — will grow significantly when emerald migrates

### Amber (Warning/Delayed)

| Class | Count |
|-------|-------|
| text-amber-700 | 131 |
| text-amber-600 | 112 |
| bg-amber-50 | 111 |
| border-amber-200 | 84 |
| bg-amber-100 | 80 |
| bg-amber-500 | 46 |
| text-amber-800 | 31 |
| text-amber-500 | 23 |
| bg-amber-200 | 12 |
| bg-amber-600 | 10 |
| text-amber-900 | 9 |
| bg-amber-700 | 8 |
| text-amber-400 | 5 |
| border-amber-300 | 5 |
| bg-amber-400 | 5 |
| border-amber-100 | 3 |
| text-amber-300 | 2 |
| text-amber-100 | 1 |
| border-amber-500 | 1 |
| border-amber-400 | 1 |

**Consolidation needed:** text-amber-600 (112) vs text-amber-700 (131) split

### Yellow (TO BE ELIMINATED — merge into amber)

| Class | Count |
|-------|-------|
| bg-yellow-500 | 2 |
| text-yellow-800 | 1 |
| text-yellow-600 | 1 |
| text-yellow-200 | 1 |
| bg-yellow-400 | 1 |
| bg-yellow-300 | 1 |
| bg-yellow-100 | 1 |

**Total: 8 uses** — small migration

### Slate (Neutral — DOMINANT)

| Class | Count |
|-------|-------|
| text-slate-500 | 1040 |
| border-slate-200 | 901 |
| text-slate-400 | 789 |
| text-slate-900 | 712 |
| text-slate-600 | 523 |
| text-slate-700 | 512 |
| bg-slate-50 | 493 |
| bg-slate-100 | 348 |
| border-slate-300 | 195 |
| bg-slate-200 | 148 |
| border-slate-100 | 133 |
| text-slate-300 | 117 |
| bg-slate-900 | 40 |
| bg-slate-800 | 34 |
| text-slate-800 | 33 |
| bg-slate-300 | 30 |
| bg-slate-400 | 21 |
| bg-slate-700 | 18 |
| border-slate-400 | 11 |
| Others | ~25 |

**Total: ~6,100+ slate usages** — this is the neutral backbone, largely consistent

### Purple (Tech role)

| Class | Count |
|-------|-------|
| bg-purple-100 | 34 |
| text-purple-700 | 28 |
| text-purple-600 | 13 |
| border-purple-200 | 11 |
| bg-purple-50 | 8 |
| text-purple-800 | 4 |
| bg-purple-500 | 4 |
| Others | ~6 |

### Orange (Anesthesiologist in staff-assignment — TO BE REPLACED WITH AMBER)

| Class | Count |
|-------|-------|
| text-orange-600 | 17 |
| bg-orange-100 | 14 |
| text-orange-800 | 8 |
| text-orange-700 | 8 |
| border-orange-200 | 7 |
| bg-orange-50 | 6 |
| text-orange-500 | 3 |
| border-orange-300 | 2 |
| bg-orange-500 | 2 |
| bg-orange-400 | 1 |

**Total: ~68 usages** — need migration to amber for anesthesiologist

### Indigo (facility_admin role)

| Class | Count |
|-------|-------|
| text-indigo-700 | 7 |
| bg-indigo-100 | 7 |
| bg-indigo-500 | 4 |
| border-indigo-200 | 3 |
| bg-indigo-50 | 3 |
| Others | ~5 |

---

## 4. Spacing Inventory

### Total Spacing Utilities: 7,911

### Grid-Compliant Values (on 8px grid with 4px half-steps)

| Value | px | Count | Grid step |
|-------|----|-------|-----------|
| gap-2 | 8px | 481 | 1x |
| px-4 | 16px | 474 | 2x |
| gap-3 | 12px | 341 | 1.5x |
| py-2 | 8px | 340 | 1x |
| px-3 | 12px | 334 | 1.5x |
| px-6 | 24px | 297 | 3x |
| py-3 | 12px | 284 | 1.5x |
| p-4 | 16px | 245 | 2x |
| py-4 | 16px | 244 | 2x |
| mt-1 | 4px | 241 | 0.5x |
| mb-2 | 8px | 226 | 1x |
| gap-4 | 16px | 217 | 2x |
| py-2.5 | 10px | 213 | — (half-step OK) |
| mb-1 | 4px | 212 | 0.5x |
| px-2 | 8px | 197 | 1x |
| mb-4 | 16px | 190 | 2x |
| mt-0.5 | 2px | 189 | — (micro OK) |
| py-0.5 | 2px | 176 | — (micro OK) |
| py-1 | 4px | 145 | 0.5x |
| p-2 | 8px | 145 | 1x |
| mb-3 | 12px | 145 | 1.5x |
| p-6 | 24px | 141 | 3x |
| mb-6 | 24px | 139 | 3x |
| gap-1 | 4px | 139 | 0.5x |
| py-1.5 | 6px | 132 | — (half-step OK) |
| p-3 | 12px | 127 | 1.5x |
| gap-1.5 | 6px | 127 | — (half-step OK) |
| (and many more...) | | | |

### Non-Grid-Compliant Values: 205 instances (2.6% of total)

| Value | px | Count | Fix target |
|-------|----|-------|------------|
| p-5 | 20px | 68 | → p-4 (16px) |
| px-5 | 20px | 63 | → px-4 (16px) |
| space-y-5 | 20px | 16 | → space-y-4 (16px) |
| pl-7 | 28px | 12 | Review: nested indent |
| pl-9 | 36px | 8 | Review: nested indent |
| pl-10 | 40px | 6 | Review: nested indent |
| mb-5 | 20px | 6 | → mb-4 (16px) |
| py-5 | 20px | 5 | → py-4 (16px) |
| pt-5 | 20px | 5 | → pt-4 (16px) |
| pb-5 | 20px | 3 | → pb-4 (16px) |
| pr-10 | 40px | 2 | Review |
| pl-11 | 44px | 2 | Review: nested indent |
| mt-5 | 20px | 2 | → mt-4 (16px) |
| space-y-10 | 40px | 1 | → space-y-8 (32px) |
| py-10 | 40px | 1 | → py-8 (32px) |
| mt-10 | 40px | 1 | → mt-8 (32px) |
| ml-7 | 28px | 1 | Review |
| ml-5 | 20px | 1 | → ml-4 (16px) |
| mb-10 | 40px | 1 | → mb-8 (32px) |
| gap-5 | 20px | 1 | → gap-4 (16px) |

### Arbitrary Bracket Spacing Values: 5 instances

| File | Value | Purpose |
|------|-------|---------|
| `app/status/[token]/page.tsx:160` | `-ml-[calc(50%-16px)]` | Progress bar centering |
| `components/analytics/financials/OverviewTab.tsx:473` | `gap-[2px]` | Chart bar micro-gap |
| `components/analytics/financials/OverviewTab.tsx:514` | `gap-[2px]` | Chart bar micro-gap |
| `components/analytics/Tracker.tsx:38` | `gap-[3px]` | Tracker bar micro-gap |
| `components/analytics/Tracker.tsx:83` | `gap-[2px]` | Mini tracker micro-gap |

These are all valid exceptions (chart rendering micro-adjustments).

### Grid Compliance: 97.4% (7,706 compliant / 7,911 total)

---

## 5. Inline Violation Inventory

### Inline Style Objects: 126 occurrences across 36 files

| File | Inline `style={{` count (approx) | Nature |
|------|----------------------------------|--------|
| `components/pip/PiPMilestonePanel.tsx` | ~80+ | **ENTIRE COMPONENT** is inline-styled (dark PiP overlay) |
| `components/block-schedule/WeekCalendar.tsx` | ~10 | Dynamic hex colors for surgeon blocks |
| `components/block-schedule/BlockPopover.tsx` | ~5 | Surgeon color badges |
| `components/block-schedule/BlockSidebar.tsx` | ~5 | Color picker swatches |
| `components/analytics/financials/OverviewTab.tsx` | ~5 | Chart bar widths/colors |
| `components/analytics/financials/ProcedureTab.tsx` | ~3 | Chart elements |
| `components/analytics/financials/SurgeonTab.tsx` | ~3 | Chart elements |
| `components/analytics/AnalyticsComponents.tsx` | ~3 | Dynamic chart colors |
| `app/analytics/block-utilization/page.tsx` | ~3 | Case color blocks |
| `app/analytics/orbit-score/page.tsx` | ~3 | Score visualization |
| `app/analytics/flags/page.tsx` | ~2 | Chart elements |
| `app/analytics/kpi/page.tsx` | ~2 | Chart elements |
| `app/admin/demo/page.tsx` | ~2 | Demo schedule grid |
| `app/block-schedule/page.tsx` | ~2 | Surgeon color coding |
| `app/status/[token]/page.tsx` | ~2 | Public status page |
| `app/login/page.tsx` | ~1 | Background styling |
| Other 20 files | ~1 each | Misc: tooltips, modals, skeletons, layouts |

### Hardcoded Hex Colors in TSX/TS: 145 occurrences across 15 files

| File | Hex colors used |
|------|----------------|
| `components/pip/PiPMilestonePanel.tsx` | #000, #fff, #3b82f6, #2563eb, #10b981, #f59e0b, #34d399, rgba() variants |
| `types/block-scheduling.ts` | 12 surgeon palette hex values |
| `hooks/useSurgeonColors.ts` | 10 surgeon palette hex values |
| `components/block-schedule/WeekCalendar.tsx` | Dynamic surgeon hex colors from state |
| `components/block-schedule/BlockCard.tsx` | Surgeon hex colors |
| `components/block-schedule/BlockSidebar.tsx` | Color picker hex values |
| `components/analytics/AnalyticsComponents.tsx` | Chart gradient hex values |
| `app/analytics/orbit-score/page.tsx` | Score gradient hex values |
| `app/analytics/surgeons/page.tsx` | Chart hex colors |
| `app/admin/docs/page.tsx` | Documentation color examples |
| `app/auth/reset-password/page.tsx` | Gradient hex values |
| `app/sentry-example-page/page.tsx` | Example styling |
| `lib/design-tokens.ts` | Shadow definitions use rgb() |
| `lib/email.ts` | Email template hex colors |
| `lib/orbitScoreEngine.ts` | Score calculation color mapping |

### Font Size Classes In Use

| Class | px value | Count | Role |
|-------|----------|-------|------|
| text-sm | 14px | 1,708 | **Dominant** — most body text |
| text-xs | 12px | 989 | Secondary text, table cells |
| text-2xl | 24px | 152 | Hero numbers, page titles |
| text-lg | 18px | 117 | Section headings |
| text-xl | 20px | 48 | Page titles |
| text-base | 16px | 44 | Base text (rarely explicit) |
| text-3xl | 30px | 23 | Large display |
| text-4xl | 36px | 3 | Very rare |
| text-5xl | 48px | 2 | Very rare |

**After 80% scaling:** text-sm (14px) → 11.2px, text-xs (12px) → 9.6px (BELOW 10px minimum)

---

## 6. Accessibility Gaps

### Buttons Without Accessible Text: ~625

Of ~699 total `<button>` elements, approximately 625 match patterns that may lack aria-label or visible text. Many of these are false positives (buttons with visible child text that regex doesn't detect). However, icon-only buttons are a real concern.

**Known icon-only button issues:**
- `components/ui/MilestoneButton.tsx`: Undo buttons are w-5 h-5 (20px) — below 24px minimum, no aria-label
- `components/ui/Toast/ToastProvider.tsx`: Close button `<X>` icon without aria-label
- `components/ui/Pagination.tsx`: Prev/next chevron buttons
- Various modal close buttons across the codebase

### Images Without Alt Text: 8 of 8 (0% compliance)

| File | Line | Element |
|------|------|---------|
| `app/status/[token]/page.tsx` | 314 | `<Image` — facility logo |
| `app/login/page.tsx` | 255 | `<Image` — brand logo |
| `app/login/page.tsx` | 296 | `<Image` — brand logo |
| `components/ui/StaffAvatar.tsx` | 61 | `<img` — staff photo |
| `components/ui/StaffAvatar.tsx` | 132 | `<img` — staff photo |
| `components/ui/StaffAvatar.tsx` | 182 | `<img` — staff photo |
| `components/FacilityLogoUpload.tsx` | 165 | `<img` — facility logo |
| `components/layouts/Header.tsx` | 103 | `<img` — facility logo |

### onClick on Non-Interactive Elements: ~10 div/span/tr/td instances

These elements use onClick without `role="button"` or keyboard event handlers:
- Various `<div onClick>` patterns for card clicks, row clicks
- `<tr onClick>` for table row navigation

### Color-Only Status Indicators: 15+ instances found

Files with colored dots (w-2/w-3 rounded-full) without text companions:
- `app/settings/cancellation-reasons/page.tsx:314` — active/inactive dot
- `app/settings/financials/cost-categories/page.tsx:498,562,648` — debit/credit dots
- `app/settings/financials/procedure-pricing/page.tsx:700,728` — pricing dots
- `app/settings/financials/surgeon-variance/page.tsx:618,653` — variance dots
- `app/settings/general/page.tsx:604` — status dot
- `app/settings/subscription/page.tsx:228` — plan status dot
- `app/spd/page.tsx:336,916,920` — SPD status dots

### Focus Indicators in CSS: Only 3 rules

Only 3 focus-related CSS rules in globals.css. Most focus styling relies on Tailwind's default `focus:` and `focus-visible:` utilities applied per-component. No global focus ring standard.

### Undersized Click Targets

- `components/ui/MilestoneButton.tsx`: Undo/remove buttons at w-5 h-5 (20x20px) — below both 24px minimum and 32px target
- Various small icon buttons throughout that may be below 32px target after 80% scaling

---

## 7. Third-Party Components

### Tremor (@tremor/react v3.18.7)

| Component | Used in | Custom sizing |
|-----------|---------|--------------|
| `AreaChart` | Analytics pages | No custom sizing — inherits container |
| `BarChart` | Analytics pages | No custom sizing — inherits container |

**Post-scale concerns:**
- Chart text labels, axis labels, legends, tooltips will shrink by 20%
- ~260 fill/stroke utility classes in globals.css required for Tailwind v4 compatibility
- Tremor CSS custom properties (20 vars in `@theme inline` block)

### Recharts (v3.6.0)

Import found in grep but actual usage may be indirect through Tremor or limited. No direct `import from 'recharts'` found in tsx files — may be a dependency of Tremor.

### @dnd-kit (Drag and Drop)

| File | Purpose |
|------|---------|
| `app/dashboard/page.tsx` | Room reordering |
| `components/dashboard/DroppableCaseRow.tsx` | Case row drag targets |
| `components/dashboard/RoomOrderModal.tsx` | Room ordering modal |
| `components/dashboard/StaffAssignmentPanel.tsx` | Staff drag-drop assignment |
| `components/dashboard/StaffDragOverlay.tsx` | Drag overlay component |
| `components/settings/SortableList.tsx` | Generic sortable list |

**Post-scale concerns:** Drag handles and drop zones must remain above 32px target click size.

### HeadlessUI (@headlessui/tailwindcss)

Used in 1 file: `components/analytics/financials/OutlierDetailDrawer.tsx`

### Lucide React (v0.562.0)

Icon library used across ~50+ component files. Icons are sized via className (w-4 h-4, w-5 h-5, etc.). After 80% scaling, rem-based icon sizes will shrink. Most use hardcoded w/h Tailwind classes which use rem.

### @heroicons/react

Secondary icon library. Used alongside Lucide in some components.

---

## 8. Testing Baseline

### Infrastructure

| Tool | Status |
|------|--------|
| Test runner | Vitest (vitest.config.ts exists) |
| Test environment | jsdom |
| React Testing Library | Installed (@testing-library/react, jest-dom, user-event) |
| Setup file | vitest.setup.ts exists |
| `npm run test` script | **NOT DEFINED** in package.json |
| Playwright/Cypress | **NOT INSTALLED** |

### Existing Tests: 23 files

**lib/ tests (13):**
- `lib/__tests__/logger.test.ts`
- `lib/__tests__/UserContext.test.tsx`
- `lib/__tests__/demo-data-generator.test.ts`
- `lib/__tests__/formatters-timestamp.test.ts`
- `lib/__tests__/pace-utils-milestone.test.ts`
- `lib/__tests__/milestone-order-dialog.test.tsx`
- `lib/__tests__/milestone-order.test.ts`
- `lib/__tests__/flip-room.test.ts`
- `lib/__tests__/delay-timer.test.ts`
- `lib/dal/__tests__/cases.test.ts`
- `lib/dal/__tests__/lookups.test.ts`
- `lib/validation/__tests__/schemas.test.ts`
- `lib/hooks/__tests__/useMilestoneRealtime.test.ts`

**components/ tests (9):**
- `components/ui/__tests__/SearchableDropdown.test.tsx`
- `components/ui/__tests__/MilestoneButton.test.tsx`
- `components/cases/__tests__/IncompleteCaseModal.test.tsx`
- `components/cases/__tests__/StaffMultiSelect.test.tsx`
- `components/cases/__tests__/CaseForm.test.tsx`
- `components/cases/__tests__/MilestoneCard.test.tsx`
- `components/cases/__tests__/MilestoneCard-pace.test.tsx`
- `components/cases/__tests__/FlipRoomCard.test.tsx`
- `components/cases/__tests__/CaseFlagsSection-timer.test.tsx`

**app/ tests (1):**
- `app/cases/bulk-create/__tests__/page.test.tsx`

### What's Missing
- **No design-tokens.test.ts** — no validation of token shapes, types, or grid compliance
- **No `test` script in package.json** — can't run `npm run test`
- **No ui/ component smoke tests** — only 2 of ~30 ui/ components have tests
- **No visual regression tests** — no screenshot comparison
- **No E2E workflow tests** — no Playwright/Cypress

---

## 9. Raw Terminal Output

### 0a: Design Token Source Files

```
grep -rl "spacing|fontSize|fontWeight|radius|shadow|zIndex|colors|palette" \
  --include="*.ts" --include="*.tsx" --include="*.css" \
  lib/ components/ app/ hooks/ types/ 2>/dev/null | sort

=> 170 files match (full list in Section 1)
```

### 0a: Theme/Token/Constants/Design Named Files

```
find . -type f \( -name "*theme*" -o -name "*token*" -o -name "*constants*" -o -name "*design*" \) \
  -not -path "./node_modules/*" -not -path "./.next/*"

./lib/design-tokens.ts
./lib/scanner/css-token-extractor.ts
```

### 0a: CSS Custom Properties

```
grep -n "^  --" app/globals.css

8:  --background: #ffffff;
9:  --foreground: #171717;
13:  --color-background: var(--background);
14:  --color-foreground: var(--foreground);
15:  --font-sans: var(--font-geist-sans);
16:  --font-mono: var(--font-geist-mono);
19:  --color-tremor-brand-faint: #eff6ff;
20:  --color-tremor-brand-muted: #bfdbfe;
21:  --color-tremor-brand-subtle: #60a5fa;
22:  --color-tremor-brand: #3b82f6;
23:  --color-tremor-brand-emphasis: #1d4ed8;
24:  --color-tremor-brand-inverted: #ffffff;
26:  --color-tremor-background-muted: #f9fafb;
27:  --color-tremor-background-subtle: #f3f4f6;
28:  --color-tremor-background: #ffffff;
29:  --color-tremor-background-emphasis: #374151;
31:  --color-tremor-border: #e5e7eb;
32:  --color-tremor-ring: #e5e7eb;
34:  --color-tremor-content-subtle: #9ca3af;
35:  --color-tremor-content: #6b7280;
36:  --color-tremor-content-emphasis: #374151;
37:  --color-tremor-content-strong: #111827;
38:  --color-tremor-content-inverted: #ffffff;
```

### 0b: Tailwind Spacing Classes (Top 50)

```
grep -roh spacing-utilities --include="*.tsx" | sort | uniq -c | sort -rn | head -50

 481 gap-2        474 px-4         341 gap-3         340 py-2
 334 px-3         297 px-6         284 py-3          245 p-4
 244 py-4         241 mt-1         226 mb-2          217 gap-4
 213 py-2.5       212 mb-1         197 px-2          190 mb-4
 189 mt-0.5       176 py-0.5       145 py-1          145 p-2
 145 mb-3         141 p-6          139 mb-6          139 gap-1
 132 py-1.5       127 p-3          127 gap-1.5        91 mb-1.5
  90 mt-2          75 mt-4          70 py-8           68 p-5
  67 px-1.5        65 py-12         63 px-5           60 space-y-3
  59 space-y-4     51 space-y-6     51 space-y-2      50 p-1.5
  43 ml-1          42 px-2.5        40 gap-6          39 mt-3
  38 p-8           38 mt-6          36 space-y-1      35 pb-3
  34 pt-4          29 mb-8
```

### 0b: Font Size Classes

```
text-sm   1708
text-xs    989
text-2xl   152
text-lg    117
text-xl     48
text-base   44
text-3xl    23
text-4xl     3
text-5xl     2
```

### 0c: Non-Grid Spacing Values

```
 68 p-5      63 px-5      16 space-y-5   12 pl-7
  8 pl-9      6 pl-10       6 mb-5        5 py-5
  5 pt-5      3 pb-5        2 pr-10       2 pl-11
  2 mt-5      1 space-y-10  1 py-10       1 mt-10
  1 ml-7      1 ml-5        1 mb-10       1 gap-5
```

### 0c: Grid Compliance Ratio

```
Total spacing utilities: 7,911
Non-grid (5,7,9,10,11,14): 205
Compliance: 97.4%
```

### 0c: Arbitrary Bracket Spacing

```
./app/status/[token]/page.tsx:160: -ml-[calc(50%-16px)]
./components/analytics/financials/OverviewTab.tsx:473: gap-[2px]
./components/analytics/financials/OverviewTab.tsx:514: gap-[2px]
./components/analytics/Tracker.tsx:38: gap-[3px]
./components/analytics/Tracker.tsx:83: gap-[2px]
```

### 0d: Accessibility Counts

```
Buttons without accessible text: ~625 (many false positives from regex)
Images total: 5 <img> tags + 3 <Image> components
Images with alt: 0
onClick on div/span/tr/td: 10
Focus rules in CSS: 3
```

### 0d: Color-Only Indicators (sample)

```
./app/settings/cancellation-reasons/page.tsx:314 - active/inactive dot
./app/settings/financials/cost-categories/page.tsx:498 - red dot (debit)
./app/settings/financials/cost-categories/page.tsx:562 - green dot (credit)
./app/settings/financials/cost-categories/page.tsx:648 - type indicator dot
./app/settings/financials/procedure-pricing/page.tsx:700 - red dot
./app/settings/financials/procedure-pricing/page.tsx:728 - green dot
./app/settings/financials/surgeon-variance/page.tsx:618 - red dot
./app/settings/financials/surgeon-variance/page.tsx:653 - green dot
./app/settings/general/page.tsx:604 - status dot
./app/settings/subscription/page.tsx:228 - plan status dot
./app/spd/page.tsx:916,920 - SPD status dots
```
