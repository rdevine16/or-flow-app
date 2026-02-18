# Implementation Plan: KPI Target Configuration

## Summary
Wire all KPI targets from the `facility_analytics_settings` database table through to the analytics calculations, replacing dozens of hard-coded values. Add missing columns for targets that have no storage yet. Make daily tracker colors target-relative. Reuse existing `facilities.or_hourly_rate` for revenue assumptions in the insights engine. Update all consumer pages (KPI, flags, dashboard) and the Settings UI.

## Interview Notes
- **Revenue**: Use existing `facilities.or_hourly_rate` (per-facility, configurable at `/settings/financials`) — do NOT add new revenue columns
- **Scope**: Wire KPI page, flags page, AND dashboard (useDashboardKPIs)
- **Colors**: Make daily tracker sparkline colors target-relative (not absolute thresholds)
- **Shared type**: Create `FacilityAnalyticsConfig` in `lib/analyticsV2.ts` — used by all analytics consumers
- **Backfill**: Fix wrong turnover defaults (30→45 for same-room, 45→15 for flip) and update existing rows
- **Dead code**: Delete unused `components/analytics/KPICard.tsx`
- **Type name**: `FacilityAnalyticsConfig` (facility-level, not KPI-specific)

---

## Settings UI Field Spec

All fields live at **Settings > Ops > Analytics** (`/settings/analytics`).

### Section 1: First Case On-Time Start (FCOTS)
*Existing — no changes*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `fcots_milestone` | Start Milestone | radio | `patient_in` | — | Which event defines "started" |
| `fcots_grace_minutes` | Grace Period (min) | number | 2 | 0–30 | Minutes after scheduled time still "on-time" |
| `fcots_target_percent` | Target (%) | number | 85 | 0–100 | Industry benchmark: 85% |

### Section 2: Surgical Turnovers
*Rename from "Turnover Targets" — fix labels, fix defaults, add 2 new fields*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `turnover_target_same_surgeon` | Same-Room Target (min) | number | **45** ← was 30 | 5–120 | Same surgeon, same OR. Benchmark: 45 min |
| `turnover_target_flip_room` | Flip-Room Target (min) | number | **15** ← was 45 | 5–120 | Surgeon moves to different OR. Benchmark: 15 min |
| `turnover_threshold_minutes` | Room Turnover Threshold (min) | number | 30 | 5–120 | **NEW** — A turnover is "compliant" if under this |
| `turnover_compliance_target_percent` | Compliance Target (%) | number | 80 | 0–100 | **NEW** — Target % of turnovers under threshold |

### Section 3: OR Utilization
*Split from "Other Targets"*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `utilization_target_percent` | Utilization Target (%) | number | **75** ← was 80 | 0–100 | Patient-in-room time as % of available hours |

### Section 4: Cancellations
*Split from "Other Targets"*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `cancellation_target_percent` | Same-Day Cancellation Target (%) | number | 5 | 0–100 | Max acceptable same-day cancellation rate |

### Section 5: Surgeon Idle Time *(NEW section)*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `idle_combined_target_minutes` | Combined Idle Target (min) | number | 10 | 1–60 | Total acceptable idle time between cases |
| `idle_flip_target_minutes` | Flip-Room Idle Target (min) | number | 5 | 1–60 | Idle time when surgeon moves to another OR |
| `idle_same_room_target_minutes` | Same-Room Idle Target (min) | number | 10 | 1–60 | Idle time when surgeon stays in same OR |

### Section 6: Tardiness & Non-Operative Time *(NEW section)*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `tardiness_target_minutes` | Cumulative Tardiness Target (min) | number | 45 | 5–120 | Max cumulative tardiness per day |
| `non_op_warn_minutes` | Non-Op Time Warning (min) | number | 20 | 5–120 | Avg non-operative time that triggers warning |
| `non_op_bad_minutes` | Non-Op Time Alert (min) | number | 30 | 5–120 | Avg non-operative time that triggers alert |

### Section 7: Operational *(NEW section)*

| Field | Label | Type | Default | Min–Max | Help Text |
|---|---|---|---|---|---|
| `operating_days_per_year` | Operating Days per Year | number | 250 | 1–365 | Used for annualized projections in AI Insights |

### Section 8: ORbit Score
*Existing — no changes*

---

## Phase 1: Database Migration + Shared Type + Fetch Hook
**Complexity: Medium**

### What it does
- Add new columns to `facility_analytics_settings` for all currently hard-coded targets
- Fix wrong defaults on existing turnover columns and backfill existing rows
- Create shared `FacilityAnalyticsConfig` TypeScript interface
- Create `useAnalyticsConfig` hook for consistent fetching across pages

### Files touched
- `supabase/migrations/YYYYMMDD000001_add_kpi_target_columns.sql` (new)
- `lib/analyticsV2.ts` — add `FacilityAnalyticsConfig` interface and default constants
- `lib/hooks/useAnalyticsConfig.ts` (new) — shared hook to fetch facility analytics settings + or_hourly_rate

### Migration details

**New columns on `facility_analytics_settings`:**

