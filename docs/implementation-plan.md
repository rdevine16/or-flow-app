# Implementation Plan: Financial Analytics Facelift

## Summary

Complete visual and functional rebuild of the Financial Analytics page (`/analytics/financials`). Transforms the current data-table-heavy layout into a polished analytics dashboard with sparklines, waterfall charts, payer mix analysis, profit distribution histograms, URL-routed detail views, and animated counters. Adds a `financial_targets` table for configurable monthly profit targets with per-month CRUD.

## Interview Notes

| Decision | Answer |
|----------|--------|
| Outlier detection system | **Strip entirely** — remove from hook and UI. Old feature, not in new design. |
| Monthly profit target source | **Monthly target table** — `financial_targets` table with per-month targets, CRUD on settings page |
| Migrations allowed? | **Yes** — small migrations for `financial_targets` table |
| Rebuild vs refactor daily activity | **Rebuild from scratch** — new files matching mockup design |
| Test depth for shared components | **Unit tests** — each micro-component gets its own test file |

## Reference Files

- `docs/orbit-financials-complete.jsx` — Overview + embedded tabs
- `docs/orbit-procedure-detail.jsx` — Procedure detail target design
- `docs/orbit-surgeon-detail.jsx` — Surgeon detail target design

---

## Phase 1: Migration + Shared Components + Data Layer Extensions
**Complexity: Large**

### What it does
1. Create `financial_targets` migration (facility_id, year, month, profit_target) and push to DB
2. Extract ~14 shared micro-components into `components/analytics/financials/shared/` with unit tests
3. Rewrite `useFinancialsMetrics` hook — strip outlier detection, add payer mix aggregation, profit distribution bins, monthly trend sparklines, phase duration computation, target fetching
4. Add/update TypeScript types in `types.ts` for all new data structures

### Files touched
- **Create:** `supabase/migrations/[timestamp]_financial_targets.sql`
- **Create:** `components/analytics/financials/shared/Sparkline.tsx`
- **Create:** `components/analytics/financials/shared/MicroBar.tsx`
- **Create:** `components/analytics/financials/shared/MarginBadge.tsx`
- **Create:** `components/analytics/financials/shared/ComparisonPill.tsx`
- **Create:** `components/analytics/financials/shared/PhasePill.tsx`
- **Create:** `components/analytics/financials/shared/ConsistencyBadge.tsx`
- **Create:** `components/analytics/financials/shared/RankBadge.tsx`
- **Create:** `components/analytics/financials/shared/AnimatedNumber.tsx`
- **Create:** `components/analytics/financials/shared/InfoTip.tsx`
- **Create:** `components/analytics/financials/shared/SortTH.tsx`
- **Create:** `components/analytics/financials/shared/SparklineLight.tsx`
- **Create:** `components/analytics/financials/shared/MarginDot.tsx`
- **Create:** `components/analytics/financials/shared/index.ts`
- **Create:** `components/analytics/financials/shared/__tests__/Sparkline.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/MicroBar.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/MarginBadge.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/ComparisonPill.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/PhasePill.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/ConsistencyBadge.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/RankBadge.test.tsx`
- **Create:** `components/analytics/financials/shared/__tests__/AnimatedNumber.test.tsx`
- **Modify:** `components/analytics/financials/useFinancialsMetrics.ts` — rewrite with new computations, strip outliers
- **Modify:** `components/analytics/financials/types.ts` — add payer mix, profit bins, monthly trend, phase duration, target types
- **Modify:** `components/analytics/financials/utils.ts` — add shared formatters (fmtK, fmtDur, fmtTime)

### Commit message
`feat(financials): phase 1 - shared components, data layer extensions, financial targets migration`

### Test gate
- **Unit:** Each shared component renders correctly with various props (positive/negative values, empty data, null states)
- **Unit:** useFinancialsMetrics computes payer mix grouping, profit bins, and phase durations correctly
- **Integration:** Migration applies cleanly via `supabase db push`
- **Workflow:** Hook returns enriched data when fed real-shaped test data

---

