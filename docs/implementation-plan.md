# Implementation Plan: Surgeon Day Analysis Redesign

## Overview
Replace the Day Analysis tab content on the Surgeon Performance page with a timeline-first layout. 5 phases, ordered by dependency. Only the Day Analysis tab is modified — Overview tab is untouched.

## Architecture Notes
- All new visualization components go in `AnalyticsComponents.tsx` as shared exports
- Flag detection is a separate pure-function module (`flag-detection.ts`) for testability
- Sub-phase positioning is computed from existing `computePhaseDurations` output — we add a helper to calculate offset within parent
- No new database queries — all data comes from existing `dayCases`, `last30DaysCases`, `phaseDefinitions`, and `phaseTree` state
- Phase colors are always resolved dynamically via `resolvePhaseHex` / `resolveSubphaseHex` — never hardcoded

## Dependency Graph
```
Phase 1 (flag engine) ──┐
Phase 2 (components)  ───┤── Phase 4 (page integration)── Phase 5 (responsive + polish)
Phase 3 (sub-phase helper)┘
```
Phases 1-3 are independent of each other. Phase 4 depends on all three. Phase 5 depends on 4.

---

## Phase 1: Flag Detection Engine

**What:** Create a standalone pure-function module for detecting case flags. This is extracted so it can be unit tested independently and reused on iOS later.

**Files to create:**
- `src/lib/flag-detection.ts`

**Files to modify:**
- None

**Implementation details:**

1. Define TypeScript types:
```typescript
interface CaseFlag {
  type: string           // e.g. 'late_start', 'long_turnover', 'extended_preOp', 'fast_case'
  severity: 'warning' | 'caution' | 'info' | 'positive'
  label: string          // Human-readable: "Late Start", "Extended Surgical"
  detail: string         // Context: "+12m vs scheduled", "47m vs 38m med"
  icon: string           // Emoji for compact display
}

interface FlagThresholds {
  lateStartMinutes: number        // default 10
  longTurnoverMinutes: number     // default 30
  phaseExtendedPct: number        // default 0.4 (40% over median)
  subphaseExtendedPct: number     // default 0.3 (30% over median)
  fastCasePct: number             // default 0.15 (15% under median)
}
```

2. Export `DEFAULT_FLAG_THRESHOLDS` constant

3. Export `detectCaseFlags(caseData, caseIndex, allDayCases, procedureMedians, thresholds?)` — pure function:
   - Late start: only check `caseIndex === 0`, compare `patient_in` milestone timestamp to `start_time` (scheduled)
   - Long turnover: find previous case in same room, compute gap, compare to threshold
   - Extended phase: iterate parent phases from `computePhaseDurations` output, compare each to procedure-specific median
   - Extended sub-phase: iterate child phases, same comparison with lower threshold
   - Fast case: compare total OR time to procedure-specific median OR time
   - Return `CaseFlag[]`

4. Export `computeProcedureMedians(cases, phaseDefinitions)` — computes historical medians per procedure per phase/sub-phase from a case array (used with `last30DaysCases`)

5. Export `aggregateDayFlags(cases, caseFlagsMap)` — returns `{ caseNumber, flag }[]` flat array for the sidebar list

**Commit:** `feat(analytics): phase 1 - flag detection engine for surgeon day analysis`

**Test gate:**
1. `npm run typecheck` passes — all types are clean
2. Unit tests for `detectCaseFlags`: late start detection, long turnover detection, extended phase detection, fast case detection, no-flags case
3. Unit test for `computeProcedureMedians`: correct median computation with small and large cohorts
4. Edge cases: case with missing milestones returns no phase-extension flags, single-case day returns no turnover flags

---

## Phase 2: New Shared Components

**What:** Build all new visualization components in `AnalyticsComponents.tsx`. These are presentational components only — no data fetching, no flag logic. Each receives pre-computed props.

**Files to modify:**
- `src/components/analytics/AnalyticsComponents.tsx` (add exports)

**Components to create (all exported):**

### 2a. Summary Strip Components
1. **`MetricPillStrip`** — horizontal flex row of metric pills with dividers
   - Props: `items: { label: string; value: string; sub?: string; accent?: boolean }[]`
   - Renders each as label (uppercase xs slate) + value (lg semibold) + optional sub-text
   - Dividers between items (`w-px h-10 bg-slate-100`)

2. **`UptimeRing`** — SVG donut chart
   - Props: `percent: number`
   - 64×64 SVG with stroke-dashoffset animation, center text, surgical/other legend

3. **`FlagCountPills`** — inline flag summary pills
   - Props: `warningCount: number; positiveCount: number`
   - Renders colored rounded pills: `● N flags`, `⚡ N fast`

### 2b. Timeline Components
4. **`DayTimeline`** — the full Gantt timeline
   - Props: `cases: TimelineCaseData[]; caseFlags: Record<string, CaseFlag[]>; phaseTree: PhaseTreeNode[]; onHoverCase?: (id: string | null) => void`
   - `TimelineCaseData`: `{ id, caseNumber, procedure, room, startTime (Date), endTime (Date), phases: { phaseId, label, color, durationSeconds, subphases: { label, color, durationSeconds, offsetSeconds }[] }[] }`
   - Computes room grouping, time axis, turnover gaps internally
   - Renders phase segments with sub-phase inset pills at bottom 25%
   - Flag dots on top-right of case blocks
   - Hover lifts block with shadow

