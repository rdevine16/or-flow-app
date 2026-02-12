# Phase 1: Consolidate Design Tokens — Implementation Plan

> Prerequisite: Read CLAUDE.md, PHASE_0_AUDIT.md, INTERVIEW_NOTES.md
> Goal: Create ONE canonical token file. Eliminate all other sources of truth.
> Commit message: `chore: consolidate design tokens into single source of truth`

---

## Table of Contents

1. [Exact Structure of lib/design-tokens.ts](#1-exact-structure-of-libdesign-tokensts)
2. [Files to Delete or Redirect](#2-files-to-delete-or-redirect)
3. [Color Migrations](#3-color-migrations)
4. [Spacing Standardization](#4-spacing-standardization)
5. [Tailwind / globals.css Changes](#5-tailwind--globalscss-changes)
6. [Test Harness Setup](#6-test-harness-setup)
7. [Estimated Scope](#7-estimated-scope)
8. [Risks and Open Questions](#8-risks-and-open-questions)
9. [Execution Order](#9-execution-order)

---

## 1. Exact Structure of lib/design-tokens.ts

The file must be restructured to include all sections specified in CLAUDE.md §1a. Here is the exact target structure with approved values:

```typescript
// lib/design-tokens.ts
// Central design system tokens for ORbit
// Single source of truth for all design values

// ============================================
// SPACING SYSTEM (8px grid)
// ============================================
export const spacing = {
  '0.5': '0.125rem',  // 2px  — micro adjustment
  '1':   '0.25rem',   // 4px  — tight association (icon-to-label)
  '1.5': '0.375rem',  // 6px  — half-step
  '2':   '0.5rem',    // 8px  — default internal spacing
  '2.5': '0.625rem',  // 10px — half-step
  '3':   '0.75rem',   // 12px — compact component padding
  '4':   '1rem',      // 16px — standard component padding
  '6':   '1.5rem',    // 24px — section spacing
  '8':   '2rem',      // 32px — major section breaks
  '12':  '3rem',      // 48px — page-level section separation
  '16':  '4rem',      // 64px — hero/header spacing
} as const

// ============================================
// TYPOGRAPHY (NEEDS_REVISIT: present post-80% ramp to owner for approval)
// ============================================
// NOTE: These are PRE-scaling values. After html{font-size:80%}, 1rem = 12.8px.
// Phase 2 will adjust these. For Phase 1, define the structure.
export const typography = {
  fontFamily: {
    sans: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
  },
  fontSize: {
    // Current standard Tailwind values — will be adjusted in Phase 2
    xs:   '0.75rem',    // 12px → 9.6px after 80% (NEEDS BUMP in Phase 2)
    sm:   '0.875rem',   // 14px → 11.2px after 80%
    base: '1rem',       // 16px → 12.8px after 80%
    lg:   '1.125rem',   // 18px → 14.4px after 80%
    xl:   '1.25rem',    // 20px → 16px after 80%
    '2xl': '1.5rem',    // 24px → 19.2px after 80%
    '3xl': '1.875rem',  // 30px → 24px after 80%
    '4xl': '2.25rem',   // 36px → 28.8px after 80%
  },
  fontWeight: {
    normal:   '400',  // body text, table cells
    medium:   '500',  // labels, table headers, nav items
    semibold: '600',  // card titles, section headings
    bold:     '700',  // page titles only (use sparingly)
  },
  lineHeight: {
    tight:   '1.25',
    snug:    '1.375',
    normal:  '1.5',
    relaxed: '1.75',
  },
} as const

// ============================================
// BORDER RADIUS
// ============================================
export const radius = {
  none: '0',
  sm:   '0.375rem',   // 6px
  md:   '0.5rem',     // 8px
  lg:   '0.75rem',    // 12px
  xl:   '1rem',       // 16px
  '2xl': '1.5rem',    // 24px
  full: '9999px',
} as const

// ============================================
// ELEVATION (SHADOWS)
// ============================================
export const elevation = {
  none: 'shadow-none',
  sm:   'shadow-sm',
  md:   'shadow-md',
  lg:   'shadow-lg',
  xl:   'shadow-xl',
  '2xl': 'shadow-2xl',
} as const

export const shadowValues = {
  none: '0 0 #0000',
  sm:   '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md:   '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg:   '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl:   '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const

// ============================================
// TRANSITIONS
// ============================================
export const transition = {
  fast:    '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base:    '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow:    '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slowest: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const

export const transitionClasses = {
  fast:      'transition-all duration-150 ease-out',
  base:      'transition-all duration-200 ease-out',
  slow:      'transition-all duration-300 ease-out',
  colors:    'transition-colors duration-200 ease-out',
  transform: 'transition-transform duration-200 ease-out',
} as const

// ============================================
// Z-INDEX SCALE
// ============================================
export const zIndex = {
  base:          0,
  dropdown:      1000,
  sticky:        1020,
  fixed:         1030,
  modalBackdrop: 1040,
  modal:         1050,
  popover:       1060,
  tooltip:       1070,
  toast:         1080,
} as const

// ============================================
// BREAKPOINTS
// ============================================
export const breakpoints = {
  sm:   '640px',
  md:   '768px',
  lg:   '1024px',
  xl:   '1280px',
  '2xl': '1536px',
} as const

// ============================================
// ANIMATION DURATIONS
// ============================================
export const animationDuration = {
  instant: '0ms',
  fast:    '150ms',
  base:    '200ms',
  slow:    '300ms',
  slower:  '500ms',
  slowest: '700ms',
} as const

// ============================================
// STATUS COLORS — Canonical semantic colors
// ============================================
// APPROVED: green (not emerald), red-600, blue-600, amber-700
export const statusColors = {
  scheduled: {
    bg: 'bg-blue-50',
    bgHover: 'hover:bg-blue-100',
    text: 'text-blue-700',
    textDark: 'text-blue-900',
    border: 'border-blue-200',
    borderDark: 'border-blue-300',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/20',
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
  },
  in_progress: {
    bg: 'bg-green-50',        // CHANGED from emerald
    bgHover: 'hover:bg-green-100',
    text: 'text-green-600',    // CHANGED: green-600 (approved)
    textDark: 'text-green-900',
    border: 'border-green-200',
    borderDark: 'border-green-300',
    dot: 'bg-green-500',
    ring: 'ring-green-500/20',
    gradient: 'bg-gradient-to-br from-green-50 to-green-100/50',
  },
  completed: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    text: 'text-slate-600',
    textDark: 'text-slate-900',
    border: 'border-slate-200',
    borderDark: 'border-slate-300',
    dot: 'bg-slate-400',
    ring: 'ring-slate-500/20',
    gradient: 'bg-gradient-to-br from-slate-50 to-slate-100/50',
  },
  delayed: {
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    text: 'text-amber-700',     // CONFIRMED: amber-700
    textDark: 'text-amber-900',
    border: 'border-amber-200',
    borderDark: 'border-amber-300',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
  },
  cancelled: {
    bg: 'bg-red-50',
    bgHover: 'hover:bg-red-100',
    text: 'text-red-600',       // CHANGED to red-600 (approved)
    textDark: 'text-red-900',
    border: 'border-red-200',
    borderDark: 'border-red-300',
    dot: 'bg-red-500',
    ring: 'ring-red-500/20',
    gradient: 'bg-gradient-to-br from-red-50 to-red-100/50',
  },
  active: {
    bg: 'bg-green-50',         // CHANGED from emerald
    bgHover: 'hover:bg-green-100',
    text: 'text-green-600',
    textDark: 'text-green-900',
    border: 'border-green-200',
    borderDark: 'border-green-300',
    dot: 'bg-green-500',
    ring: 'ring-green-500/20',
    gradient: 'bg-gradient-to-br from-green-50 to-green-100/50',
  },
  inactive: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    text: 'text-slate-600',
    textDark: 'text-slate-900',
    border: 'border-slate-200',
    borderDark: 'border-slate-300',
    dot: 'bg-slate-400',
    ring: 'ring-slate-500/20',
    gradient: 'bg-gradient-to-br from-slate-50 to-slate-100/50',
  },
  pending: {
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    text: 'text-amber-700',
    textDark: 'text-amber-900',
    border: 'border-amber-200',
    borderDark: 'border-amber-300',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
  },
} as const

// ============================================
// ALERT/NOTIFICATION COLORS
// ============================================
// CHANGED: success uses green (not green-800 for text, now green-600 for consistency)
export const alertColors = {
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',      // CHANGED from blue-800 to match canonical blue
    border: 'border-blue-200',
    icon: 'text-blue-500',
    button: 'text-blue-600 hover:text-blue-700',
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-600',     // CHANGED from green-800 to approved green-600
    border: 'border-green-200',
    icon: 'text-green-500',
    button: 'text-green-600 hover:text-green-700',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',     // CHANGED from amber-800 to approved amber-700
    border: 'border-amber-200',
    icon: 'text-amber-500',
    button: 'text-amber-600 hover:text-amber-700',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-600',       // CHANGED from red-800 to approved red-600
    border: 'border-red-200',
    icon: 'text-red-500',
    button: 'text-red-600 hover:text-red-700',
  },
} as const

// ============================================
// ROLE COLORS (for badges) — with border property added
// ============================================
// APPROVED: design-tokens.ts wins (50-level bg, amber for anesthesiologist)
// ADDED: border property (was missing)
// CHANGED: nurse from emerald to green
export const roleColors = {
  surgeon: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',    // NEW
    dot: 'bg-blue-500',
  },
  anesthesiologist: {
    bg: 'bg-amber-50',           // CONFIRMED: amber (not orange)
    text: 'text-amber-700',
    border: 'border-amber-200',   // NEW
    dot: 'bg-amber-500',
  },
  nurse: {
    bg: 'bg-green-50',           // CHANGED from emerald
    text: 'text-green-600',      // CHANGED from emerald-700 to green-600
    border: 'border-green-200',   // NEW (was emerald)
    dot: 'bg-green-500',
  },
  tech: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',  // NEW
    dot: 'bg-purple-500',
  },
  admin: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',   // NEW
    dot: 'bg-slate-500',
  },
  global_admin: {
    bg: 'bg-red-50',
    text: 'text-red-600',        // CHANGED to approved red-600
    border: 'border-red-200',     // NEW
    dot: 'bg-red-500',
  },
  facility_admin: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',  // NEW
    dot: 'bg-indigo-500',
  },
} as const

// ============================================
// SURGEON DATA VISUALIZATION PALETTE — NEW
// ============================================
// Consolidated from types/block-scheduling.ts, hooks/useSurgeonColors.ts, admin/demo
export const surgeonPalette = {
  hex: [
    '#3B82F6', // blue
    '#10B981', // green (was emerald - keeping hex as-is, it's a viz color)
    '#F59E0B', // amber
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#EF4444', // red
    '#84CC16', // lime
    '#A855F7', // violet
  ],
  tailwind: [
    { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-200' },
    { bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-200' },
    { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-200' },
    { bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-200' },
    { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-200' },
    { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-200' },
    { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-200' },
    { bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-200' },
    { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-200' },
    { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-200' },
    { bg: 'bg-lime-100',    text: 'text-lime-800',    border: 'border-lime-200' },
    { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-200' },
  ],
} as const

// ============================================
// COMPONENT SIZING — NEW
// ============================================
export const components = {
  button: {
    sm: { height: '32px', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    md: { height: '36px', padding: 'px-4 py-2',   fontSize: 'text-sm' },
    lg: { height: '44px', padding: 'px-6 py-2.5',  fontSize: 'text-base' },
  },
  input: {
    sm: { height: '32px', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    md: { height: '36px', padding: 'px-3 py-2',   fontSize: 'text-sm' },
    lg: { height: '44px', padding: 'px-4 py-2.5',  fontSize: 'text-base' },
  },
  table: {
    headerHeight: '36px',
    rowHeight: '40px',
    cellPaddingX: 'px-3',    // 12px
    cellPaddingY: 'py-2',    // 8px
  },
  badge: {
    height: '20px',
    padding: 'px-2 py-0.5',
    fontSize: 'text-xs',
  },
  card: {
    padding: 'p-4',           // 16px internal
    gap: 'gap-6',             // 24px between cards
  },
  modal: {
    padding: 'p-6',           // 24px
    maxWidth: 'max-w-lg',
  },
  sidebar: {
    width: '256px',           // 16rem
    itemPadding: 'px-3 py-2',
  },
} as const

// ============================================
// ACCESSIBILITY MINIMUMS — NON-NEGOTIABLE
// ============================================
export const a11y = {
  minClickTarget: 32,            // px — owner chose 32 (not WCAG's 24)
  minTextContrast: 4.5,          // ratio for body text
  minLargeTextContrast: 3,       // ratio for 18px+ text
  minUIContrast: 3,              // ratio for UI components
  criticalDataContrast: 7,       // ratio target for surgical timing data
  focusRingWidth: 2,             // px
  focusRingContrast: 3,          // ratio against surrounding content
} as const

// ============================================
// COMBINED EXPORT
// ============================================
export const tokens = {
  spacing,
  typography,
  radius,
  elevation,
  shadowValues,
  transition,
  transitionClasses,
  zIndex,
  breakpoints,
  animationDuration,
  components,
  a11y,
} as const

// ============================================
// HELPER FUNCTIONS (unchanged API, updated internals)
// ============================================
export function getStatusColors(status: string) { ... }   // keep existing
export function getStatusLabel(status: string | null) { ... } // keep existing
export function getAlertColors(variant: keyof typeof alertColors) { ... } // keep existing
export function getRoleColors(role: string) { ... }  // keep existing

// NEW: Get surgeon palette color by index
export function getSurgeonColor(index: number) {
  return {
    hex: surgeonPalette.hex[index % surgeonPalette.hex.length],
    ...surgeonPalette.tailwind[index % surgeonPalette.tailwind.length],
  }
}

// NEW: Get next available surgeon color
export function getNextSurgeonColor(usedColors: Set<string>): string {
  return surgeonPalette.hex.find(c => !usedColors.has(c)) || surgeonPalette.hex[0]
}
```

---

## 2. Files to Delete or Redirect

### Delete Exports (redirect consumers to design-tokens.ts)

| File | What to remove | Consumers to update |
|------|---------------|---------------------|
| `types/staff-assignment.ts` | Remove `ROLE_COLORS` constant (L56-82) and `getRoleColor()` function (L95-100) | `components/ui/StaffAvatar.tsx`, `components/cases/TeamMember.tsx`, `components/cases/StaffMultiSelect.tsx` |
| `types/block-scheduling.ts` | Remove `SURGEON_COLOR_PALETTE` (L133-146) and `getNextColor()` | `components/block-schedule/BlockPopover.tsx`, `components/block-schedule/BlockCard.tsx` |
| `hooks/useSurgeonColors.ts` | Remove `DEFAULT_COLORS` (L11-22), import from design-tokens instead | Self (internal reference) |
| `app/admin/demo/page.tsx` | Remove `SURGEON_COLORS` (L97-104), import from design-tokens | Self (internal reference) |

### Inline Color Definitions to Migrate (redirect to design-tokens)

| File | What to migrate |
|------|----------------|
| `components/dashboard/RoomGridView.tsx` | Replace `getStatusColor()` and `getStatusBgColor()` with imports from design-tokens `getStatusColors()` |
| `components/cases/CompletedCaseView.tsx` | Replace inline `bgColors`, `textColors`, `iconColors` with statusColors from design-tokens |
| `components/cases/TeamMember.tsx` | Replace `roleColorClasses` with `getRoleColors()` from design-tokens |
| `components/cases/StaffMultiSelect.tsx` | Replace `ROLE_SECTIONS` colors with `roleColors` from design-tokens |
| `components/dashboard/PaceProgressBar.tsx` | Replace `getPaceStatusColors()` with mappings from design-tokens |
| `components/analytics/financials/OverviewTab.tsx` | Replace inline `statusColors` with import |
| `app/settings/flags/page.tsx` | Replace severity color config with alertColors from design-tokens |

### Leave Alone (per owner decision)

- `components/pip/PiPMilestonePanel.tsx` — excluded from project entirely
- `components/analytics/AnalyticsComponents.tsx` — chart-specific colors (review in Phase 3)
- `components/analytics/Tracker.tsx` — chart micro-gap bracket values are fine

---

## 3. Color Migrations

### Emerald → Green (largest migration: ~596 usages)

| From | To | Est. count |
|------|----|-----------|
| `bg-emerald-50` | `bg-green-50` | 114 |
| `bg-emerald-100` | `bg-green-100` | 48 |
| `bg-emerald-200` | `bg-green-200` | 4 |
| `bg-emerald-300` | `bg-green-300` | 2 |
| `bg-emerald-400` | `bg-green-400` | 6 |
| `bg-emerald-500` | `bg-green-500` | 74 |
| `bg-emerald-600` | `bg-green-600` | 6 |
| `bg-emerald-700` | `bg-green-700` | 5 |
| `text-emerald-100` | `text-green-100` | 1 |
| `text-emerald-200` | `text-green-200` | 2 |
| `text-emerald-400` | `text-green-400` | 6 |
| `text-emerald-500` | `text-green-500` | 23 |
| `text-emerald-600` | `text-green-600` | 123 |
| `text-emerald-700` | `text-green-600` | 96 (consolidate to canonical 600) |
| `text-emerald-800` | `text-green-800` | 14 |
| `text-emerald-900` | `text-green-900` | 5 |
| `border-emerald-100` | `border-green-100` | 2 |
| `border-emerald-200` | `border-green-200` | 51 |
| `border-emerald-300` | `border-green-300` | 7 |
| `border-emerald-500` | `border-green-500` | 7 |
| `hover:bg-emerald-*` | `hover:bg-green-*` | ~10 |
| `ring-emerald-*` | `ring-green-*` | ~5 |

### Orange → Amber (for anesthesiologist role: ~68 usages)

| From | To |
|------|----|
| `bg-orange-50` | `bg-amber-50` |
| `bg-orange-100` | `bg-amber-100` |
| `bg-orange-400` | `bg-amber-400` |
| `bg-orange-500` | `bg-amber-500` |
| `text-orange-500` | `text-amber-500` |
| `text-orange-600` | `text-amber-600` |
| `text-orange-700` | `text-amber-700` |
| `text-orange-800` | `text-amber-800` |
| `border-orange-200` | `border-amber-200` |
| `border-orange-300` | `border-amber-300` |

**IMPORTANT:** Not all orange usages are anesthesiologist role. Some may be surgeon palette colors (orange is in the surgeon viz palette). Review contextually — only migrate role-related orange to amber.

### Yellow → Amber (8 usages)

| From | To |
|------|----|
| `bg-yellow-100` | `bg-amber-100` |
| `bg-yellow-300` | `bg-amber-300` |
| `bg-yellow-400` | `bg-amber-400` |
| `bg-yellow-500` | `bg-amber-500` |
| `text-yellow-200` | `text-amber-200` |
| `text-yellow-600` | `text-amber-600` |
| `text-yellow-800` | `text-amber-800` |

### Red Text Consolidation

| From | To | Context |
|------|----|---------|
| `text-red-500` | `text-red-600` | Where used as error text (review each) |
| `text-red-700` | `text-red-600` | Where used as error text (review each) |
| `text-red-800` | Keep or → `text-red-600` | Some may be intentional dark contexts |

### Amber Text Consolidation

| From | To | Context |
|------|----|---------|
| `text-amber-600` | `text-amber-700` | Where used as warning text |

### Blue Text Consolidation

Primary action text should standardize on `text-blue-600`:
| From | To | Context |
|------|----|---------|
| `text-blue-500` | `text-blue-600` | Where used as link/action text |
| `text-blue-800` | Keep for dark badge contexts |
| `text-blue-900` | Keep for very dark contexts |

---

## 4. Spacing Standardization

### Automatic Conversions (p-5/px-5 family → p-4/px-4)

| From | To | Count |
|------|----|-------|
| `p-5` | `p-4` | 68 |
| `px-5` | `px-4` | 63 |
| `py-5` | `py-4` | 5 |
| `pt-5` | `pt-4` | 5 |
| `pb-5` | `pb-4` | 3 |
| `mb-5` | `mb-4` | 6 |
| `mt-5` | `mt-4` | 2 |
| `ml-5` | `ml-4` | 1 |
| `space-y-5` | `space-y-4` | 16 |
| `gap-5` | `gap-4` | 1 |

### Large Value Conversions

| From | To | Count |
|------|----|-------|
| `py-10` | `py-8` | 1 |
| `mt-10` | `mt-8` | 1 |
| `mb-10` | `mb-8` | 1 |
| `space-y-10` | `space-y-8` | 1 |

### Review Individually (nested indentation)

| Value | Count | Files | Action |
|-------|-------|-------|--------|
| `pl-7` (28px) | 12 | Various settings/admin pages | Review: likely nested nav/list indent. Consider pl-6 or pl-8 |
| `pl-9` (36px) | 8 | Various settings/admin pages | Review: deeper nesting. Consider pl-8 or pl-12 |
| `pl-10` (40px) | 6 | Various settings/admin pages | Review: third-level nesting. Consider pl-8 or pl-12 |
| `pl-11` (44px) | 2 | Few files | Review: deepest nesting. Consider pl-12 |
| `pr-10` (40px) | 2 | Few files | Review: likely intentional wide padding |
| `ml-7` (28px) | 1 | 1 file | Review |

### Keep As-Is (valid exceptions)

| Value | Location | Reason |
|-------|----------|--------|
| `gap-[2px]` | OverviewTab.tsx, Tracker.tsx | Chart bar micro-gap |
| `gap-[3px]` | Tracker.tsx | Chart bar micro-gap |
| `-ml-[calc(50%-16px)]` | status/[token]/page.tsx | Progress bar centering |

---

## 5. Tailwind / globals.css Changes

### globals.css @theme Additions

No new `@theme` tokens needed in Phase 1. The existing Tremor tokens stay. Custom component sizing is defined in design-tokens.ts and consumed via Tailwind classes.

### globals.css CSS Class Updates

Update existing CSS component classes to use canonical color values:

| Class | Current issue | Fix |
|-------|--------------|-----|
| `.badge-success` | May use emerald | Change to green |
| `.alert-success` | May use emerald or green-800 | Verify uses green-50/green-600 |
| `.alert-warning` | May use amber-800 | Verify uses amber-50/amber-700 |
| `.alert-error` | May use red-800 | Verify uses red-50/red-600 |
| `.alert-info` | May use blue-800 | Verify uses blue-50/blue-600 |

**Read globals.css in full before making changes** — verify current values against canonical targets.

### No tailwind.config.ts

Per owner decision: do NOT create a tailwind.config.ts file. All Tailwind customization stays in the CSS `@theme inline` block.

---

## 6. Test Harness Setup

### Step 1: Add test script to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:watch": "vitest --watch"
  }
}
```

### Step 2: Create lib/__tests__/design-tokens.test.ts

Test coverage:
1. **Shape validation** — all expected exports exist (statusColors, alertColors, roleColors, surgeonPalette, spacing, typography, components, a11y)
2. **Type validation** — each status has bg, text, border, dot properties
3. **8px grid compliance** — spacing values map to 8px grid (4, 8, 12, 16, 24, 32, 48, 64, 96)
4. **Accessibility minimums** — a11y.minClickTarget >= 32, contrast ratios defined
5. **No emerald** — verify zero emerald references in statusColors, roleColors, alertColors
6. **Surgeon palette** — hex array has 12 entries, tailwind array has 12 entries
7. **Helper functions** — getStatusColors('in_progress') returns green colors, getRoleColors('surgeon') returns blue colors

### Step 3: Verify existing tests still pass

```bash
npx vitest run
```

All 23 existing tests must pass after design-tokens.ts changes.

---

## 7. Estimated Scope

### Files Affected

| Category | Count | Complexity |
|----------|-------|-----------|
| lib/design-tokens.ts | 1 | HIGH — major restructure |
| types/staff-assignment.ts | 1 | LOW — remove exports |
| types/block-scheduling.ts | 1 | LOW — remove exports |
| hooks/useSurgeonColors.ts | 1 | LOW — redirect imports |
| app/globals.css | 1 | MEDIUM — verify/update CSS classes |
| package.json | 1 | LOW — add test script |
| New: lib/__tests__/design-tokens.test.ts | 1 | MEDIUM — new test file |
| Color migration (emerald→green) | ~40-60 files | MEDIUM — search-and-replace with review |
| Color migration (orange→amber for roles) | ~5-10 files | LOW |
| Color migration (yellow→amber) | ~3-5 files | LOW |
| Color consolidation (red/amber/blue shades) | ~20-30 files | MEDIUM — contextual review |
| Inline color redirect (component files) | ~10 files | MEDIUM — refactor imports |
| Spacing fixes (p-5→p-4 etc.) | ~57 files | LOW — search-and-replace |

**Total: ~100-120 files touched**

### Time Estimate

Not providing — per project guidelines, focus on what needs to be done.

---

## 8. Risks and Open Questions

### Risks

1. **Emerald→green migration may break Tailwind safelist**: If any dynamic class construction uses emerald, the green equivalent must also be in the safelist. Check for template literal patterns like `` `bg-${color}-50` `` that might not be caught by find-and-replace.

2. **Tremor chart color classes**: globals.css has fill/stroke utilities for emerald. These must be updated to green OR kept alongside green versions if Tremor uses them internally.

3. **Orange in surgeon palette**: The surgeon viz palette legitimately uses orange (#F97316). When migrating anesthesiologist orange→amber for role colors, ensure surgeon palette orange is NOT affected.

4. **Existing tests**: The 23 existing tests may reference specific color classes (e.g., MilestoneButton.test.tsx). These need updating after color migrations.

5. **CSS class specificity**: globals.css component classes (.btn-*, .badge-*, .alert-*) may conflict with inline Tailwind classes in components. Verify ordering.

### Open Questions for Phase 1 to Resolve Early

1. **NEEDS_REVISIT: Typography rem values** — Calculate and present exact post-80% ramp to owner for approval before Phase 2 touches them. Phase 1 just documents the structure.

2. **Nested indentation (pl-7/9/10/11)**: Review the ~30 instances and decide on a consistent nesting pattern (e.g., pl-6 for L1, pl-8 for L2, pl-12 for L3).

3. **green-600 vs green-700**: The approved canonical text is green-600, but roleColors.nurse currently uses emerald-700. After migration, nurse text becomes green-600 (not green-700). Verify this looks right visually.

4. **Dynamic class patterns**: Search for patterns like `` `text-${color}` `` or `` `bg-${status}` `` that construct Tailwind classes dynamically. These won't be caught by simple find-and-replace.

---

## 9. Execution Order

Execute in this exact order to minimize risk:

### Step 1: Test baseline (verify green)
```bash
npx vitest run       # all 23 existing tests pass
npx tsc --noEmit     # zero type errors
npm run lint         # zero errors
npm run build        # zero errors
```

### Step 2: Add test infrastructure
- Add `"test": "vitest"` to package.json
- Create `lib/__tests__/design-tokens.test.ts` (test CURRENT shape first, then update)

### Step 3: Update lib/design-tokens.ts
- Restructure file per Section 1 spec
- Add new sections: surgeonPalette, components, a11y
- Change emerald→green in statusColors, roleColors
- Change alertColors text shades to canonical values
- Add border property to roleColors
- Add new helper functions (getSurgeonColor, getNextSurgeonColor)

### Step 4: Update design-tokens.test.ts
- Update tests to validate new shape
- Run tests: `npx vitest run`

### Step 5: Remove duplicate sources
- Remove ROLE_COLORS from types/staff-assignment.ts
- Remove SURGEON_COLOR_PALETTE from types/block-scheduling.ts
- Update hooks/useSurgeonColors.ts to import from design-tokens
- Update admin/demo/page.tsx to import from design-tokens
- Update all consumer components

### Step 6: Color migrations (emerald→green)
- Global find-and-replace with contextual review
- Update globals.css fill/stroke utilities if needed
- Update Tremor-related color utilities

### Step 7: Color migrations (orange→amber, yellow→amber)
- Targeted migrations for role colors only

### Step 8: Color consolidation (shade normalization)
- text-red-500/700 → text-red-600 (where semantic error text)
- text-amber-600 → text-amber-700 (where semantic warning text)
- text-blue-500 → text-blue-600 (where semantic action text)

### Step 9: Redirect inline color definitions
- Migrate ~10 component files to import from design-tokens instead of defining inline

### Step 10: Spacing fixes
- p-5/px-5 → p-4/px-4 (automatic)
- Review pl-7/9/10/11 individually
- Large values (py-10, mt-10, etc.) → grid-compliant

### Step 11: Verify globals.css CSS classes
- Ensure .btn-*, .badge-*, .alert-*, .card-*, .table-* classes match canonical token values

### Step 12: Final verification
```bash
npx vitest run       # all tests pass (old + new)
npx tsc --noEmit     # zero type errors
npm run lint         # zero errors
npm run build        # zero errors
```

### Step 13: Commit
```
chore: consolidate design tokens into single source of truth
```
