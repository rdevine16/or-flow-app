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

---

## Review Q&A

> Generated by /review on 2026-02-19

**Q1:** The heatmap categories in the design spec (FCOTS / Timing / Turnover / Delays) don't match the DB's flag_rules.category values (timing / efficiency / anesthesia / recovery). How should we map flag data to heatmap rows?
**A1:** Map by metric, not category. FCOTS row = metric 'fcots_delay'. Timing row = metrics 'total_case_time', 'surgical_time', 'pre_op_time'. Turnover row = metric 'turnover_time'. Delays row = all flag_type='delay' flags. This matches what users actually care about regardless of how flag_rules.category is set.

**Q2:** Which sparkline approach should the new FlagKPICard use for its inline mini-charts?
**A2:** Reuse existing SVG Sparkline from `components/ui/Sparkline.tsx`. Zero extra dependencies, already handles edge cases, consistent with KPI page.

**Q3:** Should the useFlagAnalytics hook filter by cases.scheduled_date (consistent with other analytics pages) or by case_flags.created_at (consistent with FlagsSummaryCard)?
**A3:** Filter by `cases.scheduled_date`. Consistent with all other analytics pages. When a user selects a date range, they see flags for cases scheduled in that window.

**Q4:** Are you comfortable with the all-client-side computation approach, or should we consider an RPC/view for heavy aggregation?
**A4:** Create a Supabase RPC for aggregation. Build a PostgreSQL function that returns pre-aggregated data in one call.

**Q5:** For the Supabase RPC approach, should it return a single comprehensive JSON blob covering all aggregation dimensions, or should we split into multiple focused RPCs?
**A5:** Single comprehensive RPC. One call like `get_flag_analytics(facility_id, start_date, end_date)` returns a JSON object with all aggregation dimensions. One round-trip, one function to maintain.

**Q6:** Should the RPC handle previous-period comparison internally or should the hook call the same RPC twice?
**A6:** RPC handles both periods internally. Accepts `(facility_id, start_date, end_date)` and internally computes the equivalent previous period. Returns KPI values with deltas already calculated.

**Q7:** Should pattern detection stay client-side in TypeScript or should the RPC also compute detected patterns?
**A7:** Client-side TypeScript. The RPC returns aggregated data; a separate `flagPatternDetection.ts` module applies heuristic rules. Easier to iterate on thresholds, testable in isolation, no migration needed when tweaking rules.

**Q8:** For the 'case detail' drill-through from the Recent Flagged Cases list, should it open a new flags-specific panel, or reuse the existing CaseDrawer?
**A8:** Navigate to `/cases` with drawer. Clicking a recent flagged case navigates to the existing case page which has a Flags tab. No new component needed for case drill-through. Surgeon and room drill-throughs still get custom panels.

**Q9:** Should the new flags analytics page use the compound CardEnhanced + SectionHeader pattern, or simpler Card.tsx?
**A9:** Use CardEnhanced + SectionHeader from AnalyticsComponents.tsx. Consistent with the surgeons and block-utilization pages.

**Q10:** Should the flags analytics page persist the selected date range in URL search params?
**A10:** Yes, use URL search params (e.g., `?range=last_30&start=2026-01-20&end=2026-02-19`). Enables bookmarking and sharing links.

**Q11:** When a facility has zero flags for the selected date range, what should the page show?
**A11:** Full empty state with message. Show KPI cards with zeroed values (0%, 0 flags) plus a centered EmptyState component below saying "No flags detected for this period." Charts and tables are hidden.

**Q12:** Where should the 'View All' button on the Recent Flagged Cases section navigate to?
**A12:** Expand inline to show full list. Instead of navigating away, toggle to show all flagged cases for the period in a scrollable list on the same page. Initially show 5 cases, expand to show all on click.

**Q13:** When a user clicks a surgeon row to open the drill-through panel, what level of detail should it show?
**A13:** Summary stats + flagged case list. Show surgeon name, total cases, flagged cases, flag rate, top flags, plus a list of their recent flagged cases (case number, date, flag badges). Case clicks navigate to `/cases`.

**Q14:** For the Tremor migration phases (6-8), should these be one phase per page or collapsed?
**A14:** Keep one phase per page as planned. Safer — each page gets its own commit, test gate, and rollback point.

**Q15:** What default date range should the flags analytics page load with?
**A15:** Last 30 days. Consistent with all other analytics pages.

**Q16:** Should the RPC return all flagged cases upfront (enabling instant expand), or return just the top 5?
**A16:** Return all upfront. The UI initially shows 5, toggles to show all. For 30 days this is likely <100 rows — minimal payload overhead.

**Q17:** Should the flags analytics page define its chart colors in design-tokens.ts or inline per component?
**A17:** Constants in `design-tokens.ts`. Add a `flagChartColors` object with named keys: autoDetected, delays, critical, warning, info, fcots, timing, turnover. Centralized, easy to adjust.

