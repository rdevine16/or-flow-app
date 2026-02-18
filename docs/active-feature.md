# Feature: AI Insight Drill-Through Panels

## Goal
Make AI Insight cards on the KPI page clickable, opening slide-over detail panels with drill-through data. Each insight type gets its own panel with relevant supporting data, surgeon-level breakdowns, and actionable recommendations. Reference design: `docs/analytics-redesign/insight-drillthrough.jsx`.

## Requirements

### 1. Clickable Insight Cards
- Insight cards on the KPI page (`/analytics/kpi/`) should be clickable when they have drill-through data
- Cards with drill-through show `cursor-pointer` and a chevron indicator
- Cards without drill-through (e.g., positive/informational) remain non-clickable

### 2. Slide-Over Panel Component
- Right-side slide-over panel (640px wide) with backdrop blur
- Animated open/close (translateX transition)
- Header with severity badge, title, export button, close button
- Scrollable content area

### 3. Callback/Idle Time Panel
- Surgeon comparison cards with status badges (On Track, Call Sooner, Call Later)
- Per-surgeon metrics: flip idle time, callback delta, case count, same-room turnover
- Sparkline showing daily idle trend per surgeon
- Expandable gap-by-gap detail showing individual flip room transitions
- Recommendation box with specific timing advice
- Financial impact summary (using facility config: `or_hourly_rate`, `operating_days_per_year`)

### 4. FCOTS Panel
- Summary strip: on-time rate, late cases count, total first cases, avg delay
- Per-case detail table: date, room, surgeon, scheduled time, actual time, delay, status
- Pattern analysis box highlighting repeat offenders and worst days

### 5. OR Utilization Panel
- Room status summary: above target / near target / below 60%
- Per-room cards with utilization bar, case count, active days, hours breakdown
- Target line on utilization bars (from facility config)
- Flag rooms using default availability hours

### 6. Export Functionality
- Export button on each insight card (inline)
- Export button in panel header (XLSX format)
- Simulated export with visual feedback (checkmark confirmation)

## Reference Design
`docs/analytics-redesign/insight-drillthrough.jsx` — complete reference implementation with:
- Slide-over panel with backdrop
- Three drill-through panel types (callback, fcots, utilization)
- Surgeon-level expandable detail
- Financial impact calculations
- Export button UI

## Data Sources
- `analyticsV2.ts` — `AnalyticsOverview` already has most of the data:
  - `fcots.firstCaseDetails` — per-case FCOTS data
  - `orUtilization` — room-level utilization data
  - `surgeonIdleSummaries` — per-surgeon idle time data
  - `flipRoomAnalysis` — flip room gap detail
- `insightsEngine.ts` — `generateInsights()` output provides the insight cards
- `FacilityAnalyticsConfig` — targets for color thresholds and financial calculations

## UI/UX
- Route: `/analytics/kpi/` — insight cards become clickable, panel overlays the page
- No new routes needed — panels are overlays on the existing KPI page
- Panel closes on backdrop click, close button, or Escape key

## Files Likely Involved
- `app/analytics/kpi/page.tsx` — add click handlers to insight cards, render slide-over panel
- `components/analytics/InsightPanel.tsx` (new) — slide-over panel shell
- `components/analytics/InsightPanelCallback.tsx` (new) — callback/idle detail content
- `components/analytics/InsightPanelFCOTS.tsx` (new) — FCOTS detail content
- `components/analytics/InsightPanelUtilization.tsx` (new) — utilization detail content

## iOS Parity
- [ ] iOS equivalent needed
- [x] iOS can wait (iOS doesn't have KPI analytics yet)

## Known Issues / Constraints
- Some insight types may not have drill-through data (e.g., "zero cancellations" — positive insight with no detail to show)
- The `insightsEngine.ts` `Insight` type may need a `drillThroughType` field to map insights to panel types
- Gap-by-gap detail for callback panel requires `flipRoomAnalysis` data to be available on the analytics overview
- Financial calculations need `or_hourly_rate` from facility config (may be null)

## Out of Scope
- Actual XLSX export implementation (simulated with visual feedback for now)
- Cancellation drill-through panel (positive insight, low priority)
- Turnover compliance drill-through panel (future)
- Deep-linking to specific panels via URL params

## Acceptance Criteria
- [ ] Insight cards with drill-through data are clickable with visual affordance (cursor, chevron)
- [ ] Slide-over panel opens with smooth animation on card click
- [ ] Callback panel shows surgeon comparison with expandable gap detail
- [ ] FCOTS panel shows per-case detail table with pattern analysis
- [ ] Utilization panel shows per-room breakdown with target bars
- [ ] Panel closes on backdrop click, close button, or Escape
- [ ] Financial impact uses facility config values (not hard-coded)
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
