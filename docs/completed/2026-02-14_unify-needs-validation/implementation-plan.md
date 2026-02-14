# Implementation Plan: Unify "Needs Validation" Around Data Quality Engine

> Feature spec: `docs/active-feature.md`

## Summary

Make `metric_issues` the single source of truth for "needs validation" across all surfaces. Dashboard and cases page currently query `cases.data_validated = false` (showing 4 cases), while the data quality page queries `metric_issues WHERE resolved_at IS NULL` (showing 7 issues across potentially more/fewer cases). This plan switches dashboard and cases page to derive counts from `metric_issues`, removes direct validation UI from the cases page, adds deep-linking to the data quality page, and ensures non-completed stale cases are included.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Source of truth | `metric_issues` table (not `data_validated` boolean) |
| Tab rename | Keep "Needs Validation" (distinct from "Flagged" which is operational/financial) |
| Direct validation | Removed from cases page entirely |
| Resolution workflow | Data quality page only (unchanged) |
| `data_validated` column | Keep in DB, still set by DQ resolution flow, used for display badges |
| Deep linking | `?caseId=<uuid>` param on data quality page |
| Stale cases | Included — DQ engine already detects stale_in_progress, abandoned_scheduled, no_activity |

---

## Phase 1: Foundation — DQ Page URL Support + DAL Query

**What it does:** Adds `?caseId=` URL parameter support to the data quality page for deep-linking, and adds a new DAL function to get unique case IDs with unresolved metric issues. No visible changes to dashboard or cases page yet.

**Files touched:**
- `lib/dal/cases.ts` — add `getCaseIdsWithUnresolvedIssues()` function
- `app/dashboard/data-quality/page.tsx` — add `caseId` URL param support, filter chip UI

**Details:**

### 1a. New DAL function: `getCaseIdsWithUnresolvedIssues()`
Add to `lib/dal/cases.ts` (after existing functions, ~line 546):
- Query `metric_issues` for `facility_id = X AND resolved_at IS NULL`, select `case_id`
- Deduplicate in JS: `[...new Set(data.map(d => d.case_id))]`
- Return `string[]` of unique case IDs
- Reuse existing `AnySupabaseClient` type pattern from the DAL

### 1b. Data quality page URL param support
Modify `app/dashboard/data-quality/page.tsx`:
- Import `useSearchParams` from `next/navigation`
- Read `searchParams.get('caseId')` into `filterCaseId` state
- Pass `caseId: filterCaseId` to existing `fetchMetricIssues()` call (line 284 — the `caseId` option already exists at line 147 of `dataQuality.ts`)
- Add `filterCaseId` to `loadData` dependency array
- Render filter chip when `filterCaseId` is set: "Filtered to case: {case_number}" with X button to clear
- Extract `case_number` from the first returned issue's `cases.case_number` field
- On clear: remove `caseId` from URL via `window.history.replaceState`

**Commit message:** `feat(dq): phase 1 - DQ page URL param support and getCaseIdsWithUnresolvedIssues DAL function`

**3-stage test gate:**
1. **Unit:** `getCaseIdsWithUnresolvedIssues()` returns deduplicated case IDs. Returns empty array when no issues.
2. **Integration:** Navigate to `/dashboard/data-quality?caseId=<uuid>` — only that case's issues display. Clear filter — all issues return.
3. **Workflow:** From browser URL bar, paste a DQ URL with caseId → page loads filtered → clear chip → see all issues → reload page → filter persists from URL.

**Complexity:** Light

---

## Phase 2: Dashboard + Cases Page — Switch to DQ Engine, Remove Validation UI

**What it does:** Switches the dashboard alert and cases page "Needs Validation" tab to query `metric_issues` instead of `data_validated`. Removes all direct validation UI (buttons, bulk validate modal). Adds "View Issues" links to the data quality page.

**Files touched:**
- `lib/hooks/useDashboardAlerts.ts` — rewrite validation alert query
- `lib/dal/cases.ts` — update `countByTab()` and `listForCasesPage()` for needs_validation tab, remove `validateCase()`
- `lib/hooks/useCasesPage.ts` — remove `validateCase` function and from return type
- `app/cases/page.tsx` — remove all validation UI, bulk validate state/modal, pass `activeTab` to table
- `components/cases/CasesTable.tsx` — remove `onValidateCase`/`onBulkValidate` props, remove validate buttons, add DQ link for needs_validation tab
- `components/cases/CaseDrawer.tsx` — remove `onValidateCase` prop, replace validate button with DQ link
- `components/cases/BulkValidateProgress.tsx` — delete file

**Details:**

### 2a. Dashboard alert
Rewrite `queryUnvalidatedCases()` in `lib/hooks/useDashboardAlerts.ts` (lines 56-92):
- Query `metric_issues` for `facility_id = X AND resolved_at IS NULL`, select `case_id`
- Deduplicate to count unique cases (same pattern as Phase 1 DAL function)
- Change `linkTo` from `/cases?filter=needs_validation` to `/dashboard/data-quality`
- Update title: `"${count} case(s) flagged for review"`
- Update description: `"Cases with data quality issues that need review."`

