# ORbit Analytics Dashboard Redesign — Master Brief

## What This Is

A complete redesign of the `/analytics/kpi` page. We're replacing the current flat grid of identical KPI cards with a 4-layer information hierarchy (glance → scan → dive), adding an AI insights engine that synthesizes analytics into actionable recommendations with financial projections, and adding drill-through panels with XLSX export for every insight.

## Files You Need

All files referenced below are in the project root under `/docs/analytics-redesign/`. Read ALL of them before writing any code.

### Reference Files (read but don't copy verbatim):
- `orbit-dashboard-light.jsx` — Interactive React prototype showing the final design. This is the DESIGN REFERENCE for layout, spacing, typography, color, and component structure. It uses inline styles for prototyping — convert to Tailwind in the real implementation.
- `insight-drillthrough.jsx` — Interactive prototype of the slide-over drill-through panels. Shows how insight cards open into detail views with case-level data and export buttons.

### Implementation Files (integrate into the codebase):
- `insightsEngine.ts` — Drop into `lib/insightsEngine.ts`. This is production-ready TypeScript. It imports from `@/lib/analyticsV2` and exports `generateInsights()`.
- `IMPLEMENTATION_PLAN.md` — Phased implementation plan with exact line numbers, interface changes, and test checklists per phase.
- `DRILL_THROUGH_PLAN.md` — Data availability analysis per insight type. Shows which drill-throughs need analyticsV2 changes and which don't.

## Current State

The existing page is at `app/analytics/kpi/page.tsx` (or wherever AnalyticsOverviewPage is defined). It uses:
- `lib/analyticsV2.ts` — All calculations. `calculateAnalyticsOverview()` is the main entry point.
- Tremor components (`Tracker`, `BarChart`, `DonutChart`, `Legend`) for visualization.
- A `KPICard` component that renders identically for every metric.
- A `SurgeonIdleTimeCard` component for callback optimization.
- An `ORUtilizationModal` for per-room breakdown.

## What Changes

### Phase 1: Extend analyticsV2.ts

Add `numericValue: number` to the `DailyTrackerData` interface. Every function that builds `dailyData` already computes this value before assigning a color — just add it to the return object. See IMPLEMENTATION_PLAN.md Phase 1 for exact locations.

