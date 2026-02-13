# Feature: Cases Page Revamp

## Goal
Transform the Cases page from a basic list into an enterprise-grade data table with Shopify-style status tabs, contextual summary metrics, procedure type icons, milestone progress indicators, and a tabbed detail drawer (slide-over panel) that lets admins inspect, validate, and analyze cases without navigating away from the list. The drawer includes a projected financials tab that shows expected revenue, cost, and margin based on stored values, surgeon medians, and facility medians — turning every case row into a financial insight.

## Requirements

### Navigation & Route Changes
1. Ensure the Cases page lives at `/cases` with the new design
2. Case detail page at `/cases/[id]` remains as the deep-dive destination — the drawer links to it via "Open full detail"

### Date Range Context Bar
3. Date range selector above everything — defaults to "Last 30 days"
4. Options: Today, This Week, This Month, Last 30 Days, Custom Range
5. All data on the page (tabs, summary cards, table) scoped to the selected date range

### Status Tabs (Shopify Pattern)
6. Tab bar below the date range: **All** | **Today** | **Scheduled** | **In Progress** | **Completed** | **Needs Validation** | **+** (save custom filter)
7. Each tab shows a count badge: "Completed (47)"
8. "Today" tab = cases where `scheduled_date = today`, any status
9. "Needs Validation" tab = cases where `status = completed` AND `data_validated = false` — this is a first-class workflow queue
10. "+" button saves current filter combination as a named custom tab (stored in localStorage for v1, user preferences table for v2)
11. Tabs filter within the active date range

### Summary Metric Cards (Above Table)
12. 3 contextual metric cards that change based on active tab + date range
13. **"All" / "Today" tabs:** Cases Completed vs Scheduled, Median Case Duration, On-Time Start %
14. **"Completed" tab:** Total Cases, Median Duration, Total Profit
15. **"Needs Validation" tab:** Count Needing Validation, Oldest Unvalidated (days ago), Data Completeness %
16. **"Scheduled" tab:** Cases Scheduled, Total Scheduled OR Time, Surgeons Operating
17. **"In Progress" tab:** Active Cases, Average Progress %, Rooms In Use

### Search & Filter Bar
18. Search input — searches by case number/ID, surgeon name, or procedure name. Debounced 300ms.
19. Filter pills next to search: Surgeon, Room, Procedure Type, Status
20. Active filters shown as dismissible pill chips below the search bar
21. "Clear all filters" link when filters are active

### Data Table
22. Columns: Checkbox | Procedure Icon + Name | Surgeon | Room | Date | Status Badge | Progress | Duration | Flags | Actions
23. **Procedure Icon:** Small category SVG icon next to procedure name. Icons mapped by procedure category (orthopedic → bone, spine → vertebrae, hand → hand, etc.). Fallback to generic scalpel icon.
24. **Status Badge:** Colored pill — blue/Scheduled, amber/In Progress, green/Completed, red/Cancelled, gray/On Hold, orange/Needs Validation
25. **Progress Pill:** Mini progress bar inside a pill. Progress = (milestones with `recorded_at` / total milestones). Blue fill for in-progress, green for complete, gray for scheduled.
26. **Duration:** Completed = actual duration. In-progress = elapsed since first milestone. Scheduled = surgeon's median or scheduled duration.
27. **Flags indicator:** Colored dot if case has flags. Red = critical, amber = warning. No dot if clean.
28. **Hover actions:** "Validate" checkmark for unvalidated cases, "Open" chevron always
29. Sortable columns: Date (default desc), Surgeon, Procedure, Duration, Room
30. Checkbox enables bulk actions — "Validate Selected (N)", "Export Selected"
31. Row click opens detail drawer
32. Pagination: 25 rows/page, controls at bottom with total count
33. Designed empty states per tab with message + CTA

### Procedure Type Icons Component
34. Shared `ProcedureIcon` component — accepts procedure category or type ID, renders SVG
35. Icon set: Orthopedic/Joint (bone), Spine (vertebrae), Hand/Wrist (hand), General (scalpel), Ophthalmology (eye), ENT (ear), Cardiac (heart), Generic fallback (medical cross)
36. Monochrome (slate-500), 20x20px, reusable across the app
37. Mapping stored in `lib/constants/procedureIcons.ts`

### Case Detail Drawer (Slide-Over Panel)
38. Slides from right, ~550px wide, background dims. Click outside or Escape to close.
39. Fixed header + scrollable content area

