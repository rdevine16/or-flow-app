# Feature: KPI Target Configuration — Wire DB Settings to Calculations

## Goal
The KPI Analytics page has dozens of hard-coded targets and thresholds that should be configurable per-facility. A `facility_analytics_settings` table already exists with some columns, and a Settings UI at `/settings/analytics/` already lets users edit them — but most saved values are **never consumed** by the actual calculations. This feature wires everything together and adds missing columns so every KPI target is facility-configurable.

## Requirements

### 1. Wire existing DB columns into `analyticsV2.ts` calculations
These columns exist in `facility_analytics_settings` and are editable in the Settings UI, but the KPI calculations ignore them:

| KPI | DB Column | DB Default | Currently Hard-Coded As |
|---|---|---|---|
| OR Utilization | `utilization_target_percent` | 80% | **75%** (mismatch!) |
| Cancellation Rate | `cancellation_target_percent` | 5% | 5% (matches by coincidence) |
| Same-Room Surgical Turnover | `turnover_target_same_surgeon` | 30 min | **45 min** (mismatch!) |
| Flip-Room Surgical Turnover | `turnover_target_flip_room` | 45 min | **15 min** (mismatch!) |

### 2. Add new DB columns for targets that have no storage
These are hard-coded with no way to configure them:

| KPI | Hard-Coded Value | Proposed Column |
|---|---|---|
| Room Turnover Compliance | 80% (of cases ≤30 min) | `turnover_compliance_target_percent` |
| Room Turnover Threshold | 30 min | `turnover_threshold_minutes` |
| Cumulative Tardiness | 45 min | `tardiness_target_minutes` |
| Surgeon Idle (Combined) | 10 min | `idle_combined_target_minutes` |
| Surgeon Idle (Flip) | 5 min | `idle_flip_target_minutes` |
| Surgeon Idle (Same-Room) | 10 min | `idle_same_room_target_minutes` |
| Non-Op Time (Warn) | 20 min | `non_op_warn_minutes` |
| Non-Op Time (Bad) | 30 min | `non_op_bad_minutes` |
| Operating Days per Year | 250 | `operating_days_per_year` |

### 3. Update Settings UI (`/settings/analytics/`)
Add input fields for all new columns so facility admins can configure them.

### 4. Update KPI page to pass all settings into calculations
The page currently only passes FCOTS config. It needs to pass all settings into `calculateAnalyticsOverview()` and the insights engine.

### 5. Update color thresholds to be target-relative
Daily tracker sparkline colors (green/yellow/red) are hard-coded at absolute values. They should derive from the configured target so colors stay meaningful when targets change.

## Database Context
- Table: `facility_analytics_settings` — already exists, needs new columns added
- Current columns used: `fcots_milestone`, `fcots_grace_minutes`, `fcots_target_percent`
- Current columns ignored: `utilization_target_percent`, `cancellation_target_percent`, `turnover_target_same_surgeon`, `turnover_target_flip_room`
- Settings page: `app/settings/analytics/page.tsx` — reads/writes this table

## UI/UX
- Route: `/settings/analytics/` — add new fields for all configurable targets
- Route: `/analytics/kpi/` — no UI changes, just correct values flowing through
- Group settings logically: FCOTS, Turnovers, Utilization, Cancellations, Surgeon Idle, Revenue

## Files Likely Involved
- `lib/analyticsV2.ts` — all calculation functions; replace hard-coded values with config params
- `app/analytics/kpi/page.tsx` — fetch all settings, pass to calculations
- `app/settings/analytics/page.tsx` — add UI for new settings fields
- `lib/insightsEngine.ts` — replace hard-coded revenue assumptions with config
- `supabase/migrations/` — new migration for added columns
- `lib/analyticsV2.ts` types — extend `AnalyticsConfig` type to include all settings

## iOS Parity
- [ ] iOS equivalent needed
- [x] iOS can wait (iOS doesn't have KPI analytics yet)

## Known Issues / Constraints
- The DB column defaults are **wrong**: `turnover_target_same_surgeon` defaults to 30 min but should be **45 min**; `turnover_target_flip_room` defaults to 45 min but should be **15 min**. The migration must fix these defaults.
- Changing defaults may shift KPI status indicators for existing facilities — consider whether to backfill current hard-coded values as explicit DB rows.
- Color thresholds in daily trackers are tightly coupled to absolute values — making them target-relative requires careful design.

## Out of Scope
- ORbit Score configuration (already wired via `start_time_grace_minutes` etc.)
- Per-surgeon or per-procedure targets (this is facility-level only)
- Historical target tracking (no audit trail of target changes)

## Acceptance Criteria
- [ ] All existing DB settings columns are consumed by their corresponding calculations
- [ ] New columns added via migration with sensible defaults matching current hard-coded values
- [ ] Settings UI has fields for every configurable target, grouped logically
- [ ] KPI page passes all settings through to `calculateAnalyticsOverview()` and insights engine
- [ ] Changing a target in Settings immediately affects KPI page display
- [ ] No hard-coded target values remain in `analyticsV2.ts` or `insightsEngine.ts`
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