**Q18:** Should Phase 1 be split into two sub-phases (1a: migration/RPC, 1b: hook + types)?
**A18:** Yes, split into Phase 1a (migration + RPC function + db push) and Phase 1b (TypeScript types + hook). Two commits, two test gates. More granular rollback.

**Q19:** Should FlagsSummaryCard on the hub page be updated to consume the new RPC?
**A19:** Yes, update to use new RPC + fix heroicons→lucide-react. Part of the hub page migration phase.

**Q20:** Should loading states use existing skeleton components or page-specific skeletons?
**A20:** Build page-specific skeletons that mirror the exact page structure for a polished loading experience.

**Q21:** Should the RPC filter out is_excluded_from_metrics and is_draft cases?
**A21:** Yes, filter both out in the RPC. `cases.is_excluded_from_metrics = false AND cases.is_draft = false`. Consistent with all other analytics queries.

**Q22:** How much responsive behavior should the flags analytics page support?
**A22:** Desktop-optimized with basic responsive. 4-col KPI grid → 2-col on tablet. Charts stack vertically on smaller screens. Tables get horizontal scroll. Not optimized for phone.

**Q23:** Should the surgeon flag table support column sorting?
**A23:** Yes, client-side sortable columns. Clickable column headers that sort by cases, flags, flag rate, or trend. Simple useState for sort state.

**Q24:** For the hub page Tremor migration, should the DonutChart be replaced with a Recharts PieChart?
**A24:** Yes, Recharts PieChart with innerRadius. Direct 1:1 replacement creating the same donut shape.

**Q25:** How should room analysis cards handle facilities with many rooms (8+)?
**A25:** Show all rooms in a responsive grid (2-col tablet, 3-col desktop, 4-col wide). Sorted by flag rate descending. No truncation.

**Q26:** Should the flags analytics page have data export capability?
**A26:** No export for now. Reduces scope. Can be added later if users request it.

**Q27:** Should the RPC include flags from all case statuses, or only completed cases?
**A27:** Only completed cases. Filter to cases where `case_statuses.name = 'completed'`.

**Q28:** Should the weekly trend chart match the selected date range or always show 12 weeks?
**A28:** Match selected date range. If user selects 30 days, show ~4-5 weekly data points. Consistent with how the date selector works everywhere else.

**Q29:** Should the flag analytics RPC require cases.data_validated = true?
**A29:** Yes, require `data_validated = true`. Consistent with milestone median calculations and ensures data quality.

**Q30:** Should pattern detection thresholds be hardcoded or configurable per-facility?
**A30:** Configurable per-facility via the Case Flags settings page. Add a new phase to this feature that adds settings columns, migration, settings UI, and wires pattern detection to read from config.

**Q31:** Where should the configurable pattern thresholds phase go in the plan?
**A31:** After Phase 5 (pattern detection), before Tremor migration. Build patterns with hardcoded constants first, then make configurable. Tremor migration phases shift down.

**Q32:** Should the analyticsV2.ts Color type migration happen during hub page migration or the remove-Tremor phase?
**A32:** In the remove-Tremor phase. Replace the Color type import with a local type definition alongside removing @tremor/react from package.json.

**Q33:** What width should the FlagDrillThrough slide-over use?
**A33:** 640px, matching InsightSlideOver. Follows the analytics page slide-over pattern.

---

## Key Changes from Original Spec (Based on Review)

1. **Data layer changed from client-side to RPC.** Phase 1 splits into 1a (migration/RPC) and 1b (types/hook). The spec's "no migrations needed" changes — we need a migration for the `get_flag_analytics` RPC function.
2. **Heatmap maps by metric, not category.** The original spec referenced `flag_rules.category` for heatmap rows, but actual categories (timing/efficiency/anesthesia/recovery) don't match the desired rows (FCOTS/Timing/Turnover/Delays). Mapping by `flag_rules.metric` instead.
3. **Date filtering by `cases.scheduled_date`**, not `case_flags.created_at`. Consistent with other analytics pages.
4. **Only completed + validated cases** included in analytics. `data_validated = true` required.
5. **Case drill-through navigates to `/cases`** instead of a custom panel. FlagDrillThrough has 2 modes (surgeon, room), not 3.
6. **URL search params** for date range persistence (new pattern for analytics pages).
7. **"View All" expands inline** instead of navigating to `/cases`.
8. **New Phase 6: Configurable pattern detection thresholds** via Case Flags settings page. Pattern detection initially built with hardcoded constants (Phase 5), then made configurable (Phase 6).
9. **FlagsSummaryCard updated** to use new RPC + heroicons→lucide-react migration (part of hub page Tremor migration).
10. **Page-specific loading skeletons** instead of reusing generic skeletons.
11. **Client-side sortable surgeon table** instead of fixed sort order.
12. **Total phases: 11** (was 9). Phase 1 splits into 1a/1b, new Phase 6 for settings.
13. **Chart colors centralized** in `design-tokens.ts` as `flagChartColors`.
14. **Sparkline uses existing SVG `Sparkline` component**, not Recharts mini AreaChart.
