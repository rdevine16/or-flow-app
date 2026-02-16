# Implementation Plan: Case Drawer Revamp — Milestones & Financials

> **Feature branch:** `feature/drawer-milestones-financials-revamp`
> **Prerequisite:** Detail drawer shell, tab system, and Overview tab from the Cases Page Revamp must be in place.
> **Reference:** HST Pathways Case Overview (profit analysis layout), ORbit existing analytics engine

---

## Context & Goals

The current drawer spec (from the original Cases Page Revamp) defined a basic milestone list and a projected-vs-actual financials layout. This plan upgrades both tabs to enterprise-grade with:

1. **Milestones Tab** — Horizontal swimlane timeline, surgeon/facility median benchmarking with MAD-aware delta coloring, "Where did the time go?" stacked allocation bar, missing milestone alerts, and a comparison mode toggle.
2. **Financials Tab** — HST Pathways-inspired hero metrics row (margin ring, profit with ORbit Score badge, revenue, costs) with contextual benchmarking, projected-vs-actual two-column layout for completed cases, cost breakdown table replacing the generic bar chart, and full-day surgeon aggregation.

Both tabs leverage ORbit's existing analytics engine (median calculations, MAD scoring, `case_completion_stats`, cost items) — no new database tables required, only new queries and potentially one new database function for milestone median aggregation.

---

## Phase 1: Milestone Data Layer & Hooks

**Goal:** Build the data-fetching and calculation layer for enhanced milestone analytics. Pure logic — no UI yet.

### Files to Create

- `lib/hooks/useMilestoneComparison.ts` — Fetches surgeon + facility milestone medians for a given procedure type
- `lib/utils/milestoneAnalytics.ts` — Pure functions for delta calculations, time allocation, swimlane positioning
- `lib/types/milestoneAnalytics.ts` — TypeScript interfaces for milestone comparison data

### Steps

1. **Define interfaces** in `milestoneAnalytics.ts`:
   ```
   MilestoneInterval {
     milestone_name: string
     milestone_id: string
     recorded_at: string | null
     interval_minutes: number | null        // time since previous milestone
     surgeon_median_minutes: number | null   // surgeon's median for this interval
     facility_median_minutes: number | null  // facility median for this interval
     delta_from_surgeon: number | null       // actual - surgeon median
     delta_from_facility: number | null      // actual - facility median
     delta_severity: 'faster' | 'on-pace' | 'slower' | 'critical' | null
   }

   TimeAllocation {
     label: string           // "Pre-Op", "Surgical", "Closing", "Idle/Gap"
     minutes: number
     percentage: number
     color: string           // tailwind color token
   }

   MilestoneComparisonData {
     intervals: MilestoneInterval[]
     time_allocation: TimeAllocation[]
     missing_milestones: string[]          // names of unrecorded milestones
     total_case_minutes: number | null
     total_surgical_minutes: number | null
     comparison_source: 'surgeon' | 'facility'  // which benchmark is active
   }
   ```

2. **Build `useMilestoneComparison` hook:**
   - Inputs: `caseId`, `surgeonId`, `procedureTypeId`, `facilityId`
   - Fetches this case's `case_milestones` with `recorded_at` timestamps
   - Fetches the surgeon's milestone interval medians for this procedure type from `case_milestones` across historical cases (query: join `case_milestones` → `cases` where `surgeon_id` matches, `procedure_type_id` matches, `status = completed`, `data_validated = true`, grouped by milestone pair, `PERCENTILE_CONT(0.5)` on interval)
   - Fetches facility-level milestone interval medians (same query but without surgeon filter)
   - Returns `MilestoneComparisonData`
   - Consider: If the query is too complex for a single hook, create a Supabase database function `get_milestone_medians(surgeon_id, procedure_type_id, facility_id)` that returns pre-computed medians in one round trip

3. **Build pure calculation functions** in `milestoneAnalytics.ts`:
   - `calculateIntervals(milestones, surgeonMedians, facilityMedians)` → `MilestoneInterval[]`
   - `calculateDeltaSeverity(actual, median)` → Uses MAD-aware thresholds: within 0.5 MAD = 'on-pace', faster = 'faster', 0.5-1.5 MAD over = 'slower', >1.5 MAD = 'critical'
   - `calculateTimeAllocation(milestones, procedureConfig)` → `TimeAllocation[]` — buckets milestone intervals into Pre-Op, Surgical, Closing, and Idle/Gap categories based on `procedure_milestone_config` groupings
   - `identifyMissingMilestones(caseMilestones, expectedMilestones)` → `string[]`
   - `calculateSwimlaneSections(intervals, totalMinutes)` → Proportional widths for horizontal timeline rendering

