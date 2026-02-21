# Feature: Financial Analytics Facelift

## Goal
Complete visual and functional rebuild of the Financial Analytics page (`/analytics/financials`), including the Overview tab, Procedure Detail view, and Surgeon Detail view. The redesign introduces richer KPI cards with sparklines, waterfall charts, payer mix analysis, profit distribution histograms, phase-based case breakdowns, and URL-routed detail views. Transforms the current data-table-heavy layout into a polished analytics dashboard matching the three reference mockups.

## Requirements
1. Rebuild Overview tab with hero P&L card (animated counter + waterfall chart), sparkline KPI cards, MicroBar tables, and cumulative profit trend
2. Rebuild Procedure Detail view with 5 KPI cards, volume/profit trend chart, profit distribution histogram, case economics waterfall, payer mix table, surgeon breakdown, and expandable case rows
3. Rebuild Surgeon Detail view with dark gradient hero header, sub-tabs (Overview, Daily Activity, By Procedure), phase pills on cases, and surgical uptime visualization
4. URL-route detail views (`/analytics/financials/procedures/[id]`, `/analytics/financials/surgeons/[id]`) for deep-linking and browser navigation
5. Extract ~14 shared micro-components (Sparkline, MicroBar, MarginBadge, ComparisonPill, PhasePill, etc.)
6. Extend `useFinancialsMetrics` hook with payer mix, profit distribution bins, monthly trend sparklines, and phase duration computation
7. All phase names must be pulled dynamically from `facility_milestones` / `phase_definitions` — never hardcoded
8. Reuse existing `DateRangeSelector` for date filtering

## Reference Mockups
- `docs/orbit-financials-complete.jsx` — Full page: Overview + embedded Procedure/Surgeon tabs
- `docs/orbit-procedure-detail.jsx` — Standalone rich Procedure Detail (target detail level)
- `docs/orbit-surgeon-detail.jsx` — Standalone rich Surgeon Detail (target detail level)

## Database Context
- Materialized view: `case_completion_stats` — per-case P&L (reimbursement, total_debits, total_credits, or_time_cost, profit, scheduled_date, payer_id, procedure_type_id, surgeon_id)
- View: `surgeon_procedure_stats` — pre-computed surgeon+procedure medians/stddevs
- View: `facility_procedure_stats` — facility-wide procedure benchmarks
- Table: `payers` — insurance/payer lookup (id, name), joined via `payer_id` on cases
- Table: `facility_milestones` — has `phase_group` column (pre_op, surgical, closing, post_op)
- Table: `phase_definitions` — configurable phase boundaries (start/end milestone pairs per facility)
- Table: `case_milestones` — per-case milestone timestamps → join with `facility_milestones` for phase durations
- Table: `facilities` — `or_hourly_rate` for OR cost computation

## UI/UX

### Route Structure
| Route | View |
|-------|------|
| `/analytics/financials` | Main page with tabs (Overview, By Procedure list, By Surgeon list) |
| `/analytics/financials/procedures/[id]` | Procedure detail (deep-linked) |
| `/analytics/financials/surgeons/[id]` | Surgeon detail (deep-linked) |

### Overview Tab
- Hero P&L card: animated net profit counter + revenue→profit waterfall chart (SVG)
- 4 secondary KPI cards with inline sparklines and trend badges
- Two-column tables: Top Procedures (with MicroBar) + Top Surgeons (with RankBadge)
- Click row → navigates to URL-routed detail view
- Profit trend: Recharts ComposedChart (daily bars + cumulative area + target reference line)
- Monthly target progress bar

### Procedure Detail
- Breadcrumb: All Procedures → [Name]
- 5 KPI cards with sparklines (Total Profit hero, Median Profit, Duration, Margin, $/OR Hour)
- Volume & Profit Trend: ComposedChart (bars=volume, area=profit, dashed line=avg/case)
- Profit Distribution: BarChart histogram with min/median/max summary
- Average Case Economics: waterfall rows with proportional bars + stacked percentage bar
- Payer Mix: table with micro-bars + insight callout
- Surgeon Breakdown: sortable table with consistency badges
- Recent Cases: sortable table with expandable rows (cost breakdown + mini waterfall)

