# Feature: Case & Flag Analytics Page + Tremor-to-Recharts Migration

## Goal

Replace the current `analytics/flags` page (which incorrectly shows the general analytics overview) with a dedicated **Case & Flag Analytics** dashboard. The new page is a comprehensive flags analytics tool with KPIs, severity breakdowns, computed pattern detection, trend charts, a day-of-week heatmap, flag rule/delay type breakdowns, surgeon flag distribution, room analysis, recent flagged cases, and drill-through panels.

Additionally, migrate all remaining analytics pages from `@tremor/react` to **Recharts** for consistency, then remove the Tremor dependency.

## Background

The codebase has a well-established flag system:
- **`case_flags` table** — stores both auto-detected threshold flags and user-reported delay flags
- **`flag_rules` table** — configurable rules (timing, efficiency, anesthesia, recovery categories)
- **`delay_types` table** — user-reportable delay categories
- **`flagEngine.ts`** — batch flag evaluation engine (auto-detection at case completion)
- **`FlagsSummaryCard.tsx`** — compact summary card on the analytics hub (proven query pattern)

The current `/analytics/flags` page was a copy-paste mistake — it shows the general analytics overview (FCOTS, OR Utilization, turnovers, charts) with just the title changed to "Case Flags." The KPI page at `/analytics/kpi` already covers that content.

The design spec at `docs/case-flags-analytics-light.jsx` defines the complete page layout using mock data and Recharts.

## Key Decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Chart library | Recharts — build new page with it, then migrate all analytics pages from Tremor |
| 2 | Pattern insights | Computed from real flag data (day spikes, cascades, trends, concentrations) |
| 3 | Heatmap categories | Map by `flag_rules.category` → FCOTS / Timing / Turnover / Delay buckets |
| 4 | Row click behavior | Drill-through slide-over panels (surgeon detail, case detail, room detail) |
| 5 | Current flags page | Full replace — was a copy/paste mistake |
| 6 | KPI card pattern | Custom `FlagKPICard` component matching design spec |
| 7 | Migration scope | Same branch, split by page (one phase per page) |
| 8 | Branch | `feature/flags-analytics-recharts-migration` |

## Affected Systems

### Database (read-only — no migrations needed)
- `case_flags` — main data source (threshold + delay flags)
- `flag_rules` — rule names, categories, severity
- `delay_types` — delay type display names
- `cases` — case metadata (date, surgeon, room, procedure)
- `users` (surgeons) — surgeon names for flag distribution
- `or_rooms` — room names for room analysis

### Web App — New Files
- `types/flag-analytics.ts` — TypeScript interfaces
- `lib/hooks/useFlagAnalytics.ts` — data fetching hook
- `lib/flagPatternDetection.ts` — pattern detection engine
- `components/analytics/flags/FlagKPICard.tsx` — custom KPI cards with sparklines
- `components/analytics/flags/SeverityStrip.tsx` — proportional severity strip
- `components/analytics/flags/FlagTrendChart.tsx` — Recharts stacked area chart
- `components/analytics/flags/DayHeatmap.tsx` — CSS grid heatmap
- `components/analytics/flags/HorizontalBarList.tsx` — reusable bar breakdown
- `components/analytics/flags/SurgeonFlagTable.tsx` — surgeon flag distribution table
- `components/analytics/flags/RoomAnalysisCards.tsx` — room analysis cards
- `components/analytics/flags/PatternInsightCards.tsx` — pattern insight cards
- `components/analytics/flags/RecentFlaggedCases.tsx` — recent flagged cases list
- `components/analytics/flags/FlagDrillThrough.tsx` — slide-over drill-through panels

### Web App — Modified Files
- `app/analytics/flags/page.tsx` — full replace
- `app/analytics/page.tsx` — Tremor → Recharts migration
- `app/analytics/surgeons/page.tsx` — Tremor → Recharts migration
- `app/analytics/block-utilization/page.tsx` — Tremor → Recharts migration
- `lib/analyticsV2.ts` — remove Tremor `Color` type import
- `package.json` — remove `@tremor/react`

---

## Phase 1: Data Layer — Hook + Query Infrastructure (Medium)

**Goal:** Create the `useFlagAnalytics` hook and TypeScript interfaces that power the entire page.

### 1.1 — TypeScript interfaces

**File:** `types/flag-analytics.ts`

