# Feature: Remove `cases.scheduled_duration_minutes`

## Goal

Remove the `cases.scheduled_duration_minutes` column and migrate all consumers to use the correct sources: `surgeon_procedure_duration.expected_duration_minutes` → `procedure_types.expected_duration_minutes` → fallback. Update the demo data generator to use procedure type durations for case spacing and milestone generation.

## Background

The `cases` table has a `scheduled_duration_minutes` column populated by the demo data generator with random values (35–96 min). Two newer, properly-configured duration sources exist:

- `procedure_types.expected_duration_minutes` — base template set via Settings > Procedures (THA=90, TKA=90; 74 others null)
- `surgeon_procedure_duration.expected_duration_minutes` — surgeon-specific override (currently empty)

The schedule timeline has a 3-level fallback: case → surgeon_override → procedure_type. Since the case-level field is always populated (randomly), the configured values are never used. The user sees incorrect durations (88, 91, 89, 100 min) instead of the configured 90 min.

## Key Decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Schedule Timeline | surgeon_override → procedure_types (drop case-level) |
| 2 | Dashboard Alerts (behind-schedule) | surgeon_override → procedure_types → 120 min fallback |
| 3 | Dashboard Metrics (median duration) | Use actual `case_completion_stats.total_duration_minutes` |
| 4 | Cases Table Duration column | Actual duration for completed, expected for scheduled |
| 5 | Case Drawer Financial Comparison | Use procedure_types expected duration as fallback |
| 6 | Database column | Drop entirely via migration |
| 7 | Duration column sort | Remove server-side sort (replace with plain label) |

## Database Context

- `case_completion_stats.total_duration_minutes` = actual elapsed minutes from patient_in → patient_out (computed by trigger)
- `case_completion_stats` has FK + UNIQUE on `case_id` → PostgREST supports to-one left join via `case_completion_stats(total_duration_minutes)`
- Latest migration: `20260219000011_procedure_duration_config.sql`

---

## Phase 1: Replace All Code References

**Goal:** Every consumer switches to the correct data source. The DB column still exists but is no longer read.

### 1.1 — Types & Data Layer

**File:** `lib/dal/cases.ts`

**`CaseListItem` interface (line 30):**
- Remove `scheduled_duration_minutes: number | null`
- Add `expected_duration_minutes: number | null` to the `procedure_type` shape
- Add `case_completion_stats?: { total_duration_minutes: number | null } | null`

**`CaseDetail` interface (line 58):**
- Remove duplicate `scheduled_duration_minutes: number | null` declaration

**`CASE_LIST_SELECT` (lines 126–134):**
- Remove `scheduled_duration_minutes` from select
- Change `procedure_type:procedure_types(id, name, procedure_category_id)` → `procedure_type:procedure_types(id, name, procedure_category_id, expected_duration_minutes)`
- Add `case_completion_stats(total_duration_minutes)` join

**`CASE_DETAIL_SELECT` (lines 136–151):**
- Uses `*` so column removal is handled by migration
- Add `expected_duration_minutes` to `procedure_types(...)` join

**`SORT_COLUMN_MAP` (line 630):**
- Remove `duration: 'scheduled_duration_minutes'` entry

### 1.2 — Schedule Timeline

**File:** `lib/hooks/useScheduleTimeline.ts`

- Remove `scheduled_duration_minutes` from `TIMELINE_CASE_SELECT` (line 141)
- Remove from inline type cast (line 216)
- Duration chain (lines 283–294): Remove step 1 (`c.scheduled_duration_minutes`). Chain becomes:
  ```
  let durationMinutes: number | null = null
  // 1. surgeon override
  if (c.surgeon_id && c.procedure_type_id) {
    durationMinutes = overrideMap.get(`${c.surgeon_id}::${c.procedure_type_id}`) ?? null
  }
  // 2. procedure base
  if (durationMinutes === null && c.procedure_type_id) {
    durationMinutes = procedureMap.get(c.procedure_type_id) ?? null
  }
  ```

