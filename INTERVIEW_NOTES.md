# Phase 0 Interview Notes — Owner Decisions for Density Project

> Collected: 2026-02-12
> Format: Question asked → Answer given → Implications

---

## Audit Findings

### Role Colors Conflict
**Q:** design-tokens.ts uses lighter shades (bg-X-50) while types/staff-assignment.ts uses deeper shades (bg-X-100). Anesthesiologist is amber in design-tokens vs orange in staff-assignment. Which source wins?
**A:** design-tokens.ts wins.
**Implication:** staff-assignment.ts ROLE_COLORS and getRoleColor() will be deleted. All consumers redirect to design-tokens.ts. Anesthesiologist = amber. Background shade = 50-level. design-tokens.ts roleColors needs `border` property added (currently missing).

### Green vs Emerald
**Q:** statusColors use emerald for success/in-progress, but alertColors use green for success. Standardize on one?
**A:** All green. Replace emerald with green everywhere.
**Implication:** ~596 emerald class usages across the codebase need migration to green equivalents. This is the single largest color migration in the project.

### Error Red Shade
**Q:** Error text is spread across text-red-500 (86 uses), text-red-600 (154 uses), text-red-700 (63 uses). Which is canonical?
**A:** text-red-600.
**Implication:** Migrate text-red-500 and text-red-700 to text-red-600 where they serve as error/danger text. Some usages may be intentional (hover states, dark backgrounds) — review contextually.

### Blue Shades
**Q:** What are the canonical blue shades for buttons, links, and badges?
**A:** bg-blue-600 for primary buttons, text-blue-600 for links/actions, bg-blue-50 for badge backgrounds.
**Implication:** Standardize across the ~1,100+ blue usages. text-blue-700 remains valid for role badge text in darker contexts.

### Amber Shade
**Q:** Warning text uses both text-amber-600 (112) and text-amber-700 (131). Which is canonical?
**A:** text-amber-700.
**Implication:** Migrate text-amber-600 → text-amber-700 for warning/delayed semantic text. Note: this breaks the "600 for everything" pattern but owner explicitly chose 700 for amber.

### Green Shade
**Q:** With green replacing emerald, should success text be text-green-600, text-green-700, or text-green-800?
**A:** text-green-600.
**Implication:** Consistent with blue-600, red-600 pattern for semantic action text.

### Surgeon Color Palettes (3 sources)
**Q:** Consolidate into design-tokens.ts or keep separate?
**A:** Consolidate into design-tokens.ts.
**Implication:** Add `surgeonPalette` to design-tokens.ts. All three current sources (types/block-scheduling.ts, hooks/useSurgeonColors.ts, admin/demo/page.tsx) redirect to single source.

---

## Design Decisions

### Typography Scale
**Q:** Are you happy with the CLAUDE.md proposed post-scale type ramp (10px→24px)?
**A:** Adjust the ramp — wants to see the math and approve specific sizes before committing.
**NEEDS_REVISIT:** Present the exact rem values during Phase 1 implementation for final approval. The post-80% ramp calculation:
- 10px = 0.781rem, 11px = 0.859rem, 12px = 0.938rem, 13px = 1.016rem
- 14px = 1.094rem, 16px = 1.25rem, 18px = 1.406rem, 20px = 1.563rem, 24px = 1.875rem
- Key issue: current text-xs (0.75rem) becomes 9.6px after scaling — below 10px minimum

### Density Exceptions
**Q:** Any pages that should be more or less dense than the 80% default?
**A:** 80% everywhere uniformly. No exceptions.
**Implication:** Login, auth pages, settings — everything gets the same density treatment. Simpler implementation.

### Component Sizing
**Q:** CLAUDE.md specifies 24px min click targets (32px target). What feels right for surgical users?
**A:** Slightly larger targets — 32px minimum across the board.
**NON-NEGOTIABLE:** All interactive elements must be at least 32x32px. This is stricter than WCAG's 24px and accounts for rushed/gloved surgical users.

---

## Technical Tradeoffs

### Charts (Tremor/Recharts)
**Q:** How much custom override effort for chart readability after 80% scaling?
**A:** Fix what breaks, minimal override. Don't exempt charts or create full custom theme.
**Implication:** Apply 80% scaling, then spot-fix any chart text that becomes unreadable. Keep overrides small and targeted.

### Tailwind Configuration
**Q:** CSS @theme only (Tailwind v4 native) or create a tailwind.config.ts?
**A:** CSS @theme only.
**NON-NEGOTIABLE:** No tailwind.config.ts file. Stay with Tailwind v4 conventions. Custom tokens go in `@theme inline` block in globals.css.