5. **`PhaseTreeLegend`** — legend showing parent phases + sub-phases
   - Props: `phaseTree: PhaseTreeNode[]` (reuse existing type from `buildPhaseTree`)
   - Sub-phases render adjacent to parent with smaller swatch

### 2c. Case Breakdown Components
6. **`CasePhaseBarNested`** — single case row with nested sub-phase pill
   - Props: `caseNumber, procedureName, phases (same structure as timeline), totalSeconds, maxTotalSeconds, isSelected, onSelect, flags: CaseFlag[]`
   - Parent phase bar with sub-phase inset pills at bottom 25%
   - Compact flag badges inline with case number
   - Blue ring highlight when selected

### 2d. Sidebar Components
7. **`PhaseMedianComparison`** — phase-by-phase today vs historical bars
   - Props: `dayMedians: Record<string, number>; historicalMedians: Record<string, number>; phaseTree: PhaseTreeNode[]`
   - Dual bars (faded historical, solid today) with median tick line
   - Sub-phases indented with `└` connector
   - Percentage change pills

8. **`CaseDetailPanel`** — expanded detail for a selected case
   - Props: `caseData: TimelineCaseData; flags: CaseFlag[]; procedureMedians: Record<string, number>`
   - Start/end times, room badge, flag badges
   - Phase rows with median delta, sub-phases indented with left-border

9. **`SidebarFlagList`** — day flags list for when no case is selected
   - Props: `flags: { caseNumber: string; flag: CaseFlag }[]`
   - Compact rows with severity-colored background, icon, label, case number, detail
   - Checkmark empty state when no flags

10. **`FlagBadge`** — reusable flag badge
    - Props: `flag: CaseFlag; compact?: boolean`
    - Compact: emoji only with tooltip. Full: emoji + label

**Commit:** `feat(analytics): phase 2 - day analysis visualization components`

**Test gate:**
1. `npm run typecheck` passes — all component prop types are clean
2. `npm run lint` passes — no unused imports or variables
3. Verify each component renders without error by inspecting type compatibility (functional render tests if test infrastructure supports React component tests)
4. No hardcoded phase colors anywhere — all colors come from props

---

## Phase 3: Sub-phase Positioning Helper

**What:** Add a utility function that computes a sub-phase's offset and duration *within its parent phase*, using milestone timestamp data. This bridges the gap between `computePhaseDurations` (which gives absolute durations) and the visual positioning needed for inset pills.

**Files to modify:**
- `src/lib/analyticsV2.ts` (add export)

**Implementation details:**

1. Export `computeSubphaseOffsets(phaseTree, phaseDurations, timestampMap)`:
   - For each parent phase that has children:
     - Get the parent's start timestamp from `timestampMap` (using the parent's `start_milestone_id`)
     - For each child sub-phase:
       - Get the child's start timestamp from `timestampMap`
       - Compute `offsetSeconds = childStart - parentStart`
       - Get the child's `durationSeconds` from `phaseDurations`
     - Return: `{ phaseId, subphases: { phaseId, offsetSeconds, durationSeconds, label, color }[] }[]`
   - If a sub-phase's start milestone isn't recorded, skip it (graceful degradation)

2. This function is called once per case in the page component, feeding the result into `DayTimeline` and `CasePhaseBarNested`

**Commit:** `feat(analytics): phase 3 - sub-phase offset computation for nested visualization`

**Test gate:**
1. `npm run typecheck` passes
2. Unit test: parent phase 0-1200s, sub-phase starts at 180s for 600s → offset = 180, duration = 600
3. Unit test: missing sub-phase milestone → sub-phase omitted from output
4. Unit test: sub-phase that extends beyond parent end → clamped to parent duration

---

## Phase 4: Page Integration

**What:** Replace the Day Analysis tab content in the surgeon page with the new layout, wiring all components to existing state and data.

**Files to modify:**
- `src/app/analytics/surgeons/page.tsx`

**Implementation details:**

### 4a. New state and computed values
1. Add state: `selectedCaseId: string | null` (for case selection in breakdown)
2. Add `useMemo` for `procedureMedians` — calls `computeProcedureMedians(last30DaysCases, phaseDefinitions)`
3. Add `useMemo` for `caseFlags` — iterates `caseBreakdown`, calls `detectCaseFlags` for each, returns `Record<string, CaseFlag[]>`
4. Add `useMemo` for `allDayFlags` — calls `aggregateDayFlags`
5. Add `useMemo` for `dayMedians` — computes median per phase/sub-phase from today's cases
6. Add `useMemo` for `timelineCases` — transforms `caseBreakdown` into `TimelineCaseData[]` format needed by `DayTimeline`, including sub-phase offsets from `computeSubphaseOffsets`

