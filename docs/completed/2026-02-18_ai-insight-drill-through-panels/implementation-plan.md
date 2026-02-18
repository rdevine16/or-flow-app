# Implementation Plan: AI Insight Drill-Through Panels

## Summary
Make every AI Insight card on the KPI page clickable, opening a Radix-based slide-over panel (640px, right side) with drill-through data specific to each insight category. Build panels for all 7 insight categories, replace the existing inline ORUtilizationModal with the new slide-over pattern, and add real XLSX export using SheetJS. Continue on branch `feature/milestone-hierarchy-redesign`.

## Interview Notes
- **Panel pattern**: CaseDrawer (Radix Dialog) — 640px wide slide-over from the right
- **Scope**: All 7 insight categories (not just the 3 with existing data)
- **ORUtilizationModal**: Replace with the new slide-over — single consistent drill-through UX
- **Detail level**: Case-level where the reference design shows it; aggregate where not
- **Export**: Real XLSX export using SheetJS (xlsx)
- **Panel width**: 640px (reference design)
- **Panel designs for missing categories**: Designed in this plan (see each phase)
- **Branch**: Stay on `feature/milestone-hierarchy-redesign` — no new branch

## Data Readiness Matrix

| Category | Insight IDs | Detail Data Ready? | New Work Needed |
|---|---|---|---|
| Callback/Idle | `callback-*` | YES — `flipRoomAnalysis` + `surgeonIdleSummaries` | None |
| FCOTS | `fcots-*` | YES — `fcots.firstCaseDetails` | None |
| Utilization | `utilization-*` | YES — `orUtilization.roomBreakdown` | None |
| Non-Op Time | `non-op-*`, `preop-*` | PARTIAL — avg times on AnalyticsOverview | Per-case time breakdown array |
| Scheduling | `scheduling-*`, `volume-*` | PARTIAL — `weeklyVolume[]` on CaseVolumeResult | Day-of-week distribution |
| Turnovers | `turnover-*` | NO — only aggregate KPIResult | Per-transition detail arrays |
| Cancellations | `cancellation-*` | NO — only counts | Per-case cancellation list |

---

## Phase 1: Slide-Over Shell + Click Wiring
**Complexity: Medium**

### What it does
- Create `InsightSlideOver.tsx` using Radix Dialog pattern (matches CaseDrawer)
- Add `drillThroughType` field to `Insight` interface in `insightsEngine.ts`
- Map each insight ID to a panel type: `'callback' | 'fcots' | 'utilization' | 'turnover' | 'cancellation' | 'non_op_time' | 'scheduling' | null`
- Wire `onClick` handlers on insight cards in the KPI page
- Add `cursor-pointer` + chevron to cards that have drill-through
- Render placeholder content in the slide-over ("Panel content coming in Phase X")
- Add state: `const [activeInsight, setActiveInsight] = useState<Insight | null>(null)`

### Panel shell design (640px, Radix Dialog)
```
+---------------------------------------------+
| [severity badge] Title              [X]     |
| Supporting data . {period}                  |
| ------------------------------------------- |
|                                             |
|  [scrollable panel content area]            |
|                                             |
|                                             |
+---------------------------------------------+
```

### Files touched
- `lib/insightsEngine.ts` — add `drillThroughType` to `Insight`, map in each generator
- `components/analytics/InsightSlideOver.tsx` (new) — Radix Dialog slide-over shell
- `app/analytics/kpi/page.tsx` — wire onClick on insight cards, render InsightSlideOver

### Commit message
`feat(analytics): phase 1 - insight slide-over shell and click wiring`

### Test gate
1. **Unit**: InsightSlideOver renders with title/severity when open, hidden when closed
2. **Integration**: Clicking an insight card opens the slide-over with correct insight data
3. **Workflow**: Escape key and backdrop click close the panel; non-drillthrough cards are not clickable

---

## Phase 2: Callback/Idle Time Panel
**Complexity: Large**

### What it does
Build the callback/idle drill-through panel following the reference design exactly.

