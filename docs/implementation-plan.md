# Implementation Plan: 4-Metric Turnover Restructure

## Summary

Restructure turnover metrics from 3 to 4, organized as two parallel pairs: **Room Turnovers** (facility perspective) and **Surgical Turnovers** (surgeon perspective), each with same-room and flip-room variants. Rename all fields for consistency, add the missing flip-room room turnover calculation, update all display consumers, fix data quality page issues.

## Interview Notes

| Decision | Answer |
|---|---|
| Flags page layout | 2x2 + 1: Room turnovers (same + flip) row 1, Surgical turnovers (same + flip) row 2, Non-Op Time below |
| InsightPanelTurnover | Pass `flipRoomTurnover` as prop only — no panel UI redesign |
| Analytics hub quick stat label | Rename to "Same Room Turnover" |
| Legacy functions | Rename for consistency (`getAllSameRoomTurnovers`, `getAllSameRoomSurgicalTurnovers`); remove dead `calculateRoomTurnovers` alias |
| InsightsEngine | Add `flipRoomTurnover` to the existing surgical comparison insight |

## Field Rename Map

| Old field | New field | Type |
|---|---|---|
| `turnoverTime` | `sameRoomTurnover` | `TurnoverResult` |
| `standardSurgicalTurnover` | `sameRoomSurgicalTurnover` | `KPIResult` |
| `flipRoomTime` | `flipRoomSurgicalTurnover` | `KPIResult` |
| _(new)_ | `flipRoomTurnover` | `TurnoverResult` |
| `getAllTurnovers` | `getAllSameRoomTurnovers` | function |
| `calculateRoomTurnovers` | _(remove — dead code)_ | function |
| `getAllSurgicalTurnovers` | `getAllSameRoomSurgicalTurnovers` | function |

Also inside `TurnoverBreakdown`:
| Old field | New field |
|---|---|
| `standardTurnover` | `sameRoomSurgicalTurnover` |
| `flipRoomTime` | `flipRoomSurgicalTurnover` |

## Codebase Scan Results

### Files referencing `turnoverTime` (→ `sameRoomTurnover`)
- `lib/analyticsV2.ts` — type definition (line 270), assignment (line 2390)
- `lib/insightsEngine.ts` — destructured from analytics (line 245), used in insight generation
- `lib/insightExports.ts` — CSV export rows (line 807, 925)
- `app/analytics/kpi/page.tsx` — KPI row (line 475-477)
- `app/analytics/flags/page.tsx` — KPI card (line 913)
- `app/analytics/page.tsx` — quick stat (line 843-846)
- `components/analytics/InsightSlideOver.tsx` — prop pass (line 151)
- `components/analytics/InsightPanelTurnover.tsx` — prop interface + destructuring (line 15, 77, 80)
- `lib/hooks/useDashboardKPIs.ts` — uses `calculateTurnoverTime` (function name unchanged), returns as `medianTurnover`
- `lib/__tests__/insightsEngine.test.ts` — mock fixture (lines 45, 322, 562, 822)
- `lib/__tests__/insightExports.test.ts` — mock fixture (line 83)
- `lib/__tests__/analyticsV2-phase2.test.ts` — assertions (lines 591-592, 627)
- `app/analytics/kpi/__tests__/page-phase4.test.ts` — mock fixture (line 61)
- `app/analytics/kpi/__tests__/page-phase5.test.tsx` — mock fixture (lines 50, 231)
- `components/analytics/__tests__/InsightSlideOver.test.tsx` — mock fixture (line 63)
- `components/analytics/__tests__/InsightPanelTurnover.test.tsx` — mock + assertions (lines 66, 84, 93, 105, 119)
- `components/analytics/__tests__/InsightPanelNonOpTime.test.tsx` — mock fixture (line 37)
- `components/analytics/__tests__/InsightPanelScheduling.test.tsx` — mock fixture (line 37)
- `components/analytics/__tests__/InsightPanelUtilization.test.tsx` — mock fixture (line 238)

