# Feature: Unify "Needs Validation" Around Data Quality Engine

## Goal
Make the data quality engine (`metric_issues` table) the single source of truth for which cases need validation. Currently the dashboard and cases page use a simple `data_validated` boolean on the cases table, while the data quality page uses the `metric_issues` table — producing different counts (4 vs 7). This change aligns all surfaces so counts match, directs users to the data quality page for resolution, and removes direct validation from the cases page.

## Requirements

### Source of Truth
1. "Needs Validation" = case has one or more unresolved `metric_issues` (where `resolved_at IS NULL`)
2. Dashboard alert count = unique cases with unresolved metric_issues
3. Cases page "Needs Validation" tab count = same unique case count
4. Data quality page issue count may differ (multiple issues per case) — that's expected

### Dashboard
5. Dashboard "validation" alert derives count from `metric_issues`, not `cases.data_validated`
6. Clicking the alert navigates to `/dashboard/data-quality` (was `/cases?filter=needs_validation`)
7. Non-completed cases flagged by the DQ engine (stale_in_progress, abandoned_scheduled, no_activity) are included in the count

### Cases Page
8. "Needs Validation" tab lists all cases with unresolved metric_issues, regardless of case status
9. Users cannot validate directly from the cases page — no validate buttons, no bulk validate
10. Each case row on the "Needs Validation" tab shows a link to the data quality page filtered to that case
11. Case drawer shows "Review in Data Quality" link instead of "Validate Case" button

### Data Quality Page
12. Supports `?caseId=<uuid>` URL parameter to filter issues to a specific case
13. Shows a filter chip when filtered by case, with ability to clear
14. `fetchMetricIssues()` already supports `caseId` option — just wire up URL param

### Backward Compatibility
15. `data_validated` boolean stays in the database
16. DQ resolution flow continues to set `data_validated = true` when all issues resolved
17. CSV export continues to include the validated column
18. `resolveDisplayStatus()` continues to use `data_validated` for badge display

## Database Context
- Table: `metric_issues` — `case_id`, `facility_id`, `resolved_at`, `issue_type_id`, `resolution_type_id`
- Table: `cases` — `data_validated` (boolean), `validated_at`, `validated_by`
- Table: `issue_types` — `name`, `severity` (info|warning|error)
- No schema changes needed — only query changes

## UI/UX
- Dashboard alert: links to `/dashboard/data-quality`
- Cases page row action: links to `/dashboard/data-quality?caseId=<uuid>`
- Case drawer: "Review in Data Quality" button links to `/dashboard/data-quality?caseId=<uuid>`
- Data quality page: filter chip when `?caseId=` is present

## Files Likely Involved
- `lib/dal/cases.ts` — add DQ-based query, update tab queries, remove validateCase
- `lib/hooks/useDashboardAlerts.ts` — rewrite validation alert query
- `lib/hooks/useCasesPage.ts` — remove validateCase, update tab type
- `app/dashboard/data-quality/page.tsx` — add URL param support
- `app/cases/page.tsx` — remove validation UI
- `components/cases/CasesTable.tsx` — remove validate buttons, add DQ link
- `components/cases/CaseDrawer.tsx` — replace validate button with DQ link
- `components/cases/BulkValidateProgress.tsx` — delete file

## iOS Parity
- [x] iOS can wait

## Known Issues / Constraints
- Supabase doesn't support `SELECT DISTINCT` in `.select()` — must deduplicate case IDs in JS
- `.in('id', caseIds)` has URL length limits — fine for <500 cases with issues
- Between phases, counts may temporarily mismatch (feature branch, not deployed)

## Out of Scope
- Changing the "Flagged" system (operational/financial flags) — separate concept
- Removing `data_validated` column from the database
- Changing how the DQ engine detects issues
- Real-time subscriptions for issue count updates

## Acceptance Criteria
- [ ] Dashboard alert count = unique cases with unresolved metric_issues
- [ ] Cases "Needs Validation" tab count matches dashboard count
- [ ] No validate buttons anywhere on cases page or drawer
- [ ] Clicking any "View Issues" link opens DQ page filtered to that case
- [ ] Non-completed stale cases appear in the validation count
- [ ] Resolving all issues on DQ page removes case from dashboard + cases tab
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
