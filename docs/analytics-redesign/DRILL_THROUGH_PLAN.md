# Insight Drill-Through & Export Architecture

## Data Availability Per Insight

### ✅ Callback Optimization — FULLY AVAILABLE
**What the insight says**: "Dr. Martinez's 4 min flip idle is the facility benchmark. Applying similar timing to Dr. Williams (currently 12 min) could save ~7 min per transition."

**What the user wants to see when they click**:
- Dr. Williams' actual cases with the idle gaps
- Which cases had the gaps (case numbers, dates, rooms)  
- The exact idle minutes per gap
- What the optimal call time would have been
- Side-by-side comparison with Dr. Martinez

**Data already returned by analyticsV2**:
- `analytics.flipRoomAnalysis[]` — Full `FlipRoomAnalysis` per surgeon-day with:
  - `cases[]` — caseId, caseNumber, roomId, roomName, scheduledStart, patientIn, patientOut
  - `idleGaps[]` — fromCase, toCase, idleMinutes, optimalCallDelta, gapType, fromRoom, toRoom
  - avgIdleTime, totalIdleTime
- `analytics.surgeonIdleSummaries[]` — Per-surgeon aggregates with medians

**Verdict**: Can build the full detail view AND export right now. No changes to analyticsV2 needed.

---

### ⚠️ First Case Delays — PARTIALLY AVAILABLE  
**What the insight says**: "11 of 16 first cases started late — Wednesdays are the weakest day."

**What the user wants to see when they click**:
- Which specific first cases were late
- How late each one was (delay in minutes)
- Which surgeon, which room, which day
- Pattern: is it always the same room? Same surgeon?

**Data currently returned**:
- `analytics.fcots.dailyData[]` — date, color, tooltip (aggregate per day)
- `analytics.fcots.subtitle` — "11 late of 16 first cases"

**Data computed internally but NOT returned** (inside `calculateFCOTS`):
- The `casesByDateRoom` Map has every first case identified
- The `delayMinutes` per case is calculated
- The `isOnTime` boolean per case is determined
- But none of this per-case detail is in the return object

**What needs to change**: Add a `firstCaseDetails` array to the FCOTS return:
```ts
interface FCOTSDetail {
  caseId: string
  caseNumber: string
  scheduledDate: string
  roomName: string
  surgeonName: string
  scheduledStart: string    // "07:30"
  actualStart: string       // "07:44" 
  delayMinutes: number      // 14
  isOnTime: boolean
}
```

**Effort**: Small — the data is already computed in the loop, just needs to be collected and returned.

---

### ⚠️ OR Utilization — MOSTLY AVAILABLE
**What the insight says**: "42% utilization across 4 rooms. Room 2 is lowest at 28%."

**What the user wants to see when they click**:
- Per-room breakdown (already in the modal!)
- Per-room daily utilization trend
- Which days rooms were empty vs. underutilized
- Gap analysis: how many hours were unused

**Data currently returned**:
- `analytics.orUtilization.roomBreakdown[]` — roomId, roomName, utilization, usedMinutes, availableHours, caseCount, daysActive, usingRealHours

