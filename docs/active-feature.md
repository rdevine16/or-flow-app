# Feature: 4-Metric Turnover Restructure

## Goal

Restructure turnover metrics from 3 to 4, organized as two parallel pairs: **Room Turnovers** (facility perspective — how quickly the room is prepared) and **Surgical Turnovers** (surgeon perspective — how quickly the surgeon transitions between patients). Each pair has a same-room and flip-room variant. Also fix the data quality Impact Analysis which incorrectly references a `room_cleaned` milestone that no turnover calculation actually uses.

## Background

Currently there are 3 turnover metrics with inconsistent naming:
- `turnoverTime` (Room Turnover) — `patient_out (Case A) → patient_in (Case B)`, same room
- `standardSurgicalTurnover` — `surgeonDone (Case A) → incision (Case B)`, same surgeon, same room
- `flipRoomTime` — `surgeonDone (Case A) → incision (Case B)`, same surgeon, different room

Missing: **Flip-Room Room Turnover** — when a surgeon flips from Room X to Room Y, how quickly did the facility prepare Room Y? Measured as `patient_out (previous case in Room Y) → patient_in (surgeon's flip case in Room Y)`.

## Target: 4 Metrics

| | Room Turnover (facility) | Surgical Turnover (surgeon) |
|---|---|---|
| **Same-Room** | `patient_out (A) → patient_in (B)`, same room | `surgeonDone (A) → incision (B)`, same room |
| **Flip-Room** | `patient_out (prev in Room Y) → patient_in (flip case in Room Y)` | `surgeonDone (A) → incision (B)`, different room |

### Naming Convention (new)

| Old field name | New field name |
|---|---|
| `turnoverTime` | `sameRoomTurnover` |
| `standardSurgicalTurnover` | `sameRoomSurgicalTurnover` |
| `flipRoomTime` | `flipRoomSurgicalTurnover` |
| _(new)_ | `flipRoomTurnover` |

## Requirements

### 1. New Calculation: Flip-Room Room Turnover

**Algorithm:**
1. Build room timeline: Map<`date|room_id`, cases sorted by start_time>
2. Build surgeon timeline: Map<`surgeon_id|date`, cases sorted by incision>
3. For each surgeon day, find flip transitions (consecutive cases where `or_room_id` differs)
4. For each flip into Room Y: find the predecessor case in Room Y's timeline
5. Compute: `patient_out (predecessor) → patient_in (flip case)`
6. Filter: > 0 and < 180 minutes

**Config:** Shares existing `turnoverThresholdMinutes` (30 min) with same-room room turnover. No new DB columns needed.

### 2. Rename Existing Fields

All 3 existing turnover fields get renamed for consistency (see naming table above). TypeScript strict mode will catch every missed consumer.

### 3. Update All Display Consumers

Every page/component that shows turnover data must:
- Update field references to new names
- Add the 4th metric (flip-room room turnover) where appropriate

### 4. Fix Data Quality Page

- Remove `room_turnover` from `METRIC_REQUIREMENTS` — room turnover is a cross-case metric, not a single-case milestone metric. It does NOT use `room_cleaned`.
- Remove the debug `showToast` that dumps facility_milestones objects (already done on current branch)

## Database Context

No new tables or migrations. All calculations use existing `case_milestones` data.

### Existing Config (facility_analytics_settings)

| Column | Default | Used by |
|---|---|---|
| `turnover_threshold_minutes` | 30 min | Room turnover compliance (same + flip) |
| `turnover_compliance_target_percent` | 80% | Room turnover compliance target |
| `turnover_target_same_surgeon` | 45 min | Same-room surgical target |
| `turnover_target_flip_room` | 15 min | Flip-room surgical target |

## Files Likely Involved

### Analytics Engine (core)
- `lib/analyticsV2.ts` — Types (`TurnoverBreakdown`, `AnalyticsOverview`), new `calculateFlipRoomTurnover`, rename fields in `calculateSurgicalTurnovers` return, update `calculateAnalyticsOverview`

### Display Consumers
- `app/analytics/kpi/page.tsx` — KPI drill-down turnover rows
- `app/analytics/flags/page.tsx` — KPI cards in turnover section
- `app/analytics/page.tsx` — Quick stats
- `components/analytics/InsightSlideOver.tsx` — Passes turnover data to panel
- `components/analytics/InsightPanelTurnover.tsx` — Drill-through detail panel
- `lib/insightsEngine.ts` — AI insight generation
- `lib/insightExports.ts` — Excel export

### Hooks
- `lib/hooks/useDashboardKPIs.ts` — Dashboard KPI computation
- `lib/hooks/useTrendData.ts` — 30-day trend chart

### Data Quality
- `app/dashboard/data-quality/page.tsx` — Remove phantom `room_turnover` from `METRIC_REQUIREMENTS`

### Test Files (mock fixture updates)
- `lib/__tests__/insightsEngine.test.ts`
- `lib/__tests__/insightExports.test.ts`
- `lib/__tests__/analyticsV2-phase2.test.ts`
- `app/analytics/kpi/__tests__/page-phase4.test.ts`
- `app/analytics/kpi/__tests__/page-phase5.test.tsx`
- `components/analytics/__tests__/InsightSlideOver.test.tsx`
- `components/analytics/__tests__/InsightPanelTurnover.test.tsx`

## iOS Parity
- [x] iOS can wait — iOS doesn't have KPI analytics yet

## Known Issues / Constraints
- Flip-room room turnover can only be calculated when the destination room had a prior case that same day. If it's the first case in the room, no value is recorded.
- The `METRIC_REQUIREMENTS` procedure-awareness fix (filtering against `procedure_milestone_config`) is deferred to a follow-up — it requires an additional DB round-trip per modal open.

## Out of Scope
- New DB migrations or config columns
- Redesigning the turnover insight panel layout
- Procedure-aware filtering in data quality METRIC_REQUIREMENTS
- Dashboard page turnover card redesign

## Acceptance Criteria
- [ ] `calculateFlipRoomTurnover` correctly measures destination room prep time for flip transitions
- [ ] All 4 turnover metrics appear on KPI page, flags page, and insight exports
- [ ] Field names are consistent: `sameRoomTurnover`, `flipRoomTurnover`, `sameRoomSurgicalTurnover`, `flipRoomSurgicalTurnover`
- [ ] Data quality Impact Analysis no longer shows "Room Turnover Time" as uncomputable
- [ ] Debug toast removed from data quality page
- [ ] `npx tsc --noEmit` passes
- [ ] All tests pass (`npm run typecheck && npm run test`)
- [ ] No TypeScript `any` types introduced