Define interfaces for:
- `FlagAnalyticsData` — top-level shape returned by the hook
- `FlagSummaryKPIs` — totalCases, flaggedCases, flagRate, flagRateTrend, delayedCases, delayRate, delayRateTrend, criticalCount, warningCount, infoCount, totalFlags, avgFlagsPerCase
- `FlagRuleBreakdownItem` — name, count, severity, pct
- `DelayTypeBreakdownItem` — name, count, pct, avgDuration, color
- `WeeklyTrendPoint` — week label, threshold count, delay count, total
- `DayOfWeekRow` — day, fcots, timing, turnover, delay, total
- `SurgeonFlagRow` — name, surgeonId, cases, flags, rate, trend, topFlag
- `RoomFlagRow` — room, roomId, cases, flags, rate, topIssue, topDelay
- `RecentFlaggedCase` — caseNum, caseId, date, surgeon, procedure, flags[]
- `DetectedPattern` — type, title, desc, severity, metric

### 1.2 — Data fetching hook

**File:** `lib/hooks/useFlagAnalytics.ts`

- Use `useSupabaseQuery` to fetch `case_flags` with joins to `flag_rules`, `delay_types`, and `cases` (including surgeon + room + procedure joins)
- Accept `facilityId` and date range params
- Compute all aggregate stats client-side from the raw flags:
  - KPI values (flag rate, delay rate, severity counts)
  - Sparkline data (12-week rolling flag rate)
  - Flag rule breakdown (group by `flag_rule.name`, count, sort desc)
  - Delay type breakdown (group by `delay_type.display_name`, count, avg duration)
  - Weekly trend (group by ISO week, split threshold vs delay)
  - Day-of-week heatmap (group by `scheduled_date` day, categorize by `flag_rules.category`)
  - Surgeon rollup (group by `surgeon_id`, compute flag rate, trend, top flag)
  - Room rollup (group by `or_room_id`, compute flag rate, top issue/delay)
  - Recent flagged cases (dedupe by case, sort by date desc, take 5)
- Also fetch total case count for the period (for flag rate denominator)
- Fetch previous period flag data for trend comparison
- Return typed `FlagAnalyticsData` object

### Phase 1 Commit
`feat(analytics): phase 1 - flag analytics data layer and hook`

### Phase 1 Test Gate
1. **Unit:** Hook returns correctly typed data, handles loading/error/empty states, computations are accurate for known inputs
2. **Integration:** Query returns real data from `case_flags` with all joins populated
3. **Workflow:** Hook responds to date range changes and facility scoping correctly

---

## Phase 2: Page Shell + KPI Strip + Severity Strip (Medium)

**Goal:** Replace the entire `analytics/flags/page.tsx` with the new page skeleton. Build custom KPI cards and severity strip.

### 2.1 — Page skeleton

**File:** `app/analytics/flags/page.tsx` (full replace)

- Standard analytics page pattern: `DashboardLayout`, `AnalyticsPageHeader`, `DateRangeSelector`
- Permission guard: `can('analytics.view')`
- `useUser()` for facility scoping, `useFlagAnalytics()` for data
- Loading skeleton
- Content layout: `space-y-8` sections

### 2.2 — Custom FlagKPICard component

**File:** `components/analytics/flags/FlagKPICard.tsx`

- Match design spec: status dot, uppercase label, large monospace value + unit, sparkline (Recharts mini AreaChart), trend badge, detail text
- Props: `label, value, unit?, trend?, trendInverse?, sparkData?, sparkColor?, status?, detail?`
- Inline MiniSparkline using Recharts `AreaChart` + `Area` (no axes, gradient fill)
- TrendBadge sub-component: directional arrow + percentage + color based on good/bad

### 2.3 — Severity strip

**File:** `components/analytics/flags/SeverityStrip.tsx`

- Proportional flex strip showing critical/warning/info with counts and percentages
- Each segment uses severity-appropriate bg/border/text colors
- Flex basis proportional to count

### 2.4 — Wire into page

- 4 KPI cards in `grid-cols-4`: Flagged Cases (%), Delay Rate (%), Critical Flags (count), Total Flags (count)
- Severity strip below KPIs

### Phase 2 Commit
`feat(analytics): phase 2 - flags page shell, KPI cards, severity strip`

### Phase 2 Test Gate
1. **Unit:** KPI cards render correct values, trend badges, sparklines; severity strip proportions are accurate
2. **Integration:** Page loads with real data, date filtering updates KPIs
3. **Workflow:** Navigate from analytics hub → flags page → KPIs populated with real numbers