## Phase 2A: Overview Tab Rebuild — Components
**Complexity: Large** (split from Phase 2 due to context limits)

### What was done
1. Created `WaterfallChart.tsx` — SVG waterfall showing Revenue → Debits → Credits → OR Cost → Profit flow
2. Rewrote `OverviewTab.tsx` to match `orbit-financials-complete.jsx` design:
   - Hero P&L card with AnimatedNumber + WaterfallChart + trend badge + waterfall legend
   - Four secondary KPI cards with Sparkline + trend badges (profit/hr, margin, median profit, OR hours)
   - Two-column CSS Grid tables: Top Procedures (MicroBar, MarginDot, loss styling) + Top Surgeons (RankBadge, low vol badge)
   - Profit trend chart (Recharts ComposedChart: daily bars + cumulative area + target reference line)
   - Monthly target progress bar with remaining/day-needed calculation
3. Started `page.tsx` edits: added `useRouter`, `monthlyTarget` state, `financial_targets` fetch to Promise.all

### Files touched
- **Created:** `components/analytics/financials/WaterfallChart.tsx`
- **Rewritten:** `components/analytics/financials/OverviewTab.tsx`
- **Partially modified:** `app/analytics/financials/page.tsx` (fetch added, wiring incomplete)

### Commit message
`feat(financials): phase 2a - overview tab rebuild with sparklines, waterfall, and profit trend`

---

## Phase 2B: Overview Tab Rebuild — Wiring + Cleanup + Tests
**Complexity: Small**

### What it does
1. Finish `page.tsx` wiring:
   - Set `monthlyTarget` state from `financialTargetRes` result
   - Update `handleProcedureClick` / `handleSurgeonClick` to use `router.push('/analytics/financials/procedures/[id]')` and `router.push('/analytics/financials/surgeons/[id]')` for URL navigation
   - Pass `monthlyTarget` prop to `<OverviewTab />`
2. Delete `components/analytics/financials/MetricCard.tsx`
3. Remove MetricCard export from `components/analytics/financials/index.ts`
4. Run 3-stage test gate
5. Verify typecheck passes (pre-existing errors in flagEngine.test.ts are expected)

### Files touched
- **Modify:** `app/analytics/financials/page.tsx` — finish wiring monthlyTarget + router.push handlers
- **Delete:** `components/analytics/financials/MetricCard.tsx`
- **Modify:** `components/analytics/financials/index.ts` — remove MetricCard export

### Commit message
`feat(financials): phase 2b - page wiring, MetricCard cleanup, and test gate`

### Test gate
- **Unit:** WaterfallChart renders correct bars for revenue/cost/profit flow
- **Integration:** OverviewTab renders all sections with enriched metrics data, sparklines show correct trends
- **Workflow:** Click procedure row → navigates to `/analytics/financials/procedures/[id]`, click surgeon row → navigates to `/analytics/financials/surgeons/[id]`

---

## Phase 3: URL-Routed Detail Pages + Procedure Detail
**Complexity: Large**

### What it does
1. Create Next.js dynamic route pages for procedure and surgeon detail
2. Build full procedure detail layout matching `orbit-procedure-detail.jsx`:
   - Breadcrumb navigation back to list
   - 5 KPI cards with sparklines (Total Profit hero, Median Profit, Duration, Margin, $/OR Hour)
   - Volume & Profit Trend (ComposedChart: bars=volume, area=profit, dashed line=avg/case)
   - Profit Distribution histogram with min/median/max summary
   - Average Case Economics waterfall with proportional bars + stacked percentage bar
   - Payer Mix table with micro-bars + insight callout
   - Surgeon Breakdown sortable table with consistency badges
   - Recent Cases sortable table with expandable rows (cost breakdown)
3. Wire breadcrumb back-navigation, convert ProcedureTab to list-only view