| Column | Type | Default | Constraint |
|---|---|---|---|
| `turnover_compliance_target_percent` | numeric | 80 | CHECK (>= 0 AND <= 100) |
| `turnover_threshold_minutes` | numeric | 30 | CHECK (>= 5 AND <= 120) |
| `tardiness_target_minutes` | numeric | 45 | CHECK (>= 5 AND <= 120) |
| `idle_combined_target_minutes` | numeric | 10 | CHECK (>= 1 AND <= 60) |
| `idle_flip_target_minutes` | numeric | 5 | CHECK (>= 1 AND <= 60) |
| `idle_same_room_target_minutes` | numeric | 10 | CHECK (>= 1 AND <= 60) |
| `non_op_warn_minutes` | numeric | 20 | CHECK (>= 5 AND <= 120) |
| `non_op_bad_minutes` | numeric | 30 | CHECK (>= 5 AND <= 120) |
| `operating_days_per_year` | integer | 250 | CHECK (>= 1 AND <= 365) |

**Fix existing column defaults:**
- `ALTER COLUMN turnover_target_same_surgeon SET DEFAULT 45`
- `ALTER COLUMN turnover_target_flip_room SET DEFAULT 15`
- `ALTER COLUMN utilization_target_percent SET DEFAULT 75`

**Backfill existing rows:**
- `UPDATE facility_analytics_settings SET turnover_target_same_surgeon = 45 WHERE turnover_target_same_surgeon = 30`
- `UPDATE facility_analytics_settings SET turnover_target_flip_room = 15 WHERE turnover_target_flip_room = 45`
- `UPDATE facility_analytics_settings SET utilization_target_percent = 75 WHERE utilization_target_percent = 80`

### `FacilityAnalyticsConfig` interface
```typescript
export interface FacilityAnalyticsConfig {
  // FCOTS
  fcotsMillestone: 'patient_in' | 'incision'
  fcotsGraceMinutes: number
  fcotsTargetPercent: number
  // Surgical Turnovers
  sameRoomTurnoverTarget: number       // minutes (default 45)
  flipRoomTurnoverTarget: number       // minutes (default 15)
  turnoverThresholdMinutes: number     // room turnover compliance threshold (default 30)
  turnoverComplianceTarget: number     // percent (default 80)
  // OR Utilization
  utilizationTargetPercent: number     // percent (default 75)
  // Cancellations
  cancellationTargetPercent: number    // percent (default 5)
  // Surgeon Idle Time
  idleCombinedTargetMinutes: number    // minutes (default 10)
  idleFlipTargetMinutes: number        // minutes (default 5)
  idleSameRoomTargetMinutes: number    // minutes (default 10)
  // Tardiness & Non-Operative Time
  tardinessTargetMinutes: number       // minutes (default 45)
  nonOpWarnMinutes: number             // minutes (default 20)
  nonOpBadMinutes: number              // minutes (default 30)
  // Operational
  operatingDaysPerYear: number         // days (default 250)
  // Revenue (from facilities table, not facility_analytics_settings)
  orHourlyRate: number | null          // $/hr (from facilities.or_hourly_rate)
}
```

### `useAnalyticsConfig` hook
- Fetches `facility_analytics_settings` (all columns) for the current facility
- Fetches `facilities.or_hourly_rate` for the current facility
- Merges into a single `FacilityAnalyticsConfig` object with fallback defaults
- Returns `{ config, loading, refetch }`

### Commit message
`feat(analytics): phase 1 - migration, shared FacilityAnalyticsConfig type, useAnalyticsConfig hook`

### Test gate
1. **Unit**: FacilityAnalyticsConfig type compiles, defaults are exported, useAnalyticsConfig hook returns correct shape
2. **Integration**: Hook fetches from facility_analytics_settings + facilities.or_hourly_rate and merges correctly
3. **Workflow**: Settings page still loads/saves correctly with new columns present

---

## Phase 2: Wire analyticsV2 to Accept Config
**Complexity: Large**

### What it does
- Modify `calculateAnalyticsOverview()` to accept `FacilityAnalyticsConfig`
- Forward config fields to each `calculate*` function
- Replace ALL hard-coded targets with config values (with fallback defaults)
- Make daily tracker color thresholds target-relative

### Files touched
- `lib/analyticsV2.ts` — refactor all `calculate*` functions to accept config params
- `lib/__tests__/analyticsV2-phase1.test.ts` — update tests to pass config, verify target-relative behavior

### Key changes
- `calculateAnalyticsOverview(cases, prevCases, config?: FacilityAnalyticsConfig, roomHoursMap?)` — new unified config param replaces `fcotsConfig`
- Each `calculate*` function gets relevant config fields forwarded:
  - `calculateFCOTS` ← `fcotsMillestone`, `fcotsGraceMinutes`, `fcotsTargetPercent`
  - `calculateSurgicalTurnovers` ← `sameRoomTurnoverTarget`, `flipRoomTurnoverTarget`
  - `calculateTurnoverTime` ← `turnoverThresholdMinutes`, `turnoverComplianceTarget`
  - `calculateORUtilization` ← `utilizationTargetPercent`
  - `calculateCancellationRate` ← `cancellationTargetPercent`
  - `calculateCumulativeTardiness` ← `tardinessTargetMinutes`
  - `calculateNonOperativeTime` ← `nonOpWarnMinutes`, `nonOpBadMinutes`
  - `calculateSurgeonIdleTime` ← `idleCombinedTargetMinutes`, `idleFlipTargetMinutes`, `idleSameRoomTargetMinutes`
