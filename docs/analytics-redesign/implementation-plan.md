# ORbit Analytics Dashboard Redesign — Claude Code Implementation Plan

## Overview

Redesign the `/analytics/kpi` page to use information hierarchy (glance → scan → dive), replace Tremor block trackers with sparklines, add an AI Insights engine, and reorganize metrics by decision rather than data type.

**Key constraint**: Zero new database queries. Everything derives from the existing `calculateAnalyticsOverview()` output.

## Progress

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Extend analyticsV2.ts — Sparkline Data + Utilities | DONE | `46c8acf` |
| 2 | insightsEngine.ts (already exists, TS fix applied) | DONE (bundled with Phase 1) | `46c8acf` |
| 3 | Build Sparkline Component | NEXT | — |
| 4 | Redesign KPI Page Layout | Pending | — |
| 5 | Responsive + Polish | Pending | — |

### Phase 1 Notes
- All 7 dailyData builders now include `numericValue`
- Added `FCOTSDetail` + `firstCaseDetails` to FCOTS return (for Phase 5 drill-through)
- Added `CaseVolumeResult` with `weeklyVolume` (previously computed but discarded)
- Added `dailyData` to `calculateNonOperativeTime` (was missing)
- Added `getKPIStatus()` utility for 3-tier status
- Fixed TS narrowing bug in `insightsEngine.ts` `findWorstDayOfWeek`
- 20 new unit tests in `lib/__tests__/analyticsV2-phase1.test.ts`
- insightsEngine.ts was already in `lib/` — confirmed fully compatible, no changes needed beyond the TS fix

### Phase 2 Notes
- `lib/insightsEngine.ts` was already placed by the user before Phase 1 started
- Verified all type imports match `analyticsV2.ts` (zero mismatches)
- The only change needed was the TS narrowing fix (done in Phase 1 commit)
- Integration into the page component (the `useMemo` wiring) will happen in Phase 4 when the page is redesigned

---

## Phase 1: Extend `analyticsV2.ts` — Sparkline Data + Utilities ✅

### Goal
Add numeric daily values to every KPI so sparklines can render actual trend lines instead of color blocks.

### Changes to `lib/analyticsV2.ts`

**1. Add `numericValue` to `DailyTrackerData` interface (line ~58):**

```ts
export interface DailyTrackerData {
  date: string
  color: Color
  tooltip: string
  numericValue: number  // ← ADD: raw value for sparkline rendering
}
```

**2. Populate `numericValue` in every function that builds `dailyData`:**

Each calculation function already computes the numeric value before assigning a color. Add it to the return object:

- `calculateFCOTS` (line ~892): Add `numericValue: dayRate`
- `calculateTurnoverTime` (line ~1006): Add `numericValue: dayMedian`
- `calculateORUtilization` (line ~1163): Add `numericValue: dayAvg`
- `calculateCancellationRate` (line ~1277): Add `numericValue: data.sameDay`
- `calculateCumulativeTardiness` (line ~1330): Add `numericValue: minutes`
- `calculateSurgicalTurnovers` sameRoomDailyData (line ~741): Add `numericValue: dayMedian`
- `calculateSurgicalTurnovers` flipRoomDailyData (line ~753): Add `numericValue: dayMedian`

**3. Return `weeklyVolume` from `calculateCaseVolume` (line ~1199):**

The weekly volume Map is already calculated on lines 1216-1223 but discarded. Add to return:

```ts
// Add to KPIResult or create CaseVolumeResult extending KPIResult
export interface CaseVolumeResult extends KPIResult {
  weeklyVolume: Array<{ week: string; count: number }>
}
```

Update the return to include `weeklyVolume: Array.from(weeklyVolume.entries()).sort(...).map(...)`.

**4. Add `dailyData` to `calculateNonOperativeTime` (line ~1355):**

Follow the same pattern as other functions — group by `c.scheduled_date`, compute daily average, assign color thresholds.

**5. Add utility function for 3-tier status:**

```ts
export function getKPIStatus(
  value: number,
  target: number,
  inverse: boolean = false
): 'good' | 'warn' | 'bad' {
  const ratio = inverse ? target / Math.max(value, 0.01) : value / Math.max(target, 0.01)
  if (ratio >= 1) return 'good'
  if (ratio >= 0.7) return 'warn'
  return 'bad'
}
```

**6. Update `AnalyticsOverview` interface (line ~151):**

Change `caseVolume: KPIResult` → `caseVolume: CaseVolumeResult`

### Testing (Phase 1)