### 1.3 — Dashboard Alerts

**File:** `lib/hooks/useDashboardAlerts.ts`

- Remove `scheduled_duration_minutes` from select (line 168)
- Add `procedure_type_id, surgeon_id, procedure_types(expected_duration_minutes)` to query
- Add parallel fetch of `surgeon_procedure_duration` overrides (same pattern as useScheduleTimeline)
- Build overrideMap, then replace line 202:
  ```
  // WAS: const estimatedDuration = c.scheduled_duration_minutes ?? 120
  // NOW:
  const overrideKey = `${c.surgeon_id}::${c.procedure_type_id}`
  const surgeonDuration = overrideMap.get(overrideKey) ?? null
  const procDuration = c.procedure_types?.expected_duration_minutes ?? null
  const estimatedDuration = surgeonDuration ?? procDuration ?? 120
  ```

### 1.4 — Dashboard Metrics

**File:** `lib/hooks/useCaseMetrics.ts`

**Median duration (lines 127–152):**
- Switch from `cases.scheduled_duration_minutes` to `case_completion_stats.total_duration_minutes`
- Query `case_completion_stats` for completed cases in date range:
  ```
  supabase.from('case_completion_stats')
    .select('total_duration_minutes')
    .eq('facility_id', facilityId)
    .gte('case_date', start).lte('case_date', end)
    .not('total_duration_minutes', 'is', null)
  ```
- Update downstream median computation to use `total_duration_minutes`

**Total scheduled hours (lines 266–278):**
- Add `procedure_types(expected_duration_minutes)` join to cases query
- Add parallel `surgeon_procedure_duration` fetch
- Apply surgeon_override → procedure_types → 0 fallback when computing totalMinutes

### 1.5 — Cases Table

**File:** `components/cases/CasesTable.tsx`

**Duration column cell (line 487):**
- Completed: `row.original.case_completion_stats?.total_duration_minutes` (actual)
- Scheduled: `row.original.procedure_type?.expected_duration_minutes` (expected, may be null)
- In-progress: unchanged (elapsed from start_time)

**Duration column header:**
- Remove `SortableHeader` wrapper, replace with plain `<span>` label (no server-side sort)

### 1.6 — Case Drawer

**File:** `components/cases/CaseDrawer.tsx`

- Line 174: `caseDetail?.scheduled_duration_minutes ?? null` → `caseDetail?.procedure_type?.expected_duration_minutes ?? null`

### 1.7 — Tests

| File | Change |
|------|--------|
| `lib/dal/__tests__/cases.test.ts` | Remove `scheduled_duration_minutes` from fixtures (lines 24, 46, 65, 123). Add `case_completion_stats: null` + `procedure_type.expected_duration_minutes: null` |
| `components/cases/__tests__/CasesTable-duration.test.tsx` | Rewrite: completed → test `case_completion_stats.total_duration_minutes`, scheduled → test `procedure_type.expected_duration_minutes`, null cases → dash |
| `components/cases/__tests__/CaseDrawer.test.tsx` | Remove `scheduled_duration_minutes: 95` (line 122). Add `procedure_type.expected_duration_minutes: 90` |
| `components/cases/__tests__/CasesTable-validation.test.tsx` | Remove `scheduled_duration_minutes: 120` (line 43). Add new fields |
| `lib/hooks/__tests__/useScheduleTimeline.test.ts` | Remove "Level 1: cases.scheduled_duration_minutes" test (line 197). Renumber remaining levels. Update comments (lines 45–64) |

### Phase 1 Verification

1. `npx tsc --noEmit` — clean compile
2. `npx vitest run` — all tests pass
3. Manual: Cases page Duration column shows actual time for completed cases, schedule timeline shows 90 min for THA/TKA

---

## Phase 2: Database Drop + Demo Generator

### 2.1 — Migration