### Files referencing `standardSurgicalTurnover` (→ `sameRoomSurgicalTurnover`)
- `lib/analyticsV2.ts` — type definition (line 281), assignment (line 2413)
- `lib/insightsEngine.ts` — destructured and used (lines 245, 248, 252, 288, 298)
- `lib/insightExports.ts` — CSV export (line 808, 925)
- `app/analytics/kpi/page.tsx` — KPI row (lines 482-484)
- `app/analytics/flags/page.tsx` — KPI card (line 920)
- `lib/__tests__/insightsEngine.test.ts` — mock (lines 68, 397, 578)
- `lib/__tests__/insightExports.test.ts` — mock (line 115)
- `app/analytics/kpi/__tests__/page-phase4.test.ts` — mock (line 84)
- `app/analytics/kpi/__tests__/page-phase5.test.tsx` — mock (line 73)
- `components/analytics/__tests__/InsightSlideOver.test.tsx` — mock (line 86)
- `components/analytics/__tests__/InsightPanelNonOpTime.test.tsx` — mock (line 57)
- `components/analytics/__tests__/InsightPanelScheduling.test.tsx` — mock (line 65)
- `components/analytics/__tests__/InsightPanelUtilization.test.tsx` — mock (line 259)

### Files referencing `flipRoomTime` (→ `flipRoomSurgicalTurnover`)
- `lib/analyticsV2.ts` — interface member (line 40), type definition (line 282), computation (line 1141), assignment (line 2414)
- `lib/insightsEngine.ts` — destructured and used (lines 245, 249, 253, 289, 298)
- `lib/insightExports.ts` — CSV export (line 809, 925)
- `app/analytics/kpi/page.tsx` — KPI row (lines 489-491)
- `app/analytics/flags/page.tsx` — KPI card (line 927)
- `lib/__tests__/insightsEngine.test.ts` — mock (lines 69, 404, 585)
- `lib/__tests__/insightExports.test.ts` — mock (line 116)
- `app/analytics/kpi/__tests__/page-phase4.test.ts` — mock (line 85)
- `app/analytics/kpi/__tests__/page-phase5.test.tsx` — mock (line 74)
- `components/analytics/__tests__/InsightSlideOver.test.tsx` — mock (line 87)
- `components/analytics/__tests__/InsightPanelNonOpTime.test.tsx` — mock (line 58)
- `components/analytics/__tests__/InsightPanelScheduling.test.tsx` — mock (line 66)
- `components/analytics/__tests__/InsightPanelUtilization.test.tsx` — mock (line 260)

### Legacy function consumers
- `getAllTurnovers` — defined `analyticsV2.ts:2438`, called `surgeons/page.tsx:574`
- `calculateRoomTurnovers` — defined `analyticsV2.ts:2477`, DEAD CODE (no callers)
- `getAllSurgicalTurnovers` — defined `analyticsV2.ts:2486`, called `surgeons/page.tsx:575,608,611`

### Data quality findings
- `METRIC_REQUIREMENTS` at `data-quality/page.tsx:55-58` has phantom `room_turnover` entry referencing `room_cleaned`
- 3 debug `showToast` calls at lines ~330, ~365, ~441 fire on success paths

---

## Phase 1: New Calculation + Engine Types

**Status:** Pending

**What:** Add `calculateFlipRoomTurnover` function and wire `flipRoomTurnover` into `AnalyticsOverview`. No renames yet — purely additive.

**Files touched:**
- `lib/analyticsV2.ts` — new function, updated types, updated `calculateAnalyticsOverview`

**Details:**
1. Add `flipRoomTurnover: TurnoverResult` field to `AnalyticsOverview` interface
2. Implement `calculateFlipRoomTurnover(cases, previousPeriodCases?, config?)`:
   - Build room timeline: `Map<date|room_id, cases sorted by start_time>`
   - Build surgeon timeline: `Map<surgeon_id|date, cases sorted by incision>`
   - For each surgeon day, find flip transitions (consecutive cases where `or_room_id` differs)
   - For each flip into Room Y: find the predecessor case in Room Y's timeline
   - Compute: `patient_out(predecessor) → patient_in(flip case)`
   - Filter: > 0 and < 180 minutes
   - Return `TurnoverResult` with details, compliance (uses `turnoverThresholdMinutes`), daily data