### 2b. Cases page tab count
Update `countByTab()` in `lib/dal/cases.ts` (~line 477):
- Replace: `dateRangeFilter().eq('status_id', completed).eq('data_validated', false)`
- With: call `getCaseIdsWithUnresolvedIssues()`, return `.length`
- No date range filter on DQ count — issues are relevant regardless of scheduled date

### 2c. Cases page tab list
Update `listForCasesPage()` in `lib/dal/cases.ts` (~line 381):
- Replace: `.eq('status_id', completed).eq('data_validated', false)`
- With: get case IDs from `getCaseIdsWithUnresolvedIssues()`, then `.in('id', caseIds)`
- Guard empty array: if no case IDs, return empty result immediately (`.in()` with empty array causes errors)

### 2d. Remove `validateCase()` from DAL
Delete `casesDAL.validateCase()` function (lines 552-569 of `lib/dal/cases.ts`)

### 2e. Remove validation from hooks
In `lib/hooks/useCasesPage.ts`:
- Remove `validateCase` callback (~lines 423-431)
- Remove from return object (~line 525)

### 2f. Remove validation UI from cases page
In `app/cases/page.tsx`:
- Remove `BulkValidateProgress` import (line 14)
- Remove bulk validate state: `showBulkValidate`, `bulkValidateIds` (lines 147-148)
- Remove `handleValidateCase` (lines 154-162)
- Remove `handleBulkValidate` (lines 175-180)
- Remove `handleBulkValidateComplete` (lines 201-206)
- Remove `onValidateCase={handleValidateCase}` from `<CasesTable>` (line 305)
- Remove `onBulkValidate={handleBulkValidate}` from `<CasesTable>` (line 307)
- Remove `onValidateCase={validateCase}` from `<CaseDrawer>` (line 344)
- Remove `<BulkValidateProgress>` component (lines 358-364)
- Pass `activeTab={activeTab}` to `<CasesTable>` (needed for conditional DQ link)

### 2g. Update CasesTable
In `components/cases/CasesTable.tsx`:
- Remove `onValidateCase` and `onBulkValidate` from props interface (lines 59, 61)
- Add `activeTab` prop (type `CasesPageTab`)
- Remove validate button from row hover actions (lines 465-476)
- Remove "Validate Selected" button from bulk bar (lines 576-582)
- Add DQ link in row actions when `activeTab === 'needs_validation'`:
  ```tsx
  <Link href={`/dashboard/data-quality?caseId=${row.original.id}`}>
    <ExternalLink className="w-4 h-4" />
  </Link>
  ```
- Import `Link` from `next/link` and `ExternalLink` from `lucide-react`

### 2h. Update CaseDrawer
In `components/cases/CaseDrawer.tsx`:
- Remove `onValidateCase` prop and `validating` state
- Replace validate button (lines 343-365) with a "Review in Data Quality" link:
  ```tsx
  <Link href={`/dashboard/data-quality?caseId=${caseDetail.id}`}>
    Review in Data Quality
  </Link>
  ```
- Show when `displayStatus === 'needs_validation'`

### 2i. Delete BulkValidateProgress
Delete `components/cases/BulkValidateProgress.tsx` — no longer needed.

**Commit message:** `feat(dq): phase 2 - switch dashboard and cases to DQ engine, remove direct validation`

**3-stage test gate:**
1. **Unit:** Dashboard alert query returns unique case count from metric_issues. Tab count matches. No validate-related props on CasesTable or CaseDrawer.
2. **Integration:** Dashboard count = cases tab count = unique cases with unresolved metric_issues. DQ link navigates correctly with caseId param. Stale non-completed cases appear in count.
3. **Workflow:** Dashboard shows "N cases flagged for review" → click → DQ page → resolve all issues for a case → refresh dashboard → count decreases by 1. Cases page "Needs Validation" tab → click "View Issues" on a row → DQ page filtered to that case → resolve → return to cases → case gone from tab.

**Complexity:** Medium-Large (mostly deletions)

---

## Existing Code Reused

| Function/Component | File | How Used |
|---|---|---|
| `fetchMetricIssues(caseId)` | `lib/dataQuality.ts:147` | Already supports caseId filter — just wire URL param |
| `useSearchParams` | `next/navigation` | Standard Next.js — for DQ page URL params |
| `ExternalLink` icon | `lucide-react` | Already in project deps |
| `useSupabaseQuery` pattern | `lib/hooks/useSupabaseQuery.ts` | Existing data fetching pattern |
| `resolveDisplayStatus()` | `lib/constants/caseStatusConfig.ts` | Kept as-is for badge display |

## Verification Checklist

- [ ] Dashboard alert count = unique cases with `metric_issues.resolved_at IS NULL`
- [ ] Cases "Needs Validation" tab count = same number
- [ ] DQ page shows 7 issues (or current count) — may be more than case count
- [ ] `/dashboard/data-quality?caseId=<uuid>` filters to one case
- [ ] No validate button on cases table rows
- [ ] No bulk validate button in selection bar
- [ ] No validate button in case drawer
- [ ] "Review in Data Quality" link in drawer works
- [ ] "View Issues" icon on table rows works
- [ ] Stale in-progress cases appear in dashboard alert + cases tab
- [ ] Resolving all issues removes case from both surfaces
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
