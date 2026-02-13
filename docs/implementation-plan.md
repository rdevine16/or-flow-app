# Implementation Plan: Design System Consistency Audit & Cleanup

> Created: 2026-02-13
> Feature spec: docs/active-feature.md
> Branch: feature/design-system-cleanup

---

## Summary

Make every color, spacing value, font size, and visual property in the ORbit web app trace back to a single source of truth: `lib/design-tokens.ts` for programmatic values and `app/globals.css` CSS variables for theme-level tokens. Eliminate hardcoded values, inconsistent spacing, dead CSS, rogue hex colors, and inline styles.

---

## Interview Decisions

| Decision | Answer | Impact |
|----------|--------|--------|
| Green vs emerald | **All green** — replace emerald everywhere | ~596 usages across ~50 files |
| Role colors conflict | **design-tokens.ts wins** — lighter bg-X-50, amber for anesthesiologist | Delete ROLE_COLORS from staff-assignment.ts |
| Error red shade | **text-red-600** canonical | Migrate text-red-500 and text-red-700 |
| Warning amber shade | **text-amber-700** canonical | Migrate text-amber-600 |
| Border radius | **Intentional hierarchy** — rounded-lg for small, rounded-xl for large | Document convention, audit per-element |
| Arbitrary text sizes | **Normalize** to nearest Tailwind size | text-[10px] → text-xs, text-[11px] → text-xs |
| PiP panel | **Excluded** — don't touch PiPMilestonePanel.tsx | Skip entirely |
| Dead CSS classes | **Remove** ~392 lines of unused .btn-*, .card-*, .table-*, etc. | Lines 604-995 of globals.css |
| Surgeon palettes | **Consolidate** three sources into design-tokens.ts | Add getSurgeonColor() helper |
| Shadcn components | **Refactor** to import from design-tokens.ts | True single source of truth |
| Inline styles | **Convert static** to Tailwind, keep dynamic (calculated widths) | ~38 instances to review |
| Page title weight | **font-semibold** for all titles, font-bold for hero numbers only | Migrate ~81 font-bold title usages |
| Phase size | **~15-20 files per phase** | Lower risk per session |

---

## Non-Negotiables

1. **PiP panel excluded** — PiPMilestonePanel.tsx is not touched
2. **No tailwind.config.ts** — Tailwind v4 CSS-first, all config in @theme inline
3. **No dark mode work** — light-mode only for this project
4. **No behavior changes** — styling only, no data flow or logic changes
5. **Existing tests must pass** after every phase

---

## Phases

### Phase 1: Design Token Foundation
**What:** Restructure `lib/design-tokens.ts` to be the complete single source of truth. Add missing sections, consolidate surgeon palette, add component sizing tokens, add helpers.

**Files touched (~12):**
- `lib/design-tokens.ts` — major restructure (add surgeonPalette, components sizing, a11y minimums, border on roleColors, emerald→green in token values)
- `lib/__tests__/design-tokens.test.ts` — NEW: validate token shape, grid compliance, no emerald, helper functions
- `types/staff-assignment.ts` — remove ROLE_COLORS and getRoleColor()
- `types/block-scheduling.ts` — remove SURGEON_COLOR_PALETTE and getNextColor()
- `hooks/useSurgeonColors.ts` — redirect to design-tokens.ts imports
- `app/admin/demo/page.tsx` — redirect SURGEON_COLORS to design-tokens.ts
- `package.json` — add "test" script if missing
- Consumers of deleted exports: `components/ui/StaffAvatar.tsx`, `components/cases/TeamMember.tsx`, `components/cases/StaffMultiSelect.tsx`, `components/block-schedule/BlockPopover.tsx`, `components/block-schedule/BlockCard.tsx`

**Commit:** `feat(design-system): phase 1 - consolidate design tokens into single source of truth`

**3-stage test gate:**
1. Unit: design-tokens.test.ts passes (shape, types, grid compliance, no emerald)
2. Integration: all consumers of deleted exports compile and work
3. Workflow: typecheck + lint + existing tests pass

**Complexity:** Medium

---

### Phase 2: Emerald → Green Migration
**What:** Replace all ~596 emerald Tailwind class usages with green equivalents across the entire codebase. Also update globals.css chart fill/stroke utilities.

**Files touched (~50):**
- All files using emerald-* classes (bg-emerald-50 → bg-green-50, text-emerald-600 → text-green-600, etc.)
- `app/globals.css` — update emerald fill/stroke/bg chart utilities to green
- Exclude: PiPMilestonePanel.tsx

**Key migration table:**
| From | To |
|------|----|
| bg-emerald-* | bg-green-* |
| text-emerald-700 | text-green-600 (canonical) |
| text-emerald-600 | text-green-600 |
| text-emerald-* (other) | text-green-* (same shade) |
| border-emerald-* | border-green-* |
| hover:bg-emerald-* | hover:bg-green-* |
| ring-emerald-* | ring-green-* |

**Commit:** `feat(design-system): phase 2 - migrate emerald to green`

