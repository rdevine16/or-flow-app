# Implementation Plan: Dashboard Revamp

## Summary

Transform the facility admin dashboard from a static KPI overview into a real-time operational command center. Adds Live Pulse Banner, Schedule Adherence Gantt (recharts), AI Insights (informational), new DashboardKpiCard with recharts sparklines and target bars, AreaChart trend, FacilityScoreMini with extracted ScoreRing, and a restructured 50/50 layout. Also includes a database migration for procedure durations with surgeon overrides, and a full redesign of the Procedures settings page into a master-detail view.

## Key Decisions (from /review on 2026-02-18)

| # | Decision | Answer |
|---|---|---|
| 1 | Sparkline approach | Recharts `AreaChart` (not existing SVG Sparkline) for gradient fill |
| 2 | KPI card component | New `DashboardKpiCard` — leave existing `MetricCard` untouched |
| 3 | Gantt rendering | Recharts custom chart with horizontal BarChart + custom bar shapes |
| 4 | Gantt data source | New `useScheduleTimeline` hook (not extending useTodayStatus) |
| 5 | Polling scope | `useScheduleTimeline` only (60s). Live Pulse uses useTodayStatus without polling |
| 6 | Duration data | `scheduled_duration_minutes` likely unpopulated. Full fallback chain needed |
| 7 | Procedures settings UI | **Full redesign** of `/settings/procedures` into master-detail view |
| 8 | Duration page location | Replace current procedures page entirely (same URL, new UX) |
| 9 | Insights loading | Lazy-load on scroll via IntersectionObserver |
| 10 | Insight cards | Informational only — no action items or impact callout boxes |
| 11 | Time range toggle | Affects KPI cards + Trend chart only. Everything else = always "today" |
| 12 | Facility Score card | Extract `ScoreRing` to shared component. Compact 52px ring + grade + trend |
| 13 | TrendChart | Convert in-place: LineChart → AreaChart, dropdown → segmented toggle |
| 14 | QuickAccessCards | Minimal restyle only (hover effects, icon colors) |
| 15 | NeedsAttention | Minor tweaks: urgent badge, "View all" link, row styling |
| 16 | Gantt time axis | Derive from `or_rooms.available_hours` (7am + hours) |
| 17 | Gantt milestones | `patient_in` → `patient_out` for actual bars |
| 18 | Late determination | Facility-configured FCOTS milestone + grace minutes |
| 19 | Gantt bar labels | Tooltip on hover only — no inline text |
| 20 | Empty states | Show component frame with "No cases scheduled today" message |
| 21 | Target progress bar | Current value as % of target. Green ≥80%, amber ≥50%, red <50% |
| 22 | Pulse effect | Pure CSS `@keyframes` animation |
| 23 | Phase 2 scope | Split into 2a (DB migration) + 2b (procedures page redesign) |
| 24 | Score data source | Same `facilityScoreStub.ts` via `useDashboardKPIs` |

## Codebase Scan Results

### Data Availability

| Feature | Hook/Source | Gap |
|---|---|---|
| KPI sparklines | `useDashboardKPIs` → `KPIResult.dailyData[].numericValue` | None — wire directly |
| Live Pulse | `useTodayStatus` → room status + case counts | None — data exists |
| Schedule Gantt | No hook exists | Need `useScheduleTimeline` — cases + milestones + durations |
| AI Insights | `insightsEngine.generateInsights()` exists | Need `useDashboardInsights` wrapping `calculateAnalyticsOverview` |
| Trend chart | `useTrendData` → 30-day data | None — restyle only |
| Facility Score | `facilityScoreStub.computeFacilityScore()` in `useDashboardKPIs` | Extract `ScoreRing` from orbit-score page |

### Key Patterns

- **All hooks use `useSupabaseQuery`** — facility-scoped, enabled-gated
- **No polling exists anywhere** — `useScheduleTimeline` will be the first
- **Recharts `^3.6.0` installed**, used only in TrendChart currently. Tremor used on analytics pages
- **Tailwind v4** with CSS-first config in `globals.css`. No `tailwind.config.ts`
- **No Tabs/Progress components** in `components/ui/` — will need custom implementations
- **Procedure milestones page** pattern: master-detail (280px left panel + flex-1 right panel) is the reference for the procedures redesign

---

## Phase 1: Database Migration — Procedure Duration Config

**Status:** Pending

**What:** Add `expected_duration_minutes` to `procedure_types` and create `surgeon_procedure_duration` table with RLS policies.