---

## Phase 3: Charts — Flag Trend + Day-of-Week Heatmap (Medium)

**Goal:** Build the flag trend stacked area chart and the day-of-week category heatmap.

### 3.1 — Flag trend chart

**File:** `components/analytics/flags/FlagTrendChart.tsx`

- Recharts `AreaChart` inside `ResponsiveContainer`
- Stacked areas: "Auto-detected" (violet) + "User-reported" (orange)
- Linear gradient fills, custom tooltip, legend
- X-axis: week labels, Y-axis: flag count
- Data from `useFlagAnalytics().weeklyTrend`

### 3.2 — Day-of-week heatmap

**File:** `components/analytics/flags/DayHeatmap.tsx`

- Custom CSS grid (not chart library)
- Rows: FCOTS, Timing, Turnover, Delays + Total row
- Columns: Mon–Fri
- Cell background intensity based on value relative to max
- Category colors: rose (FCOTS), amber (Timing), violet (Turnover), orange (Delays)

### 3.3 — Wire into page

- Two-column grid: trend chart (left) + heatmap (right)
- Both wrapped in Card components with SectionHeader

### Phase 3 Commit
`feat(analytics): phase 3 - flag trend chart and day-of-week heatmap`

### Phase 3 Test Gate
1. **Unit:** Chart renders with mock data, handles empty/single-week edge cases; heatmap renders all 5 days
2. **Integration:** Charts populate from real flag data grouped by week/day
3. **Workflow:** Change date range → both charts update; hover tooltip shows correct values

---

## Phase 4: Breakdowns + Surgeon Table + Room Cards (Large)

**Goal:** Build the flag rule breakdown, delay type breakdown, surgeon flag distribution table, and room analysis cards.

### 4.1 — Horizontal bar list

**File:** `components/analytics/flags/HorizontalBarList.tsx`

- Reusable for both flag rule and delay type breakdowns
- Props: `items[]` with `name, count, pct, severity?, color?, avgDuration?`
- Each row: dot, name, count (monospace), percentage, thin progress bar

### 4.2 — Flag rule & delay type sections

- Two-column grid: Auto-detected flags (left) + Reported delays (right)
- Both use `HorizontalBarList` with different data

### 4.3 — Surgeon flag distribution table

**File:** `components/analytics/flags/SurgeonFlagTable.tsx`

- Plain `<table>` — dataset is small
- Columns: Surgeon, Cases, Flags, Flag Rate (color-coded), Trend, Top Flag
- Hover highlighting, click → triggers drill-through (Phase 5)

### 4.4 — Room analysis cards

**File:** `components/analytics/flags/RoomAnalysisCards.tsx`

- Grid of cards (one per room), responsive columns
- Each card: room name, flag rate badge, progress bar, counts, top flag, top delay
- Click → triggers drill-through (Phase 5)

### Phase 4 Commit
`feat(analytics): phase 4 - flag breakdowns, surgeon table, room analysis`

### Phase 4 Test Gate
1. **Unit:** Bar lists render sorted data; surgeon table renders; room cards show correct color thresholds
2. **Integration:** Breakdowns show real flag rule names and delay type display_names from DB
3. **Workflow:** Surgeon table flag rates match KPI totals; room percentages are consistent

---

## Phase 5: Pattern Insights + Recent Cases + Drill-Through (Large)

**Goal:** Build computed pattern detection, recent flagged cases list, and drill-through slide-over panels.

### 5.1 — Pattern detection engine

**File:** `lib/flagPatternDetection.ts`

Detects patterns from raw flag analytics data:
- **Day-of-week spike:** Any day >50% more flags than daily average
- **Equipment cascade:** Delay flags correlating with subsequent threshold flags in same room/day
- **Trend improvement:** Flag category declining >20% over recent 4 weeks
- **Trend deterioration:** Flag category increasing >20%
- **Room concentration:** Room with >35% of flags but <30% of cases
- **Recurring surgeon pattern:** Surgeon flag rate >2x facility average

Returns `DetectedPattern[]` sorted by severity.

### 5.2 — Pattern insight cards

**File:** `components/analytics/flags/PatternInsightCards.tsx`

- 2-column grid of pattern cards
- Each: left color border, icon, title, metric badge, description
- Severity colors: critical → rose, warning → amber, good → emerald

### 5.3 — Recent flagged cases