- Daily tracker colors computed as target-relative:
  - "Lower is better" metrics (turnovers, idle, tardiness, non-op): `<= target → green`, `<= target × 1.2 → yellow`, `> target × 1.2 → red`
  - "Higher is better" metrics (FCOTS, utilization): `>= target → green`, `>= target × 0.8 → yellow`, `< target × 0.8 → red`
- Existing `FCOTSConfig` interface kept for backward compat but `FacilityAnalyticsConfig` is the primary param
- `getKPIStatus()` already uses ratio-based logic — no change needed

### Commit message
`feat(analytics): phase 2 - analyticsV2 accepts FacilityAnalyticsConfig, target-relative colors`

### Test gate
1. **Unit**: Each `calculate*` function uses config values when provided, falls back to defaults when not
2. **Integration**: `calculateAnalyticsOverview()` produces correct targets and colors with custom config vs default config
3. **Workflow**: Passing different config values changes KPI targets, color thresholds, and `targetMet` flags

---

## Phase 3: Wire KPI Page + Flags Page
**Complexity: Medium**

### What it does
- Update KPI page to use `useAnalyticsConfig` hook and pass full config to `calculateAnalyticsOverview()`
- Update flags page identically
- Remove page-level hard-coded fallbacks (the `?? 85`, `?? 75`, etc.)
- Update OR Utilization modal to use config-driven thresholds instead of hard-coded 75/60

### Files touched
- `app/analytics/kpi/page.tsx` — replace inline settings fetch with `useAnalyticsConfig`, pass config to calculations
- `app/analytics/flags/page.tsx` — same pattern
- `app/analytics/kpi/__tests__/page-phase4.test.ts` — update tests for config-driven targets

### Commit message
`feat(analytics): phase 3 - KPI and flags pages use facility config for all targets`

### Test gate
1. **Unit**: Pages pass full config to `calculateAnalyticsOverview`, no hard-coded fallback targets remain
2. **Integration**: Changing a config value (e.g., utilization target = 90%) flows through to correct KPI status and color
3. **Workflow**: KPI page → Settings page → change target → KPI page shows updated target and status

---

## Phase 4: Wire Dashboard + Insights Engine
**Complexity: Medium**

### What it does
- Update `useDashboardKPIs` hook to fetch and pass `FacilityAnalyticsConfig`
- Update insights engine to accept `or_hourly_rate` from `facilities` table instead of hard-coded $36/min
- Wire `operating_days_per_year` from config into insights engine
- Remove hard-coded revenue values from `insightsEngine.ts` defaults

### Files touched
- `lib/hooks/useDashboardKPIs.ts` — fetch config, pass to `calculateAnalyticsOverview()`
- `lib/insightsEngine.ts` — `InsightsConfig` accepts `orHourlyRate` and `operatingDaysPerYear` from facility config
- `app/analytics/kpi/page.tsx` — pass `or_hourly_rate` and `operating_days_per_year` to `generateInsights()`

### Commit message
`feat(analytics): phase 4 - dashboard and insights engine use facility config`

### Test gate
1. **Unit**: `useDashboardKPIs` passes config, insights engine uses `orHourlyRate` when provided
2. **Integration**: Dashboard KPI cards reflect custom facility targets; insights show correct revenue impact
3. **Workflow**: Set OR hourly rate in `/settings/financials` → KPI insights show financial impacts using that rate

---

## Phase 5: Settings UI Expansion + Dead Code Cleanup
**Complexity: Medium**

### What it does
- Reorganize `/settings/analytics/` into 8 sections per the field spec above
- Add input fields for all new columns (turnovers, idle times, non-op thresholds, operating days)
- Fix existing turnover field labels ("Same Surgeon" → "Same-Room Target", "Flip Room" → "Flip-Room Target")
- Fix existing turnover defaults in form state (30→45, 45→15)
- Split "Other Targets" into separate OR Utilization and Cancellations sections
- Fix utilization default in form state (80→75)
- Update `AnalyticsSettings` interface to import from shared `FacilityAnalyticsConfig`
- Delete dead `components/analytics/KPICard.tsx`

### Files touched
- `app/settings/analytics/page.tsx` — reorganize form into 8 sections, add all new fields, fix labels/defaults
- `components/analytics/KPICard.tsx` — delete

### Commit message
`feat(analytics): phase 5 - settings UI for all KPI targets, delete dead KPICard`

### Test gate
1. **Unit**: Settings form renders all new fields with correct defaults, validates min/max constraints
2. **Integration**: Saving new settings writes correct values to DB, loading page hydrates all fields correctly
3. **Workflow**: Change idle time target in Settings → KPI page reflects the new target → insights recalculate