**3-stage test gate:**
1. Unit: zero emerald references in codebase (excluding PiP panel, node_modules)
2. Integration: all components using green render correctly
3. Workflow: typecheck + lint + build + existing tests pass

**Complexity:** Medium (high volume but mechanical)

---

### Phase 3: Color Shade Consolidation & Minor Migrations
**What:** Standardize red, amber, blue text shades. Migrate orange→amber for role contexts. Migrate yellow→amber. Consolidate to canonical shades.

**Files touched (~20-30):**
- Red consolidation: text-red-500 → text-red-600, text-red-700 → text-red-600 (where semantic error text)
- Amber consolidation: text-amber-600 → text-amber-700 (where semantic warning text)
- Blue consolidation: text-blue-500 → text-blue-600 (where semantic action/link text)
- Orange→amber: bg-orange-* → bg-amber-*, text-orange-* → text-amber-* (role contexts only, ~68 usages)
- Yellow→amber: ~8 usages

**Commit:** `feat(design-system): phase 3 - consolidate color shades and minor migrations`

**3-stage test gate:**
1. Unit: canonical shades used consistently (grep verification)
2. Integration: status badges, alerts, role badges render with correct colors
3. Workflow: typecheck + lint + build + existing tests pass

**Complexity:** Medium (contextual review needed — not all red-500/700 should change)

---

### Phase 4: Shadcn Component Refactor
**What:** Refactor shadcn/ui base components to import color values from design-tokens.ts instead of hardcoding them inline.

**Files touched (~15):**
- `components/ui/Button.tsx` — variant colors from design-tokens
- `components/ui/Badge.tsx` — variant colors from design-tokens
- `components/ui/Card.tsx` / `CardEnhanced.tsx` — colors from design-tokens
- `components/ui/Input.tsx` — colors from design-tokens
- `components/ui/StatusBadge.tsx` — already uses getStatusColors(), verify
- `components/ui/MetricCard.tsx` — colorClasses from design-tokens
- `components/ui/Loading.tsx` — colorClasses from design-tokens
- `components/ui/Modal.tsx` — verify token usage
- `components/ui/PhaseBadge.tsx` — colors from design-tokens
- `components/ui/StaffBadge.tsx` — colors from design-tokens
- `components/ui/ErrorBanner.tsx` — colors from design-tokens
- `components/ui/EmptyState.tsx` — verify
- `components/ui/Toggle.tsx` — colors from design-tokens
- `components/ui/FloatingActionButton.tsx` — colors from design-tokens

**Commit:** `feat(design-system): phase 4 - refactor shadcn components to use design tokens`

**3-stage test gate:**
1. Unit: components render all variants correctly
2. Integration: pages using these components look the same
3. Workflow: typecheck + lint + build + existing component tests pass

**Complexity:** Medium

---

### Phase 5: Inline Color Redirects & Dead CSS Removal
**What:** Redirect component-level inline color definitions to design-tokens.ts. Remove ~392 lines of dead CSS from globals.css. Convert static inline styles to Tailwind.

**Files touched (~18):**
- `app/globals.css` — remove dead CSS classes (lines ~604-995)
- `components/dashboard/RoomGridView.tsx` — replace getStatusColor()/getStatusBgColor() with design-tokens
- `components/dashboard/PaceProgressBar.tsx` — replace getPaceStatusColors()
- `components/cases/CompletedCaseView.tsx` — replace inline bgColors/textColors/iconColors
- `components/cases/TeamMember.tsx` — replace roleColorClasses with getRoleColors()
- `components/cases/StaffMultiSelect.tsx` — replace ROLE_SECTIONS colors
- `components/analytics/financials/OverviewTab.tsx` — replace inline statusColors
- `app/settings/flags/page.tsx` — replace severity color config
- `app/settings/cancellation-reasons/page.tsx` — replace category colors
- Static inline style conversions across ~10 files (style={{color: '#fff'}} → Tailwind class)

**Commit:** `feat(design-system): phase 5 - redirect inline colors to tokens, remove dead CSS`

**3-stage test gate:**
1. Unit: no dead CSS classes remain, inline color definitions removed
2. Integration: all redirected components render correctly
3. Workflow: typecheck + lint + build + existing tests pass

**Complexity:** Medium

---

### Phase 6: Spacing Standardization
**What:** Fix non-grid spacing values. p-5→p-4 family, large values to grid-compliant, review nested indentation.

**Files touched (~20):**
- p-5/px-5/py-5/pt-5/pb-5 → p-4 family (~170 instances across ~57 files, batched to ~20 per session)
- mb-5/mt-5/ml-5 → mb-4/mt-4/ml-4
- space-y-5 → space-y-4
- gap-5 → gap-4
- Large values: py-10→py-8, mt-10→mt-8, mb-10→mb-8, space-y-10→space-y-8
- Review: pl-7/pl-9/pl-10/pl-11 (nested indentation — standardize to pl-6/pl-8/pl-12 hierarchy)

**Commit:** `feat(design-system): phase 6 - standardize spacing to 8px grid`

**3-stage test gate:**
1. Unit: zero non-grid spacing values (excluding valid exceptions: gap-[2px], gap-[3px])
2. Integration: page layouts maintain visual consistency
3. Workflow: typecheck + lint + build + existing tests pass