**File:** `supabase/migrations/20260219000012_drop_scheduled_duration_minutes.sql`

```sql
-- Drop cases.scheduled_duration_minutes
-- All application code now reads surgeon_procedure_duration and
-- procedure_types.expected_duration_minutes directly.
ALTER TABLE cases DROP COLUMN IF EXISTS scheduled_duration_minutes;
```

Apply: `supabase db push --workdir /Users/ryandevine/Desktop/ORbit/apps/web/or-flow-app`

### 2.2 — Demo Generator

**File:** `lib/demo-data-generator.ts`

**Remove column references:**
- Remove `scheduled_duration_minutes` from `CaseRecord` interface (line 63)
- Remove `scheduled_duration_minutes: scheduledDuration` assignment (line 828)
- Remove `scheduledDuration` variable computation (lines 805–810)

**Fetch procedure durations:**
- Update procedure_types select (line 395): `select('id, name, expected_duration_minutes')`
- Update `allProcedureTypes` type throughout: `{ id: string; name: string; expected_duration_minutes: number | null }[]`
- Pass through to `generateSurgeonCases` function signature

**Use expected_duration_minutes for surgicalTime:**
- When `proc.expected_duration_minutes` is set, derive surgicalTime from it:
  ```
  // Overhead constants from milestone templates:
  //   joint: incision(28) + exit(12) = ~40 min overhead
  //   spine: incision(32) + exit(20) = ~48 min overhead
  //   hand:  incision(18) + exit(10) = ~28 min overhead (use 30)
  const SURGICAL_OVERHEAD: Record<string, number> = { joint: 40, spine: 48, hand_wrist: 30 }
  const overhead = SURGICAL_OVERHEAD[surgeon.specialty] ?? 40

  let surgicalTime: number
  if (proc.expected_duration_minutes != null) {
    const derived = Math.max(15, proc.expected_duration_minutes - overhead)
    surgicalTime = derived + randomInt(-5, 5) // ±5 min jitter for realism
  } else if (PROCEDURE_SURGICAL_TIMES[proc.name]) {
    surgicalTime = randomInt(override.min, override.max)
  } else {
    surgicalTime = randomInt(speedCfg.surgicalTime.min, speedCfg.surgicalTime.max)
  }
  ```

**Use expected_duration_minutes for flip-room spacing:**
- Line 914: When `proc.expected_duration_minutes` is set, use it as `flipInterval` instead of `speedCfg.flipInterval`
  ```
  const interval = proc.expected_duration_minutes ?? speedCfg.flipInterval
  currentTime = addMinutes(currentTime, interval > 0 ? interval : 90)
  ```

### Phase 2 Verification

1. `npx tsc --noEmit` — clean compile
2. `supabase db push` — column dropped successfully
3. Generate demo data → verify cases insert without errors
4. Schedule timeline shows correct 90 min durations for THA/TKA cases
5. `npx vitest run` — all tests pass

## Files Involved

### Modified Files
- `lib/dal/cases.ts` — Types, select strings, sort map
- `lib/hooks/useScheduleTimeline.ts` — Duration resolution chain
- `lib/hooks/useDashboardAlerts.ts` — Behind-schedule detection
- `lib/hooks/useCaseMetrics.ts` — Median duration + total hours
- `components/cases/CasesTable.tsx` — Duration column display + sort
- `components/cases/CaseDrawer.tsx` — Financial comparison param
- `lib/demo-data-generator.ts` — Stop writing column, use procedure durations

### New Files
- `supabase/migrations/20260219000012_drop_scheduled_duration_minutes.sql`

### Test Files
- `lib/dal/__tests__/cases.test.ts`
- `components/cases/__tests__/CasesTable-duration.test.tsx`
- `components/cases/__tests__/CaseDrawer.test.tsx`
- `components/cases/__tests__/CasesTable-validation.test.tsx`
- `lib/hooks/__tests__/useScheduleTimeline.test.ts`
