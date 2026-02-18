# Implementation Plan: Dashboard Revamp

## Summary

Transform the facility admin dashboard from a static KPI overview into a real-time operational command center. Adds Live Pulse Banner, Schedule Adherence Gantt, AI Insights, KPI sparklines with target bars, AreaChart trend, and a restructured layout. Includes a new database migration for procedure type expected durations with surgeon overrides.

## Interview Notes

| Decision | Answer |
|---|---|
| Missing case duration handling | Add `expected_duration_minutes` to `procedure_types` with surgeon override table |
| Duration inheritance | 2-level: procedure type base → surgeon override (no facility-wide default) |
| Duration settings UI | Add to existing Procedures settings page as inline field + surgeon override |
| Duration permissions | Facility admins manage, global admins view |
| AI Insights loading | Lazy load on scroll (IntersectionObserver) |
| Live Pulse scope | Status chips + counts only (existing `useTodayStatus` data) |
| Gantt refresh | Poll every 60 seconds |
| Trend chart style | Restyle existing LineChart → AreaChart with gradient |
| KPI card approach | Modify existing MetricCard (add optional sparkData + target props) |
| Quick Actions | Keep current 5 cards, restyle visually |
| Scope | Full mockup (all 7 changes) — ~7 phases |

## Codebase Scan Results

### Data Availability

| Feature | Hook/Source | Gap |
|---|---|---|
| KPI sparklines | `useDashboardKPIs` → `KPIResult.dailyData[].numericValue` | None — wire directly |
| Live Pulse | `useTodayStatus` → room status + case counts | None — data exists |
| Schedule Gantt | No hook exists | Need `useScheduleTimeline` hook: cases + milestones + durations |
| AI Insights | `insightsEngine.generateInsights()` exists | Need `useDashboardInsights` hook wrapping `calculateAnalyticsOverview` |
| Trend chart | `useTrendData` → 30-day data | None — restyle only |

### Key Files

- Dashboard page: `app/dashboard/page.tsx`
- KPI hook: `lib/hooks/useDashboardKPIs.ts` (returns `DashboardKPIs` with `dailyData` arrays)
- Today status: `lib/hooks/useTodayStatus.ts` (returns `RoomStatusData[]` + `TodaySurgeonData[]`)
- Insights engine: `lib/insightsEngine.ts` (7 categories, takes `AnalyticsOverview`)
- Analytics engine: `lib/analyticsV2.ts` (`calculateAnalyticsOverview()`)
- MetricCard: `components/ui/MetricCard.tsx` (gradient text, trend arrows, count-up animation)
- Procedures page: `app/settings/procedures/page.tsx`
- `procedure_types` table: has `name`, `facility_id`, `procedure_category_id`, etc. — NO `expected_duration_minutes` yet
- `cases` table: has `scheduled_duration_minutes` (nullable), `start_time` (TIME)

### Test Infrastructure

- Vitest + jsdom, `@testing-library/react`
- Recharts already installed (`^3.6.0`)
- Supabase not mocked directly — tests use extracted pure functions or `vi.mock()` on hooks
- Existing dashboard test files: FacilityScoreCard, NeedsAttention, QuickAccessCards, RoomStatusCard, TodaysSurgeons, TrendChart

---

## Phase 1: Database Migration — Procedure Duration Config

**Status:** Pending

**What:** Add `expected_duration_minutes` to `procedure_types` and create `surgeon_procedure_duration` table for surgeon-level overrides.

**Files touched:**
- `supabase/migrations/YYYYMMDD_procedure_duration_config.sql` (new)

**Details:**
1. `ALTER TABLE procedure_types ADD COLUMN expected_duration_minutes integer;`
2. Create `surgeon_procedure_duration` table:
   ```sql
   CREATE TABLE surgeon_procedure_duration (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
     surgeon_id uuid NOT NULL REFERENCES users(id),
     procedure_type_id uuid NOT NULL REFERENCES procedure_types(id) ON DELETE CASCADE,
     expected_duration_minutes integer NOT NULL,
     created_at timestamptz DEFAULT now(),
     updated_at timestamptz DEFAULT now(),
     UNIQUE(facility_id, surgeon_id, procedure_type_id)
   );
   ```