### Source of Truth Architecture
**Q:** globals.css CSS classes vs design-tokens.ts — which pattern for single source of truth?
**A:** Both, reconciled. design-tokens.ts for VALUES (color mappings, status/role objects, helper functions). CSS classes in globals.css for PATTERNS (.btn-primary, .card-base, .table-header). Both reference same canonical Tailwind shades.
**Implication:** design-tokens.ts is for programmatic/dynamic access. CSS classes are for template-level consistent styling. Neither duplicates the other's purpose.

### Testing
**Q:** What testing infrastructure to add?
**A:** Add test script + token tests. No Playwright/E2E.
**Implication:** Add `"test": "vitest"` to package.json scripts. Create design-tokens.test.ts validating shape, types, grid compliance, a11y minimums. Add smoke tests for components/ui/. Existing 23 tests must continue passing.

---

## UX & User Context

### Primary Users
**Q:** Who are the primary users and what screens do they live on most?
**A:** Mix of all three — charge nurses (dashboard), surgeons (case detail/analytics), admins (settings/management). All equally important.
**Implication:** No page gets preferential treatment. All pages get full density audit in Phase 3.

### Primary Viewport
**Q:** What screen sizes do actual users use?
**A:** Mostly 1440x900 (laptops).
**Implication:** 1440x900 is the primary test viewport. Also test 1920x1080 and 2560x1440. 1024x768 for graceful degradation.

### Accessibility Requirements
**Q:** Any requirements beyond WCAG 2.2 AA?
**A:** WCAG 2.2 AA is sufficient. No Section 508 or hospital-specific requirements at this time.
**Implication:** Standard AA compliance. 4.5:1 body text contrast, 3:1 UI component contrast, 32px click targets (owner's choice, exceeds AA's 24px).

---

## Scope & Priorities

### Fragile Pages
**Q:** Any pages or workflows considered especially fragile or untouchable?
**A:** Nothing is off-limits. Everything is fair game with thorough testing.
**Implication:** Block schedule (DnD), case detail (real-time), auth flows — all get density treatment. Test thoroughly.

### PiP Milestone Panel
**Q:** Refactor the entirely inline-styled PiP panel to use tokens?
**A:** Leave it alone.
**NON-NEGOTIABLE:** components/pip/PiPMilestonePanel.tsx is excluded from this project. It's a standalone dark PiP overlay with its own styling. Don't touch it.

### Dark Mode
**Q:** Is dark mode active, planned, or not relevant?
**A:** Active — needs work. BUT: light-mode only, no dark prep for this project.
**Implication:** Ignore the existing minimal dark mode CSS. Don't structure tokens for dark mode compatibility. It will be a separate project entirely.

### Timeline & Thoroughness
**Q:** Thoroughness vs speed?
**A:** Thoroughness first. Do it right, follow all phases.
**Implication:** No shortcuts on testing or documentation phases. Complete Phase 4 docs.

### Excluded Pages
**Q:** Any pages excluded from this project?
**A:** No pages excluded. Only the PiP panel component is excluded.

### Roadmap Conflicts
**Q:** Any upcoming features that might conflict?
**A:** No conflicts expected. Codebase is stable, no major feature branches.

### globals.css CSS Classes
**Q:** Keep CSS utility classes (.btn-primary etc.), remove them, or reconcile?
**A:** Keep CSS classes, reconcile with design-tokens.ts values.
**Implication:** Update CSS classes to match canonical token values. Both systems serve different purposes (CSS classes = template patterns, design-tokens.ts = programmatic access).

---

## Summary of Non-Negotiables

1. **32px minimum click targets** across all interactive elements
2. **No tailwind.config.ts** — CSS @theme only (Tailwind v4)
3. **PiP panel excluded** — don't touch PiPMilestonePanel.tsx
4. **Light-mode only** — no dark mode prep or work
5. **Thoroughness first** — follow all phases, no shortcuts
6. **design-tokens.ts wins** for role colors (lighter 50-level, amber for anesthesiologist)
7. **Green replaces emerald** everywhere

## Items Flagged as NEEDS_REVISIT

1. **Typography rem values** — exact post-80% ramp needs owner approval before implementation. Present the calculated values and get sign-off.
2. **pl-7/pl-9/pl-10/pl-11 spacing** — review individually for intentional nesting hierarchy vs accidental off-grid values.
3. **Icon-only button aria-labels** — need to inventory all icon-only buttons and add labels. Count TBD during implementation.
4. **Chart readability** — unknown which specific chart elements will break after 80% scaling. Will discover during Phase 2.
