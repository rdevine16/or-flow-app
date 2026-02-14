# Project: Cases Page — Separate Status, Validation & Fix Duration
**Completed:** 2026-02-14
**Branch:** feat/cases-columns
**Duration:** 2026-02-14 → 2026-02-14
**Total Phases:** 5

## What Was Built
The cases page Status column previously used a compound display that overrode "Completed" with "Needs Validation" for cases with unresolved DQ issues. This caused confusion on the "Needs Validation" tab where cases showed mixed statuses because the DQ engine returns cases of any status with unresolved metric_issues, but the badge only overrode completed ones.

This project separated concerns into distinct columns: Status (pure DB state) and Validation (DQ state). The Status column now shows only the database status. A new Validation column shows green "Validated" or orange "Needs Validation" badges, with the orange badge linking directly to the Data Quality page filtered to that case. The Duration column was fixed to show actual duration formatted as "Xh Ym" for completed cases and a live ticking timer for in-progress cases. The "Needs Validation" tab was renamed to "Data Quality".

Additionally, a conditional Validation tab was added to the case detail drawer, showing unresolved metric issues with severity badges, affected milestones, detected vs expected values, and a link to the DQ page for resolution. This lazy-loads data only when the tab is active.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Data layer — add actual_duration_minutes and DQ status to CaseListItem | `c5a98a2` |
| 2     | Status column — remove compound display, show pure DB status | `7a5ae17` |
| 3     | Validation column — new column with DQ status badges | `4a2113a` |
| 4     | Duration column — fix display with live timer for in-progress cases | `78957ba` |
| 5     | Tab rename — "Needs Validation" → "Data Quality" + cleanup | `7383f43` |
| Extra | CaseDrawer validation tab with lazy-loaded DQ issues | `27149c4` |

## Key Files Created/Modified
- `lib/dal/cases.ts` — CasesPageTab type, CaseListItem select, sort map, DQ query logic
- `lib/constants/caseStatusConfig.ts` — removed needs_validation compound status
- `components/cases/CasesTable.tsx` — Validation column, Duration column rewrite, empty state
- `components/cases/CasesStatusTabs.tsx` — tab key + label rename
- `components/cases/CaseDrawer.tsx` — conditional Validation tab, lazy-loading, tab reset on case switch
- `components/cases/CaseDrawerValidation.tsx` (NEW) — validation tab content component
- `lib/hooks/useCasesPage.ts` — dqCaseIds, tab rename
- `lib/hooks/useCaseMetrics.ts` — tab rename in switch
- `app/cases/page.tsx` — passes dqCaseIds to CaseDrawer

## Architecture Decisions
- **Status vs Validation separation:** Status column is purely database-driven, Validation column is DQ-engine-driven. This prevents confusion when a case is "In Progress" but also has DQ issues.
- **Design token preservation:** The `needs_validation` color token in `lib/design-tokens.ts` was kept as-is — it's a color (orange) used by the Validation column badge, not tied to the tab key.
- **Lazy-loading in drawer:** Validation tab fetches metric issues via `useSupabaseQuery` only when the tab is active, avoiding unnecessary API calls.
- **Render-time tab reset:** When switching cases in the drawer, `activeTab` resets to 'flags' using a ref-based render-time pattern (React-recommended) rather than useEffect, to avoid extra render cycles.
- **Page-level timer:** The live elapsed timer for in-progress cases uses a single 60s `setInterval` at the page level (not per-row) to minimize re-render overhead.

## Database Changes
None — all changes were frontend-only. The `scheduled_duration_minutes` column was already present; `actual_duration_minutes` was found to not exist in the real DB (discovered during Phase 1), so `scheduled_duration_minutes` is used instead.

## Known Limitations / Future Work
- `actual_duration_minutes` does not exist in the DB — duration relies on `scheduled_duration_minutes` or milestone-computed values
- CasesStatusTabs has no dedicated unit test file (pre-existing gap)
- No end-to-end test for the full tab click → URL update → data filter workflow
