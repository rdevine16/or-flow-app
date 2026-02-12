# Phase 0 Interview Notes — Design System Density Project

> Collected: 2026-02-12
> Context: Post-Phase 0 audit, pre-Phase 1 implementation

---

## 1. Color Conflict Resolutions

### Role Colors
- **Winner: design-tokens.ts** — lighter 50-level backgrounds
- staff-assignment.ts ROLE_COLORS will be deleted/redirected to design-tokens.ts
- Anesthesiologist: **amber** (not orange)
- design-tokens.ts needs `border` property added to roleColors (currently missing)

### Green Family
- **Standardize on `green` everywhere** — replace all `emerald` with `green`
- statusColors.in_progress: emerald → green
- statusColors.active: emerald → green
- alertColors.success: already green (keep)
- roleColors.nurse: emerald → green

### Canonical Semantic Color Shades

| Semantic Meaning | Background | Text | Border | Dot |
|-----------------|------------|------|--------|-----|
| **Primary/Info/Scheduled** | bg-blue-50 | text-blue-700 (roles) / text-blue-600 (links/actions) | border-blue-200 | bg-blue-500 |
| **Success/In-Progress/Active** | bg-green-50 | text-green-600 | border-green-200 | bg-green-500 |
| **Warning/Delayed/Pending** | bg-amber-50 | text-amber-700 | border-amber-200 | bg-amber-500 |
| **Error/Cancelled** | bg-red-50 | text-red-600 | border-red-200 | bg-red-500 |
| **Neutral/Completed/Inactive** | bg-slate-100 | text-slate-600 | border-slate-200 | bg-slate-400 |

### Blue Usage Rules
- **bg-blue-600**: Primary button backgrounds
- **text-blue-600**: Links, primary action text
- **bg-blue-50**: Badge/status backgrounds
- **text-blue-700**: Role badge text, darker contexts

### Surgeon Color Palette
- **Consolidate into design-tokens.ts** as a `surgeonPalette`
- All three current sources (types/block-scheduling.ts, hooks/useSurgeonColors.ts, admin/demo/page.tsx) redirect to single source

---

## 2. Grid & Spacing Decisions

### Grid Compliance Strategy
- **Convert most, review edge cases**
- `p-5`/`px-5` (20px) → `p-4`/`px-4` (16px) in most cases
- `pl-7`/`pl-9`/`pl-10`/`pl-11` — review individually (likely nested indentation)
- Arbitrary bracket values in chart components (`gap-[2px]`, `gap-[3px]`) — keep as-is (valid exceptions)
- Goal: 100% grid compliance on 8px base with 4px half-steps

---

## 3. Typography Decisions

### Type Ramp
- **User wants to review the math** before committing
- Current design-tokens.ts uses standard Tailwind rem values that will undershoot after 80% scaling
- Will present adjusted rem values during Phase 1 for approval
- Every standard Tailwind text class needs bump to hit CLAUDE.md targets post-scaling
- **10px minimum enforced** — text-xs at 80% would be 9.6px, needs correction

### Post-80% Target Ramp (needs final approval)
| Target | Rem needed (÷12.8) | Purpose |
|--------|-------------------|---------|
| 10px | 0.781rem | Fine print, timestamps |
| 11px | 0.859rem | Captions, helper text |
| 12px | 0.938rem | Table cells, secondary body |
| 13px | 1.016rem | Primary body (new base) |
| 14px | 1.094rem | Card titles, emphasized body |
| 16px | 1.25rem | Section headings |
| 18px | 1.406rem | Page subtitles |
| 20px | 1.563rem | Page titles |
| 24px | 1.875rem | Hero numbers |

---

## 4. Density Decisions

### Root Scaling
- **80% uniform everywhere** — no per-page exceptions
- Login, auth pages get same density treatment as everything else

### Component Sizing
- **32px minimum click targets across the board** (not 24px)
- Surgical context: users may be rushed or wearing gloves
- Table rows: 36-40px per CLAUDE.md
- Badges: 20px height per CLAUDE.md
- All interactive elements must meet 32px minimum

---

## 5. Technical Decisions

### Charts (Tremor/Recharts)
- **Fix what breaks, minimal override**
- Apply 80% scaling, then only override chart elements that become unreadable
- Keep existing ~260 fill/stroke utilities in globals.css for Tremor v4 compatibility

### Tailwind Configuration
- **CSS @theme only** — stay with Tailwind v4 conventions
- No tailwind.config.ts (doesn't exist, won't create one)
- Add custom tokens to `@theme inline` block in globals.css

### Source of Truth Architecture
- **design-tokens.ts**: Canonical VALUES — color mappings, spacing scale, typography scale, status/role/alert color objects, helper functions
- **globals.css CSS classes**: Canonical PATTERNS — .btn-primary, .card-base, .table-header, .badge-base, .alert-info etc.
- Both reference the same Tailwind color shades, no duplication of purpose
- design-tokens.ts is for programmatic access (dynamic status colors, role badges)
- CSS classes are for template-level styling (consistent component appearance)

### Testing
- **Add `test` script to package.json**
- **Create design-tokens.test.ts** — validate shape, types, 8px grid compliance, a11y minimums
- **Add smoke tests** for components/ui/ components
- **No Playwright/E2E** — build+lint+vitest is the test suite
- Existing 23 tests must continue to pass

---

## 6. UX & User Context

### User Profiles
- **All three user types equally important**: charge nurses (dashboard), surgeons (case detail/analytics), admins (settings/management)
- No single dominant persona — all pages get equal scrutiny

### Primary Viewport
- **1440x900** (laptops) is the primary target
- Also test 1920x1080 and 2560x1440
- 1024x768 for graceful degradation

### Accessibility
- **WCAG 2.2 AA sufficient** — no additional hospital-specific requirements
- No Section 508 requirement at this time

---

## 7. Scope & Priorities

### Dark Mode
- **Light-mode only, no dark prep**
- Ignore existing minimal dark mode CSS
- Don't structure tokens for future dark mode compatibility
- Separate project entirely if/when needed

### Pages
- **Nothing excluded** — all pages are in scope
- **Nothing is off-limits** or considered too fragile to touch
- PiP Milestone Panel: **leave alone** (standalone inline-styled overlay)

### Timeline
- **Thoroughness first** — do it right, follow all phases
- No shortcuts on testing or documentation phases

### Roadmap Conflicts
- **None expected** — codebase is stable, no major feature branches

---

## Summary of Key Decisions for Phase 1

1. Consolidate all color definitions into design-tokens.ts + globals.css CSS classes
2. Standardize: green (not emerald), amber (not yellow/orange), red-600, blue-600, amber-700, green-600
3. Convert p-5/px-5 → p-4/px-4, review pl-7+ individually
4. 80% root font-size uniform, 32px min click targets
5. Adjust type ramp rem values to hit CLAUDE.md targets post-scaling (present for approval)
6. CSS @theme for Tailwind v4 custom tokens, no tailwind.config.ts
7. Add vitest test script + design token tests
8. Light-mode only, leave PiP panel alone
9. Surgeon color palette consolidated into design-tokens.ts
10. Fix chart readability only where broken, minimal overrides
