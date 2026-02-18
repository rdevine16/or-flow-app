# Feature: Dashboard Revamp

## Goal

Revamp the facility admin dashboard from a static KPI overview into a real-time operational command center. Add a live status banner, schedule adherence Gantt chart, AI-generated insights, KPI sparklines with target bars, and restructure the layout for better information hierarchy.

## Background

The current dashboard shows 5 KPI cards, an alerts list, room status, surgeon list, trend chart, and quick-access nav. It's informative but passive — the admin has to mentally connect dots between KPIs, alerts, and room status.

The new design (mockup: `docs/dashboard-improved.jsx`) transforms the dashboard into a "control tower" view:
1. **Live Pulse Banner** — instant situational awareness (how many rooms active, cases completed)
2. **Schedule Adherence Timeline** — the visual gut-punch that makes schedule drift undeniable
3. **AI Insights** — "What should we fix?" ranked by recoverable OR time
4. **KPI sparklines + target bars** — trend context without leaving the card
5. **Layout restructure** — better information grouping (alerts ↔ insights, rooms ↔ surgeons)

## Requirements

### 1. Database: Procedure Duration Config

Add expected duration per procedure type with surgeon override capability.

**New column on `procedure_types`:**
- `expected_duration_minutes` (integer, nullable) — base expected OR time for this procedure

**New table: `surgeon_procedure_duration`**
- `id` (uuid PK)
- `facility_id` (uuid FK → facilities)
- `surgeon_id` (uuid FK → users)
- `procedure_type_id` (uuid FK → procedure_types)
- `expected_duration_minutes` (integer NOT NULL)
- UNIQUE(facility_id, surgeon_id, procedure_type_id)
- RLS: facility admins only (+ global admin view)

**Duration resolution order for Gantt:**
1. `cases.scheduled_duration_minutes` (if set by scheduler)
2. `surgeon_procedure_duration.expected_duration_minutes` (surgeon-specific override)
3. `procedure_types.expected_duration_minutes` (procedure base)
4. No bar shown (case has no estimable duration)

### 2. Procedure Duration Settings UI

Add duration configuration to the existing Procedures settings page (`app/settings/procedures/`):
- Add "Expected Duration" column/field to the procedure list/detail
- Add surgeon override capability (button or inline per procedure → shows surgeon list with override durations)

### 3. Live Pulse Banner

Full-width banner below the header showing:
- Pulsing green "Live" indicator
- Status chips: `X In Surgery · Y Turnover · Z Pre-Op · W Available`
- Case progress: `N / M cases completed · Next: OR X @ HH:MM`
- Data source: existing `useTodayStatus()` hook — no new queries needed

### 4. KPI Card Enhancement

Modify existing `MetricCard` component to support:
- Optional sparkline mini-chart (recharts `AreaChart`, ~72×28px)
- Optional target progress bar with label (e.g., `71%` bar with `80%` target marker)
- Status dot color derived from target achievement
- Data source: `useDashboardKPIs().dailyData[].numericValue` for sparklines, existing target values from `facility_analytics_settings`

### 5. Schedule Adherence Timeline (Gantt)

Full-width horizontal Gantt chart below KPI row:
- Each OR room = one swim lane, time axis 7a–5p (configurable from OR hours)
- Per case: faded gray ghost bar (scheduled) + solid overlay (actual: green=on-time, rose=late)
- Upcoming cases: dashed outline
- Blue vertical "now" marker
- Summary badges: "X on time · Y late · avg drift Z min · W upcoming"
- 60-second polling for live updates
- New hook: `useScheduleTimeline()` — fetches today's cases with milestone data + procedure durations

### 6. AI Insights Section ("What should we fix?")

Side-by-side with Needs Attention (50/50 split):
- Ranked insight cards with priority badges and pillar tags
- Click to expand: full analysis, projected impact callout, recommended action
- Lazy-loaded on scroll (IntersectionObserver)
- New hook: `useDashboardInsights()` — wraps `calculateAnalyticsOverview()` → `generateInsights()`
- Data source: existing `insightsEngine.ts` (7 insight categories already implemented)