**What's missing for drill-through**:
- Daily per-room utilization (the `dailyUtils[]` array exists in `roomAgg` but isn't returned)
- The existing OR Utilization Modal already shows most of this

**What needs to change**: Expose `dailyUtilization` on each `RoomUtilizationDetail`:
```ts
dailyUtilization: Array<{ date: string; utilization: number; caseCount: number }>
```

**Effort**: Small — data is already in `roomAgg.dailyUtils`, just needs to be structured and returned.

---

### ✅ Cancellation Trend — AVAILABLE (but shallow)
**What the insight says**: "Zero same-day cancellations for 22 consecutive days."

**What the user wants to see when they click**:
- Calendar view of cancellation-free days
- Historical cancellation details when they did occur
- Which cases were cancelled and why

**Data currently returned**:
- `analytics.cancellationRate.dailyData[]` — per-day cancel count
- `analytics.cancellationRate.sameDayCount`, `totalCancelledCount`

**What's NOT available without new queries**:
- Cancellation reasons (would need a `cancellation_reason` column on cases table)
- Specific cancelled case details

**Verdict**: The streak visualization and daily history can render from existing data. Cancellation reasons would need a schema addition — flag as future enhancement.

---

### ⚠️ Non-Operative Time — PARTIALLY AVAILABLE
**What the insight says**: "33% of case time is non-operative. Pre-op at 18 min is the larger contributor."

**What the user wants to see when they click**:
- Per-case breakdown: which cases had the longest pre-op?
- Surgeon comparison: who has the highest non-op time?
- Pre-op vs post-op split per surgeon

**Data currently returned**:
- `analytics.nonOperativeTime` — aggregate only (value, subtitle)
- `analytics.avgPreOpTime`, `analytics.avgClosingTime`, `analytics.avgEmergenceTime` — averages

**What's computed internally but NOT returned**:
- `calculateTimeBreakdown` computes per-case `preOpTimes[]`, `closingTimes[]`, `emergenceTimes[]` but only returns averages

**What needs to change**: Return per-case or per-surgeon time breakdowns:
```ts
interface TimeBreakdownDetail {
  caseId: string
  caseNumber: string
  surgeonName: string
  preOpMinutes: number
  surgicalMinutes: number
  closingMinutes: number
  emergenceMinutes: number
  totalMinutes: number
  nonOpPercent: number
}
```

**Effort**: Medium — needs to collect case-level data in the existing loop and group by surgeon.

---

### ✅ Turnover Efficiency — PARTIALLY AVAILABLE
**What the insight says**: "Same-room surgical turnover is 54 min. Focus here first."

**Data currently returned**:
- Medians, compliance rates, daily tracker data
- `TurnoverBreakdown` with counts

**What's missing**:
- Per-transition detail (which case pair, which room, how many minutes)
- This data IS computed in `calculateSurgicalTurnovers` and `calculateTurnoverTime` but only aggregated

**Effort**: Medium — same pattern as FCOTS, collect the per-transition detail in the existing loop.

---

## Recommended Drill-Through Patterns

### Pattern A: Slide-Over Panel (Preferred for most insights)
A panel slides in from the right (like Linear's detail views) showing:
- The insight title + severity at top
- Supporting data table
- Sparkline/chart for the specific metric
- Export button at bottom

**Best for**: Callback optimization, FCOTS delays, turnover details

### Pattern B: Navigate to Existing Page with Filter
Some insights map directly to pages that already exist or should exist:
- OR Utilization → Opens the existing modal (already built)
- Cancellations → Navigate to a cases list filtered to cancelled status
- Time Breakdown → Navigate to a phase analysis page

### Pattern C: Export to XLSX
Every drill-through view should have an "Export" button that generates a spreadsheet with:
- Summary sheet (the insight headline metrics)
- Detail sheet (case-level data)
- Comparison sheet (benchmarks, targets, recommendations)

---

## Export Architecture

### File: `lib/insightExports.ts`

Uses the xlsx skill/library to generate downloadable spreadsheets per insight type.

Each export function takes the analytics data and returns a structured workbook:

```ts
export function exportCallbackOptimization(
  summaries: SurgeonIdleSummary[],
  details: FlipRoomAnalysis[],
  config: InsightsConfig
): ExportData

export function exportFCOTSDetails(
  fcots: FCOTSResult,  // extended with firstCaseDetails
  config: InsightsConfig  
): ExportData

export function exportUtilizationBreakdown(
  utilization: ORUtilizationResult,
  config: InsightsConfig
): ExportData
```

### ExportData type:
```ts
interface ExportData {
  filename: string              // "orbit-callback-optimization-2025-02.xlsx"
  sheets: Array<{
    name: string                // "Summary", "Surgeon Detail", "Recommendations"
    headers: string[]
    rows: (string | number)[][]
  }>
}
```

---

## Implementation Priority

| Priority | Insight | Drill-Through | Export | analyticsV2 Changes |
|----------|---------|--------------|--------|-------------------|
| 1 | Callback Optimization | Slide-over panel | Yes | None — data exists |
| 2 | First Case Delays | Slide-over panel | Yes | Add FCOTSDetail[] |
| 3 | OR Utilization | Existing modal | Yes | Add daily per-room |  
| 4 | Turnover Efficiency | Slide-over panel | Yes | Add per-transition detail |
| 5 | Non-Operative Time | Navigate to page | Yes | Add per-case breakdown |
| 6 | Cancellations | Navigate to cases | Yes | None for basic; schema for reasons |