3. Add RLS policies: facility admins can SELECT/INSERT/UPDATE/DELETE on their facility, global admins can SELECT all
4. Add index on `(facility_id, surgeon_id)` and `(facility_id, procedure_type_id)`
5. Apply migration via `supabase db push`

**Commit:** `feat(db): phase 1 - add procedure duration config with surgeon override`

**Test gate:**
- Unit: Migration SQL is syntactically valid
- Integration: Column exists on `procedure_types`, table exists with correct constraints
- Workflow: Verify via Supabase REST API that the new column/table are accessible

**Complexity:** Small

---

## Phase 2: Procedure Duration Settings UI

**Status:** Pending

**What:** Add expected duration configuration to the Procedures settings page with surgeon override support.

**Files touched:**
- `app/settings/procedures/page.tsx` — add duration field + surgeon override button
- `lib/dal/procedures.ts` or inline — update/insert duration values

**Details:**
1. Add "Expected Duration" column to the procedure list/table
2. Each procedure row gets an editable duration field (minutes, integer input)
3. Add "Surgeon Overrides" button per procedure → opens inline section or modal
4. Surgeon override section: list of surgeons with override duration inputs
5. Save handler: update `procedure_types.expected_duration_minutes` and upsert `surgeon_procedure_duration` rows
6. Show inheritance indicator: "No override" when surgeon row doesn't exist

**Commit:** `feat(settings): phase 2 - procedure duration config with surgeon override UI`

**Test gate:**
- Unit: Duration input renders, saves correct value, surgeon override creates/updates rows
- Integration: Changing duration persists to DB and reloads correctly
- Workflow: Settings → Procedures → set duration → set surgeon override → verify both saved

**Complexity:** Medium

---

## Phase 3: Live Pulse Banner + Layout Restructure

**Status:** Pending

**What:** Create the Live Pulse Banner and restructure the dashboard layout to the new 50/50 grid pattern. Add an empty placeholder where AI Insights will go in Phase 6.

**Files touched:**
- `components/dashboard/LivePulseBanner.tsx` (new)
- `app/dashboard/page.tsx` — add banner, restructure grid layout

**Details:**
1. **LivePulseBanner component:**
   - Pulsing green dot with "Live" label (CSS animation)
   - Status chips from `useTodayStatus`: count rooms by status (`in_case`, `turning_over`, `idle`, `done`)
   - Case progress: `completedCases / totalCases` aggregated across all rooms
   - "Next: OR X @ HH:MM" from first room with a `nextCase`
   - Styling: `bg-white rounded-xl shadow-sm border border-slate-100` (matches card pattern)

2. **Layout restructure in `page.tsx`:**
   - Insert `<LivePulseBanner>` between header and KPI row
   - Change Needs Attention from `lg:col-span-3` in 5-col grid → `lg:col-span-1` in 2-col grid
   - Add Insights placeholder (`lg:col-span-1`) — empty card with "Insights coming soon" or just the section wrapper
   - Move Room Status and Surgeons to their own `grid-cols-2` row below
   - Maintain responsive: single column on mobile, 2-col on `lg:`

**Commit:** `feat(dashboard): phase 3 - live pulse banner and layout restructure`

**Test gate:**
- Unit: LivePulseBanner renders status chips with correct counts from mock data
- Integration: Dashboard page renders new layout with all sections in correct positions
- Workflow: Load dashboard → see Live Pulse at top → Needs Attention and placeholder side by side → Rooms and Surgeons below

**Complexity:** Medium

---

## Phase 4: KPI Card Enhancement (Sparklines + Target Bars)

**Status:** Pending

**What:** Add optional sparkline mini-charts and target progress bars to the existing MetricCard component. Wire sparkline data from the dashboard KPIs hook.

**Files touched:**
- `components/ui/MetricCard.tsx` — add `sparkData`, `target` props
- `app/dashboard/page.tsx` — pass sparkline data and targets to MetricCard instances

**Details:**
1. **MetricCard enhancements:**
   - Add optional `sparkData?: { value: number }[]` prop — renders a tiny recharts `AreaChart` (72×28px) in the top-right corner with gradient fill
   - Add optional `target?: { value: number; label: string }` prop — renders a thin progress bar below the value showing current vs target
   - Status dot: colored based on target achievement (green ≥80%, amber ≥50%, rose <50%)
   - All new props are optional — existing MetricCard usage is unaffected