### Panel layout
```
+-- Surgeon Comparison -----------------------+
| +-- Dr. Martinez --- On Track ---- > -----+ |
| | [sparkline]                              | |
| | Flip Idle: 4m  |  Call D: --             | |
| | Cases: 28      |  Same Rm: --            | |
| | [utilization bar against target]         | |
| +------------------------------------------+ |
| +-- Dr. Williams -- Call Sooner --- > -----+ |
| | [sparkline]                              | |
| | Flip Idle: 12m |  Call D: 7m             | |
| | Cases: 15      |  Same Rm: 52m           | |
| | v Expanded: gap-by-gap detail            | |
| |   Date | From -> To | Idle | Save       | |
| |   Feb 4  1048->1049   14m    9m          | |
| +------------------------------------------+ |
|                                              |
| +-- Recommendation -------------------------+|
| | Call Dr. Williams 7 min earlier...        ||
| +-------------------------------------------+|
|                                              |
| +-- Financial Impact -----------------------+|
| | Recoverable: 11 min/day                   ||
| | Rate: $36/min  |  Annual: $24K            ||
| +-------------------------------------------+|
+----------------------------------------------+
```

### Data sources (all ready)
- `analytics.surgeonIdleSummaries` — per-surgeon aggregates
- `analytics.flipRoomAnalysis` — per-surgeon-day gap detail
- `insight.metadata` — pre-computed totals from insightsEngine
- `config.orHourlyRate`, `config.operatingDaysPerYear` — financial calc

### Files touched
- `components/analytics/InsightPanelCallback.tsx` (new) — callback panel content
- `components/analytics/InsightSlideOver.tsx` — import and route to callback panel

### Commit message
`feat(analytics): phase 2 - callback/idle time drill-through panel`

### Test gate
1. **Unit**: Panel renders surgeon cards sorted by actionability, expandable detail toggles
2. **Integration**: Clicking callback insight opens panel with correct surgeon data and financial calcs
3. **Workflow**: Expand surgeon -> see gap detail -> recommendation text reflects actual data

---

## Phase 3: FCOTS Panel
**Complexity: Medium**

### What it does
Build the FCOTS drill-through panel following the reference design.

### Panel layout
```
+-- Summary Strip ----------------------------+
|  On-Time   |  Late    |  Total  | Avg       |
|  31%       |  11      |  16     | 16m       |
+----------------------------------------------+

+-- First Case Detail ------------------------+
| Date  Room  Surgeon    Sched  Act  Delay     |
| Feb 3 OR-1  Martinez   7:30  7:32  +2m      |
| Feb 3 OR-2  Williams   7:30  7:48  +18m     |
| ...                                          |
+----------------------------------------------+

+-- Pattern Detected -------------------------+
| Dr. Williams late 3/3 first cases            |
| (avg +25m). OR-2 worst room (4/4 late).      |
+----------------------------------------------+
```

### Pattern detection logic (computed in component)
- Group `firstCaseDetails` by surgeon -> find surgeons with >50% late rate
- Group by room -> find rooms with >50% late rate
- Group by day-of-week -> find worst day
- Build narrative from the findings

### Data sources (all ready)
- `analytics.fcots.firstCaseDetails` — per-case detail
- `analytics.fcots` — aggregate KPI (value, target, targetMet)
- `config.fcotsGraceMinutes`, `config.fcotsTargetPercent` — thresholds

### Files touched
- `components/analytics/InsightPanelFCOTS.tsx` (new) — FCOTS panel content
- `components/analytics/InsightSlideOver.tsx` — route to FCOTS panel

### Commit message
`feat(analytics): phase 3 - FCOTS drill-through panel with pattern detection`

### Test gate
1. **Unit**: Summary strip computes correctly, detail table renders all cases, pattern detection finds repeat offenders
2. **Integration**: FCOTS insight click opens panel with correct case data
3. **Workflow**: Panel pattern box highlights surgeon/room with worst on-time rate

---

## Phase 4: Utilization Panel + Replace ORUtilizationModal
**Complexity: Medium**

### What it does
- Build utilization drill-through panel in the slide-over
- Remove the inline `ORUtilizationModal` from `kpi/page.tsx`
- Redirect the OR Utilization KPI card click to open the new slide-over instead
- Also remove the duplicate `ORUtilizationModal` from `flags/page.tsx`

