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

## Review Q&A

> Generated by /review on 2026-02-18

**Q1: Sparkline approach** — Existing SVG `Sparkline` component (`components/ui/Sparkline.tsx`) vs recharts `AreaChart` for KPI sparklines?
**A1:** Build recharts `AreaChart` sparklines for visual fidelity with gradient fill, matching the mockup and trend chart library.

**Q2: KPI card component** — Extend existing `MetricCard` (animated count-up, gradient text) or build new `DashboardKpiCard`?
**A2:** Build new `DashboardKpiCard` component. Existing MetricCard has a very different design (animated count-up, gradient text) — leave it untouched for analytics pages.

**Q3: Gantt rendering approach** — CSS absolute positioning, SVG, or recharts?
**A3:** Recharts custom chart — use horizontal BarChart with custom bar shapes for ghost/actual overlay and `ReferenceLine` for the now marker.

**Q4: Gantt data source** — New `useScheduleTimeline` hook vs extending `useTodayStatus` vs composing multiple hooks?
**A4:** New `useScheduleTimeline` hook. Purpose-built, fetches today's cases + joins surgeon overrides + procedure durations. Includes 60s polling. Cleanly separated from `useTodayStatus`.

**Q5: Polling scope** — Which components get 60-second polling?
**A5:** `useScheduleTimeline` only. Live Pulse Banner consumes `useTodayStatus` without polling (data updates on navigation/reload). Minimal blast radius.

**Q6: Duration data availability** — Is `cases.scheduled_duration_minutes` populated?
**A6:** Likely not populated (no UI exists for it). Need the full fallback chain: `scheduled_duration_minutes` → surgeon override → procedure base → no bar.

**Q7: Procedure Duration Settings UI** — Where and how?
**A7:** Full redesign of `/settings/procedures` page into a master-detail view (like the procedure milestones page). Left panel: procedure list with search. Right panel: ALL procedure settings (existing fields + expected duration + surgeon overrides). When a procedure is selected, shows all settings. Surgeon overrides section shows which surgeons have custom durations. List view indicates which procedures have overrides.

**Q8: Duration page location** — New route, tab, or modal integration?
**A8:** Replace the current `/settings/procedures` page entirely with the master-detail view. No separate route needed — same URL, new UX.

**Q9: AI Insights data loading** — Full `AnalyticsOverview` on mount, lazy-load, or simplified?
**A9:** Lazy-load on scroll via `IntersectionObserver`. Dashboard loads fast, insights populate when the user scrolls to the Insights section.

**Q10: Insight cards content** — Actionable (with recommendations + impact) or informational only?
**A10:** Informational only. No action items or impact callout boxes. Just show the insight information: priority rank, title, category/pillar tag, analysis text. Click to expand for full detail.

**Q11: Time range toggle behavior** — What does Today/Week/Month affect?
**A11:** Applies to KPI cards + Trend chart only. Live Pulse, Gantt, OR Status, Surgeons, and Alerts are always "today" (operational/live data).

**Q12: Facility ORbit Score card** — New FacilityScoreMini, adapt existing FacilityScoreCard, or plain KPI card?
**A12:** Use the `ScoreRing` SVG component from the surgeon orbit-score page, extracted to `components/ui/ScoreRing.tsx`. Compact 52px ring + grade letter + trend. Uses `computeFacilityScore()` from `facilityScoreStub.ts` (same as current).

**Q13: TrendChart conversion** — Convert in-place, build new, or extract SegmentedControl first?
**A13:** Convert in-place. Swap `LineChart` → `AreaChart` with gradient fill, replace dropdown with segmented button toggle. Data flow (`useTrendData`) stays the same.

**Q14: QuickAccessCards restyle** — Full mockup match, trim to 4 items, or minimal restyle?
**A14:** Minimal restyle only. Just update hover effects and icon colors. Don't restructure the cards.

**Q15: NeedsAttention updates** — Restyle to match mockup or keep as-is?
**A15:** Minor tweaks: add urgent count badge to header, add "View all" link, adjust row padding/bg. No structural changes.

**Q16: OR hours for Gantt timeline axis** — Hardcoded, derived from data, or configurable?
**A16:** Derive from `or_rooms.available_hours`. Use 7am as assumed start, add `available_hours` to get end. Timeline = earliest room start to latest room end.

**Q17: Gantt milestone range** — Which milestones define the actual case bars?
**A17:** `patient_in` → `patient_out`. Represents full patient-in-room time. Uses `getMilestoneMap()` from `analyticsV2.ts`.

**Q18: Gantt "late" determination** — What defines a late case?
**A18:** Use the facility-configured FCOTS milestone (`facility_analytics_settings.fcots_milestone` = `'patient_in'` or `'incision'`). Case is late if the configured milestone `recorded_at > cases.start_time + fcots_grace_minutes`. Consistent with FCOTS KPI calculation.

**Q19: Gantt bar labels** — Inline text, conditional, or tooltip only?
**A19:** Tooltip on hover only. Never render text inside bars. Tooltip shows procedure name, surgeon, scheduled time, actual time, status.

**Q20: KPI responsive layout** — How to handle narrower viewports?
**A20:** Keep `grid-cols-5` with min-width on cards. Sidebar is usually collapsed (64px) giving plenty of room.

**Q21: Empty states** — What to show when no cases today (Gantt, Live Pulse)?
**A21:** Show component frame with empty state message ("No cases scheduled today"). Consistent with NeedsAttention "All clear" pattern.

**Q22: Target progress bar** — What does the bar represent?
**A22:** Current value as percentage of target. Color: green if >= 80% of target, amber if >= 50%, red if < 50%. Label shows target value.

**Q23: Phase 2 scope** — Should the expanded procedures page redesign be split?
**A23:** Split into Phase 2a (DB migration) + Phase 2b (procedures page redesign to master-detail with duration + surgeon overrides).

**Q24: Pulse effect** — JS interval or CSS animation?
**A24:** Pure CSS animation (`@keyframes`). More performant, smoother, standard approach.

**Q25: Facility score data source** — Stub or real engine?
**A25:** Consume same `facilityScoreStub.ts` via `useDashboardKPIs`. No new data fetching needed.
