# Implementation Plan: Cases Page — Separate Status, Validation & Fix Duration

> Feature spec: `docs/active-feature.md`

## Summary

The cases page Status column currently uses a compound display that overrides "Completed" → "Needs Validation" for cases with unresolved DQ issues. This causes confusion on the "Needs Validation" tab where cases show mixed statuses (In Progress, Completed, Scheduled) because the DQ engine returns cases of ANY status with unresolved `metric_issues`, but the status badge only overrides completed cases. Additionally, the Duration column shows start_time instead of actual duration due to a missing field.

This plan: (1) makes the Status column show pure DB status, (2) adds a new Validation column with DQ state, (3) fixes Duration to show actual duration with a live timer for in-progress cases, and (4) renames the "Needs Validation" tab to "Data Quality".

## Key Decisions

| Decision | Choice |
|----------|--------|
| Status column | Pure DB status only — no compound "Needs Validation" override |
| Validation column | Green "Validated" pill / orange "Needs Validation" pill / dash for scheduled/cancelled |
| Validation click | Navigates to `/dashboard/data-quality?caseId=<id>` |
| Validation visibility | All tabs |
| Validation sorting | Yes, sortable |
| Duration format | "Xh Ym" (e.g., "2h 15m", "45m") |
| In-progress duration | Live ticking timer, page-level 60s interval |
| Tab rename | "Needs Validation" → "Data Quality" |
| Tab filter logic | Unchanged — still queries `metric_issues` via DQ engine |
| Tab counts | Unchanged |

---

## Phase 1: Data Layer — Add `actual_duration_minutes` and DQ Status to CaseListItem

**What it does:** Extends the `CaseListItem` type and select query to include `actual_duration_minutes` (needed for Duration column fix) and adds a utility to determine per-case DQ validation status for the new Validation column. No UI changes yet.

**Files touched:**
- `lib/dal/cases.ts` — add `actual_duration_minutes` to type + select, add DQ status enrichment
- `lib/hooks/useCasesPage.ts` — enrich cases with DQ validation status

**Details:**

### 1a. Add `actual_duration_minutes` to CaseListItem

In `lib/dal/cases.ts`:
- Add `actual_duration_minutes: number | null` to `CaseListItem` interface (line 14-30)
- Add `actual_duration_minutes` to `CASE_LIST_SELECT` string (line 126-134)

### 1b. Add DQ validation status enrichment

The cases page already calls `getCaseIdsWithUnresolvedIssues()` for the needs_validation tab. We need this data available on ALL tabs to populate the Validation column.

In `lib/hooks/useCasesPage.ts`:
- After fetching cases, also call `casesDAL.getCaseIdsWithUnresolvedIssues(supabase, facilityId)` for every tab load
- Store result as `dqCaseIds: Set<string>` in hook state
- Expose `dqCaseIds` from the hook return value so the table can check `dqCaseIds.has(case.id)`

### 1c. Add `validation` to SORT_COLUMN_MAP

In `lib/dal/cases.ts` (line 628-633):
- Add `validation: 'data_validated'` to `SORT_COLUMN_MAP` — this enables server-side sorting by validation state

**Commit message:** `feat(cases-columns): phase 1 - add actual_duration_minutes and DQ status to CaseListItem`

**3-stage test gate:**
1. **Unit:** `CaseListItem` includes `actual_duration_minutes`. `CASE_LIST_SELECT` includes the column. `dqCaseIds` set is populated.
2. **Integration:** `listForCasesPage()` returns `actual_duration_minutes` values for completed cases. `dqCaseIds` correctly identifies cases with unresolved issues.
3. **Workflow:** Load cases page → hook fetches cases with `actual_duration_minutes` + DQ status enrichment → no UI changes visible yet but data is available.

**Complexity:** Light

---

## Phase 2: Status Column — Remove Compound Display

**What it does:** Makes the Status column show pure DB status. Removes the `needs_validation` compound state from `resolveDisplayStatus()` and `caseStatusConfig`. The Status badge always shows what the database says.

**Files touched:**
- `lib/constants/caseStatusConfig.ts` — remove `needs_validation` entry, simplify `resolveDisplayStatus()`
- `components/cases/CasesTable.tsx` — simplify `StatusBadge` to use raw status name

**Details:**

### 2a. Simplify `resolveDisplayStatus()`

In `lib/constants/caseStatusConfig.ts`:
- Remove lines 40-44: the `needs_validation` entry from `CASE_STATUS_CONFIG`
- Simplify `resolveDisplayStatus()` (lines 51-63): remove the compound `if (status === 'completed' && !dataValidated)` block. The function just returns the raw status.
- Since `dataValidated` param is no longer needed, simplify the function signature to only take `statusName`

