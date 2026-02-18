# Feature: Surgeon Day Analysis Redesign

## Goal
Replace the Day Analysis tab on the Surgeon Performance page with a timeline-first layout that tells the story of a surgeon's day. The current 4×4 metric grid and flat case bar list are replaced by: (1) a compact horizontal summary strip with inline flag counts and a utilization ring, (2) a Gantt-style OR timeline grouped by room with phase-colored case blocks and sub-phase inset pills, (3) a case breakdown list with nested sub-phase rendering and click-to-expand detail, (4) a sidebar showing phase median comparisons (today vs historical, including sub-phases) and contextual day flags or per-case detail, and (5) an auto-detected flag system that surfaces late starts, long turnovers, extended phases/sub-phases, and fast cases. The Overview tab is NOT modified.

## Requirements

### Summary Strip (replaces Day Overview metric grid)
1. Single horizontal card containing: First Case Start (with scheduled sub-label), Cases count, Total OR Time, Total Surgical Time — separated by vertical dividers
2. SVG donut ring on the right showing uptime/utilization % with surgical vs non-surgical legend
3. Inline flag count pills after the metrics when flags exist (e.g. `● 2 flags`, `⚡ 3 fast`) — these replace the current Surgical Turnover, Room Turnover, and Uptime vs Downtime cards
4. Turnover metrics are NOT lost — they move to the timeline's turnover gap annotations (dashed gap regions with duration labels) and can be surfaced in a future tooltip

### Day Timeline (new section)
5. Gantt-style horizontal timeline with one row per OR room used that day
6. Time axis across the top with hour markers and half-hour grid lines
7. Each case renders as a block within its room row, color-segmented by parent phases from `phase_definitions` (using `resolvePhaseHex`)
8. Sub-phases render as a red inset pill at the bottom 25% of the parent phase segment, positioned using the sub-phase's offset and duration within the parent
9. Turnover gaps between consecutive cases in the same room render as dashed-border regions with duration labels
10. Flag indicator dots (orange for warnings/cautions, green for fast cases) appear on the top-right corner of flagged case blocks
11. Hover on a case block should lift it slightly with enhanced shadow
12. Consume the existing `buildPhaseTree`, `computePhaseDurations`, `buildMilestoneTimestampMap`, `resolvePhaseHex`, and `resolveSubphaseHex` utilities — do NOT duplicate phase computation logic

### Case Breakdown (replaces current Case Breakdown section)
13. Stacked horizontal bar per case showing parent phases, with the sub-phase rendered as a red inset pill at the bottom 25% of the parent segment (same visual as timeline)
14. Each row shows case number, procedure name, flag badges (compact), and total duration
15. Clicking a case selects it — highlights with blue ring, opens the detail panel in the sidebar
16. Clicking again deselects
17. Phase duration labels appear inside segments when wide enough (≥8 minutes)

### Sidebar — Phase Medians (always visible)
18. Dual-bar comparison for each parent phase: faded bar = historical median, solid bar = today's median, vertical tick at historical median line
19. Sub-phases appear indented below their parent phase with `└` tree connector, slightly smaller bars
20. Each row shows absolute value + colored percentage pill (↓ green for improvement, ↑ red for regression)
21. Historical medians come from the existing `last30DaysCases` data (same data source as current 30-day comparisons)

### Sidebar — Contextual Panel (below Phase Medians)
22. When NO case is selected: show "Day Flags" list — compact rows with icon, label, affected case number, and detail text
23. When a case IS selected: show case detail panel with start/end time, room, parent phase durations with per-procedure median comparisons, sub-phase durations indented below their parent with median comparisons, and total duration with median delta
24. Sub-phases in the detail panel show with a left border in the sub-phase color and indented layout

### Flag Detection Engine
25. Auto-detect and surface the following flag types:
    - **Late Start** (warning): first case started > facility threshold (configurable, default 10m) past scheduled time
    - **Late Start** (info): first case started 1-10m past scheduled time
    - **Long Turnover** (warning): turnover between consecutive same-room cases exceeds facility threshold (configurable, default 30m)
    - **Extended Phase** (caution): any parent phase duration > 40% above the procedure-specific historical median
    - **Extended Sub-phase** (caution): any sub-phase duration > 30% above the procedure-specific historical median
    - **Fast Case** (positive): total case time > 15% below the procedure-specific historical median OR time
26. Flag detection is a pure function — takes a case, its index in the day's list, and all cases for the day; returns an array of flag objects
27. Flags surface at three levels: count pills in summary strip, dot indicators on timeline blocks, and full detail in sidebar

### Phase Legend
28. Shared legend component showing all parent phases with color swatches, and sub-phases with smaller swatches adjacent to their parent — derived from `buildPhaseTree` and phase color resolvers