**Files touched:**
- `supabase/migrations/20260219000011_procedure_duration_config.sql` (new)

**Details:**
1. `ALTER TABLE procedure_types ADD COLUMN expected_duration_minutes integer;`
2. Create `surgeon_procedure_duration` table:
   - `id` uuid PK, `facility_id` FK → facilities, `surgeon_id` FK → users, `procedure_type_id` FK → procedure_types
   - `expected_duration_minutes` integer NOT NULL
   - `created_at`, `updated_at` timestamps
   - UNIQUE(facility_id, surgeon_id, procedure_type_id)
3. RLS policies following established pattern:
   - `get_my_facility_id()` for SELECT (all facility users)
   - `get_my_access_level() = 'facility_admin'` for INSERT/UPDATE/DELETE
   - `get_my_access_level() = 'global_admin'` for full access
4. Indexes on `(facility_id, surgeon_id)` and `(facility_id, procedure_type_id)`
5. Soft-delete trigger: `sync_soft_delete_columns()` — add `is_active`, `deleted_at`, `deleted_by` columns
6. Apply via `supabase db push`

**Commit:** `feat(db): phase 1 - add procedure duration config with surgeon override`

**Test gate:**
- Unit: Migration SQL is syntactically valid
- Integration: Column exists on `procedure_types`, table created with correct constraints
- Workflow: Verify via Supabase REST API that column/table are accessible and RLS works

**Complexity:** Small

---

## Phase 2: Procedures Settings Page Redesign (Master-Detail + Durations)

**Status:** Pending
**Depends on:** Phase 1

**What:** Replace the current `/settings/procedures` page (list + modal) with a master-detail view matching the procedure milestones pattern. Left panel: searchable procedure list. Right panel: all procedure settings including the new expected duration field and surgeon override management.

**Files touched:**
- `app/settings/procedures/page.tsx` — full rewrite to master-detail layout
- `components/settings/procedures/ProcedureDetailPanel.tsx` (new) — right panel with all fields
- `components/settings/procedures/SurgeonOverrideList.tsx` (new) — surgeon duration overrides section

**Details:**
1. **Left panel (280px fixed, matches milestones):**
   - Search input at top (same styling as procedure-milestones page)
   - Filter tabs: "All", "Has Duration", "Has Overrides"
   - Procedure rows: name, sub-text showing override count or "Default"
   - Purple dot indicator for procedures with surgeon overrides
   - Selected state: `bg-blue-50 border border-blue-200`
   - "Add Procedure" button at bottom

2. **Right panel (flex-1):**
   - Header bar: procedure name + status badge + archive button
   - Editable form with existing fields: name, body region, category, technique, implant category
   - **New section: "Expected Duration"** — integer input (minutes), nullable
   - **New section: "Surgeon Overrides"** — list of surgeon overrides with:
     - Each row: surgeon name + override duration + edit/delete buttons
     - "Add Override" button → surgeon dropdown + duration input
     - Count badge showing total overrides
   - Empty state when no procedure selected

3. **Data flow:**
   - Fetch procedures via existing query pattern
   - Fetch surgeon overrides for selected procedure from `surgeon_procedure_duration`
   - Mutations: update `procedure_types.expected_duration_minutes`, upsert/delete `surgeon_procedure_duration` rows
   - Optimistic updates via `setData`

4. **Preserve existing functionality:**
   - Add/edit/archive procedures (from existing modal → inline form in right panel)
   - Search and filter
   - Dependency warnings before archiving

**Commit:** `feat(settings): phase 2 - redesign procedures page with master-detail + duration config`

**Test gate:**
- Unit: Left panel renders procedure list, right panel renders all fields, surgeon override CRUD works
- Integration: Selecting a procedure loads its details + overrides, saving persists to DB
- Workflow: Settings → Procedures → select procedure → edit duration → add surgeon override → verify saved → search/filter → archive procedure

**Complexity:** Large

---

## Phase 3: Live Pulse Banner + DashboardKpiCard + FacilityScoreMini

**Status:** Pending

**What:** Create the Live Pulse Banner, new DashboardKpiCard component with recharts sparklines and target bars, and FacilityScoreMini with extracted ScoreRing. Wire all three into the dashboard.