### 2b. Update `StatusBadge` in CasesTable

In `components/cases/CasesTable.tsx` (lines 104-118):
- Remove `dataValidated` prop from `StatusBadge`
- Call `resolveDisplayStatus(statusName)` with just the status name
- Update the usage at line 405-410: remove `dataValidated={row.original.data_validated}`

### 2c. Check other consumers of `resolveDisplayStatus`

Search for any other callers of `resolveDisplayStatus` or `getCaseStatusConfig('needs_validation')` and update them. Known consumer: `CaseDrawer.tsx` — update similarly.

**Commit message:** `feat(cases-columns): phase 2 - status column shows pure DB status only`

**3-stage test gate:**
1. **Unit:** `resolveDisplayStatus('completed')` returns `'completed'` (not `'needs_validation'`). No `needs_validation` key in `CASE_STATUS_CONFIG`.
2. **Integration:** Cases page Status column shows "Completed" for completed cases regardless of `data_validated` value.
3. **Workflow:** Navigate to Data Quality tab → all cases show their real DB status (Completed, In Progress, Scheduled) — no orange "Needs Validation" badges in the Status column.

**Complexity:** Light

---

## Phase 3: Validation Column — New Column with DQ Status Badges

**What it does:** Adds the new Validation column between Duration and Flags. Shows green "Validated" pill, orange "Needs Validation" pill, or dash based on case state and DQ issues.

**Files touched:**
- `components/cases/CasesTable.tsx` — add Validation column definition, accept `dqCaseIds` prop
- `app/cases/page.tsx` — pass `dqCaseIds` to CasesTable
- `lib/design-tokens.ts` — ensure `validated` color key exists (green)

**Details:**

### 3a. Add `dqCaseIds` prop to CasesTable

In `components/cases/CasesTable.tsx`:
- Add `dqCaseIds: Set<string>` to `CasesTableProps` interface (line 42-62)
- Accept it in the component function signature

### 3b. Create `ValidationBadge` component