### Panel layout
```
+-- Room Status Summary ----------------------+
|  Above Target  |  Near Target  | <60%       |
|       0        |       1       |   3        |
+----------------------------------------------+

+-- OR-1 ------------- 58% -------------------+
| [bar against 75% target]                     |
| 42 cases . 18 days active . 5.2h/10h        |
+----------------------------------------------+
+-- OR-2 ------------- 44% [Default hrs] -----+
| [bar against 75% target]                     |
| 35 cases . 17 days active . 4.4h/10h        |
+----------------------------------------------+
```

### Data sources (all ready)
- `analytics.orUtilization.roomBreakdown` — per-room detail
- `analytics.orUtilization.roomsWithRealHours`, `roomsWithDefaultHours`
- `config.utilizationTargetPercent` — target line position

### Files touched
- `components/analytics/InsightPanelUtilization.tsx` (new) — utilization panel content
- `components/analytics/InsightSlideOver.tsx` — route to utilization panel
- `app/analytics/kpi/page.tsx` — remove ORUtilizationModal, redirect KPI card click
- `app/analytics/flags/page.tsx` — remove ORUtilizationModal

### Commit message
`feat(analytics): phase 4 - utilization panel, replace ORUtilizationModal`

### Test gate
1. **Unit**: Room cards render with correct utilization %, bars, and target lines
2. **Integration**: Both insight click AND KPI card click open the same utilization panel
3. **Workflow**: Rooms using default hours are flagged; rooms sorted lowest-first

---

## Phase 5: Non-Op Time + Scheduling Panels
**Complexity: Medium**

### What it does
Build panels for non-operative time and scheduling pattern insights. These use data already on AnalyticsOverview (avg times, weekly volume) plus light new calculations.

### Non-Op Time Panel layout
```
+-- Case Time Breakdown ----------------------+
| Pre-Op     ========-------  32 min (38%)    |
| Anesthesia ==-------------   8 min  (9%)    |
| Surgical   =============--  52 min (62%)    |
| Closing    ===------------  12 min (14%)    |
| Emergence  ==-------------   6 min  (7%)    |
+----------------------------------------------+

+-- Non-Operative Time High ------------------+
| Non-op time is 38% of total case time.      |
| Pre-op phase (32 min) is the largest        |
| contributor. Compare to surgical (52 min).  |
+----------------------------------------------+
```

### Scheduling Panel layout
```
+-- Weekly Volume Trend ----------------------+
| [bar chart: weeklyVolume data]              |
| Current avg: 24 cases/week                  |
| Previous avg: 28 cases/week (-14%)          |
+----------------------------------------------+

+-- Volume vs Utilization --------------------+
| Volume:      down declining                 |
| Utilization: down declining                 |
| Pattern: Both trending down suggests        |
| fewer cases scheduled, not just shorter.    |
+----------------------------------------------+
```

### New data needed
- `CaseVolumeResult` already has `weeklyVolume[]` — sufficient for scheduling
- Non-op panel computes from existing `avg*Time` fields — no new calculation
- Optionally: add `previousWeeklyVolume` for trend comparison (light addition)

### Files touched
- `components/analytics/InsightPanelNonOpTime.tsx` (new)
- `components/analytics/InsightPanelScheduling.tsx` (new)
- `components/analytics/InsightSlideOver.tsx` — route to new panels
- `lib/analyticsV2.ts` — add `previousWeeklyVolume` to CaseVolumeResult (optional, for trend)

### Commit message
`feat(analytics): phase 5 - non-op time and scheduling drill-through panels`

### Test gate
1. **Unit**: Time breakdown bars render with correct proportions, weekly chart shows trend
2. **Integration**: Non-op and scheduling insight clicks open correct panels with live data
3. **Workflow**: Scheduling divergence insight shows volume-vs-utilization comparison

---

## Phase 6: Turnover + Cancellation Detail Data and Panels
**Complexity: Large**

### What it does
Add new detail data structures to `analyticsV2.ts` for turnovers and cancellations, then build their drill-through panels.

### New types needed

```typescript
// Per-transition detail for room turnovers
interface TurnoverDetail {
  date: string
  roomName: string
  fromCaseNumber: string
  toCaseNumber: string
  fromSurgeonName: string
  toSurgeonName: string
  turnoverMinutes: number
  isCompliant: boolean // under threshold
}

// Per-case cancellation detail
interface CancellationDetail {
  caseId: string
  caseNumber: string
  date: string
  roomName: string
  surgeonName: string
  scheduledStart: string
  cancellationType: string // 'same_day' | 'prior_day' | 'other'
}
```