4. **Write unit tests** for all pure functions:
   - Standard complete case (all milestones recorded)
   - Partial case (some milestones missing)
   - Edge case: only 1 historical case for surgeon (small cohort → wider MAD bands)
   - Edge case: zero facility median data
   - Edge case: milestones recorded out of order

### Acceptance

- [ ] `useMilestoneComparison` returns correct intervals with deltas
- [ ] Surgeon and facility medians calculated using MEDIAN (not average)
- [ ] MAD-aware severity thresholds working correctly
- [ ] Time allocation buckets sum to total case duration
- [ ] Missing milestones correctly identified
- [ ] All unit tests pass
- [ ] No TypeScript `any` types
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Phase 2: Milestones Tab — Swimlane Timeline & Benchmarking UI

**Goal:** Build the visual milestone tab with horizontal timeline, delta badges, and comparison toggle.

### Files to Create

- `components/cases/CaseDrawerMilestones.tsx` — Main milestones tab container
- `components/cases/MilestoneTimeline.tsx` — Horizontal swimlane timeline component
- `components/cases/MilestoneDetailRow.tsx` — Individual milestone row with comparison data
- `components/cases/TimeAllocationBar.tsx` — Stacked horizontal bar ("Where did the time go?")
- `components/cases/MilestoneComparisonToggle.tsx` — Toggle between surgeon/facility/previous case
- `components/ui/DeltaBadge.tsx` — Reusable colored delta indicator ("+9 min" in red, "-3 min" in green)

### Files to Modify

- `components/cases/CaseDrawer.tsx` — Wire milestones tab to new component

### Steps

1. **Build `MilestoneTimeline` (the hero component):**
   - Horizontal bar proportional to total case time
   - Each milestone is a node on the bar with connecting segments
   - Segment width = proportional to interval duration relative to total
   - Node states:
     - **Recorded:** Solid circle, teal fill, timestamp label above, interval below
     - **In-progress (current):** Pulsing blue ring with elapsed timer
     - **Pending:** Hollow gray circle, "Pending" label
     - **Missing (case complete but unrecorded):** Amber triangle with "!" icon
   - Hover on any segment highlights it and shows a tooltip: "Incision → Close: 47 min (Surgeon median: 38 min)"
   - Below the timeline: surgeon median overlay as a subtle dashed line showing where each milestone "should" have been
   - Responsive: if drawer is narrow, collapse to a vertical condensed view

2. **Build `MilestoneDetailRow`:**
   - Each milestone shows: name, timestamp (or "Not recorded"), interval from previous
   - Comparison columns (shown based on toggle): surgeon median, facility median, delta
   - `DeltaBadge` component for the delta: green pill for faster, amber for on-pace, red for slower, dark red for critical
   - Format: "+9 min" / "-3 min" / "on pace"
   - Click row → expands to show: "Based on 23 cases from Dr. Kim" or "Based on 156 facility cases"
   - For missing milestones: row has amber background tint with "Not Recorded" badge

3. **Build `TimeAllocationBar` ("Where did the time go?"):**
   - Horizontal stacked bar, full width
   - Segments: Pre-Op (blue), Surgical (teal), Closing (indigo), Idle/Gap (gray)
   - Each segment labeled with category name + minutes + percentage
   - Below the bar: one-line insight, e.g. "Closing took 34% of total case time — facility median is 18%"
   - Only shown for completed cases with sufficient milestone data

4. **Build `MilestoneComparisonToggle`:**
   - Small segmented control at top-right of tab: "Surgeon Median" | "Facility Median" | "Previous Case"
   - Switching updates all delta values and colors throughout the tab
   - "Previous Case" fetches the same surgeon's most recent completed case of the same procedure type
   - Default: Surgeon Median
   - Show cohort size next to label: "Surgeon Median (23 cases)"

5. **Build missing milestone alert banner:**
   - If case is completed and milestones are missing, show at top of tab:
   - Amber background, warning icon
   - "2 milestones not recorded: Closing, Patient Out"
   - Links to validation workflow

6. **Build summary row at bottom of milestone list:**
   - Total Case Time | Surgical Time | Pre-Op Time | Closing Time
   - Each with delta badge comparing to the active comparison source
   - Styled as a footer row with subtle top border

7. **Wire into `CaseDrawer`** — Replace placeholder milestones tab content with `CaseDrawerMilestones`

8. **Run 3-stage test gate**

### Acceptance