### 7. Layout Restructure

| Current | New |
|---|---|
| Needs Attention (3/5 cols) + Room Status & Surgeons (2/5) | Needs Attention (1/2) + AI Insights (1/2) |
| — | Room Status (1/2) + Today's Surgeons (1/2) |
| LineChart trend | AreaChart trend with gradient fill |
| 5-col quick access | 5-col quick access (restyled) |

### 8. Trend Chart Restyle

Convert existing `TrendChart` from recharts `LineChart` to `AreaChart` with gradient fill. Replace dropdown metric selector with inline button toggle. Match mockup styling.

## Database Context

### New Migration Required
- Add `expected_duration_minutes` column to `procedure_types`
- Create `surgeon_procedure_duration` table with RLS policies
- No changes to existing tables or triggers

### Existing Tables Used
- `cases` — `start_time`, `scheduled_duration_minutes`, `or_room_id`
- `case_milestones` — `recorded_at` for actual start/end times
- `facility_milestones` — milestone name lookups (`patient_in`, `patient_out`)
- `or_rooms` — room names, display order
- `procedure_types` — procedure names + new `expected_duration_minutes`
- `facility_analytics_settings` — KPI targets for target bars

## Files Likely Involved

### Database
- New migration: `supabase/migrations/YYYYMMDD_procedure_duration.sql`

### Settings
- `app/settings/procedures/page.tsx` — add duration field + surgeon override

### Dashboard Page
- `app/dashboard/page.tsx` — layout restructure, new component imports

### New Components
- `components/dashboard/LivePulseBanner.tsx`
- `components/dashboard/ScheduleAdherenceTimeline.tsx`
- `components/dashboard/InsightsSection.tsx`
- `components/dashboard/InsightCard.tsx`

### Modified Components
- `components/ui/MetricCard.tsx` — add sparkline + target bar props
- `components/dashboard/TrendChart.tsx` — LineChart → AreaChart
- `components/dashboard/QuickAccessCards.tsx` — visual restyle

### New Hooks
- `lib/hooks/useScheduleTimeline.ts`
- `lib/hooks/useDashboardInsights.ts`

### Existing Hooks (consumed, not modified)
- `lib/hooks/useDashboardKPIs.ts` — sparkline data from `dailyData`
- `lib/hooks/useTodayStatus.ts` — Live Pulse data
- `lib/hooks/useDashboardAlerts.ts` — Needs Attention (unchanged)

### Analytics (consumed)
- `lib/analyticsV2.ts` — `calculateAnalyticsOverview()`
- `lib/insightsEngine.ts` — `generateInsights()`

## iOS Parity
- [ ] iOS can wait — iOS doesn't have a dashboard yet

## Out of Scope
- Real-time WebSocket/Supabase Realtime subscriptions (using polling instead)
- Block schedule visualization (separate from case-level Gantt)
- Surgeon-level dashboard views
- Mobile-specific responsive breakpoints beyond basic sm/lg grid
- Drag-and-drop case reordering on the Gantt

## Acceptance Criteria
- [ ] Procedure types have configurable expected duration with surgeon override
- [ ] Live Pulse Banner shows real-time room status counts and case progress
- [ ] KPI cards show sparkline trends and target progress bars
- [ ] Schedule Adherence Timeline renders scheduled vs actual per room with 60s polling
- [ ] AI Insights section lazy-loads and shows ranked, expandable insight cards
- [ ] Layout uses 50/50 splits for Alerts+Insights and Rooms+Surgeons
- [ ] Trend chart uses AreaChart with gradient fill
- [ ] Quick access cards are visually restyled
- [ ] `npx tsc --noEmit` passes
- [ ] All existing tests pass
- [ ] New components have test coverage
