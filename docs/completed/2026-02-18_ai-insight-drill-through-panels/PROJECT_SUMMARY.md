# Project: AI Insight Drill-Through Panels
**Completed:** 2026-02-18
**Branch:** feature/milestone-hierarchy-redesign
**Duration:** 2026-02-17 → 2026-02-18
**Total Phases:** 7

## What Was Built
Made every AI Insight card on the KPI analytics page clickable, opening a 640px Radix Dialog slide-over panel from the right side with drill-through data specific to each insight category. Built dedicated panels for all 7 insight categories: Callback/Idle Time, First Case On-Time (FCOTS), OR Utilization, Turnover Efficiency, Cancellation Rate, Non-Operative Time, and Scheduling/Volume.

Replaced the existing inline `ORUtilizationModal` with the new consistent slide-over pattern across both the KPI and Flags pages. Each panel provides case-level or surgeon-level detail data, pattern detection, financial impact estimates, and actionable recommendations derived from the analytics engine output.

Added real XLSX export using SheetJS — every panel type has a dedicated multi-sheet export function producing professional reports with summary, detail, and pattern analysis sheets. Export buttons appear both in the slide-over header and inline on each insight card, with checkmark visual feedback after download.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Slide-over shell + click wiring | c049c70 |
| 2     | Callback/idle time drill-through panel | 74a5136 |
| 3     | FCOTS drill-through panel with pattern detection | 79185db |
| 4     | Utilization panel, replace ORUtilizationModal | c55cfa6 |
| 5     | Non-op time and scheduling drill-through panels | dfc67c1 |
| 6     | Turnover and cancellation detail data and panels | 141c2f3 |
| 7     | XLSX export for all insight panels | ee26d62 |

## Key Files Created/Modified
### New Components
- `components/analytics/InsightSlideOver.tsx` — Radix Dialog slide-over shell with export button
- `components/analytics/InsightPanelCallback.tsx` — Surgeon comparison cards, expandable gap detail, financial impact
- `components/analytics/InsightPanelFCOTS.tsx` — Summary strip, per-case detail table, pattern detection
- `components/analytics/InsightPanelUtilization.tsx` — Room status summary, per-room utilization bars
- `components/analytics/InsightPanelNonOpTime.tsx` — Case time breakdown bars, dominant phase analysis
- `components/analytics/InsightPanelScheduling.tsx` — Weekly volume trend, volume vs utilization divergence
- `components/analytics/InsightPanelTurnover.tsx` — Compliance summary, per-transition detail, surgeon comparison
- `components/analytics/InsightPanelCancellation.tsx` — Cancellation summary, zero-day streak, daily detail

### New Utilities
- `lib/insightExports.ts` — 9 XLSX export functions + unified dispatcher for all panel types

### Modified Files
- `lib/insightsEngine.ts` — Added `drillThroughType` field to `Insight` interface
- `lib/analyticsV2.ts` — Added `TurnoverDetail[]`, `CancellationDetail[]`, `FCOTSDetail[]` types and data population
- `app/analytics/kpi/page.tsx` — Click wiring on insight cards, inline export buttons, InsightSlideOver integration
- `app/analytics/flags/page.tsx` — Removed ORUtilizationModal

### Test Files (15+ new test files)
- `lib/__tests__/insightExports.test.ts` — Export function tests
- `components/analytics/__tests__/InsightSlideOver.test.tsx` — Slide-over tests
- `components/analytics/__tests__/InsightPanelCallback.test.tsx`
- `components/analytics/__tests__/InsightPanelFCOTS.test.tsx`
- `components/analytics/__tests__/InsightPanelUtilization.test.tsx`
- `components/analytics/__tests__/InsightPanelNonOpTime.test.tsx`
- `components/analytics/__tests__/InsightPanelScheduling.test.tsx`
- `components/analytics/__tests__/InsightPanelTurnover.test.tsx`
- `components/analytics/__tests__/InsightPanelCancellation.test.tsx`
- `app/analytics/kpi/__tests__/page-phase5.test.tsx` — KPI page click wiring tests

## Architecture Decisions
- **Radix Dialog for slide-over:** Chose Radix Dialog over custom portal for accessibility (focus trap, escape key, screen reader announcements) out of the box.
- **Panel per drillThroughType:** Each insight category maps to a dedicated panel component rather than a generic data table — allows category-specific layouts (surgeon cards for callback, compliance bars for turnover, etc.)
- **Unified export dispatcher:** `exportInsightPanel()` routes to the correct export function by `drillThroughType` — avoids duplicating the switch logic in both the slide-over and inline card buttons.
- **Pattern detection in components, not engine:** FCOTS pattern analysis (repeat offender surgeons, worst rooms/days) is computed in the panel component from raw detail data, keeping the insights engine focused on aggregate KPI-level insights.
- **Replaced ORUtilizationModal entirely:** Removed the old inline modal from both KPI and Flags pages in favor of the new slide-over for a single consistent drill-through UX.

## Database Changes
- Added `TurnoverDetail` array populated in `calculateTurnoverTime()` — per-transition room turnover data
- Added `CancellationDetail` array populated in `calculateCancellationRate()` — per-case cancellation data
- No new migrations, tables, or columns — all data derived from existing case_milestones queries

## Known Limitations / Future Work
- **No deep-linking to panels:** Panels are opened via click state only, not URL params. A future phase could add `?panel=callback` support.
- **Export is client-side only:** XLSX generation happens in the browser using SheetJS. For very large datasets, a server-side export endpoint may be needed.
- **No per-case detail for non-op time:** The non-operative time panel shows averages only (from `avgPreOpTime`, etc.). Per-case time breakdown would require adding a detail array to the analytics pipeline.
- **Scheduling panel uses weekly volume only:** Day-of-week distribution mentioned in the original plan was deferred — the weekly trend + volume-vs-utilization divergence analysis provides sufficient actionability.