- [ ] Horizontal swimlane renders proportional segments for all recorded milestones
- [ ] Node states (recorded, in-progress, pending, missing) visually distinct
- [ ] Hover tooltips show interval + comparison on timeline segments
- [ ] Comparison toggle switches between surgeon/facility/previous case
- [ ] Delta badges color-coded correctly using MAD thresholds
- [ ] Time allocation bar renders with correct proportions and insight text
- [ ] Missing milestone alert banner appears for incomplete cases
- [ ] Summary footer row shows aggregate durations with deltas
- [ ] Responsive layout degrades gracefully in narrow drawer
- [ ] Loading skeleton shown while data fetches
- [ ] Empty state for cases with zero milestones recorded
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Phase 3: Financials Data Layer & Hooks

**Goal:** Build the data-fetching and projection layer for enhanced financial analytics. Extends the existing `useCaseFinancialProjection` hook.

### Files to Create

- `lib/hooks/useFinancialComparison.ts` — Extends projection hook with benchmarking
- `lib/utils/financialAnalytics.ts` — Pure functions for cost breakdowns, margin scoring, full-day aggregation
- `lib/types/financialAnalytics.ts` — TypeScript interfaces

### Files to Modify

- `lib/hooks/useCaseFinancialProjection.ts` — Extend or refactor to support new data requirements

### Steps

1. **Define interfaces** in `financialAnalytics.ts`:
   ```
   FinancialHeroMetrics {
     margin_percentage: number
     margin_rating: 'excellent' | 'good' | 'fair' | 'poor'   // from ORbit Score
     profit: number
     revenue: number
     total_costs: number
     surgeon_median_margin: number | null
     facility_median_margin: number | null
   }

   CostBreakdownItem {
     category: string              // "OR Time", "Implants", "Supplies", "Anesthesia", etc.
     amount: number
     percentage_of_total: number
     source: 'actual' | 'projected'
   }

   ProjectedVsActual {
     line_item: string
     projected: number | null
     actual: number | null
     delta: number | null
     delta_favorable: boolean | null  // true = actual is better than projected
   }

   FullDaySurgeonForecast {
     surgeon_name: string
     surgeon_id: string
     cases: {
       case_id: string
       case_number: string
       procedure_name: string
       status: string
       profit: number | null
       margin: number | null
     }[]
     total_revenue: number
     total_costs: number
     total_profit: number
     total_margin: number
   }

   CaseFinancialData {
     hero: FinancialHeroMetrics
     cost_breakdown: CostBreakdownItem[]
     projected_vs_actual: ProjectedVsActual[] | null  // null for scheduled cases
     full_day_forecast: FullDaySurgeonForecast | null
     data_quality: {
       has_costs: boolean
       has_revenue: boolean
       cost_source: string          // "actual" | "procedure_defaults" | "surgeon_overrides"
       confidence: 'high' | 'medium' | 'low'
     }
   }
   ```

2. **Build `useFinancialComparison` hook:**
   - Inputs: `caseId`, `surgeonId`, `procedureTypeId`, `facilityId`, `scheduledDate`
   - For **completed cases**: Fetch from `case_completion_stats` (actual), compute projected from surgeon median duration × OR rate + cost items
   - For **scheduled cases**: Compute projected from surgeon median duration × OR rate + cost items, with facility median as secondary benchmark
   - For **in-progress cases**: Use scheduled projection with "pending" flag
   - Fetch **surgeon median margin** for this procedure type across validated completed cases
   - Fetch **facility median margin** similarly
   - Compute **cost breakdown** from `procedure_cost_items` and `surgeon_cost_items` with effective date filtering
   - Fetch **full day forecast**: All cases for the same surgeon on the same `scheduled_date`, aggregate revenue/costs/profit
   - Handle edge cases: zero costs, missing reimbursement, no surgeon history
   - Returns `CaseFinancialData`

3. **Build pure calculation functions** in `financialAnalytics.ts`:
   - `calculateMarginRating(margin, surgeonMedian, facilityMedian)` → rating string (use ORbit Score thresholds)
   - `buildCostBreakdown(costItems, orTimeCost, caseStatus)` → `CostBreakdownItem[]`
   - `buildProjectedVsActual(projected, actual)` → `ProjectedVsActual[]`
   - `aggregateFullDayForecast(cases)` → `FullDaySurgeonForecast`
   - `formatCurrency(amount)` → Consistent "$1,234" formatting
   - `assessDataQuality(caseStats, costItems)` → confidence rating

4. **Write unit tests:**
   - Complete case with full cost data
   - Scheduled case (projection only)
   - Case with zero costs (known bug scenario)
   - Case with no reimbursement configured
   - Full day with mix of scheduled + completed cases
   - Edge: surgeon with only 1 historical case

### Acceptance