3. Wire into `calculateAnalyticsOverview` — call `calculateFlipRoomTurnover` and assign to `flipRoomTurnover`

**Commit:** `feat(analytics): phase 1 - add flipRoomTurnover calculation`

**Test gate:**
- Unit: `calculateFlipRoomTurnover` returns correct values for known flip scenarios, handles edge cases (first case in room, > 180 min filter, same-day only)
- Integration: `calculateAnalyticsOverview` includes `flipRoomTurnover` in its return
- Workflow: Existing `turnoverTime`, `standardSurgicalTurnover`, `flipRoomTime` unchanged

**Complexity:** Medium

---

## Phase 2: Global Rename

**Status:** Pending

**What:** Rename all 3 existing turnover fields across the entire codebase. TypeScript strict mode catches every miss. Also rename legacy functions and remove dead code.

**Files touched (all references from codebase scan):**

_Core:_
- `lib/analyticsV2.ts` — rename in types, interfaces, function returns, `TurnoverBreakdown` fields, legacy functions

_Display consumers:_
- `app/analytics/kpi/page.tsx`
- `app/analytics/flags/page.tsx`
- `app/analytics/page.tsx`
- `app/analytics/surgeons/page.tsx` (legacy function imports)
- `components/analytics/InsightSlideOver.tsx`
- `components/analytics/InsightPanelTurnover.tsx`

_Hooks:_
- `lib/hooks/useDashboardKPIs.ts`
- `lib/hooks/useTrendData.ts`

_Insights/exports:_
- `lib/insightsEngine.ts`
- `lib/insightExports.ts`

_Test files (mock fixture updates):_
- `lib/__tests__/insightsEngine.test.ts`
- `lib/__tests__/insightExports.test.ts`
- `lib/__tests__/analyticsV2-phase2.test.ts`
- `lib/__tests__/analyticsV2-phase1.test.ts`
- `lib/__tests__/analyticsV2-phase6.test.ts`
- `app/analytics/kpi/__tests__/page-phase4.test.ts`
- `app/analytics/kpi/__tests__/page-phase5.test.tsx`
- `components/analytics/__tests__/InsightSlideOver.test.tsx`
- `components/analytics/__tests__/InsightPanelTurnover.test.tsx`
- `components/analytics/__tests__/InsightPanelNonOpTime.test.tsx`
- `components/analytics/__tests__/InsightPanelScheduling.test.tsx`
- `components/analytics/__tests__/InsightPanelUtilization.test.tsx`
- `lib/hooks/__tests__/useDashboardKPIs.test.ts`
- `lib/hooks/__tests__/useAnalyticsConfig.test.ts`
- `app/settings/analytics/__tests__/settings-defaults.test.ts`

**Details:**
1. In `analyticsV2.ts`:
   - `AnalyticsOverview.turnoverTime` → `sameRoomTurnover`
   - `AnalyticsOverview.standardSurgicalTurnover` → `sameRoomSurgicalTurnover`
   - `AnalyticsOverview.flipRoomTime` → `flipRoomSurgicalTurnover`
   - `TurnoverBreakdown.standardTurnover` → `sameRoomSurgicalTurnover`
   - `TurnoverBreakdown.flipRoomTime` → `flipRoomSurgicalTurnover`
   - `getAllTurnovers` → `getAllSameRoomTurnovers`
   - `getAllSurgicalTurnovers` → `getAllSameRoomSurgicalTurnovers`
   - Remove dead `calculateRoomTurnovers` alias
2. Update every consumer and test file to use new names
3. Run `npx tsc --noEmit` to verify zero missed references
4. Run `npm run test` to verify all tests pass

**Commit:** `refactor(analytics): phase 2 - rename turnover fields for consistency`

**Test gate:**
- Unit: All existing turnover tests pass with renamed fields
- Integration: tsc --noEmit passes cleanly
- Workflow: npm run test passes (all suites)