**File:** `components/analytics/flags/RecentFlaggedCases.tsx`

- Card with header + "View All →" button (links to `/cases`)
- Row per case: case number, date, surgeon, procedure, flag badges
- Flag badges: severity-colored with icon (⚡ threshold, ◷ delay)

### 5.4 — Drill-through slide-over

**File:** `components/analytics/flags/FlagDrillThrough.tsx`

- Radix Dialog slide-over (640px, right) — matches InsightSlideOver pattern
- Three modes: surgeon detail, room detail, case detail
- Each shows all flags for that entity, grouped and sorted

### Phase 5 Commit
`feat(analytics): phase 5 - pattern detection, recent cases, drill-through panels`

### Phase 5 Test Gate
1. **Unit:** Pattern detection identifies day spikes, trends, room concentrations correctly; handles edge cases
2. **Integration:** Patterns render from real data; drill-through shows correct detail
3. **Workflow:** Click surgeon → slide-over → close → click case → slide-over → page state preserved

---

## Phase 6: Tremor → Recharts — Analytics Hub (Small)

**Goal:** Migrate `app/analytics/page.tsx` from `@tremor/react` to Recharts.

### What to migrate
- `AreaChart` → Recharts `AreaChart` + `ResponsiveContainer` + `Area` + axes + tooltip
- `Legend` → Recharts `Legend` or custom legend div
- Remove `type Color` import

### Files touched
- MODIFY: `app/analytics/page.tsx`

### Phase 6 Commit
`refactor(analytics): phase 6 - migrate hub page from Tremor to Recharts`

### Phase 6 Test Gate
1. **Unit:** Charts render with same data shapes, no TS errors
2. **Integration:** Hub page loads and displays all charts correctly
3. **Workflow:** Visual check — charts look equivalent

**Complexity:** Small

---

## Phase 7: Tremor → Recharts — Surgeons Page (Small)

**Goal:** Migrate `app/analytics/surgeons/page.tsx` from `@tremor/react` to Recharts.

### What to migrate
- `AreaChart` → Recharts equivalents
- `BarChart` → Recharts equivalents

### Files touched
- MODIFY: `app/analytics/surgeons/page.tsx`

### Phase 7 Commit
`refactor(analytics): phase 7 - migrate surgeons page from Tremor to Recharts`

### Phase 7 Test Gate
1. **Unit:** Charts render with same data shapes
2. **Integration:** Page loads with all visualizations
3. **Workflow:** Visual regression check

**Complexity:** Small

---

## Phase 8: Tremor → Recharts — Block Utilization Page (Small)

**Goal:** Migrate `app/analytics/block-utilization/page.tsx` from `@tremor/react` to Recharts.

### What to migrate
- `AreaChart` → Recharts equivalents
- `BarChart` → Recharts equivalents

### Files touched
- MODIFY: `app/analytics/block-utilization/page.tsx`

### Phase 8 Commit
`refactor(analytics): phase 8 - migrate block-utilization page from Tremor to Recharts`

### Phase 8 Test Gate
1. **Unit:** Charts render with same data shapes
2. **Integration:** Page loads with all visualizations
3. **Workflow:** Visual regression check

**Complexity:** Small

---

## Phase 9: Remove @tremor/react Dependency (Small)

**Goal:** Remove `@tremor/react` from the project entirely.

### What to do
- Remove `@tremor/react` from `package.json`
- Update `lib/analyticsV2.ts`: replace `import { type Color } from '@tremor/react'` with local type
- Grep for any remaining `@tremor` references
- Run `npm install` to update lockfile
- Verify `npm run build` succeeds

### Files touched
- MODIFY: `package.json`
- MODIFY: `lib/analyticsV2.ts`

### Phase 9 Commit
`chore: phase 9 - remove @tremor/react dependency`

### Phase 9 Test Gate
1. **Unit:** `npx tsc --noEmit` — clean compile, no Tremor references
2. **Integration:** `npm run build` succeeds
3. **Workflow:** All analytics pages render correctly

**Complexity:** Small

---

## Phase Dependency Chain
```
Phase 1 (data layer) → Phase 2 (page + KPIs) → Phase 3 (charts)
                                               → Phase 4 (tables)
                                               → Phase 5 (patterns + drill-through)
Phase 6–8 (Tremor migration — independent of each other and of 1–5)
Phase 6 + 7 + 8 → Phase 9 (remove Tremor)
```