### Surgeon Detail
- Breadcrumb: All Surgeons → [Name]
- Dark gradient hero header (slate-800→900) with initials avatar, comparison badges, 6-stat grid with SparklineLight
- Sub-tabs: Overview | Daily Activity | By Procedure
- Overview: performance cards, trend chart, distribution, economics, payer mix, recent cases with phase pills
- Daily Activity: day rows → expandable with case cards, phase pills, surgical uptime bar
- By Procedure: comparison table (surgeon median vs facility median)

### Design Decisions
- Dark hero header for surgeon detail (differentiates from procedure detail)
- Animations: CSS transitions (fade-in with staggered delays) + requestAnimationFrame counters. No Framer Motion.
- Loss styling: red left border + red-tinted background on negative-profit rows
- Low volume: amber "Low vol" badge on surgeons < threshold

## Files Likely Involved

### Modify
- `app/analytics/financials/page.tsx` — Main page, data fetching, date range, tab layout
- `components/analytics/financials/OverviewTab.tsx` — Complete rebuild
- `components/analytics/financials/ProcedureTab.tsx` — Becomes list-only (detail moves to route)
- `components/analytics/financials/SurgeonTab.tsx` — Becomes list-only (detail moves to route)
- `components/analytics/financials/useFinancialsMetrics.ts` — Extend with payer mix, trends, bins, phases
- `components/analytics/financials/types.ts` — New types for extended data

### Create
- `app/analytics/financials/procedures/[id]/page.tsx` — URL-routed procedure detail
- `app/analytics/financials/surgeons/[id]/page.tsx` — URL-routed surgeon detail
- `components/analytics/financials/shared/Sparkline.tsx` — Inline SVG sparkline (light + dark variants)
- `components/analytics/financials/shared/MicroBar.tsx` — Horizontal bar with value
- `components/analytics/financials/shared/MarginBadge.tsx` — Colored margin pill
- `components/analytics/financials/shared/ComparisonPill.tsx` — +/- comparison badge
- `components/analytics/financials/shared/PhasePill.tsx` — Phase duration pill
- `components/analytics/financials/shared/ConsistencyBadge.tsx` — High/Moderate/Variable badge
- `components/analytics/financials/shared/RankBadge.tsx` — Numbered rank circle
- `components/analytics/financials/shared/AnimatedNumber.tsx` — rAF-based counter
- `components/analytics/financials/shared/InfoTip.tsx` — Hover tooltip
- `components/analytics/financials/shared/SortTH.tsx` — Sortable table header
- `components/analytics/financials/WaterfallChart.tsx` — Revenue→Profit SVG waterfall
- `components/analytics/financials/CaseEconomicsCard.tsx` — Avg case economics waterfall card
- `components/analytics/financials/PayerMixCard.tsx` — Payer mix table + insight callout

## iOS Parity
- [x] iOS can wait — this is a web-only analytics rebuild

## Known Issues / Constraints
- **Median over average**: All "typical" metrics use median per platform rules
- **Facility scoping**: Every query must filter by `facility_id` (RLS enforced)
- **No `any` types**: Strict TypeScript throughout
- **Recharts only**: No new chart libraries
- **No Framer Motion**: CSS transitions + rAF are sufficient
- **Phase names are dynamic**: Must pull from `facility_milestones` / `phase_definitions`, never hardcode
- **Low volume flags**: Surgeons < 10 cases, procedures with surgeon < 5 cases — show warning footnote
- **Soft deletes**: Filter `is_active = true` on all queries
- **Existing materialized view limitation**: `case_completion_stats` doesn't auto-detect PostgREST foreign keys — payer/procedure/surgeon names must be client-side joined from lookup tables
- **Date range**: Page-level state via `DateRangeSelector`, not global context
- **Pre-existing typecheck errors**: Test file mock types (milestone-order-dialog.test.tsx, cases.test.ts) — not blocking

