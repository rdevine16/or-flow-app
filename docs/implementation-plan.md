# Implementation Plan: Remove `cases.scheduled_duration_minutes`

## Summary

Remove the `cases.scheduled_duration_minutes` column and migrate all consumers to the correct duration sources: `surgeon_procedure_duration.expected_duration_minutes` → `procedure_types.expected_duration_minutes` → fallback. Update the demo data generator to derive case timing from procedure type durations.

## Interview Notes

| # | Question | Decision |
|---|----------|----------|
| 1 | `useFinancialComparison` hook scope | Just change the caller in CaseDrawer.tsx. Don't modify the hook's internal parameter name. |
| 2 | Phase breakdown | Keep 2 phases as specified. Phase 1 = all code + tests, Phase 2 = migration + demo generator. |
| 3 | Duration column sort | Plain label, completely non-sortable. No client-side sort either. |

## Audit Findings

- `scheduled_duration_minutes` appears in ~30 locations across 12 files (7 production + 5 test)
- `surgeon_procedure_duration` fetch pattern already exists in `useScheduleTimeline.ts` — can be copied to `useDashboardAlerts.ts` and `useCaseMetrics.ts`
- `case_completion_stats` has `facility_id` and `case_date` columns with proper indexes — ready for direct querying in `useCaseMetrics.ts`
- Migration slot `20260219000012` is available
- No undocumented consumers of `scheduled_duration_minutes` found outside the spec

---

## Phase 1: Replace All Code References

**Status:** Pending

**Goal:** Every consumer switches to the correct data source. The DB column still exists but is no longer read.

**Complexity:** Large (7 production files + 5 test files)

**Files touched:**
- `lib/dal/cases.ts` — types, select strings, sort map
- `lib/hooks/useScheduleTimeline.ts` — duration resolution chain
- `lib/hooks/useDashboardAlerts.ts` — behind-schedule detection
- `lib/hooks/useCaseMetrics.ts` — median duration + total hours
- `components/cases/CasesTable.tsx` — duration column display + sort removal
- `components/cases/CaseDrawer.tsx` — financial comparison param
- `lib/dal/__tests__/cases.test.ts` — fixture updates
- `components/cases/__tests__/CasesTable-duration.test.tsx` — rewrite for new data sources
- `components/cases/__tests__/CaseDrawer.test.tsx` — fixture update
- `components/cases/__tests__/CasesTable-validation.test.tsx` — fixture update
- `lib/hooks/__tests__/useScheduleTimeline.test.ts` — remove Level 1 test, renumber

**Changes by subsection:**

### 1.1 — Types & Data Layer (`lib/dal/cases.ts`)
- `CaseListItem` interface (~line 30): Remove `scheduled_duration_minutes`, add `expected_duration_minutes` to `procedure_type` shape, add `case_completion_stats` to-one join shape
- `CaseDetail` interface (~line 58): Remove `scheduled_duration_minutes`
- `CASE_LIST_SELECT` (~line 129): Remove `scheduled_duration_minutes`, add `expected_duration_minutes` to procedure_types join, add `case_completion_stats(total_duration_minutes)` join
- `CASE_DETAIL_SELECT` (~line 136): Add `expected_duration_minutes` to procedure_types join
- `SORT_COLUMN_MAP` (~line 630): Remove `duration: 'scheduled_duration_minutes'` entry

### 1.2 — Schedule Timeline (`lib/hooks/useScheduleTimeline.ts`)
- Remove `scheduled_duration_minutes` from `TIMELINE_CASE_SELECT` (~line 141)
- Remove from inline type cast (~line 216)
- Duration chain (~lines 283–294): Remove step 1 (case-level). Chain becomes: surgeon_override → procedure_base → null

### 1.3 — Dashboard Alerts (`lib/hooks/useDashboardAlerts.ts`)
- Remove `scheduled_duration_minutes` from select (~line 168)
- Add `procedure_type_id, surgeon_id, procedure_types(expected_duration_minutes)` to query
- Add parallel fetch of `surgeon_procedure_duration` overrides (copy pattern from useScheduleTimeline)
- Build overrideMap, replace `scheduled_duration_minutes ?? 120` with `surgeonOverride ?? procDuration ?? 120`