**Complexity:** Large (mechanical, wide-reaching)

---

## Phase 3: Display Updates + Insights

**Status:** Pending

**What:** Add the 4th metric (flipRoomTurnover) to all display surfaces. Update insights engine and exports.

**Files touched:**
- `app/analytics/kpi/page.tsx` — add flipRoomTurnover row to `turnoverRows`
- `app/analytics/flags/page.tsx` — restructure to 2x2+1 layout (room turnovers row, surgical turnovers row, non-op below)
- `app/analytics/page.tsx` — update quick stat label to "Same Room Turnover"
- `components/analytics/InsightSlideOver.tsx` — pass `flipRoomTurnover` prop to InsightPanelTurnover
- `components/analytics/InsightPanelTurnover.tsx` — accept `flipRoomTurnover` prop (no UI render yet)
- `lib/insightsEngine.ts` — add flipRoomTurnover to surgical comparison insight; add room turnover comparison (same vs flip room turnovers)
- `lib/insightExports.ts` — add flipRoomTurnover to turnover export sheets and executive summary
- Test files for affected components

**Details:**
1. **KPI page:** Add a 4th entry to `turnoverRows` array for `analytics.flipRoomTurnover` with label "Flip-Room Turnover" and status vs `config.turnoverThresholdMinutes`
2. **Flags page:** Restructure from single 4-col row to:
   - Row 1 (Room Turnovers): Same-Room Turnover | Flip-Room Turnover (2 cards)
   - Row 2 (Surgical Turnovers): Same-Room Surgical | Flip-Room Surgical (2 cards)
   - Row 3: Non-Operative Time (full-width or single card)
3. **Analytics page:** Change "Avg Turnover" label to "Same Room Turnover"
4. **InsightSlideOver:** Pass `analytics.flipRoomTurnover` as prop
5. **InsightPanelTurnover:** Add optional `flipRoomTurnover?: TurnoverResult` to props interface
6. **insightsEngine:** Add room turnover comparison insight (same-room vs flip-room room turnovers)
7. **insightExports:** Add flipRoomTurnover as 4th row in summary sheet, add to executive summary

**Commit:** `feat(analytics): phase 3 - add flipRoomTurnover to all displays and insights`

**Test gate:**
- Unit: New KPI row renders, flags page layout correct, insight generation includes new metric
- Integration: Export includes 4 turnover rows, InsightSlideOver passes new prop
- Workflow: Navigate KPI page → see 4 turnover rows → click through to insight panel

**Complexity:** Medium

---

## Phase 4: Data Quality Fix + Final Verification

**Status:** Pending

**What:** Fix the data quality page phantom reference and debug toasts. Run full verification.

**Files touched:**
- `app/dashboard/data-quality/page.tsx`

**Details:**
1. Remove `room_turnover` entry from `METRIC_REQUIREMENTS` (lines 55-58) — room turnover is a cross-case metric, not a single-case milestone metric
2. Remove 3 debug `showToast` calls:
   - Line ~330-334: Unconditional toast logging case_milestones count
   - Line ~365-369: Unconditional toast logging facility_milestones count
   - Line ~441-445: Toast for missing facility_milestone lookup
3. Run full verification:
   - `npx tsc --noEmit`
   - `npm run test`
   - Manual check: data quality page no longer shows "Room Turnover Time" as uncomputable

**Commit:** `fix(data-quality): phase 4 - remove phantom room_turnover metric and debug toasts`

**Test gate:**
- Unit: METRIC_REQUIREMENTS no longer contains `room_turnover` key
- Integration: Data quality page loads without debug toasts
- Workflow: Open data quality page → Impact Analysis → confirm "Room Turnover Time" gone

**Complexity:** Small

---

## Phase Summary

| Phase | Description | Complexity | Files |
|---|---|---|---|
| 1 | New `calculateFlipRoomTurnover` + engine types | Medium | 1 |
| 2 | Global rename (3 fields + legacy fns) | Large | ~25 |
| 3 | Display updates + insights + exports | Medium | ~10 |
| 4 | Data quality fix + final verification | Small | 1 |
