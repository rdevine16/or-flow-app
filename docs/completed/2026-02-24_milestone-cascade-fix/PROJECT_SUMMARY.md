# Project: Milestone Template Cascade Fix
**Completed:** 2026-02-24
**Branch:** feature/milestone-cascade-fix
**Duration:** 2026-02-24 → 2026-02-24
**Total Phases:** 2

## What Was Built
Fixed the 3 places where the milestone template cascade was ignoring surgeon overrides: the case detail page, the `useMilestoneComparison` hook's `expectedNames` query, and the `get_milestone_interval_medians()` SQL RPC. The correct 4-tier resolver (`resolveTemplateForCase`) already existed in `lib/dal/phase-resolver.ts` — the frontend fixes replaced inline 2-step cascades with calls to the shared resolver. The RPC required a SQL migration to add the surgeon override check to its `resolved_template` CTE.

The full 3-tier cascade (surgeon override → procedure template → facility default) is now consistently applied across all code paths: case creation, case display, analytics, and milestone comparison.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Fix frontend template resolution — replaced inline 2-step cascades in case detail page and useMilestoneComparison hook with resolveTemplateForCase() | 3688470 |
| 2     | Fix RPC migration + analytics verification — updated get_milestone_interval_medians() to use 3-tier cascade, verified all analytics pages | 115286d |

## Key Files Created/Modified
- `app/cases/[id]/page.tsx` — replaced inline 2-step cascade with `resolveTemplateForCase()`
- `lib/hooks/useMilestoneComparison.ts` — replaced inline 2-step cascade in `expectedNames` query
- `lib/hooks/__tests__/useMilestoneComparison.test.ts` — added surgeon override test scenarios
- `supabase/migrations/20260224000000_fix_interval_medians_surgeon_override.sql` — RPC update

## Architecture Decisions
- **Shared resolver over inline logic:** Rather than fixing each inline cascade separately, all sites now call `resolveTemplateForCase()` from `lib/dal/phase-resolver.ts`, ensuring a single source of truth for the 4-tier cascade
- **Case snapshot preserved:** `cases.milestone_template_id` is used as the first tier (case snapshot), falling back to live cascade resolution only for legacy cases without a stamped template
- **Historical integrity:** Existing `case_milestones` rows are never modified when templates change — this preserves the surgical timeline as it actually happened
- **CaseForm.tsx left as-is:** Its 2-step cascade is validation-only (checking if ANY template exists), not for display purposes
- **Demo generator left as-is:** Uses a custom 3-tier batch resolver that is performance-optimized for bulk case generation

## Database Changes
- **Migration:** `20260224000000_fix_interval_medians_surgeon_override.sql`
  - Updated `get_milestone_interval_medians()` RPC to check `surgeon_template_overrides` table first in its `resolved_template` CTE
  - Changed from 2-tier (procedure → facility default) to 3-tier (surgeon override → procedure → facility default) cascade
  - The RPC already received `p_surgeon_id` as a parameter — it just wasn't being used for template resolution

## Known Limitations / Future Work
- Legacy cases without `cases.milestone_template_id` stamped will use live cascade resolution, which means they'll reflect current template assignments rather than what was active when the case was created
- No "re-apply template" button exists for individual cases — if a template changes, existing cases keep their original milestones
- iOS app does not yet implement the milestone template cascade (deferred)