### 1.4 — Dashboard Metrics (`lib/hooks/useCaseMetrics.ts`)
- Median duration: Switch from `cases.scheduled_duration_minutes` to `case_completion_stats.total_duration_minutes` for completed cases
- Total scheduled hours: Add `procedure_types(expected_duration_minutes)` join + parallel `surgeon_procedure_duration` fetch, apply surgeon_override → procedure_types → 0 fallback

### 1.5 — Cases Table (`components/cases/CasesTable.tsx`)
- Duration column cell (~line 487): Completed → `case_completion_stats?.total_duration_minutes`, Scheduled → `procedure_type?.expected_duration_minutes`
- Duration column header (~line 480): Replace `SortableHeader` with plain `<span>` label (no sort)

### 1.6 — Case Drawer (`components/cases/CaseDrawer.tsx`)
- Line 174: `caseDetail?.scheduled_duration_minutes` → `caseDetail?.procedure_type?.expected_duration_minutes`

### 1.7 — Tests
- `cases.test.ts`: Remove `scheduled_duration_minutes` from fixtures, add `case_completion_stats: null` + `procedure_type.expected_duration_minutes: null`
- `CasesTable-duration.test.tsx`: Rewrite — completed tests use `case_completion_stats.total_duration_minutes`, scheduled tests use `procedure_type.expected_duration_minutes`
- `CaseDrawer.test.tsx`: Remove `scheduled_duration_minutes: 95`, add `procedure_type.expected_duration_minutes: 90`
- `CasesTable-validation.test.tsx`: Remove `scheduled_duration_minutes: 120`, add new fields
- `useScheduleTimeline.test.ts`: Remove "Level 1: cases.scheduled_duration_minutes" test, renumber remaining levels, update comments

**Commit:** `feat(cases): phase 1 - replace scheduled_duration_minutes with procedure-based durations`

**3-stage test gate:**
1. **Unit:** `npx tsc --noEmit` — clean compile with no `scheduled_duration_minutes` references in production code
2. **Integration:** `npx vitest run` — all tests pass with new data sources
3. **Workflow:** Cases page Duration column shows actual time for completed, expected for scheduled. Schedule timeline shows 90 min for THA/TKA. Dashboard alerts use surgeon → procedure → 120 fallback.

---

## Phase 2: Database Drop + Demo Generator

**Status:** Pending
**Depends on:** Phase 1

**Goal:** Drop the column from the database and update the demo data generator to use procedure type durations.

**Complexity:** Medium (1 migration + 1 production file)

**Files touched:**
- `supabase/migrations/20260219000012_drop_scheduled_duration_minutes.sql` (new)
- `lib/demo-data-generator.ts`

**Changes by subsection:**

### 2.1 — Migration
Create `supabase/migrations/20260219000012_drop_scheduled_duration_minutes.sql`:
```sql
ALTER TABLE cases DROP COLUMN IF EXISTS scheduled_duration_minutes;
```
Apply via `supabase db push`.

### 2.2 — Demo Generator (`lib/demo-data-generator.ts`)
- Remove `scheduled_duration_minutes` from `CaseRecord` interface (~line 63)
- Remove `scheduled_duration_minutes: scheduledDuration` assignment (~line 828)
- Remove `scheduledDuration` variable computation (~lines 805–810)
- Update procedure_types select (~line 395) to include `expected_duration_minutes`
- Update `allProcedureTypes` type throughout to include `expected_duration_minutes`
- Derive `surgicalTime` from `proc.expected_duration_minutes` when available (subtract specialty overhead, add ±5 min jitter)
- Use `proc.expected_duration_minutes` for flip-room spacing (~line 914)

**Commit:** `feat(cases): phase 2 - drop scheduled_duration_minutes column, update demo generator`

**3-stage test gate:**
1. **Unit:** `npx tsc --noEmit` — clean compile
2. **Integration:** `supabase db push` succeeds, `npx vitest run` passes
3. **Workflow:** Generate demo data → cases insert without errors, schedule timeline shows correct 90 min durations for THA/TKA

---

## Phase Summary

| Phase | Description | Complexity | Files |
|---|---|---|---|
| 1 | Replace all code references to `scheduled_duration_minutes` | Large | 7 production + 5 test |
| 2 | Database column drop + demo generator update | Medium | 1 migration + 1 production |

**Total phases:** 2
**High-risk phase:** 1 (many files, must all stay in sync)
