# Feature: Cases Page — Separate Status, Validation & Fix Duration

## Goal
Decouple case lifecycle status from data validation state on the cases page. Currently, the Status column uses a compound display that overrides "Completed" → "Needs Validation" when a case has unresolved DQ issues, causing confusion when the "Data Quality" tab shows cases with mixed statuses (In Progress, Completed, Scheduled). This feature separates concerns into distinct columns: Status (pure DB state), Validation (DQ state), and fixes the Duration column to show actual duration instead of start time.

## Requirements
1. Status column shows pure database status only (Scheduled, In Progress, Completed, Cancelled, On Hold) — no compound "Needs Validation" override
2. New Validation column with green "Validated" badge or orange "Needs Validation" badge
3. Validation column shows dash (—) for Scheduled and Cancelled cases
4. Clicking "Needs Validation" badge navigates to DQ page filtered to that case
5. Validation column visible on all tabs, sortable
6. Duration column shows `actual_duration_minutes` formatted as "Xh Ym" for completed cases
7. Duration column shows live ticking elapsed time (60s interval) for in-progress cases
8. Duration column shows dash (—) for scheduled/cancelled cases
9. Rename "Needs Validation" tab to "Data Quality"
10. Remove `needs_validation` compound status from `resolveDisplayStatus()` and `caseStatusConfig`

## Database Context
- Table: `cases` — columns: `status_id`, `data_validated`, `actual_duration_minutes`, `scheduled_duration_minutes`
- Table: `case_statuses` — lookup for status names
- Table: `metric_issues` — DQ issues, `resolved_at IS NULL` = unresolved
- View: `CaseListItem` type — needs `actual_duration_minutes` added

## UI/UX
- Route: /cases
- Column order: Procedure, Surgeon, Room, Date, Status, Duration, Validation, Flags
- Status badges: Standard pill style (blue/green/slate/red per status)
- Validation badges: Same pill style — green "Validated", orange "Needs Validation"
- Duration format: "2h 15m" for hours+minutes, "45m" for under an hour
- Live timer: Page-level 60s setInterval for in-progress elapsed calculation
- Tab rename: "Needs Validation" → "Data Quality"

## Files Likely Involved
- `components/cases/CasesTable.tsx` — column definitions, add Validation column, fix Duration
- `lib/constants/caseStatusConfig.ts` — remove `needs_validation` compound status
- `lib/dal/cases.ts` — add `actual_duration_minutes` to CaseListItem select, add DQ status to list query
- `lib/hooks/useCasesPage.ts` — add 60s timer state for elapsed duration
- `app/cases/page.tsx` — tab rename, pass new props

## iOS Parity
- [x] iOS can wait

## Known Issues / Constraints
- `actual_duration_minutes` exists in DB but not in `CaseListItem` type — must add to select
- DQ status per case requires joining/checking `metric_issues` — may need to batch-query for the page
- Live timer adds re-render overhead — mitigated by page-level interval (not per-row)

## Out of Scope
- Changes to the Data Quality page itself
- Changes to the dashboard alerts
- Changes to case drawer validation UI (already handled by prior DQ unification project)
- Adding sub-filters within the Data Quality tab

## Acceptance Criteria
- [ ] Status column shows only DB statuses — no orange "Needs Validation" badge
- [ ] Validation column shows green "Validated" or orange "Needs Validation" on all tabs
- [ ] Validation column shows dash for Scheduled/Cancelled cases
- [ ] Clicking "Needs Validation" badge navigates to `/dashboard/data-quality?caseId=<id>`
- [ ] Validation column is sortable
- [ ] Duration shows "Xh Ym" format for completed cases using `actual_duration_minutes`
- [ ] Duration shows live ticking elapsed for in-progress cases (updates every 60s)
- [ ] Duration shows dash for scheduled/cancelled
- [ ] Tab renamed from "Needs Validation" to "Data Quality"
- [ ] No TypeScript `any` types introduced
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