- [ ] Completed cases return both projected and actual financials
- [ ] Scheduled cases return projected financials with source labels
- [ ] Margin rating calculated using ORbit Score thresholds
- [ ] Cost breakdown sums to total costs
- [ ] Full day forecast aggregates all surgeon's cases for the day
- [ ] Data quality assessment handles zero-cost and missing-revenue cases
- [ ] All unit tests pass
- [ ] No TypeScript `any` types
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Phase 4: Financials Tab — Hero Metrics & Benchmarking UI

**Goal:** Build the visual financials tab with HST-inspired hero row, ORbit benchmarking, cost breakdown, and full-day forecast.

### Files to Create

- `components/cases/CaseDrawerFinancials.tsx` — Main financials tab container
- `components/cases/FinancialHeroRow.tsx` — Margin ring + profit + revenue + costs row
- `components/cases/MarginGauge.tsx` — Circular margin percentage gauge (reusable)
- `components/cases/CostBreakdownTable.tsx` — Categorized cost table with % of total
- `components/cases/ProjectedVsActualTable.tsx` — Two-column comparison for completed cases
- `components/cases/FullDayForecast.tsx` — Surgeon's full-day financial aggregation
- `components/ui/ProfitBadge.tsx` — ORbit Score-colored badge ("EXCELLENT", "GOOD", etc.)

### Files to Modify

- `components/cases/CaseDrawer.tsx` — Wire financials tab to new component

### Steps

1. **Build `MarginGauge` (reusable component):**
   - Circular progress ring showing margin percentage
   - Ring color derived from ORbit Score rating:
     - Excellent (≥60%): teal
     - Good (40-59%): green
     - Fair (20-39%): amber
     - Poor (<20%): red
   - Center: percentage number (large) + "Margin" label (small)
   - Size prop: `sm` (40px, for tables), `md` (64px, for hero row), `lg` (80px, for standalone)
   - Animated on mount — ring draws from 0 to value

2. **Build `FinancialHeroRow` (inspired by HST, improved with benchmarking):**
   - Layout: `[MarginGauge] [Profit + Badge] [Revenue] [Costs]`
   - Margin gauge: `md` size with margin percentage
   - Profit: dollar amount + `ProfitBadge` ("GOOD" / "EXCELLENT" etc.)
   - Below profit amount: "Surgeon median: $380" in muted text for context
   - Revenue and Costs: dollar amounts, clean typography, right-aligned
   - Below costs: "Based on Dr. Kim's median of 42 min" in muted text
   - Responsive: stack vertically if drawer narrows below 450px
   - **Key differentiator from HST:** The "GOOD" badge is backed by ORbit Score, not arbitrary — explain the basis in a tooltip