Also:
- Return `weeklyVolume` from `calculateCaseVolume` (it's computed on lines ~1216-1223 but discarded)
- Add `dailyData` to `calculateNonOperativeTime` (follow the same pattern as other functions)
- Add `getKPIStatus(value, target, inverse?) → 'good' | 'warn' | 'bad'` utility
- Add `firstCaseDetails: FCOTSDetail[]` to `calculateFCOTS` return (see DRILL_THROUGH_PLAN.md)

Do NOT change any existing return values or break backward compatibility.

### Phase 2: Add insightsEngine.ts

Copy `insightsEngine.ts` into `lib/`. No modifications needed — it's ready to use.

Wire it into the page component:
```ts
import { generateInsights } from '@/lib/insightsEngine'

const insights = useMemo(() => {
  return generateInsights(analytics)
}, [analytics])
```

### Phase 3: Create Sparkline Component

Create `components/ui/Sparkline.tsx`:
- Pure SVG, no dependencies
- Props: `data: number[]`, `color`, `width`, `height`, `showArea`, `strokeWidth`, `className`
- Handle edge cases: empty array, single point, all-zero
- Use `orbit-dashboard-light.jsx` Sparkline component as reference, convert to Tailwind + TypeScript

Also create a helper:
```ts
export function dailyDataToSparkline(dailyData?: DailyTrackerData[]): number[] {
  if (!dailyData) return []
  return dailyData.map(d => d.numericValue)
}
```

### Phase 4: Redesign the KPI Page Layout

This is the big one. Redesign the page to match `orbit-dashboard-light.jsx`. The page has 4 layers:

**Layer 1 — Health Overview** (top of page):
- Left: ORbit Score radar chart. If the scoring engine isn't integrated yet, use a simplified health check showing the 4 KPI status dots with labels instead. Do NOT block the redesign on this.
- Right: Action Items card derived from analytics data:
  - If `!analytics.fcots.targetMet` → "First case on-time at {value}"
  - If `!analytics.orUtilization.targetMet` → "OR utilization at {value}"  
  - Count `call_sooner` surgeons from `analytics.surgeonIdleSummaries`
  - If `analytics.cancellationRate.sameDayCount === 0` → positive streak item

**Layer 2 — KPI Strip** (4 cards, horizontal):
Replace the current 4 identical `KPICard` instances with denser cards that include:
- Status dot (3-tier from `getKPIStatus`)
- Label + large value + trend badge
- Sparkline (from `dailyDataToSparkline(kpi.dailyData)`)
- Footer with detail text + mini target gauge

Section heading: "How are we tracking?" / "Core KPIs vs targets"

**Layer 3 — Two-Column Operational Layout**:
Left column — "Where are we losing time?":
- 4 turnover metrics as compact HORIZONTAL ROWS (not cards)
- Each row: status dot | label + detail | sparkline | value with unit | trend badge
- Use `analytics.turnoverTime`, `analytics.standardSurgicalTurnover`, `analytics.flipRoomTime`, `analytics.nonOperativeTime`

Right column — "What should we fix?":
- Summary strip: 3 values (overall median, flip idle, same-room idle)
- Surgeon table with columns: Surgeon, Flip, Same, Cases, Status
- Data from `analytics.surgeonIdleSummaries`
- Status badges: on_track (green), call_sooner (amber), call_later (blue), turnover_only (gray)

**Layer 4 — AI Insights**:
Render the `insights` array from `generateInsights()`:
- Cards with left color border by severity (critical=red, warning=amber, positive=green, info=indigo)
- Severity label badge + title
- Body text (2-3 sentences)
- Action link (clickable, opens drill-through panel) + financial impact badge
- Export button on each card
- Section heading: "AI Insights" / "Prioritized opportunities ranked by financial impact"

**What to REMOVE from the current page:**
- Tremor `Tracker` component and its import
- The current identical-card layout for KPIs and turnovers
- `SurgeonIdleTimeCard` component (replaced by inline table)
- Row 4 "Time Breakdown" (6 mini cards) — move to a detail page or keep below the fold
- Row 5 "Visual Analytics" (bar + donut) — move to detail page or keep below the fold
- Keep the `ORUtilizationModal` — it still opens from the OR Utilization KPI card click

### Phase 5: Drill-Through Panels + Export

Build a reusable `InsightPanel` slide-over component:
- Slides in from right (640px wide) with backdrop blur
- Header: severity badge, title, "Export XLSX" button, close button
- Content area: scrollable, renders different detail views based on insight type

**Callback panel** (ready now — no analyticsV2 changes):
- Surgeon comparison cards with sparklines and status badges
- Click surgeon to expand case-by-case flip transitions
- Shows: date, from case/room, to case/room, idle minutes, saveable minutes
- Recommendation box with specific per-surgeon actions
- Financial summary with the math shown
- Data source: `analytics.flipRoomAnalysis` + `analytics.surgeonIdleSummaries`

**FCOTS panel** (needs Phase 1 `firstCaseDetails`):
- Summary strip: on-time rate, late count, total first cases, avg delay
- Per-case table: date, room, surgeon, scheduled time, actual time, delay, status
- Pattern detection box (identify repeat offender surgeons/rooms)

**Utilization panel** (needs Phase 1 daily per-room data):
- Summary: rooms above/near/below target
- Per-room cards with progress bars, case counts, active days

**Export**: Each panel's "Export XLSX" button generates a workbook with:
- Summary sheet (headline metrics)
- Detail sheet (case-level data)
- Use the xlsx creation patterns already established in the project

### Phase 6: Responsive + Polish

- `lg` (1024+): Full layout as designed
- `md` (768-1023): 2-column KPI strip, stacked operational layout
- `sm` (<768): Single column, compact cards
- Staggered load animation: each layer fades in with ~80ms delay
- Hover states on all cards (subtle border + shadow shift)

## Design Specifications

**Typography**: The project already uses its font stack — keep it. Use monospace for all numeric values (tabular alignment).

**Colors**: Use the existing project color system. Key semantic colors:
- Status good: green-500/green-50
- Status warn: amber-500/amber-50  
- Status bad: red-500/red-50
- Primary accent: indigo-600/indigo-50
- Text: slate-900/slate-600/slate-400

**Spacing**: 12-16px card padding, 8-12px gaps between cards, 24-28px between sections.

**Card style**: White background, slate-200 border, 12px border-radius, subtle shadow on hover.

## Testing Checklist

Run these after each phase:

- [ ] Page renders without error for all date filter selections (Today, Yesterday, This Week, This Month, All Time)
- [ ] Empty state (0 cases) renders gracefully — no NaN, no broken layouts
- [ ] All sparklines render correctly (including single data point and all-zero)
- [ ] Insights generate appropriate severity and sort order
- [ ] Drill-through panels open/close with animation
- [ ] Export button generates valid XLSX
- [ ] OR Utilization modal still works from KPI card click
- [ ] No TypeScript errors
- [ ] No console warnings about missing keys or invalid props
- [ ] Responsive: test at 1440px, 1024px, 768px
- [ ] Existing analytics data is unchanged (backward compatible)

## Commit Strategy

One commit per phase:
1. `feat: add sparkline data and FCOTS detail to analyticsV2`
2. `feat: add AI insights synthesis engine`
3. `feat: add Sparkline component`
4. `feat: redesign analytics page with information hierarchy`
5. `feat: add insight drill-through panels with XLSX export`
6. `feat: responsive layout and polish`