### Files touched
- **Create:** `app/analytics/financials/procedures/[id]/page.tsx`
- **Create:** `app/analytics/financials/surgeons/[id]/page.tsx` (shell — populated in Phase 4)
- **Create:** `components/analytics/financials/ProcedureDetail.tsx`
- **Create:** `components/analytics/financials/CaseEconomicsCard.tsx`
- **Create:** `components/analytics/financials/PayerMixCard.tsx`
- **Modify:** `components/analytics/financials/ProcedureTab.tsx` — strip inline detail view, keep list-only
- **Modify:** `app/analytics/financials/page.tsx` — ensure tab state preserved on back-navigation

### Commit message
`feat(financials): phase 3 - URL-routed procedure detail with charts and payer mix`

### Test gate
- **Unit:** ProcedureDetail renders all 7 sections with correct data; CaseEconomicsCard/PayerMixCard render correctly
- **Integration:** Navigate to `/analytics/financials/procedures/[id]` → page loads with correct procedure data; back button returns to list
- **Workflow:** Overview → click procedure → detail page renders → breadcrumb back → Overview state preserved

---

## Phase 4: Surgeon Detail — Hero + Overview Sub-tab
**Complexity: Large**

### What it does
1. Build surgeon detail page matching `orbit-surgeon-detail.jsx`:
   - Dark gradient hero header (slate-800→900) with initials avatar, low-volume badge, comparison badges vs facility
   - 6-stat grid with SparklineLight (profit, $/case, $/hr, margin, cases, duration)
   - Sub-tab navigation (Overview | Daily Activity | By Procedure)
2. Overview sub-tab:
   - 4 performance metric cards (Time vs Facility, Profit Impact, Surgical Time, Consistency)
   - Volume & Profit Trend chart (ComposedChart)
   - Profit Distribution histogram with facility median reference
   - Average Case Economics waterfall
   - Payer Mix table + insight callout
   - Recent Cases table with PhasePill showing dynamic phases from `facility_milestones`

### Files touched
- **Create:** `components/analytics/financials/SurgeonDetail.tsx`
- **Create:** `components/analytics/financials/SurgeonHero.tsx`
- **Modify:** `app/analytics/financials/surgeons/[id]/page.tsx` — populate with data fetching + SurgeonDetail
- **Modify:** `components/analytics/financials/SurgeonTab.tsx` — strip inline detail view, keep list-only

### Commit message
`feat(financials): phase 4 - surgeon detail hero header and overview sub-tab`

### Test gate
- **Unit:** SurgeonHero renders dark gradient with correct stats, comparison badges show correct +/- values; PhasePill shows dynamic phase names
- **Integration:** Surgeon detail page loads from URL with correct surgeon data; sub-tabs switch correctly
- **Workflow:** Overview → click surgeon → hero renders → Overview sub-tab shows all sections with correct data

---

## Phase 5: Surgeon Detail — Daily Activity + By Procedure Sub-tabs
**Complexity: Medium**

### What it does
1. Daily Activity sub-tab:
   - Day rows showing date, case count, total profit, total duration
   - Expandable day detail with individual case cards
   - Phase pills on each case (dynamic from `facility_milestones` / `phase_definitions`)
   - Surgical uptime visualization bar (surgical time vs total case time)
2. By Procedure sub-tab:
   - Comparison table: surgeon median duration vs facility median for each procedure
   - Case count, total profit, and efficiency comparison per procedure

### Files touched
- **Create:** `components/analytics/financials/SurgeonDailyActivity.tsx`
- **Create:** `components/analytics/financials/SurgeonByProcedure.tsx`
- **Modify:** `components/analytics/financials/SurgeonDetail.tsx` — wire sub-tab content

### Commit message
`feat(financials): phase 5 - surgeon daily activity and by-procedure sub-tabs`

### Test gate
- **Unit:** Day rows render correctly; expandable detail shows case cards with phase pills; uptime bar widths are proportional
- **Integration:** Phase durations match case_milestones data; facility comparison values are accurate
- **Workflow:** Surgeon detail → Daily Activity → expand day → case cards with phases → switch to By Procedure → comparison table renders

---

## Phase 6: Financial Targets Settings + Animations + Polish
**Complexity: Medium**