**Files touched:**
- `components/dashboard/LivePulseBanner.tsx` (new)
- `components/dashboard/DashboardKpiCard.tsx` (new)
- `components/dashboard/FacilityScoreMini.tsx` (new)
- `components/ui/ScoreRing.tsx` (new — extracted from orbit-score page)
- `app/dashboard/page.tsx` — replace MetricCard usage with DashboardKpiCard, add LivePulseBanner

**Details:**
1. **LivePulseBanner:**
   - Consumes `useTodayStatus()` (no polling)
   - Pulsing green dot via CSS `@keyframes` animation
   - Status pills: count rooms by status (`in_case`=In Surgery, `turning_over`=Turnover, etc.)
   - Case progress: sum completed/total across all rooms + next scheduled case info
   - Empty state: "No cases scheduled today" with muted icon
   - Styling: `bg-white rounded-xl shadow-sm border border-slate-200`

2. **DashboardKpiCard:**
   - Props: `title`, `value`, `trendPct`, `trendDir`, `subtitle`, `sparkData?`, `sparkColor?`, `target?: { pct, label }`
   - Layout: status dot + title (top-left), recharts AreaChart sparkline (72×28px, top-right), large value + trend (middle), target progress bar (bottom)
   - Sparkline: recharts `AreaChart` with `<linearGradient>` fill, `isAnimationActive={false}`
   - Target bar: thin 48px bar, fill color green/amber/red based on % of target
   - Status dot color: derived from target achievement (green ≥80%, amber ≥50%, red <50%)

3. **ScoreRing extraction:**
   - Move `ScoreRing` from `app/analytics/orbit-score/page.tsx` to `components/ui/ScoreRing.tsx`
   - Props: `score: number`, `size?: number`, `ringWidth?: number`
   - Update orbit-score page to import from new location

4. **FacilityScoreMini:**
   - Compact card matching KPI row height
   - ScoreRing at size=52, ringWidth=4
   - Grade letter badge + trend value
   - Consumes `useDashboardKPIs().facilityScore`

5. **Dashboard wiring:**
   - Replace 4 `MetricCard` instances with `DashboardKpiCard`
   - Replace `FacilityScoreCard` with `FacilityScoreMini`
   - Sparkline data from `kpi.dailyData.map(d => ({ v: d.numericValue }))`
   - Targets from `facility_analytics_settings` (utilization=75%, turnover=30min, FCOTS=80%)

**Commit:** `feat(dashboard): phase 3 - live pulse banner, KPI cards with sparklines, facility score mini`

**Test gate:**
- Unit: LivePulseBanner renders status pills, DashboardKpiCard renders sparkline + target bar, ScoreRing renders SVG ring
- Integration: Dashboard shows LivePulseBanner consuming real useTodayStatus data, KPI cards show sparklines from dailyData
- Workflow: Load dashboard → Live Pulse shows room counts → KPI cards show trends + targets → toggle time range → sparklines update

**Complexity:** Large

---

## Phase 4: Schedule Adherence Timeline (Gantt)

**Status:** Pending
**Depends on:** Phase 1 (for duration resolution chain)

**What:** Create the Schedule Adherence Gantt chart using recharts with custom bar shapes, and the `useScheduleTimeline` hook with 60-second polling.

**Files touched:**
- `lib/hooks/useScheduleTimeline.ts` (new)
- `components/dashboard/ScheduleAdherenceTimeline.tsx` (new)
- `app/dashboard/page.tsx` — insert below KPI row

**Details:**
1. **`useScheduleTimeline()` hook:**
   - Fetches today's cases with: `start_time`, `scheduled_duration_minutes`, `or_room_id`, `surgeon_id`, `procedure_type_id`, `case_milestones`, `status_id`
   - Fetches `procedure_types.expected_duration_minutes` for duration fallback
   - Fetches `surgeon_procedure_duration` for surgeon-specific overrides
   - Fetches `or_rooms` (name, display_order, `available_hours`) for room list + time axis
   - Fetches `facility_analytics_settings` for `fcots_milestone` + `fcots_grace_minutes`
   - **Duration resolution:** `cases.scheduled_duration_minutes` → surgeon override → procedure base → null (no bar)
   - **Actual times:** `patient_in.recorded_at` → `patient_out.recorded_at` via `getMilestoneMap()`
   - **Late determination:** configured `fcots_milestone` recorded_at > `cases.start_time + fcots_grace_minutes`
   - **Time axis:** 7am + max(`or_rooms.available_hours`) across all rooms
   - Groups by room (sorted by `display_order`), cases sorted by `start_time`
   - Per-case output: `{ scheduledStart, scheduledEnd, actualStart?, actualEnd?, status, procedureName, surgeonName }`
   - Summary stats: on-time count, late count, avg drift minutes, upcoming count
   - **Polling:** `setInterval` + `refetch()` every 60 seconds

