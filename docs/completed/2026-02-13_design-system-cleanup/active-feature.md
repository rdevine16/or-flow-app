# Feature: Design System Consistency Audit & Cleanup

## Goal
Make every color, spacing value, font size, and visual property in the ORbit web app trace back to a single source of truth: CSS variables in `globals.css` using shadcn/ui's token system. Eliminate hardcoded values, inconsistent spacing, rogue hex colors, and inline styles so the entire app looks and feels cohesive.

## Requirements
1. Every color must reference a CSS variable (shadcn semantic tokens or ORbit-specific extensions) — no hardcoded hex, rgb, or Tailwind color classes like `bg-blue-500` that bypass the token system
2. Spacing must be consistent — same UI purpose uses the same spacing value everywhere (e.g., card padding is always `p-4`, not `p-3` in some places and `p-5` in others)
3. Typography must follow a clear hierarchy — page title > section heading > card title > body > secondary text, using consistent Tailwind text classes
4. All ORbit-specific semantic colors (surgical status, case states, role badges, flag severity) must be defined as CSS variables in `globals.css` so they're changeable in one place
5. No inline `style={{}}` attributes for values that should be tokens
6. Buttons, badges, cards, tables, and form inputs must use consistent sizing patterns across every page

## Database Context
No database changes needed. This is purely frontend.

## UI/UX
- The app should look the same after this work — this is a consistency cleanup, not a redesign
- If during the audit Claude Code finds pages that look noticeably different from each other (different card styles, different button sizes, different spacing patterns), flag them and normalize to the most common/best pattern
- Priority pages (audit and clean these first): Case Detail, Dashboard, Scorecards/Analytics, Cases List, Settings pages

## Files Likely Involved
- `app/globals.css` — the single source of truth, may need ORbit-specific token additions
- `tailwind.config.ts` — verify it references CSS variables correctly
- `components/ui/*.tsx` — shadcn components, should already be token-driven but verify
- `components/layouts/DashboardLayout.tsx` — sidebar, nav, overall structure
- Every page in `app/` — the sweep targets

## Known Issues / Constraints
- The app uses shadcn/ui components — these should already reference tokens correctly. The problem is likely in page-level code that bypasses them.
- Some pages were built at different times and may use different patterns
- The `useSupabaseQuery` migration already cleaned up data fetching patterns — this is the visual equivalent of that cleanup
- Don't change component behavior or data flow — this is styling only

## Out of Scope
- iOS app (separate project)
- Dark mode (not currently supported, don't add it)
- Redesigning any page layout or information architecture
- Adding new UI features or components
- Changing the density/zoom level (may revisit later)

## Acceptance Criteria
- [ ] Audit report produced showing every file with hardcoded values, inline styles, or token violations
- [ ] `globals.css` contains all ORbit-specific semantic tokens (status colors, role colors, flag colors) using shadcn naming convention (`--variable` + `--variable-foreground`)
- [ ] Zero hardcoded hex colors in page-level code (components/ui excluded since shadcn manages those)
- [ ] Spacing is consistent — same UI element uses same spacing across all pages
- [ ] Typography hierarchy is consistent across all pages
- [ ] All buttons use consistent sizing (no mix of `py-1.5 px-3` on one page and `py-2 px-4` on another for the same button type)
- [ ] Visual diff: app looks the same or better, never worse
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
