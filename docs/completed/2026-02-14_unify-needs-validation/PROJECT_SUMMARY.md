# Project: Unify "Needs Validation" Around Data Quality Engine
**Completed:** 2026-02-14
**Branch:** feat/unify-needs-validation
**Duration:** 2026-02-14 → 2026-02-14
**Total Phases:** 2

## What Was Built
Made the `metric_issues` table the single source of truth for "needs validation" across all surfaces in the application. Previously, the dashboard and cases page queried `cases.data_validated = false` (showing 4 cases), while the data quality page queried `metric_issues WHERE resolved_at IS NULL` (showing 7 issues) — producing mismatched counts that confused users.

This project switched the dashboard alert and cases page "Needs Validation" tab to derive their counts from `metric_issues`, removed all direct validation UI (validate buttons, bulk validate modal) from the cases page, and added deep-linking from the cases page to the data quality page. Users now resolve validation issues exclusively through the data quality page, which already had the full resolution workflow.

The `data_validated` boolean remains in the database for backward compatibility — the DQ resolution flow still sets it, and `resolveDisplayStatus()` still uses it for badge display.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | DQ page URL param support (`?caseId=`) and `getCaseIdsWithUnresolvedIssues` DAL function | 3287e9b |
| 2     | Switch dashboard and cases page to DQ engine, remove all direct validation UI | c831833 |

## Key Files Created/Modified
- `lib/dal/cases.ts` — added `getCaseIdsWithUnresolvedIssues()`, updated `countByTab()` and `listForCasesPage()` for needs_validation tab, removed `validateCase()`
- `lib/hooks/useDashboardAlerts.ts` — rewrote validation alert to query `metric_issues` instead of `data_validated`
- `lib/hooks/useCasesPage.ts` — removed `validateCase` function
- `app/dashboard/data-quality/page.tsx` — added `?caseId=` URL param support with filter chip UI
- `app/cases/page.tsx` — removed all validation UI (bulk validate state/modal, validate handlers)
- `components/cases/CasesTable.tsx` — removed validate buttons, added "View Issues" DQ link for needs_validation tab
- `components/cases/CaseDrawer.tsx` — replaced validate button with "Review in Data Quality" link
- `components/cases/BulkValidateProgress.tsx` — deleted (no longer needed)

## Architecture Decisions
- **Deduplication in JS, not SQL:** Supabase doesn't support `SELECT DISTINCT` in `.select()`, so case IDs from `metric_issues` are deduplicated in JavaScript with `new Set()`
- **No date range filter on DQ count:** Unlike other tabs, the needs_validation count is not filtered by scheduled date — issues are relevant regardless of when the case was scheduled
- **Empty array guard:** `.in('id', [])` causes Supabase errors, so the DAL returns empty results immediately when no case IDs have issues
- **Kept `data_validated` column:** Not removed from DB — still set by DQ resolution flow, still used by `resolveDisplayStatus()` for badge display

## Database Changes
None — query-only changes. No migrations, no schema modifications.

## Known Limitations / Future Work
- `.in('id', caseIds)` has URL length limits — fine for <500 cases with issues, but could be an issue at very large scale
- No real-time subscription for issue count updates — counts refresh on page load
- Pre-existing TypeScript errors in test files (not introduced by this feature) should be addressed separately
- Stage 3 test coverage gaps: no dedicated tests for DQ page URL param filtering, CasesTable DQ links, or end-to-end validation workflows