2. **`ScheduleAdherenceTimeline` component (recharts-based):**
   - Horizontal `BarChart` layout with rooms on Y-axis, time (hours) on X-axis
   - Custom `<Bar shape>` components for:
     - Scheduled (ghost): gray/slate-200, 50% opacity
     - Actual on-time: emerald/green, 75% opacity, overlays ghost
     - Actual late: rose/red, 75% opacity, overlays ghost
     - Upcoming: dashed outline (custom shape with strokeDasharray)
   - `ReferenceLine` at current time (blue, vertical)
   - Custom `Tooltip` showing: procedure name, surgeon, scheduled vs actual times, status
   - Header: title + subtitle + legend badges
   - Summary badges row: "X on time" (green) · "Y late · avg drift Z min" (rose) · "W upcoming" (slate)
   - Empty state: "No cases scheduled today"

3. **Dashboard placement:** Full-width below KPI row, above Alerts+Insights

**Commit:** `feat(dashboard): phase 4 - schedule adherence timeline with 60s polling`

**Test gate:**
- Unit: `useScheduleTimeline` correctly resolves durations via fallback chain, computes late status using FCOTS config, groups by room
- Integration: Timeline renders correct room lanes, bars at correct positions, ReferenceLine at current time
- Workflow: Dashboard → Gantt shows rooms with scheduled/actual bars → tooltip on hover → wait 60s → data refreshes

**Complexity:** Large

---

## Phase 5: AI Insights Section

**Status:** Pending

**What:** Create the "What should we fix?" insights section with expandable informational cards, lazy-loaded on scroll.

**Files touched:**
- `lib/hooks/useDashboardInsights.ts` (new)
- `components/dashboard/InsightsSection.tsx` (new)
- `components/dashboard/InsightCard.tsx` (new)
- `app/dashboard/page.tsx` — add InsightsSection to layout

**Details:**
1. **`useDashboardInsights(enabled: boolean)` hook:**
   - Only fetches when `enabled` is true (triggered by IntersectionObserver)
   - Fetches cases for selected time range (same query pattern as analytics)
   - Calls `calculateAnalyticsOverview()` → `generateInsights()`
   - Returns `{ insights: Insight[], loading, error }`
   - Caches results — don't re-compute on scroll in/out

2. **`InsightsSection` component:**
   - Header: sparkle icon + "What should we fix?" + subtitle
   - Badge: "N insights" count in purple
   - Renders `InsightCard` components (one expanded at a time)
   - Skeleton loading state
   - Lazy-load trigger: `useRef` + `IntersectionObserver` on container

3. **`InsightCard` component (informational only):**
   - Collapsed: priority rank badge (numbered, rose/amber), title, category tag (colored pill), one-line summary, expand chevron
   - Expanded: full `summary` text from insight engine + `financialImpact` as formatted text (no callout boxes, no action items)
   - Category → pillar mapping: `first_case_delays` → "Schedule Adherence" (amber), `turnover` → "Turnover Efficiency" (rose), etc.
   - Hover: `bg-slate-50` subtle highlight
   - Click: toggle expand/collapse

4. **Dashboard wiring:**
   - 50/50 grid: NeedsAttention (left) + InsightsSection (right)
   - IntersectionObserver triggers `useDashboardInsights(enabled=true)` when section enters viewport

**Commit:** `feat(dashboard): phase 5 - AI insights section with lazy loading`

**Test gate:**
- Unit: InsightCard renders collapsed/expanded, category maps to correct pillar tag
- Integration: `useDashboardInsights` calls insightsEngine, returns typed Insight[]
- Workflow: Load dashboard → scroll to insights → loading skeleton → insights populate → click to expand

**Complexity:** Medium

---

## Phase 6: Layout Restructure + NeedsAttention Tweaks + TrendChart Conversion

**Status:** Pending

**What:** Restructure the dashboard grid layout, add minor tweaks to NeedsAttention, convert TrendChart from LineChart to AreaChart.

**Files touched:**
- `app/dashboard/page.tsx` — full layout restructure
- `components/dashboard/NeedsAttention.tsx` — add urgent badge + "View all"
- `components/dashboard/TrendChart.tsx` — LineChart → AreaChart + segmented toggle