2. **Dashboard wiring:**
   - OR Utilization sparkline: `kpis.utilization.dailyData.map(d => ({ value: d.numericValue }))`
   - Cases sparkline: derive from daily completed counts (may need small computation)
   - Median Turnover sparkline: `kpis.medianTurnover.dailyData`
   - On-Time Starts sparkline: `kpis.onTimeStartPct.dailyData`
   - Targets from `facility_analytics_settings`: utilization → 80%, turnover → 25m, FCOTS → 85%

3. **FacilityScoreCard:** Add sparkline showing daily facility score (from `useTrendData('facilityScore')` or compute inline)

**Commit:** `feat(dashboard): phase 4 - KPI sparklines and target progress bars`

**Test gate:**
- Unit: MetricCard renders sparkline when `sparkData` provided, renders target bar when `target` provided, renders normally without either
- Integration: All 5 KPI cards on dashboard show sparklines and targets with real data
- Workflow: Toggle time range → sparklines update with period data → target bars reflect current values

**Complexity:** Medium

---

## Phase 5: Schedule Adherence Timeline (Gantt)

**Status:** Pending

**What:** Create the Schedule Adherence Timeline — a full-width Gantt chart showing scheduled vs actual case times per OR room with 60-second polling.

**Files touched:**
- `lib/hooks/useScheduleTimeline.ts` (new)
- `components/dashboard/ScheduleAdherenceTimeline.tsx` (new)
- `app/dashboard/page.tsx` — insert below KPI row

**Details:**
1. **`useScheduleTimeline()` hook:**
   - Fetch today's cases with: `start_time`, `scheduled_duration_minutes`, `or_room_id`, `surgeon_id`, `procedure_type_id`, `status_id`
   - Join `case_milestones` for actual times: `patient_in` (actual start), `patient_out` (actual end)
   - Fetch `procedure_types.expected_duration_minutes` for duration fallback
   - Fetch `surgeon_procedure_duration` for surgeon-specific override
   - Duration resolution: `scheduled_duration_minutes` → surgeon override → procedure base → null
   - Group by room, sort by scheduled start time
   - Compute per-case: `{ scheduledStart, scheduledEnd, actualStart?, actualEnd?, status: 'ontime'|'late'|'upcoming', label }`
   - Summary stats: on-time count, late count, avg drift (minutes), upcoming count
   - Polling: `useSupabaseQuery` with `refetchInterval: 60000`

2. **`ScheduleAdherenceTimeline` component:**
   - Header: "Schedule Adherence" title + subtitle + legend (Scheduled/On time/Late/Upcoming)
   - Summary badges: on-time (green), late + avg drift (rose), upcoming (slate)
   - Time axis: configurable start/end hours (default 7a–5p from OR hours config)
   - Per-room row: room label (48px) + timeline bar with:
     - Grid lines at each hour
     - Per-case: gray ghost bar (scheduled) + solid overlay (green=on-time, rose=late) + dashed outline (upcoming)
     - Case label text inside bar if wide enough
   - Blue vertical "now" marker at current time (updates via `setInterval` every 60s)
   - Pure div/CSS rendering (no recharts — custom positioning with percentages)

3. **On-time vs late logic:**
   - Compare `actualStart` vs `scheduledStart`: if actual > scheduled + grace (e.g., 5 min) → late
   - Or simply: if any actual bar extends past scheduled bar → late

**Commit:** `feat(dashboard): phase 5 - schedule adherence timeline with 60s polling`

**Test gate:**
- Unit: `useScheduleTimeline` correctly groups cases by room, resolves durations, computes summary stats
- Integration: Timeline component renders correct number of room rows, bars positioned correctly
- Workflow: Dashboard loads → Gantt shows rooms with scheduled/actual bars → "now" marker visible → wait 60s → data refreshes

**Complexity:** Large

---

## Phase 6: AI Insights Section

**Status:** Pending

**What:** Create the "What should we fix?" insights section with expandable cards, lazy-loaded on scroll.

**Files touched:**
- `lib/hooks/useDashboardInsights.ts` (new)
- `components/dashboard/InsightsSection.tsx` (new)
- `components/dashboard/InsightCard.tsx` (new)
- `app/dashboard/page.tsx` — replace insights placeholder from Phase 3