```
- Unit: Verify numericValue is populated for all KPIs with test data
- Unit: Verify getKPIStatus returns correct tier for edge cases (0, equal-to-target, above-target)
- Unit: Verify weeklyVolume array is sorted chronologically
- Integration: calculateAnalyticsOverview returns all new fields without breaking existing consumers
- Workflow: Existing KPI page still renders correctly (backward compatible)
```

### Commit point: `feat: add sparkline numeric data and status utilities to analyticsV2`

---

## Phase 2: Create `insightsEngine.ts` ✅ (bundled with Phase 1)

### Goal
Add the insight synthesis engine as a new file with zero coupling to UI components.

### File: `lib/insightsEngine.ts`

Copy the `insightsEngine.ts` file provided (attached to this plan). This file:

- Exports `generateInsights(analytics: AnalyticsOverview, config?: InsightsConfig): Insight[]`
- Contains 7 analyzer functions that each examine one domain
- Returns prioritized, severity-ranked insights with financial projections
- Uses only the `AnalyticsOverview` type from analyticsV2 — no DB access

### Integration point in `kpi.js` (page component):

```ts
import { generateInsights, type Insight } from '@/lib/insightsEngine'

// Inside the component, after analytics useMemo:
const insights = useMemo(() => {
  return generateInsights(analytics, {
    revenuePerORMinute: 36,  // Could come from facility_analytics_settings
    revenuePerCase: 5800,
  })
}, [analytics])
```

### Testing (Phase 2)

```
- Unit: generateInsights returns empty array for empty analytics
- Unit: FCOTS at 90% (above target) generates 'positive' severity, not 'warning'
- Unit: Zero cancellations generates streak insight with correct day count
- Unit: Financial projections use config values, not hardcoded
- Unit: Insights are sorted critical → warning → positive → info
- Unit: maxInsights config caps output length
- Integration: insights array is stable across re-renders (useMemo works correctly)
```

### Commit point: `feat: add AI insights synthesis engine`

---

## Phase 3: Build Sparkline Component ← NEXT

### Goal
Create a reusable SVG sparkline component to replace Tremor Tracker blocks.

### File: `components/ui/Sparkline.tsx`

```tsx
interface SparklineProps {
  data: number[]
  color?: string        // Defaults based on status
  width?: number        // Default 120
  height?: number       // Default 32
  showArea?: boolean    // Default true
  strokeWidth?: number  // Default 1.5
  className?: string
}
```

Key implementation notes:
- Pure SVG, no external dependencies
- Handles edge cases: single data point, all-zero, empty array
- Endpoint dot with white fill + colored stroke for visibility on both light/dark backgrounds
- Area fill at 7% opacity for subtle depth
- Responsive: accepts className for Tailwind width overrides

Also create a helper to extract sparkline data from existing `DailyTrackerData[]`:

```ts
// In the component or as a utility
export function dailyDataToSparkline(dailyData?: DailyTrackerData[]): number[] {
  if (!dailyData) return []
  return dailyData.map(d => d.numericValue)
}
```

### Testing (Phase 3)

```
- Unit: Renders without error with empty data array
- Unit: Renders single data point without NaN in path
- Unit: SVG dimensions match width/height props
- Visual: Compare sparkline output against Tremor Tracker for same data set
```

### Commit point: `feat: add Sparkline SVG component`

---

## Phase 4: Redesign KPI Page Layout

### Goal
Replace the current equal-weight card grid with the 4-layer information hierarchy.

### File: `app/analytics/kpi/page.tsx` (or wherever `AnalyticsOverviewPage` lives)

### Layer 1: Health Overview (ORbit Score + Action Items)

**ORbit Score**: If the scoring engine is available, import and display the radar chart. If not yet integrated, create a placeholder card with a "Coming Soon" state that shows the 4 KPI status dots as a simplified health check instead.

**Action Items**: Derive from analytics data:
```ts
const actionItems = useMemo(() => {
  const items = []
  if (!analytics.fcots.targetMet) items.push({ text: `First case on-time at ${analytics.fcots.displayValue}`, status: 'bad' })
  if (!analytics.orUtilization.targetMet) items.push({ text: `OR utilization at ${analytics.orUtilization.displayValue}`, status: 'bad' })
  const callSoonerCount = analytics.surgeonIdleSummaries.filter(s => s.status === 'call_sooner').length
  if (callSoonerCount > 0) items.push({ text: `${callSoonerCount} surgeons need earlier callbacks`, status: 'warn' })
  if (analytics.cancellationRate.sameDayCount === 0) items.push({ text: 'Zero same-day cancellations', status: 'good' })
  return items
}, [analytics])
```

### Layer 2: KPI Strip (4 cards, horizontal)