3. **Build `CostBreakdownTable` (replaces HST's bar chart):**
   - Compact table: Category | Amount | % of Total
   - Categories: OR Time Cost, Implants/Hardware, Supplies/Soft Goods, Anesthesia, Credits (negative), Other
   - Each row has a subtle horizontal bar in the background proportional to % (mini inline bar chart)
   - Sorted by amount descending
   - Footer row: Total Costs (bold)
   - For projected costs: italic text + "(projected)" label
   - For actual costs: normal text
   - Handles mixed: some categories actual, others projected, with clear visual distinction

4. **Build `ProjectedVsActualTable` (for completed cases only):**
   - Three-column layout: Line Item | Projected | Actual | Delta
   - Line items: Revenue, OR Cost, Supply Costs (Debits), Credits, **Profit** (bold separator), **Margin %** (bold)
   - Delta column: green text + ▲ for favorable, red text + ▼ for unfavorable
   - Profit and Margin rows visually emphasized (background tint, larger text)
   - Source labels below table: "Projected based on surgeon's median pace of 42 min" / "Actual from validated case data"
   - If case not validated: amber banner above table — "Case not yet validated — actuals may change"

5. **Build `FullDayForecast` (adopted from HST):**
   - Section header: "Full Day Forecast" with surgeon avatar + name
   - Compact table: Case # | Procedure | Status | Profit | Margin
   - Each row: case number is clickable (opens that case in drawer), profit colored by rating
   - For in-progress/scheduled: show projected values in italic
   - Footer: Total Revenue | Total Costs | Total Profit | Total Margin
   - This section is collapsible (collapsed by default to save space)
   - Mini `MarginGauge` (sm) next to the total margin

6. **Build status-specific layouts in `CaseDrawerFinancials`:**
   - **Scheduled:** Hero row (all projected) → Cost breakdown (projected) → Full day forecast
   - **In-Progress:** Hero row (projected) + info banner "Final financials after completion" → Cost breakdown (projected) → Full day forecast
   - **Completed + Validated:** Hero row (actual) → Projected vs Actual table → Cost breakdown (actual) → Full day forecast
   - **Completed + Not Validated:** Same as validated but with amber "Pending Validation" banner and "Validate Now" button

7. **Handle data quality edge cases:**
   - Zero costs: Show "Cost data unavailable" banner instead of 100% margin
   - No reimbursement: Show "Revenue not configured for this procedure" with link to settings
   - No surgeon history: Fall back to facility medians with note "First case for this surgeon — using facility benchmarks"
   - Low confidence: Show "Based on 2 cases — projections will improve with more data"

8. **Wire into `CaseDrawer`** — Replace placeholder financials tab content

9. **Run 3-stage test gate**

### Acceptance

- [ ] Margin gauge renders with correct percentage and color
- [ ] Hero row shows profit with ORbit Score badge and benchmark comparison
- [ ] Cost breakdown table shows categorized costs with inline percentage bars
- [ ] Projected vs Actual table renders for completed cases with color-coded deltas
- [ ] Full day forecast aggregates surgeon's daily cases correctly
- [ ] Scheduled cases show projected-only layout
- [ ] In-progress cases show projected with info banner
- [ ] Completed cases show full comparison layout
- [ ] Zero-cost cases show graceful fallback (not 100% margin)
- [ ] Missing revenue shows configuration prompt
- [ ] Loading skeletons for each section
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Phase 5: Database Optimization

**Goal:** Ensure milestone medians and financial projections perform well with real data. Create any needed database functions to avoid N+1 query patterns.

### Files to Create (Supabase migrations)

- `supabase/migrations/XXXXXX_milestone_median_function.sql`
- `supabase/migrations/XXXXXX_financial_projection_function.sql` (if needed)

### Steps

1. **Create `get_milestone_interval_medians` function:**
   ```sql
   -- Returns median intervals between consecutive milestones
   -- for a given surgeon + procedure type (and separately for facility)
   CREATE OR REPLACE FUNCTION get_milestone_interval_medians(
     p_surgeon_id UUID,
     p_procedure_type_id UUID,
     p_facility_id UUID
   ) RETURNS TABLE (
     milestone_name TEXT,
     facility_milestone_id UUID,
     surgeon_median_minutes NUMERIC,
     surgeon_case_count INTEGER,
     facility_median_minutes NUMERIC,
     facility_case_count INTEGER
   )
   ```
   - Calculates PERCENTILE_CONT(0.5) on intervals between consecutive milestones
   - Filters to `status = 'completed'` AND `data_validated = true`
   - Returns both surgeon-specific and facility-wide medians in one call
   - Includes case counts for confidence assessment

2. **Create `get_full_day_financials` function:**
   ```sql
   -- Returns all cases + financial summaries for a surgeon on a given date
   CREATE OR REPLACE FUNCTION get_full_day_financials(
     p_surgeon_id UUID,
     p_scheduled_date DATE,
     p_facility_id UUID
   ) RETURNS TABLE (
     case_id UUID,
     case_number TEXT,
     procedure_name TEXT,
     status TEXT,
     revenue NUMERIC,
     total_costs NUMERIC,
     profit NUMERIC,
     margin_pct NUMERIC
   )
   ```
   - Joins `cases` → `case_completion_stats` → `procedure_types`
   - For non-completed cases, uses projected values from cost items

3. **Add RLS policies** for both functions — ensure facility isolation

4. **Performance test:**
   - Benchmark both functions with facility data
   - Ensure < 200ms response for milestone medians
   - Ensure < 150ms for full day financials
   - Add indexes if needed: composite index on `case_milestones(facility_milestone_id, recorded_at)` if not exists

5. **Run 3-stage test gate**

### Acceptance

- [ ] `get_milestone_interval_medians` returns correct medians matching manual calculation
- [ ] `get_full_day_financials` returns all surgeon's cases for the date
- [ ] RLS policies enforce facility boundaries
- [ ] Both functions execute < 200ms with production-scale data
- [ ] Existing triggers and RLS policies not broken
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Phase 6: Polish, Accessibility & Edge Cases

**Goal:** Refine visual details, handle all edge cases gracefully, ensure accessibility compliance.

### Steps

1. **Loading states:**
   - Skeleton loaders for hero row (3 shimmer rectangles + circle)
   - Skeleton for milestone timeline (horizontal bar with placeholder nodes)
   - Skeleton for tables (row placeholders)
   - Tab-level loading: only load active tab's data, show skeleton on tab switch

2. **Empty states:**
   - Milestones: "No milestones configured for this procedure" with link to procedure settings
   - Financials: "Financial data not yet available" with context-specific help text
   - Full day forecast with only 1 case: "This is the only case scheduled for Dr. [Name] today"

3. **Accessibility:**
   - Margin gauge: `aria-label="Margin: 58 percent, rated good"`
   - Timeline nodes: `aria-label="Incision milestone, recorded at 2:15 PM, 12 minutes from previous"`
   - Delta badges: Screen reader text includes direction ("9 minutes slower than surgeon median")
   - Comparison toggle: `role="tablist"` with proper `aria-selected`
   - Color is never the only indicator — deltas also have +/- text and ▲/▼ icons
   - Keyboard navigation through timeline nodes

4. **Animations:**
   - Margin gauge ring draws on mount (0.6s ease-out)
   - Timeline segments animate in sequentially (staggered 50ms)
   - Delta badges fade in after data loads
   - Tab transitions: fade out old content, fade in new (150ms)
   - Full day forecast expand/collapse: smooth height transition

5. **Responsive behavior:**
   - Drawer at 550px: full layout
   - Drawer at 450px: hero row stacks, timeline stays horizontal but labels rotate
   - Drawer at 350px (mobile): hero metrics become 2×2 grid, timeline goes vertical

6. **Print/export-ready:**
   - Milestone and financial data should be exportable (future: PDF from drawer)
   - Ensure no CSS `position: fixed` or `overflow: hidden` on printable sections

7. **Run final 3-stage test gate**

### Acceptance

- [ ] All loading skeletons match content layout shapes
- [ ] Empty states are contextual and helpful
- [ ] Screen reader can navigate all interactive elements
- [ ] Color-blind safe: all deltas readable without color alone
- [ ] Animations smooth (60fps, no layout shifts)
- [ ] Narrow drawer widths don't break layouts
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Phase 7: Integration Testing & Data Validation

**Goal:** Verify both tabs work correctly with real production data across different case states and procedure types.

### Steps

1. **Test matrix — Milestones tab:**
   | Scenario | Expected |
   |----------|----------|
   | Completed case, all milestones recorded | Full timeline, all deltas shown |
   | Completed case, 2 milestones missing | Timeline with amber gaps, alert banner |
   | In-progress case, 5/8 milestones done | Partial timeline with pulsing current node |
   | Scheduled case, 0 milestones | "Case not started" state |
   | Surgeon's first case of this procedure | "No surgeon history" fallback to facility |
   | Procedure with only 3 milestones | Short timeline renders correctly |
   | Procedure with 12+ milestones | Timeline scrolls or compresses gracefully |

2. **Test matrix — Financials tab:**
   | Scenario | Expected |
   |----------|----------|
   | Completed + validated, full data | Projected vs Actual with all line items |
   | Completed + validated, zero costs | "Cost data unavailable" banner |
   | Completed + not validated | Amber banner + "Validate Now" button |
   | Scheduled, surgeon has history | Projection based on surgeon median |
   | Scheduled, surgeon has no history | Fallback to facility median with note |
   | Scheduled, no reimbursement configured | Revenue warning with settings link |
   | In-progress | Projected view + "pending" info banner |
   | Surgeon with 5 cases same day | Full day forecast shows all 5 |
   | Surgeon with 1 case same day | Full day section shows single case note |

3. **Cross-tab consistency:**
   - Overview tab's quick stats match Milestones tab's summary row
   - Financial hero row profit matches Financials detailed calculation
   - Progress pill in table matches milestone completion count in drawer

4. **Performance verification:**
   - Tab switch < 300ms perceived load time
   - Milestone medians query < 200ms
   - Financial projection query < 200ms
   - Full day aggregation < 150ms
   - No visible layout shift during data load

5. **Data integrity spot checks:**
   - Pick 5 completed cases, manually verify milestone intervals match raw data
   - Pick 5 cases, manually verify financial projections against known surgeon medians
   - Verify margin percentages: `(revenue - costs) / revenue * 100`
   - Verify no division-by-zero on zero-revenue cases

### Acceptance

- [ ] All test matrix scenarios pass
- [ ] Cross-tab data is consistent
- [ ] Performance meets thresholds
- [ ] Data integrity verified against manual calculations
- [ ] No console errors or warnings during testing
- [ ] Run `npm run typecheck && npm run lint && npm run test`

---

## Component Dependency Map

```
CaseDrawer
├── CaseDrawerMilestones
│   ├── MilestoneComparisonToggle
│   ├── MilestoneTimeline (hero visualization)
│   │   └── DeltaBadge (reusable)
│   ├── MilestoneDetailRow (one per milestone)
│   │   └── DeltaBadge
│   ├── TimeAllocationBar ("Where did the time go?")
│   └── Missing milestone alert banner (conditional)
│
├── CaseDrawerFinancials
│   ├── FinancialHeroRow
│   │   ├── MarginGauge (reusable, sm/md/lg)
│   │   └── ProfitBadge (reusable, ORbit Score color)
│   ├── ProjectedVsActualTable (completed cases only)
│   │   └── DeltaBadge
│   ├── CostBreakdownTable
│   └── FullDayForecast (collapsible)
│       └── MarginGauge (sm)
│
└── Shared hooks
    ├── useMilestoneComparison
    ├── useFinancialComparison
    └── useCaseFinancialProjection (existing, extended)
```

## Reusable Components Created

| Component | Location | Reuse Potential |
|-----------|----------|----------------|
| `MarginGauge` | `components/ui/` | Surgeon scorecards, facility dashboard, reports |
| `DeltaBadge` | `components/ui/` | Any comparison metric across the app |
| `ProfitBadge` | `components/ui/` | Financial tables, case lists, surgeon profiles |
| `TimeAllocationBar` | `components/cases/` | Could generalize for any segmented duration display |

---

## Out of Scope

- Editing financial data from the drawer (read-only)
- Real-time WebSocket updates for in-progress financial projections
- PDF export of individual case financials (future enhancement)
- Dark mode styling
- iOS parity (future — but pure calculation functions in `utils/` are architecture-ready for SwiftUI port)
- Custom milestone grouping configuration (uses existing `procedure_milestone_config`)

---

## iOS Parity Notes

When porting to SwiftUI:
- `milestoneAnalytics.ts` pure functions → Swift equivalents in a `MilestoneAnalytics` service
- `financialAnalytics.ts` pure functions → `FinancialAnalytics` service
- `MarginGauge` → SwiftUI `Circle` with `trim()` modifier, animated with `.animation(.easeOut)`
- `MilestoneTimeline` → `HStack` with proportional `GeometryReader` segments
- Database functions (`get_milestone_interval_medians`, `get_full_day_financials`) are shared — same Supabase calls from Swift
- Consider SwiftUI `sheet` presentation for the drawer equivalent, with `TabView` for tab switching

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Milestone Data Layer | 1-2 sessions | Existing milestone schema |
| Phase 2: Milestones Tab UI | 2-3 sessions | Phase 1 |
| Phase 3: Financials Data Layer | 1-2 sessions | Existing financial hooks |
| Phase 4: Financials Tab UI | 2-3 sessions | Phase 3 |
| Phase 5: Database Optimization | 1 session | Phases 1 & 3 |
| Phase 6: Polish & Accessibility | 1-2 sessions | Phases 2 & 4 |
| Phase 7: Integration Testing | 1 session | All phases |

**Total: ~9-14 Claude Code sessions**

> Phase 5 (database) can run in parallel with Phase 2 or Phase 4 UI work if needed.

---

## Review Q&A

> Generated by /review on 2026-02-15

**Q1:** The plan says "Files to Create" for CaseDrawerMilestones.tsx, CaseDrawerFinancials.tsx, useCaseFinancials.ts, and lib/financials.ts — but all four already exist with substantial implementations (390, 397, 232, and 263 lines respectively). Should we tear down and rebuild, or incrementally enhance?
**A1:** Incremental enhancement. Keep existing code as the base, extend with new features.

**Q2:** The plan's Phase 1 proposes a new `useMilestoneComparison` hook for per-interval surgeon/facility medians. The existing `useMilestoneComparisons` only fetches aggregate stats from materialized views. Getting per-interval medians requires a database function. Should we build client-side first or pull the DB work forward?
**A2:** Pull Phase 5 DB work into Phase 1. Build the database function first so the hook can call it from day one.

**Q3:** The plan specifies MAD-aware delta severity thresholds for milestone intervals. The existing code uses simpler ratio-based coloring (≤1.0x = green, ≤1.1x = amber, >1.1x = red). Do you want true MAD thresholds or the simpler ratio approach?
**A3:** Keep ratio-based (simpler). No MAD calculation needed for milestone deltas.

**Q4:** The plan describes a horizontal swimlane timeline. The existing tab uses a vertical timeline. For 550px drawer width, horizontal space is tight with 8-12 milestones. Which layout?
**A4:** Horizontal swimlane as planned. Build the proportional horizontal bar.

**Q5:** The plan's comparison toggle has three modes: Surgeon Median, Facility Median, Previous Case. "Previous Case" requires a separate query for a different data shape. How important is it for the initial build?
**A5:** Surgeon + Facility only. Drop "Previous Case" — can be added later without architectural changes.

**Q6:** The TimeAllocationBar needs phase bucketing (Pre-Op, Surgical, Closing, Idle/Gap). No `procedure_milestone_config` table with phase groupings exists. How to assign milestones to phases?
**A6:** Add a `phase_group` column to `facility_milestones`. Nullable, populated via data migration that infers from milestone names. Code falls back gracefully if null.

**Q7:** The plan's MarginGauge color comes from fixed thresholds (Excellent ≥60%, Good 40-59%, etc.). But ORbit Score is a multi-pillar weighted system — margin alone doesn't determine grade. How should the gauge be colored?
**A7:** Two gauges — one for surgeon, one for facility. Always green until 10 cases exist for that procedure type. After 10 cases, color based on this case's margin vs. the median margin of the last 50 cases of that procedure type. Same ratio logic as milestones: ≥ median = green, within 10% below = amber, >10% below = red.

**Q8:** Should the median margin benchmark be facility-wide or surgeon-specific?
**A8:** Both — two separate MarginGauge components. One showing surgeon margin vs surgeon's median, one showing margin vs facility median.

**Q9:** For the hero row layout with two gauges: how should it be structured in 550px?
**A9:** Two gauges left, metrics right. [Surgeon Gauge | Facility Gauge] [Profit] [Revenue] [Costs]. Gauges are small (48px).

**Q10:** How important is the FullDayForecast (surgeon's all cases for the day) for the initial build?
**A10:** Include in initial build. Build the DB function + component.

**Q11:** When a case row in the FullDayForecast is clicked, what happens?
**A11:** No navigation — read only. Forecast rows are purely informational.

**Q12:** The plan has 4 status-specific layouts including "Completed + Not Validated" with a "Validate Now" button. How should financials handle case status?
**A12:** Only two columns needed: Projected (based on median OR time) and Actual (populated on completion). No cost validation concept. Cases that fail DQ and haven't been admin-validated yet simply show projected with a note that actuals are pending. DQ validation gates `case_completion_stats` population — if milestones pass the DQ engine on completion, `data_validated = true` automatically; otherwise admin must validate.

**Q13:** How much to upgrade the cost breakdown display?
**A13:** Full table with % bars as planned. Category | Amount | % of Total with inline horizontal bars, sorted by amount descending.

**Q14:** Should we extract the existing DeltaBadge from KPICard.tsx or build new?
**A14:** Extract and extend the existing DeltaBadge into a standalone `components/ui/DeltaBadge.tsx`. Extend to support time, currency, and percentage formats. KPICard imports from the new location.

**Q15:** When computing milestone and financial medians, should we skip cases marked `is_excluded = true`?
**A15:** No. Cases are only excluded for incomplete milestone data, not for outlier duration. Using medians (not averages) already handles outliers. Only filter on `data_validated = true`.

**Q16:** Should we restructure into fewer phases given the simplified scope?
**A16:** Keep 7 granular phases. Smaller phases = safer commits, easier to revert.

**Q17:** Confirmed revised phase ordering:
**A17:** Phase 1: DB functions + phase_group migration → Phase 2: Milestone data layer → Phase 3: Milestones tab UI → Phase 4: Financials data layer → Phase 5: Financials tab UI → Phase 6: Polish & accessibility → Phase 7: Integration testing.

**Q18:** Animation approach: CSS-only or framer-motion?
**A18:** CSS only. Tailwind + custom @keyframes for gauge ring draw, staggered fades, and tab transitions. No new dependencies.

**Q19:** Where should new types live — new `lib/types/` directory or colocated with logic?
**A19:** Colocate with logic (existing pattern). Types in milestoneAnalytics.ts and financialAnalytics.ts alongside functions.

**Q20:** Which phase should the DeltaBadge extraction happen in?
**A20:** Phase 2 (milestone data layer). Extract it when building the milestone calculation layer so it's ready for Phase 3 UI.

**Q21:** Should the MilestoneDetailRow cohort info (e.g., "Based on 23 cases") be expandable, always visible, or tooltip?
**A21:** Always visible as subtle text. Consistent with existing Duration Summary pattern. No expand/collapse state needed.

**Q22:** Should the horizontal swimlane include a surgeon median overlay (dashed line showing expected positions)?
**A22:** Yes, include the median overlay. Dashed line beneath the actual timeline.

**Q23:** Should the DB function `get_full_day_financials` compute projections for non-completed cases, or return raw data for client-side projection?
**A23:** DB computes everything. One round trip, all projection logic in SQL.

**Q24:** Should both new database functions use SECURITY INVOKER or SECURITY DEFINER?
**A24:** SECURITY INVOKER. Functions inherit caller's RLS, facility isolation enforced automatically.

**Q25:** Does the FullDayForecast footer need a small MarginGauge, or is colored percentage text sufficient?
**A25:** Small gauge (sm, 40px) in the forecast footer. Visually consistent with the hero row.

**Q26:** Should the QuickStats header share calculation logic with the revamped milestones tab, or keep its independent calculation?
**A26:** Keep independent calculation. Less coupling, numbers should match since they use the same source data.