### Turnover Panel layout
```
+-- Compliance Summary -----------------------+
| Compliant: 65%  |  Target: 80%             |
| Under 30min: 42 |  Over 30min: 23          |
+----------------------------------------------+

+-- Turnover Detail --------------------------+
| Date  Room  From->To     Surgeon  Time      |
| Feb 3 OR-1  1041->1042  Martinez  22m check |
| Feb 3 OR-2  1048->1049  Williams  38m X     |
| ...                                          |
+----------------------------------------------+

+-- Surgical Turnover Comparison -------------+
| Same-Room: median 42m (target 45m) check    |
| Flip-Room: median 18m (target 15m) X        |
| [horizontal bars per surgeon]               |
+----------------------------------------------+
```

### Cancellation Panel layout
```
+-- Cancellation Summary ---------------------+
| Same-Day: 3  |  Rate: 4.2%  |  Streak:     |
| (target <5%)                   12 days      |
+----------------------------------------------+

+-- Same-Day Cancellations -------------------+
| Date   Case    Surgeon     Room  Sched      |
| Feb 5  #1055   Dr. Patel   OR-3  8:00      |
| Feb 8  #1078   Dr. Chen    OR-1  7:30      |
| ...                                          |
+----------------------------------------------+
```

### Files touched
- `lib/analyticsV2.ts` — add `TurnoverDetail[]` to turnover result, `CancellationDetail[]` to CancellationResult, populate in `calculateTurnoverTime()` and `calculateCancellationRate()`
- `components/analytics/InsightPanelTurnover.tsx` (new)
- `components/analytics/InsightPanelCancellation.tsx` (new)
- `components/analytics/InsightSlideOver.tsx` — route to new panels
- `lib/__tests__/analyticsV2-phase1.test.ts` — tests for new detail data

### Commit message
`feat(analytics): phase 6 - turnover and cancellation detail data and panels`

### Test gate
1. **Unit**: `calculateTurnoverTime` returns detail array with correct per-transition data; `calculateCancellationRate` returns per-case list
2. **Integration**: Turnover and cancellation insight clicks open panels with live detail tables
3. **Workflow**: Turnover compliance % matches aggregate KPI; cancellation list matches count

---

## Phase 7: XLSX Export with SheetJS
**Complexity: Medium**

### What it does
- Install SheetJS (`xlsx` package)
- Create `lib/exportInsight.ts` utility that converts panel data to XLSX
- Add export button to slide-over header (downloads XLSX)
- Add inline export button on each insight card
- Each panel type defines its own column mapping for the spreadsheet
- Visual feedback: button shows checkmark for 2 seconds after export

### Export formats per panel type
| Panel | Sheet Name | Columns |
|---|---|---|
| Callback | "Surgeon Idle" | Surgeon, Status, Flip Idle, Callback Delta, Cases, Flip Gaps |
| Callback (detail) | "Gap Detail" | Surgeon, Date, From Case, To Case, From Room, To Room, Idle Min, Optimal Save |
| FCOTS | "First Case Detail" | Date, Room, Surgeon, Scheduled, Actual, Delay Min, On Time |
| Utilization | "Room Utilization" | Room, Utilization %, Used Min, Available Hrs, Cases, Days Active, Real Hours |
| Turnover | "Turnover Detail" | Date, Room, From Case, To Case, Surgeon, Minutes, Compliant |
| Cancellation | "Cancellations" | Date, Case, Surgeon, Room, Scheduled, Type |
| Non-Op | "Time Breakdown" | Phase, Avg Minutes, % of Total |
| Scheduling | "Weekly Volume" | Week, Case Count |

### Files touched
- `package.json` — add `xlsx` dependency
- `lib/exportInsight.ts` (new) — export utility per panel type
- `components/analytics/InsightSlideOver.tsx` — add export button to header
- `app/analytics/kpi/page.tsx` — add inline export button on insight cards

### Commit message
`feat(analytics): phase 7 - XLSX export for all insight panels`

### Test gate
1. **Unit**: `exportInsight` produces correct worksheet data for each panel type
2. **Integration**: Export button triggers download with correct filename and sheet structure
3. **Workflow**: Export from panel header and from inline card button both produce identical files
