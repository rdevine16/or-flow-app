# Project: Design System Consistency Audit & Cleanup
**Completed:** 2026-02-13
**Branch:** feature/design-system-cleanup
**Duration:** 2026-02-13 (single day, 10 phases across multiple sessions)
**Total Phases:** 10

## What Was Built
A comprehensive design system cleanup that made every color, spacing value, font size, and visual property in the ORbit web app trace back to a single source of truth: `lib/design-tokens.ts` for programmatic values and `app/globals.css` CSS variables for theme-level tokens. The project eliminated hardcoded values, standardized inconsistent spacing to an 8px grid, normalized color shade usage, removed ~392 lines of dead CSS, and ensured all shadcn/ui components import from the design token system.

This was a styling-only project with no behavioral changes. The app looks the same (or better) after the cleanup, but is now significantly more maintainable. Changing a status color, role badge color, or spacing convention now requires editing a single file rather than hunting through 50+ files.

Key design decisions: all green (no emerald), text-red-600 as canonical error red, text-amber-700 as canonical warning amber, font-semibold for page titles (font-bold reserved for hero numbers), rounded-lg for buttons/badges/inputs and rounded-xl for cards/modals, PiP panel explicitly excluded.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Consolidate design tokens into single source of truth | 2bf8d69 |
| 2     | Migrate emerald to green (~596 usages across ~50 files) | 175490e |
| 3     | Consolidate color shades and minor migrations | 2c4374b |
| 4     | Refactor shadcn components to use design tokens | a170a6e |
| 5     | Redirect inline colors to tokens, remove dead CSS | d1deb5f |
| 6     | Standardize spacing to 8px grid | ae1fc47 |
| 7     | Standardize typography, sizing, and radius | b41e92b |
| 8     | Priority page cleanup (Case Detail, Dashboard, Analytics) | 4c5448f |
| 9     | Remaining pages cleanup (Settings, Admin, Auth, etc.) | 4243144 |
| 10    | Final verification and cleanup | a48c749 |

## Key Files Created/Modified
**Created:**
- `lib/__tests__/design-tokens.test.ts` — 85 tests validating token shape, types, grid compliance, helpers

**Major modifications:**
- `lib/design-tokens.ts` — restructured as comprehensive single source of truth (762 lines, 20+ token sections, 10+ helper functions)
- `app/globals.css` — removed ~392 lines of dead CSS, updated chart utilities from emerald to green
- All shadcn components in `components/ui/` — refactored to import from design-tokens
- ~120 page and component files across `app/` and `components/`

**Deleted exports:**
- `types/staff-assignment.ts` — removed ROLE_COLORS and getRoleColor() (moved to design-tokens)
- `types/block-scheduling.ts` — removed SURGEON_COLOR_PALETTE and getNextColor() (moved to design-tokens)

## Architecture Decisions
1. **design-tokens.ts as single source of truth** — All colors, spacing, sizing, and component tokens are defined here. This was chosen over CSS-only tokens because many components need programmatic access to color values (e.g., for conditional rendering, chart libraries).
2. **Tailwind classes in tokens, not raw values** — Token values are Tailwind class strings (e.g., `'bg-blue-50'`), not raw hex/CSS values. This keeps the Tailwind compiler happy and avoids string interpolation issues.
3. **chartHex for SVG/chart contexts** — Raw hex values are needed for SVG elements and chart libraries (Recharts). These are separated into `chartHex` to distinguish them from Tailwind-class tokens.
4. **surgeonPalette dual format** — Both hex (for SVGs/charts) and Tailwind classes (for badges/UI) are provided for the surgeon color palette.
5. **PiP panel excluded** — PiPMilestonePanel.tsx was explicitly excluded because it has its own visual language (dark theme, compact layout) that doesn't follow the main app's design system.
6. **Intentional arbitrary text sizes** — `text-[9px]` kept in data-dense visualization contexts where even `text-xs` (12px) is too large. `text-[13px]` and `text-[15px]` kept in analytics components for precise visual hierarchy.

## Database Changes
None. This was a purely frontend styling cleanup.

## Known Limitations / Future Work
- **Block schedule color picker** — `BlockSidebar.tsx` has a 24-color hex array for the surgeon color picker UI. These could potentially be consolidated with `surgeonPalette` but serve a different purpose (user-selectable colors vs. auto-assigned visualization colors).
- **SVG logo hex values** — `auth/reset-password/page.tsx` and login page have inline SVG logos with hex colors. These are brand marks where hex is inherently required in SVG markup.
- **Sentry example page** — `app/sentry-example-page/page.tsx` has hardcoded hex colors in auto-generated Sentry test code. Not our code to modify.
- **Pre-existing lint/type errors** — 316 pre-existing ESLint errors and ~22 TypeScript errors in test files were not addressed (out of scope for styling cleanup).
- **rgba() in dynamic effects** — Some `rgba()` values remain in box-shadows and radial gradients where Tailwind classes aren't expressive enough (e.g., BlockPopover shadow, login grid pattern).