#### Drawer Header
40. Case number (clickable → `/cases/[id]`), status badge, procedure icon + name
41. Surgeon name (clickable → surgeon scorecard), room, date + time
42. Close button (X) top-right, "Open full detail →" link

#### Drawer Tabs: Overview | Milestones | Financials | Flags | Activity

#### Overview Tab
43. Case metadata: operative side, anesthesiologist, staff assignments
44. Vertical milestone timeline: milestone name, recorded timestamp or "Pending", time delta from previous. Green checkmark for recorded, gray circle for pending.
45. For unvalidated completed cases: prominent "Validate Case" button
46. For in-progress: live elapsed time, current milestone highlighted
47. Quick stats row: Total Duration, Surgical Time, Turnover Time

#### Milestones Tab
48. Every milestone with: name, timestamp, interval from previous milestone
49. Comparison badges: surgeon median vs actual, facility median vs actual for each interval
50. Color coding: green if faster than surgeon median, amber within 10%, red if >10% over
51. Summary row: total case time, surgical time, pre-op time, closing time

#### Financials Tab
52. **Scheduled cases (projected only):** Projected revenue (reimbursement), projected costs (OR cost = surgeon median duration × OR hourly rate, supply costs from `procedure_cost_items`, credits), projected margin and margin %
53. **Completed cases (projected vs actual):** Two-column layout. Each line item (revenue, OR cost, supply costs, credits, profit, margin %) shows projected value alongside actual from `case_completion_stats`. Delta row color-coded green (beat projection) or red (missed).
54. **In-progress cases:** Show scheduled projection with note "Final financials available after completion"
55. Source labels: "Based on Dr. [Name]'s median of [X] min" and "Facility median: [Y] min"

#### Flags Tab
56. List of `case_flags`: severity badge, type, description, metric vs threshold, timestamp, creator
57. Empty state: "No flags — this case is clean"

#### Activity Tab (Stub v1)
58. Milestone recording events: who recorded which milestone, when
59. Case creation and validation events
60. Chronological, read-only audit trail

### Export
61. "Export" button top-right, exports current filtered view as CSV
62. Includes all visible columns plus case ID

### Component Architecture
63. Generic reusable components in `components/ui/`: DetailDrawer, ProgressPill, StatusBadge, ProcedureIcon
64. Cases-specific components in `components/cases/`: CasesTable, CasesStatusTabs, CasesSummaryCards, CasesFilterBar, CaseDrawer, CaseDrawerOverview, CaseDrawerMilestones, CaseDrawerFinancials, CaseDrawerFlags, CaseDrawerActivity
65. Hooks in `lib/hooks/`: useCasesPage, useCaseDrawer, useCaseFinancialProjection, useCaseMetrics
66. Constants in `lib/constants/`: procedureIcons, caseStatusConfig

## Database Context

### Tables Read
- `cases` — id, case_number, facility_id, surgeon_id, procedure_type_id, or_room_id, status_id, scheduled_date, start_time, data_validated, scheduled_duration_minutes, operative_side, anesthesiologist_id
- `case_milestones` JOIN `facility_milestones` — recorded_at, recorded_by, milestone names
- `case_completion_stats` — total_duration_minutes, surgical_time_minutes, reimbursement, soft_goods_cost, hard_goods_cost, or_cost, profit, or_hourly_rate
- `case_flags` — flag_type, severity, metric_value, threshold_value, delay_type_id, duration_minutes, note
- `case_staff` JOIN `users` JOIN `roles` — staff assignments
- `case_notes` — content, created_by, created_at
- `case_statuses` — id, name
- `procedure_types` — id, name, category
- `users` (surgeons) — id, first_name, last_name
- `rooms` — id, name
- `procedure_cost_items` — cost defaults for financial projections
- `facility_analytics_settings` — or_hourly_rate
- `surgeon_procedure_averages` — surgeon median durations per procedure
- `facility_procedure_stats` (materialized view) — facility median durations

### Tables Written
- `cases.data_validated` — set to true via validate action (triggers downstream stats computation)

### Key Queries
- Cases list: `cases JOIN procedure_types JOIN users JOIN rooms JOIN case_statuses WHERE facility_id AND scheduled_date BETWEEN range`
- Milestone progress: `case_milestones WHERE case_id IN (visible IDs)` — count recorded vs total
- Flags per case: `case_flags WHERE case_id IN (visible IDs)` — max severity per case
- Financial projection: `surgeon_procedure_averages` for median, `facility_analytics_settings.or_hourly_rate`, `procedure_cost_items` for defaults
- Actual financials: `case_completion_stats WHERE case_id = X`