### What it does
1. Add monthly profit target CRUD on analytics/financials settings page:
   - Table showing months with target amounts
   - Inline editing for target values
   - Create/update targets via Supabase
2. AnimatedNumber with requestAnimationFrame + ease-out cubic
3. CSS fade-in transitions with staggered delays on all detail sections
4. Hover effects and micro-interactions
5. Edge case handling: empty data states, single case procedures, negative profits, missing payer, no phase data, zero-case surgeons

### Files touched
- **Create or Modify:** Settings page for financial targets (location TBD — likely `app/settings/financials/targets/page.tsx` or extend existing financials settings)
- **Modify:** `components/analytics/financials/shared/AnimatedNumber.tsx` — refine animation curve
- **Modify:** `components/analytics/financials/OverviewTab.tsx` — add fade-in transitions
- **Modify:** `components/analytics/financials/ProcedureDetail.tsx` — add fade-in transitions, edge cases
- **Modify:** `components/analytics/financials/SurgeonDetail.tsx` — add fade-in transitions, edge cases
- **Modify:** `components/analytics/financials/SurgeonDailyActivity.tsx` — edge cases
- **Modify:** `components/analytics/financials/SurgeonByProcedure.tsx` — edge cases

### Commit message
`feat(financials): phase 6 - financial targets settings, animations, and edge case polish`

### Test gate
- **Unit:** AnimatedNumber counts up correctly; empty states render appropriate messages; negative profit styling correct
- **Integration:** Financial targets CRUD works end-to-end; target progress bar in Overview reads from DB
- **Workflow:** Settings → set target → Overview shows correct progress bar → edge cases don't break layout

---

## Phase 7: Integration Testing + Cleanup
**Complexity: Medium**

### What it does
1. Full end-to-end walkthrough: Overview → Procedure Detail → back → Surgeon Detail → Daily Activity → case drill-down
2. Remove dead code:
   - `components/analytics/financials/OutlierDetailDrawer.tsx`
   - `components/analytics/financials/IssuesBadge.tsx`
   - Old inline detail view code from ProcedureTab/SurgeonTab
3. Verify date range changes propagate to detail pages (page-level state via DateRangeSelector)
4. Verify browser back/forward navigation works correctly with URL-routed pages
5. Final `npm run typecheck && npm run lint && npm run test`
6. Update barrel exports in `components/analytics/financials/index.ts`

### Files touched
- **Delete:** `components/analytics/financials/OutlierDetailDrawer.tsx`
- **Delete:** `components/analytics/financials/IssuesBadge.tsx`
- **Modify:** `components/analytics/financials/index.ts` — update exports
- **Modify:** Any files with dead code references

### Commit message
`feat(financials): phase 7 - integration testing, dead code cleanup, final verification`

### Test gate
- **Unit:** All existing tests pass after cleanup
- **Integration:** Full navigation flow works; date range propagates; no console errors
- **Workflow:** Every acceptance criterion in active-feature.md is verified; `npm run typecheck && npm run lint && npm run test` passes clean

---

## Acceptance Criteria Mapping

| Criteria | Phase |
|----------|-------|
| Overview tab matches mockup design | Phase 2 |
| Procedure detail matches mockup design | Phase 3 |
| Surgeon detail matches mockup design | Phase 4 + 5 |
| URL routing works for both detail views | Phase 3 |
| Browser back button returns to list | Phase 3 |
| Click procedure/surgeon navigates to detail | Phase 2 |
| Payer mix shows real payer data | Phase 3 + 4 |
| Phase pills show dynamic phases | Phase 4 + 5 |
| Sparklines render 6-month trend data | Phase 1 + 2 |
| Animated counter on Net Profit hero | Phase 2 + 6 |
| Expandable case rows with cost breakdown | Phase 3 |
| Surgeon hero shows facility comparison | Phase 4 |
| Daily activity with phase pills and uptime | Phase 5 |
| Loss cases styled red | Phase 2 + 3 |
| Low volume warnings | Phase 2 + 4 |
| All tests pass | Phase 7 |
| No TypeScript `any` types | All phases |