### 4b. Replace Day Analysis tab JSX (lines ~1043-1310)
Replace the entire Day Analysis section (everything after `{/* Date Picker */}` inside the day tab) with:

```
1. Summary Strip
   ├── MetricPillStrip (First Case, Cases, OR Time, Surgical Time)
   ├── FlagCountPills (if flags exist)
   └── UptimeRing

2. Timeline Card
   ├── Header (title + PhaseTreeLegend)
   └── DayTimeline

3. Bottom Split
   ├── Case Breakdown (flex-1)
   │   └── CasePhaseBarNested (for each case)
   └── Sidebar (w-280)
       ├── Phase Medians Card (always)
       │   └── PhaseMedianComparison
       └── Contextual Card
           ├── CaseDetailPanel (if selectedCaseId)
           └── SidebarFlagList (if no selection)
```

### 4c. Keep date picker exactly as-is
The `{/* Date Picker */}` section (chevron buttons, date input, Today button) is NOT modified — it stays above the new layout.

### 4d. Keep Procedure Performance section
The `{/* Procedure Performance */}` section below the case breakdown stays as-is. It moves to be below the full new layout (full-width, after the bottom split section).

### 4e. Remove old sections
- Remove the `{/* Day Overview Section */}` card (the 4×4 metric grid) — replaced by summary strip
- Remove the old `{/* Cases List with Enhanced Stacked Bars */}` — replaced by new case breakdown
- Keep `{/* Procedure Performance */}` card and move it to after the new bottom split

### 4f. Clean up unused imports
- Remove any imports that are no longer used after the old sections are removed (e.g., old metric card icons if only used in day analysis)

**Commit:** `feat(analytics): phase 4 - integrate day analysis redesign into surgeon page`

**Test gate:**
1. `npm run typecheck && npm run lint` passes
2. Navigate to `/analytics/surgeons`, select a surgeon, switch to Day Analysis tab — page renders without errors
3. Select a date with cases — summary strip shows correct metrics, timeline shows cases by room, case breakdown shows all cases
4. Click a case in breakdown — sidebar switches from flag list to case detail with correct phase/sub-phase data
5. Click again — deselects, sidebar returns to flag list
6. Select a date with no cases — appropriate empty states shown
7. Verify sub-phase pills appear inside parent phase segments at bottom 25% in both timeline and case bars
8. Verify flag dots appear on timeline blocks for flagged cases
9. All phase colors match what `resolvePhaseHex` / `resolveSubphaseHex` return (no hardcoded colors)
10. Date navigation (arrows, date picker, Today button) still works correctly

---

## Phase 5: Responsive Layout + Polish

**What:** Ensure the layout works on smaller screens, add hover tooltips to timeline blocks, and polish transitions.

**Files to modify:**
- `src/app/analytics/surgeons/page.tsx` (responsive classes)
- `src/components/analytics/AnalyticsComponents.tsx` (tooltip, transitions)

**Implementation details:**

1. **Responsive sidebar stacking**: The bottom split uses `flex gap-4`. Add `flex-col lg:flex-row` so sidebar stacks below on < 1024px. Sidebar width changes from fixed 280px to `lg:w-[280px] w-full`

2. **Summary strip responsive**: On small screens, the metric pills should wrap. Change flex to `flex-wrap gap-4` and hide dividers below md breakpoint

3. **Timeline tooltip on hover**: When hovering a case block in the timeline, show a lightweight tooltip with case number, procedure, total time, and any flags — using absolute positioning above the block

4. **Timeline scroll**: If the day has very long time spans (e.g., 6am to 6pm), ensure the timeline doesn't get compressed. Add `min-width: 600px` on the timeline track container and wrap in `overflow-x-auto` on small screens

5. **Transition polish**: 
   - Case selection in sidebar: add `transition-all duration-200` for the swap between flag list and case detail
   - Utilization ring: stroke-dashoffset already has 0.8s ease transition
   - Phase bars: add `transition-all duration-300` on width for initial render

6. **Skeleton loading**: Replace the existing `SkeletonDayAnalysis` with a new skeleton that matches the new layout shape (summary strip skeleton + timeline skeleton + bottom split skeleton)

**Commit:** `feat(analytics): phase 5 - responsive layout and polish for day analysis`

**Test gate:**
1. `npm run typecheck && npm run lint` passes
2. Resize browser to 768px — sidebar stacks below, summary strip wraps gracefully
3. Hover a case in timeline — tooltip appears with correct info
4. Select surgeon with no day data — skeleton loads, then empty state appears
5. Select surgeon → switch dates rapidly — no flicker or stale state
6. All animations/transitions feel smooth, no layout jumps

---

## Session Log
<!-- Claude Code appends session summaries here during execution -->

---

## Phase Checklist

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Flag detection engine | ⬜ Pending | — |
| 2 | New shared visualization components | ⬜ Pending | — |
| 3 | Sub-phase offset computation helper | ⬜ Pending | — |
| 4 | Page integration — wire everything together | ⬜ Pending | — |
| 5 | Responsive layout + polish | ⬜ Pending | — |