**Details:**
1. **Layout restructure in `page.tsx`:**
   - New order: Live Pulse → KPI Row (5 cards) → Gantt → Alerts+Insights (50/50) → Rooms+Surgeons (50/50) → Trend Chart → Quick Access
   - Time range toggle: affects KPIs + Trend only
   - Room Status + Surgeons: keep existing components, just change grid to `grid-cols-2`
   - All live/today sections (Pulse, Gantt, Rooms, Surgeons, Alerts) ignore time range

2. **NeedsAttention tweaks:**
   - Add urgent count badge in header: red pill showing count of `severity === 'high'` alerts
   - Add "View all" link at top-right (links to `/cases`)
   - Adjust row styling: lighter bg, time stamp aligned right

3. **TrendChart conversion (in-place):**
   - Replace `LineChart` + `Line` with `AreaChart` + `Area`
   - Add `<defs><linearGradient>` for gradient fill (12% → 0% opacity)
   - Replace dropdown metric selector with inline segmented button toggle
   - Toggle styling: `border border-slate-200 rounded-md`, active = `bg-slate-800 text-white`
   - Keep existing `useTrendData` hook — no data changes
   - Keep all 4 metrics: utilization, turnover, caseVolume, facilityScore

**Commit:** `feat(dashboard): phase 6 - layout restructure, needs attention tweaks, trend chart restyle`

**Test gate:**
- Unit: TrendChart renders AreaChart (not LineChart), NeedsAttention shows urgent badge
- Integration: Full dashboard renders all sections in correct order with correct grid
- Workflow: Load dashboard → verify section order → toggle time range → KPIs + Trend update, Gantt/Pulse/Rooms stay at "today"

**Complexity:** Medium

---

## Phase 7: QuickAccess Restyle + Polish + Integration Testing

**Status:** Pending

**What:** Minimal QuickAccessCards restyle, final polish across all components, comprehensive integration testing.

**Files touched:**
- `components/dashboard/QuickAccessCards.tsx` — hover effects + icon colors
- Various component files — polish and bug fixes
- Test files for all new components

**Details:**
1. **QuickAccessCards minimal restyle:**
   - Update hover: `hover:shadow-md hover:border-slate-200 transition-all duration-200` (already close)
   - Add subtle `hover:-translate-y-0.5` lift effect
   - Keep all 5 existing navigation links unchanged

2. **Polish pass:**
   - Verify all loading/skeleton states render correctly
   - Verify all empty states render correctly (no cases, no alerts, no insights)
   - Verify all error states don't break layout (failed queries degrade gracefully)
   - Ensure `npx tsc --noEmit` passes
   - Run full existing test suite — no regressions

3. **New component test coverage:**
   - `LivePulseBanner.test.tsx` — renders status pills, handles empty data
   - `DashboardKpiCard.test.tsx` — renders sparkline, target bar, handles missing optional props
   - `ScheduleAdherenceTimeline.test.tsx` — renders room lanes, bar positioning
   - `InsightsSection.test.tsx` — lazy loading, expand/collapse
   - `FacilityScoreMini.test.tsx` — renders ScoreRing, grade badge

**Commit:** `feat(dashboard): phase 7 - quick access restyle, polish, integration tests`

**Test gate:**
- Unit: All new component tests pass
- Integration: Full dashboard end-to-end render with mock data
- Workflow: Full walkthrough: load dashboard → Live Pulse → KPIs with sparklines → scroll to Gantt → scroll to Insights (lazy loads) → Rooms + Surgeons → Trend chart toggle → Quick Access links work

**Complexity:** Medium

---

## Phase Summary

| Phase | Description | Complexity | Key New Files |
|---|---|---|---|
| 1 | DB migration — procedure duration config | Small | 1 migration file |
| 2 | Procedures page redesign (master-detail + durations) | Large | ~3 new components |
| 3 | Live Pulse + DashboardKpiCard + FacilityScoreMini | Large | ~4 new components |
| 4 | Schedule Adherence Timeline (Gantt) | Large | 1 hook + 1 component |
| 5 | AI Insights section | Medium | 1 hook + 2 components |
| 6 | Layout restructure + NeedsAttention + TrendChart | Medium | Modified existing files |
| 7 | QuickAccess restyle + polish + tests | Medium | Test files |

**Total estimated phases:** 7
**High-risk phases:** 2 (procedures redesign), 4 (Gantt with recharts custom bars)