## UI/UX
- Route: `/cases` (redesigned in place)
- References: Shopify Products (table + tabs + badges), ClickUp (tabbed drawer), Productboard (progress bars)
- Light theme, existing design tokens
- Drawer: ~550px, slides right, 200-300ms animation
- Table: compact rows (40-44px height), horizontally scrollable on narrow viewports
- Drawer becomes full-width on mobile

## Files to Create
- `components/ui/DetailDrawer.tsx` — Generic reusable slide-over drawer shell
- `components/ui/ProgressPill.tsx` — Milestone progress indicator
- `components/ui/StatusBadge.tsx` — Case status colored badge (check if exists first)
- `components/ui/ProcedureIcon.tsx` — SVG icon by procedure category
- `components/cases/CasesTable.tsx` — Redesigned data table
- `components/cases/CasesStatusTabs.tsx` — Tab bar with counts
- `components/cases/CasesSummaryCards.tsx` — Contextual metric cards
- `components/cases/CasesFilterBar.tsx` — Search + filter pills
- `components/cases/CaseDrawer.tsx` — Case-specific drawer wrapper
- `components/cases/CaseDrawerOverview.tsx` — Overview tab
- `components/cases/CaseDrawerMilestones.tsx` — Milestones tab
- `components/cases/CaseDrawerFinancials.tsx` — Financials tab with projections
- `components/cases/CaseDrawerFlags.tsx` — Flags tab
- `components/cases/CaseDrawerActivity.tsx` — Activity tab
- `lib/hooks/useCasesPage.ts` — Main list data fetching
- `lib/hooks/useCaseDrawer.ts` — Selected case drawer data
- `lib/hooks/useCaseFinancialProjection.ts` — Projected vs actual calculations
- `lib/hooks/useCaseMetrics.ts` — Summary card computation per tab
- `lib/constants/procedureIcons.ts` — Category → icon SVG mapping
- `lib/constants/caseStatusConfig.ts` — Status → color/label config

## iOS Parity
- [ ] iOS equivalent needed (future — drawer maps to SwiftUI sheet)
- [x] iOS can wait
- Notes: Financial projection logic should be pure functions, not coupled to React hooks, for SwiftUI reuse.

## Known Issues / Constraints
- `case_completion_stats` may have zero costs for some cases (known bug). Financials tab must handle gracefully — show "Cost data unavailable" not 100% margin.
- Milestone progress depends on `procedure_milestone_config` — procedures have different milestone counts. Progress % is relative to expected milestones for that procedure.
- Drawer should lazy-load tab content (especially Financials and Activity).
- Procedure icon mapping is hardcoded by category name matching. Include fallback icon.
- Bulk validation triggers `record_case_stats` per case. Test for trigger race conditions.
- Saved custom tabs use localStorage for v1.

## Out of Scope
- Editing case data from the drawer (read-only + validate only)
- Real-time WebSocket updates for in-progress cases
- PDF export of individual cases
- Drag-to-reorder or toggle column visibility
- Inline cell editing
- Full audit log system (Activity tab is a stub for v1)
- Dark mode

## Review Q&A

> Run `/review` before `/audit`. Claude Code will scan the codebase, ask clarifying questions, and append answers here. The `/audit` command incorporates these answers into the implementation plan.

_Pending — run `/review` to populate._

---

## Acceptance Criteria
- [ ] Status tabs render with accurate count badges
- [ ] Summary cards show contextual metrics per active tab
- [ ] Table renders with procedure icon, status badge, progress pill, flags indicator
- [ ] Columns are sortable
- [ ] Search and filter pills work correctly
- [ ] Row click opens detail drawer
- [ ] Drawer header shows case info with working navigation links
- [ ] Overview tab shows milestone timeline with progress
- [ ] Milestones tab shows timing with median comparisons
- [ ] Financials tab shows projections for scheduled cases
- [ ] Financials tab shows projected vs actual for completed cases
- [ ] Flags tab shows case flags or empty state
- [ ] Activity tab shows milestone events
- [ ] Validate action works from drawer and table hover
- [ ] Bulk validate works for multiple selected cases
- [ ] Export CSV works for current filtered view
- [ ] "Needs Validation" tab surfaces correct cases
- [ ] Empty states render per tab
- [ ] Page loads < 2 seconds with real data
- [ ] Drawer tabs lazy-load content
- [ ] ProcedureIcon and DetailDrawer are reusable from `components/ui/`
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