**Details:**
1. **`useDashboardInsights()` hook:**
   - Uses `IntersectionObserver` pattern: only fetches when `enabled` is true
   - Fetches cases for the selected time range (same query pattern as analytics page)
   - Calls `calculateAnalyticsOverview()` → `generateInsights()`
   - Returns `{ insights: Insight[], loading, error }`
   - Caches results for the session (don't re-compute on every scroll in/out)

2. **`InsightsSection` component:**
   - Header: sparkle icon + "What should we fix?" + "AI-generated insights ranked by recoverable OR time"
   - Badge: "N insights" count
   - Renders up to 3–5 `InsightCard` components
   - Manages expanded state (one card expanded at a time)
   - Skeleton loading state while insights compute

3. **`InsightCard` component:**
   - Collapsed: priority badge (numbered), title, pillar tag, one-line headline, expand chevron
   - Expanded: full detail text + "Projected Impact" callout (green) + "Recommended Action" callout (blue)
   - Priority colors: high=rose, medium=amber
   - Pillar tags mapped from `insight.category` to pillar names and colors
   - Click to toggle expand/collapse

4. **Dashboard wiring:**
   - `useRef` + `IntersectionObserver` on the insights section container
   - When visible, set `enabled: true` to trigger the hook
   - Replace Phase 3 placeholder with actual `<InsightsSection>`

**Commit:** `feat(dashboard): phase 6 - AI insights section with lazy loading`

**Test gate:**
- Unit: InsightCard renders collapsed/expanded states, InsightsSection renders multiple cards
- Integration: `useDashboardInsights` calls insightsEngine and returns typed insights
- Workflow: Load dashboard → scroll to insights section → loading skeleton appears → insights populate with expandable cards

**Complexity:** Large

---

## Phase 7: Trend Chart Restyle + Quick Actions Restyle + Polish

**Status:** Pending

**What:** Restyle the TrendChart from LineChart to AreaChart, update QuickAccessCards visuals, and final polish across all new components.

**Files touched:**
- `components/dashboard/TrendChart.tsx` — LineChart → AreaChart
- `components/dashboard/QuickAccessCards.tsx` — visual restyle
- `app/dashboard/page.tsx` — any final layout tweaks
- Various component files — responsive polish

**Details:**
1. **TrendChart restyle:**
   - Replace `LineChart` with `AreaChart` + `<Area>` with gradient fill (`<linearGradient>` defs)
   - Replace dropdown metric selector with inline button toggle (segmented control style, matching mockup)
   - Keep existing `useTrendData` hook — no data changes
   - Update tooltip styling to match dashboard design tokens
   - Maintain all 4 metrics: utilization, turnover, caseVolume, facilityScore

2. **QuickAccessCards restyle:**
   - Update card styling to match mockup: icon in colored rounded-square, hover border color change, subtle translateY on hover
   - Keep existing 5 navigation links (Surgeon Scorecards, Block Utilization, Financial Summary, KPI Analytics, Case Analytics)
   - Add description subtitles matching the mockup pattern

3. **Final polish:**
   - Verify responsive breakpoints: single-column mobile → 2-col tablet → full layout desktop
   - Verify skeleton/loading states for all new components
   - Ensure error states don't break layout
   - Run full typecheck + test suite

**Commit:** `style(dashboard): phase 7 - trend chart restyle, quick actions polish, final cleanup`

**Test gate:**
- Unit: TrendChart renders AreaChart (not LineChart), QuickAccessCards render updated styles
- Integration: Full dashboard renders all 7 sections correctly with loading → loaded states
- Workflow: Load dashboard → verify all sections → toggle time range → resize window → all sections responsive

**Complexity:** Medium

---

## Phase Summary

| Phase | Description | Complexity | Key Files |
|---|---|---|---|
| 1 | Database migration — procedure duration config | Small | 1 migration |
| 2 | Procedure duration settings UI | Medium | ~2 files |
| 3 | Live Pulse Banner + layout restructure | Medium | ~2 files |
| 4 | KPI sparklines + target bars | Medium | ~2 files |
| 5 | Schedule Adherence Timeline (Gantt) | Large | ~3 files |
| 6 | AI Insights section | Large | ~4 files |
| 7 | Trend chart restyle + quick actions + polish | Medium | ~3 files |