## Out of Scope
- Global date range context (keep page-level state)
- New materialized views or database migrations
- Exporting/printing financial reports
- Real-time data updates (standard page load refresh)
- Mobile responsive layout (desktop-first analytics)
- Framer Motion or other animation libraries

## Acceptance Criteria
- [ ] Overview tab matches `orbit-financials-complete.jsx` OverviewTab design
- [ ] Procedure detail matches `orbit-procedure-detail.jsx` design (standalone version)
- [ ] Surgeon detail matches `orbit-surgeon-detail.jsx` design (standalone version)
- [ ] URL routing works: `/analytics/financials/procedures/[id]` and `/analytics/financials/surgeons/[id]`
- [ ] Browser back button returns to list view
- [ ] Clicking procedure/surgeon in Overview navigates to detail page
- [ ] Payer mix shows real payer data grouped from case records
- [ ] Phase pills show dynamic phases from `facility_milestones`, not hardcoded names
- [ ] Sparklines render 6-month trend data for KPI cards
- [ ] Animated counter on Net Profit hero card
- [ ] Expandable case rows in procedure detail show cost breakdown
- [ ] Surgeon hero header shows facility comparison badges
- [ ] Daily activity shows case cards with phase pills and surgical uptime
- [ ] Loss cases styled with red border and tinted background
- [ ] Low volume warnings displayed where applicable
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced

---

## Implementation Plan

### Phase 1: Shared Components + Data Layer Extensions
- Extract ~14 shared micro-components into `components/analytics/financials/shared/`
- Extend `useFinancialsMetrics` with: payer mix aggregation, profit distribution bins, monthly trend data, phase duration computation
- Add TypeScript types for new data structures
- **Test gate**: Unit tests for new hook computations, verify payer grouping and phase duration accuracy

### Phase 2: Overview Tab Rebuild
- Rebuild `OverviewTab.tsx` to match mockup design
- Hero P&L card with AnimatedNumber + WaterfallChart
- Secondary KPI cards with Sparkline + trend badges
- Updated procedure/surgeon tables with MicroBar, MarginDot, RankBadge
- Profit trend chart (ComposedChart: daily bars + cumulative area + target reference line)
- Monthly target progress bar
- **Test gate**: Data renders correctly, sparklines accurate, table click navigation works

### Phase 3: URL-Routed Detail Pages + Procedure Detail
- Create `app/analytics/financials/procedures/[id]/page.tsx` and `app/analytics/financials/surgeons/[id]/page.tsx`
- Build full procedure detail layout: KPI row, trend/distribution charts, economics, payer mix, surgeon breakdown, expandable case table
- Wire navigation from Overview → detail pages, breadcrumb back navigation
- **Test gate**: URL routing, back button, all procedure detail sections render with correct data

### Phase 4: Surgeon Detail View — Hero + Overview
- Dark gradient hero header with SparklineLight and facility comparison badges
- Overview sub-tab: performance cards, trend chart, distribution, economics, payer mix, recent cases with PhasePill
- **Test gate**: Hero renders with correct data, phase pills show real phases, sparklines accurate

### Phase 5: Surgeon Detail — Daily Activity + By Procedure
- Daily Activity sub-tab: day rows, expandable day detail with case cards, phase pills, surgical uptime bar
- By Procedure sub-tab: comparison table with facility medians
- **Test gate**: Day expansion, phase durations accurate, facility comparison correct

### Phase 6: Animations + Polish
- AnimatedNumber hook for hero counters
- CSS fade-in transitions with staggered delays
- Hover effects and transitions
- Edge cases: empty data, single case, negative profits, missing payer, no phase data
- **Test gate**: Animations smooth, edge cases handled, no layout breaks

### Phase 7: Integration Testing + Cleanup
- Full end-to-end walkthrough: Overview → Procedure Detail → back → Surgeon Detail → Daily Activity → case drill-down
- Remove dead code from old ProcedureTab/SurgeonTab detail views
- Verify date range changes propagate to detail pages
- Final typecheck + lint + test
- **Test gate**: All acceptance criteria met, no regressions