**Complexity:** Low-Medium (mostly mechanical search-and-replace)

---

### Phase 7: Typography & Button Sizing Consistency
**What:** Standardize page title weight (font-semibold), normalize arbitrary text sizes, ensure consistent button/badge sizing patterns. Document border-radius hierarchy.

**Files touched (~20):**
- Page titles: font-bold → font-semibold (where used as page/section titles, ~81 instances)
- Arbitrary text sizes: text-[10px] → text-xs, text-[11px] → text-xs (~182 instances)
- Button sizing: audit and normalize padding patterns across pages
- Badge sizing: ensure consistent px-2 py-0.5 text-xs pattern
- Border-radius: audit rounded-lg vs rounded-xl usage, enforce hierarchy (rounded-lg for buttons/badges/inputs, rounded-xl for cards/modals)
- Shadow: audit shadow-sm vs shadow-lg usage

**Commit:** `feat(design-system): phase 7 - standardize typography, sizing, and radius`

**3-stage test gate:**
1. Unit: zero arbitrary text sizes, consistent title weights
2. Integration: visual hierarchy maintained (titles > headings > body > secondary)
3. Workflow: typecheck + lint + build + existing tests pass

**Complexity:** Medium

---

### Phase 8: Priority Page Cleanup
**What:** Final sweep of priority pages — Case Detail, Dashboard, Analytics, Cases List. Fix any remaining hardcoded hex values, inline styles, or inconsistencies.

**Files touched (~15):**
- `app/cases/[id]/page.tsx` — case detail (largest page, ~1400 lines)
- `app/dashboard/page.tsx` — main dashboard
- `app/analytics/page.tsx` — analytics hub
- `app/analytics/orbit-score/page.tsx` — ORbit score
- `app/cases/page.tsx` — cases list
- `app/cases/[id]/edit/page.tsx` — case edit
- `app/cases/new/page.tsx` — new case
- `app/cases/bulk-create/page.tsx` — bulk create
- Related analytics subpages as needed

**Commit:** `feat(design-system): phase 8 - priority page cleanup`

**3-stage test gate:**
1. Unit: zero hardcoded hex/rgb in priority pages
2. Integration: pages render correctly with token-based colors
3. Workflow: full test suite passes, visual spot-check

**Complexity:** Medium

---

### Phase 9: Remaining Pages Cleanup
**What:** Final sweep of all remaining pages — Settings, Admin, Login, Profile, Block Schedule, SPD, Status pages.

**Files touched (~20):**
- `app/login/page.tsx` — login/branding
- `app/settings/**/*.tsx` — all settings pages
- `app/admin/**/*.tsx` — admin pages
- `app/profile/page.tsx` — user profile
- `app/block-schedule/page.tsx` — block schedule
- `app/spd/page.tsx` — SPD page
- `app/status/[token]/page.tsx` — public status page
- Other remaining pages

**Commit:** `feat(design-system): phase 9 - remaining pages cleanup`

**3-stage test gate:**
1. Unit: zero hardcoded hex/rgb in any page-level code (excluding PiP panel)
2. Integration: all pages render correctly
3. Workflow: full test suite + typecheck + lint + build pass

**Complexity:** Medium

---

### Phase 10: Final Verification & Cleanup
**What:** Full codebase sweep to verify all acceptance criteria are met. Fix any stragglers. Run full test suite.

**Files touched (~5):**
- Any remaining violations found during final sweep
- `lib/design-tokens.ts` — final shape verification
- `app/globals.css` — verify clean

**Acceptance criteria verification:**
- [ ] Zero hardcoded hex colors in page-level code (components/ui excluded since shadcn manages those — but now they import from design-tokens too)
- [ ] Spacing consistent — same UI element uses same spacing across all pages
- [ ] Typography hierarchy consistent across all pages
- [ ] All buttons use consistent sizing
- [ ] Border-radius hierarchy documented and enforced
- [ ] All tests pass (typecheck + lint + test + build)
- [ ] No TypeScript `any` types introduced

**Commit:** `feat(design-system): phase 10 - final verification and cleanup`

**3-stage test gate:**
1. Unit: comprehensive grep scan for remaining violations
2. Integration: spot-check each priority page
3. Workflow: npm run typecheck && npm run lint && npx vitest run && npm run build

**Complexity:** Low

---

## Phase Dependencies

```
Phase 1 (tokens) → Phase 2 (emerald→green) → Phase 3 (shade consolidation)
                 → Phase 4 (shadcn refactor)
                 → Phase 5 (inline redirects + dead CSS)
Phase 3 + 4 + 5 → Phase 6 (spacing)
Phase 6          → Phase 7 (typography/sizing)
Phase 7          → Phase 8 (priority pages)
Phase 8          → Phase 9 (remaining pages)
Phase 9          → Phase 10 (final verification)
```

Phases 2, 4, and 5 can run in parallel after Phase 1 (no file overlap). All others are sequential.

---

## Estimated Total Files Modified

~120-150 files across 10 phases. No database changes. No behavior changes. Styling only.