New internal component in `CasesTable.tsx` (next to `StatusBadge`):
```tsx
function ValidationBadge({ caseItem, dqCaseIds }: { caseItem: CaseListItem; dqCaseIds: Set<string> }) {
  const status = caseItem.case_status?.name?.toLowerCase()

  // Scheduled and Cancelled cases: dash (validation not applicable)
  if (status === 'scheduled' || status === 'cancelled') {
    return <span className="text-sm text-slate-400">—</span>
  }

  // Has unresolved DQ issues
  if (dqCaseIds.has(caseItem.id)) {
    return (
      <Link href={`/dashboard/data-quality?caseId=${caseItem.id}`} onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors.needs_validation.bg} ${statusColors.needs_validation.text} hover:opacity-80 transition-opacity`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusColors.needs_validation.dot}`} />
          Needs Validation
        </span>
      </Link>
    )
  }

  // Validated (completed/in_progress with no DQ issues)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700`}>
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Validated
    </span>
  )
}
```

### 3c. Add Validation column definition

Insert new column between Duration (line 415-437) and Flags (line 439-450):
```tsx
{
  id: 'validation',
  header: () => (
    <SortableHeader label="Validation" columnKey="validation" currentSort={sort} onSort={onSortChange} />
  ),
  cell: ({ row }) => (
    <ValidationBadge caseItem={row.original} dqCaseIds={dqCaseIds} />
  ),
  size: 140,
}
```

### 3d. Pass `dqCaseIds` from page

In `app/cases/page.tsx`:
- Destructure `dqCaseIds` from `useCasesPage()` hook
- Pass `dqCaseIds={dqCaseIds}` to `<CasesTable>`

### 3e. Remove DQ link from actions column

Since clicking the "Needs Validation" badge now navigates to the DQ page, remove the `ExternalLink` icon from the actions column (lines 461-470 in CasesTable.tsx) — the navigation is now built into the Validation badge.

**Commit message:** `feat(cases-columns): phase 3 - add Validation column with DQ status badges`

**3-stage test gate:**
1. **Unit:** `ValidationBadge` renders "Validated" (green) when case has no DQ issues, "Needs Validation" (orange) when it does, dash for scheduled/cancelled.
2. **Integration:** Validation column visible on all tabs. Clicking "Needs Validation" badge navigates to `/dashboard/data-quality?caseId=<id>`. Column is sortable.
3. **Workflow:** Cases page → All Cases tab → see Validation column → cases with DQ issues show orange badge → click badge → DQ page opens filtered to that case → go back → Data Quality tab → all cases show orange badges.

**Complexity:** Medium

---

## Phase 4: Duration Column — Fix Display + Live Timer

**What it does:** Fixes the Duration column to show `actual_duration_minutes` formatted as "Xh Ym" for completed cases, a live ticking elapsed timer for in-progress cases (60s page-level interval), and a dash for scheduled/cancelled/on_hold.

**Files touched:**
- `components/cases/CasesTable.tsx` — rewrite Duration column cell, add timer state
- `lib/hooks/useCasesPage.ts` — (already has `dqCaseIds` from Phase 1; no additional changes needed if timer lives in table)

**Details:**

### 4a. Add `formatDuration` helper

In `CasesTable.tsx`, add helper function near existing helpers (line 80-98):
```tsx
function formatDuration(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function getElapsedMinutes(startTime: string | null, scheduledDate: string): number | null {
  if (!startTime) return null
  const start = new Date(`${scheduledDate}T${startTime}`)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / 60000)
  return diff > 0 ? diff : 0
}
```

### 4b. Add page-level 60s timer

In the `CasesTable` component function body (after table instance, ~line 518):
- Add a `tick` state: `const [tick, setTick] = useState(0)`
- Add `useEffect` with 60s `setInterval` that increments `tick`
- Only run when there are in-progress cases: check `cases.some(c => c.case_status?.name?.toLowerCase() === 'in_progress')`
- Clean up on unmount

### 4c. Rewrite Duration column cell

Replace the current Duration column (lines 415-437) with:
```tsx
{
  id: 'duration',
  header: () => (
    <SortableHeader label="Duration" columnKey="duration" currentSort={sort} onSort={onSortChange} />
  ),
  cell: ({ row }) => {
    const status = row.original.case_status?.name?.toLowerCase()
    if (status === 'completed') {
      return (
        <span className="text-sm text-slate-600 tabular-nums">
          {formatDuration(row.original.actual_duration_minutes)}
        </span>
      )
    }
    if (status === 'in_progress') {
      const elapsed = getElapsedMinutes(row.original.start_time, row.original.scheduled_date)
      return (
        <span className="text-sm text-green-600 tabular-nums">
          {formatDuration(elapsed)}
        </span>
      )
    }
    return <span className="text-sm text-slate-400">—</span>
  },
  size: 100,
}
```

Note: the `tick` state in the dependency array of `useMemo` for columns ensures the elapsed time re-renders every 60s.

**Commit message:** `feat(cases-columns): phase 4 - fix duration display with live timer for in-progress cases`

**3-stage test gate:**
1. **Unit:** `formatDuration(135)` returns `"2h 15m"`. `formatDuration(45)` returns `"45m"`. `formatDuration(null)` returns `"—"`. `getElapsedMinutes` computes correct diff.
2. **Integration:** Completed cases show actual duration. In-progress cases show elapsed time in green. Scheduled cases show dash. Timer ticks every 60s.
3. **Workflow:** Open cases page → see completed case "1h 45m" → see in-progress case "2h 10m" in green → wait 60s → elapsed increments → switch tabs → timer stops/starts appropriately.

**Complexity:** Medium

---

## Phase 5: Tab Rename + Cleanup

**What it does:** Renames the "Needs Validation" tab to "Data Quality", updates the tab key references, updates empty states, and cleans up any remaining references to the old compound status.

**Files touched:**
- `lib/dal/cases.ts` — update `CasesPageTab` type: `'needs_validation'` → `'data_quality'`, update `countByTab` and `listForCasesPage`
- `components/cases/CasesStatusTabs.tsx` — rename tab label and key
- `components/cases/CasesTable.tsx` — update `TAB_EMPTY_STATES` key, update any `needs_validation` references
- `app/cases/page.tsx` — update default tab reference if needed
- `lib/hooks/useCasesPage.ts` — update tab references

**Details:**

### 5a. Update `CasesPageTab` type

In `lib/dal/cases.ts` (line 33):
- Change `'needs_validation'` to `'data_quality'` in the union type

### 5b. Update tab config

In `components/cases/CasesStatusTabs.tsx` (line 26):
- Change `{ key: 'needs_validation', label: 'Needs Validation', colorKey: 'needs_validation' }` to `{ key: 'data_quality', label: 'Data Quality', colorKey: 'needs_validation' }`
- Keep `colorKey: 'needs_validation'` (orange) since that's the design token color

### 5c. Update empty state

In `components/cases/CasesTable.tsx` (line 74):
- Change `needs_validation` key to `data_quality` in `TAB_EMPTY_STATES`
- Update text: `{ title: 'No data quality issues', description: 'All cases have clean data — no issues to review' }`

### 5d. Update DAL references

In `lib/dal/cases.ts`:
- In `listForCasesPage` (line 381): change `tab === 'needs_validation'` to `tab === 'data_quality'`
- In `countByTab` (line 495): change key from `needs_validation` to `data_quality`
- In date range check (line 368): change `tab !== 'needs_validation'` to `tab !== 'data_quality'`

### 5e. Update hooks and page

In `lib/hooks/useCasesPage.ts`:
- Update any references to `'needs_validation'` tab to `'data_quality'`

In `app/cases/page.tsx`:
- Update any references to `'needs_validation'` tab to `'data_quality'`

### 5f. Clean up caseStatusConfig

In `lib/constants/caseStatusConfig.ts`:
- If not already done in Phase 2, ensure `needs_validation` is removed from `CASE_STATUS_CONFIG`
- Verify `resolveDisplayStatus` no longer references it

**Commit message:** `feat(cases-columns): phase 5 - rename tab to Data Quality and final cleanup`

**3-stage test gate:**
1. **Unit:** `CasesPageTab` type includes `'data_quality'`, not `'needs_validation'`. Tab config has correct label. Empty state text updated.
2. **Integration:** Tab shows "Data Quality" label with correct count. Clicking tab loads cases with DQ issues. Sorting and pagination work on renamed tab.
3. **Workflow:** Full flow: Cases page → click "Data Quality" tab → see cases with DQ issues → each shows real status (Completed, In Progress) in Status column + "Needs Validation" in Validation column → click validation badge → navigate to DQ page → resolve issue → return → case shows "Validated" → Duration shows correct values.

**Complexity:** Light

---

## Existing Code Reused

| Function/Component | File | How Used |
|---|---|---|
| `getCaseIdsWithUnresolvedIssues()` | `lib/dal/cases.ts:554` | Already exists — used to populate `dqCaseIds` set |
| `statusColors` | `lib/design-tokens.ts` | Existing color tokens for badge styling |
| `SortableHeader` | `components/cases/CasesTable.tsx:145` | Existing sort header component — reused for Validation column |
| `useCasesPage` | `lib/hooks/useCasesPage.ts` | Existing hook — extended to expose `dqCaseIds` |
| `SORT_COLUMN_MAP` | `lib/dal/cases.ts:628` | Existing map — add `validation` entry |

## Verification Checklist

- [ ] Status column shows only DB statuses (Scheduled, In Progress, Completed, Cancelled, On Hold)
- [ ] No orange "Needs Validation" badge in Status column anywhere
- [ ] Validation column shows green "Validated" pill for clean cases
- [ ] Validation column shows orange "Needs Validation" pill for cases with DQ issues
- [ ] Validation column shows dash for Scheduled and Cancelled cases
- [ ] Clicking "Needs Validation" pill navigates to `/dashboard/data-quality?caseId=<id>`
- [ ] Validation column visible on all tabs
- [ ] Validation column is sortable
- [ ] Duration shows "Xh Ym" format for completed cases
- [ ] Duration shows live ticking elapsed for in-progress cases (green text)
- [ ] Duration shows dash for scheduled/cancelled
- [ ] Live timer updates every 60 seconds
- [ ] Tab renamed from "Needs Validation" to "Data Quality"
- [ ] Tab count unchanged (still counts cases with unresolved metric_issues)
- [ ] Column order: Procedure, Surgeon, Room, Date, Status, Duration, Validation, Flags
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes

---

## Session Log

### Session — 2026-02-14, afternoon
- **Phase:** Enhancement (beyond plan) — completed
- **What was done:** Added conditional Validation tab to CaseDrawer that shows unresolved DQ metric issues with severity badges, affected milestones, detected vs expected values, and a link to the DQ page. Fixed stale tab state bug when switching cases (render-time ref-based reset).
- **Files changed:**
  - `components/cases/CaseDrawerValidation.tsx` (NEW) — validation tab content component
  - `components/cases/CaseDrawer.tsx` — added dqCaseIds prop, dynamic tabs, lazy-loading, tab reset on case switch
  - `app/cases/page.tsx` — passes dqCaseIds to CaseDrawer
  - `components/cases/__tests__/CaseDrawer.test.tsx` — 7 new tests (conditional tab, tab switching, rerender reset)
  - `components/cases/__tests__/CaseDrawerValidation.test.tsx` (NEW) — 13 unit tests
- **Commits:** `27149c4`, `c83ba70`, `9261810`, `da0d3a0`
- **Test results:** 814/814 pass, 49 test files, 0 TS errors in changed files
- **Known issues discovered:** None
- **Context usage:** Low