## Database Context
- Table: `phase_definitions` — columns: id, facility_id, name, display_name, display_order, color_key, parent_phase_id, start_milestone_id, end_milestone_id, is_active
- Table: `cases` — columns: id, case_number, scheduled_date, start_time, surgeon_id, facility_id
- Table: `case_milestones` — columns: facility_milestone_id, recorded_at + join to facility_milestones (name)
- Table: `procedure_types` — columns: id, name, technique_id
- Table: `or_rooms` — columns: id, name
- Existing utilities: `buildPhaseTree()`, `computePhaseDurations()`, `buildMilestoneTimestampMap()`, `resolvePhaseHex()`, `resolveSubphaseHex()`, `getMilestoneMap()`, `getTotalORTime()`, `getSurgicalTime()`, `getWheelsInToIncision()`, `getIncisionToClosing()`, `getClosingTime()`, `getClosedToWheelsOut()`, `getAllTurnovers()`, `getAllSurgicalTurnovers()`, `calculateAverage()`, `calculateSum()`, `calculatePercentageChange()`, `formatMinutesToHHMMSS()`, `formatSecondsToHHMMSS()`

## UI/UX
- Route: `/analytics/surgeons` — Day Analysis tab (only modifying the Day Analysis tab content, Overview tab untouched)
- Layout: Summary strip (full width) → Timeline (full width) → Case Breakdown (flex-1) + Sidebar (280px fixed) side by side
- Responsive: On screens < 1024px, sidebar stacks below case breakdown
- The date picker and Today button remain exactly as they are now
- All phase colors are dynamic from `phase_definitions` — no hardcoded colors
- Sub-phase inset pills use the sub-phase's own color from `resolveSubphaseHex` (the prototype used red for visual clarity; production should use the actual sub-phase color_key)

## Files Likely Involved
- `src/app/analytics/surgeons/page.tsx` — main page (Day Analysis tab section ~lines 1000-1310 replaced)
- `src/components/analytics/AnalyticsComponents.tsx` — shared components (new: `DayTimeline`, `CasePhaseBarNested`, `PhaseMedianComparison`, `FlagCountPills`, `SidebarFlagList`, `CaseDetailPanel`, `UptimeRing`, `MetricPillStrip`, `PhaseTreeLegend`)
- `src/lib/analyticsV2.ts` — may need a helper to compute sub-phase offset/duration within parent from milestone timestamps
- `src/lib/milestone-phase-config.ts` — already has `buildPhaseTree`, `resolvePhaseHex`, `resolveSubphaseHex`
- `src/lib/flag-detection.ts` — NEW file for the pure flag detection engine

## iOS Parity
- [ ] iOS equivalent needed (future — not part of this work)
- Notes: The timeline visualization would need a SwiftUI equivalent; the flag detection engine logic should be mirrored in Swift when building the iOS day view

## Known Issues / Constraints
- Phase definitions are facility-specific — the entire view depends on `phase_definitions` being configured. Show the existing "No Phases Configured" empty state if none exist
- Sub-phase data depends on paired milestones being recorded — if a sub-phase's start/end milestones aren't recorded for a case, that sub-phase pill simply doesn't render (graceful degradation)
- Historical medians for flag detection use `last30DaysCases` which is already fetched — no additional queries needed
- The `computePhaseDurations` function returns `durationSeconds: null` for phases with missing milestones — handle this gracefully (skip rendering, show as missing)
- Turnover computation uses `getAllTurnovers` and `getAllSurgicalTurnovers` which require room data — the day analysis query already joins `or_rooms`
- The flag detection thresholds (10m late start, 30m long turnover, 40% extended phase, etc.) are initially hardcoded constants but should be structured for easy migration to facility-configurable settings later

## Out of Scope
- Overview tab modifications
- New database tables or migrations
- Facility-configurable flag thresholds (hardcoded constants for v1)
- iOS implementation
- Procedure Performance section changes (stays as-is below the new layout)

## Acceptance Criteria
- [ ] Summary strip displays First Case Start, Cases, OR Time, Surgical Time, flag pills, and utilization ring
- [ ] Timeline renders cases grouped by room with correct phase colors from phase_definitions
- [ ] Sub-phases render as inset pills at bottom 25% of parent segment in both timeline and case bars
- [ ] Clicking a case in the breakdown list opens its detail in the sidebar with phase + sub-phase median comparisons
- [ ] When no case selected, sidebar shows day flags list
- [ ] Flag detection correctly identifies: late starts, long turnovers, extended phases, extended sub-phases, and fast cases
- [ ] Phase medians sidebar shows today vs historical for all parent phases and sub-phases
- [ ] Empty states handled: no cases, no phase definitions, missing milestones
- [ ] All phase colors are dynamic from phase_definitions (no hardcoded phase colors)
- [ ] Date picker and navigation arrows work identically to current behavior
- [ ] Responsive: sidebar stacks below on smaller screens
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
- [ ] Committed with descriptive messages per phase