Replace current `KPICard` usage with a denser card that includes:
- Status dot (3-tier from `getKPIStatus`)
- Sparkline (from `dailyDataToSparkline(kpi.dailyData)`)
- Target gauge (mini progress bar)
- Detail text in footer

Remove the Tremor `<Tracker>` component entirely.

### Layer 3: Two-Column Operational Layout

**Left column — "Where are we losing time?"**
- Turnover metrics as compact horizontal rows (not full cards)
- Each row: status dot | label + detail | sparkline | value + trend

**Right column — "What should we fix?"**
- Callback optimization as a card with:
  - Summary strip (3 values: overall, flip, same-room)
  - Table of surgeon rows (reuse existing SurgeonIdleTimeCard data)

### Layer 4: AI Insights

Render `insights` array from Phase 2 as severity-coded cards:
- Left color border (3px) by severity
- Severity label badge
- Body text
- Action link + financial impact badge

### What to Remove

- Tremor `Tracker` component import
- Tremor `BarChart` and `DonutChart` (move to a separate "Visual Analytics" sub-page or keep below the fold)
- `SurgeonIdleTimeCard` component (replaced by inline table)
- Row 4 "Time Breakdown" (6 mini cards) — move to time breakdown detail page
- Row 5 "Visual Analytics" (bar + donut charts) — move to detail page
- OR Utilization Modal — keep but trigger from the utilization KPI card click

### Testing (Phase 4)

```
- Unit: actionItems generates correct items for various analytics states
- Integration: Page renders without error for all date filter selections
- Integration: Empty state (0 cases) renders gracefully
- Workflow: Date filter changes trigger data refresh and re-render all layers
- Workflow: OR Utilization modal still opens from KPI card click
- Visual: All 4 layers visible above the fold on 1440px screen
- Visual: Responsive behavior on tablet (1024px) — two-column collapses to single
- Accessibility: All interactive elements have focus states and aria labels
```

### Commit point: `feat: redesign analytics page with information hierarchy`

---

## Phase 5: Responsive + Polish

### Goal
Handle mobile/tablet breakpoints and add micro-interactions.

### Changes

1. **Responsive breakpoints** (Tailwind classes):
   - `lg` (1024+): Full 4-column KPI strip, 2-column operational layout
   - `md` (768-1023): 2-column KPI strip, stacked operational layout
   - `sm` (<768): Single column everything, compact cards

2. **Staggered load animation**: Each layer fades in with 80ms delay (CSS `animation-delay` or React state)

3. **Hover states**: Subtle border color shift + shadow on all cards

4. **Sparkline tooltips**: Show value on hover (optional, lower priority)

5. **Financial impact formatting**: Ensure `formatCompactNumber` handles edge cases

### Testing (Phase 5)

```
- Visual: Test at 1440px, 1024px, 768px, 375px breakpoints
- Visual: Stagger animation plays correctly on initial load
- Visual: Hover states on all interactive cards
- Accessibility: Tab navigation through all clickable elements
- Performance: No layout shift during load animation
```

### Commit point: `feat: responsive layout and polish for analytics redesign`

---

## File Summary

| File | Action | Phase |
|---|---|---|
| `lib/analyticsV2.ts` | Modify — add numericValue, weeklyVolume, non-op dailyData, getKPIStatus | 1 |
| `lib/insightsEngine.ts` | **Create** — insight synthesis engine | 2 |
| `components/ui/Sparkline.tsx` | **Create** — SVG sparkline component | 3 |
| `app/analytics/kpi/page.tsx` | Modify — full layout redesign | 4 |
| `components/ui/KPICard.tsx` | Modify or replace — denser layout with sparkline | 4 |
| `components/ui/SurgeonIdleTimeCard.tsx` | Remove — replaced by inline table | 4 |

## Dependencies

- No new npm packages required
- Tremor `Tracker` import can be removed after Phase 4
- Tremor `BarChart`, `DonutChart`, `Legend` can be removed if charts move to sub-page
- All existing Supabase queries remain unchanged

## Risk Notes

- `insightsEngine.ts` parses subtitle strings (e.g., `"11 late of 16 first cases"`) via regex. If subtitle format changes in analyticsV2, the regex will silently fail and that insight won't generate. Consider adding the raw values to the KPIResult interface in a future pass so insights don't depend on string parsing.
- Financial projections are estimates based on configurable defaults. Add a disclaimer tooltip: "Estimates based on $36/OR minute. Configure in Settings."
- The ORbit Score radar chart requires the scoring engine. If not yet available, Phase 4 should use the simplified health check placeholder instead of blocking the entire redesign.
