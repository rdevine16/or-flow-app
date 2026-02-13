# Feature: Facility Admin Dashboard

## Goal
Create a new Dashboard page that serves as the facility admin's home base — a single view that answers "what do I need to know right now?" by combining KPI metrics with trend indicators, actionable alerts surfaced from real data, live room status, and quick-access navigation to deeper analytics. This replaces the current Dashboard route (which becomes "Rooms Overview") and restructures navigation to reflect how facility admins actually think about their workflow.

## Requirements

### Navigation Restructuring
1. Rename current "Dashboard" (daily room schedule grid) to "Rooms" or "Rooms Overview" in the sidebar nav
2. Create new "Dashboard" as the first/default nav item — this is the new landing page after login
3. Add global search (Cmd+K) to the top header bar — searches cases, surgeons, rooms by name/ID
4. Add notification bell icon to top header bar — mirrors the alert items shown on the dashboard
5. Sidebar nav order: Dashboard → Rooms → Cases → Surgeons → Analytics → Admin

### KPI Cards Row (Top)
6. 4-5 metric cards across the top of the page, each showing: big number, label, trend arrow with percentage vs. prior equivalent period
7. Required KPIs: OR Utilization %, Cases Completed/Scheduled, Median Turnover Time, On-Time Start %, Facility ORbit Score (stubbed)
8. Time context toggle above the cards: Today / This Week / This Month — shifts all dashboard data
9. Facility selector if multi-facility (respect current facility context from user session)

### Needs Attention List (Main Content — Left Column)
10. Prioritized, actionable list of items generated from real database queries
11. Each item has: priority icon, title, description, timestamp or count, click-through link to relevant page
12. Alert types to implement:
    - Cases with all milestones recorded but `data_validated = false` → "X cases need validation"
    - Cases from today/yesterday missing milestone data (some `recorded_at` still NULL) → "X cases missing milestones"
    - Rooms running behind schedule (current case elapsed > scheduled duration + grace) → "OR X running Y min behind"
    - Surgeon ORbit Score dropped below threshold (e.g., < 30) in rolling window → "Dr. X score declined"
    - Block conflicts (overlapping surgeon blocks in same room) → "Block conflict in OR X on [date]"
    - Incomplete case records (status = 'scheduled' but date has passed) → "X past cases still marked scheduled"
13. Empty state: friendly message when no action items exist
14. "View All" link if more than 5-6 items, linking to a filtered view

### Room Status Cards (Right Column)
15. Compact card per active room showing: room name, current status (In Case / Turning Over / Idle / Done for Day), current or next case with surgeon name, mini progress indicator
16. Each card links to room detail in the Rooms Overview page
17. Below rooms: "Today's Surgeons" mini-list showing surgeon name, cases remaining count, ORbit Score letter grade badge

### Trend Chart (Full Width Row)
18. Single time-series line chart spanning full width — default to OR Utilization over last 30 days
19. Dropdown to swap metric: Utilization, Median Turnover, Case Volume, Facility ORbit Score trend
20. Chart uses existing charting library (recharts or whatever is currently in the project)

### Quick Access Cards (Bottom Row)
21. Horizontal row of 4-5 shortcut cards linking to deeper analytics pages
22. Cards: Surgeon Scorecards, Block Utilization, Financial Summary, Schedule Accuracy, Case Analytics
23. Each card has: icon, title, one-line description
24. These are navigation aids, not data displays

### Facility ORbit Score (Stubbed)
25. Display a facility-level composite score derived from simple averages of available metrics
26. Stub calculation: average of (OR Utilization %, inverse of median turnover normalized, FCOTS %, 1 - cancellation rate) — scaled to 0-100
27. Letter grade using same grade thresholds as surgeon scorecard
28. Trend arrow comparing current period to previous period
29. This is explicitly a placeholder — the real facility score engine will be built separately

## Database Context

### Tables & Views Used
- `cases` — status, scheduled times, actual times, surgeon_id, room_id, facility_id, data_validated
- `case_milestones` (or `milestones`) — recorded_at for each milestone per case
- `case_completion_stats` — pre-computed stats: case_duration, turnover_time, etc.
- `rooms` — room names, facility_id, active status
- `surgeons` — surgeon names, facility_id
- `facility_settings` — grace periods, thresholds, flip_room config
- `blocks` / `block_schedule` — surgeon block assignments per room per day
- Materialized views for aggregated analytics (utilization, turnover trends)
- ORbit Score engine output (surgeon scorecards) — read existing computed scores

### Key Query Patterns
- Today's cases: `cases WHERE facility_id = X AND scheduled_date = today ORDER BY room_id, scheduled_start`
- Unvalidated cases: `cases WHERE data_validated = false AND all milestones recorded_at IS NOT NULL`
- Missing milestones: `cases JOIN milestones WHERE case date <= today AND some recorded_at IS NULL AND status != 'cancelled'`
- Room status: derive from today's cases — find current case per room based on time
- Utilization: from `case_completion_stats` or materialized view, aggregated by day
- Surgeon scores: read from existing scorecard computation (don't re-derive)

## UI/UX
- Route: `/dashboard` (new) — becomes the default authenticated landing page
- Current dashboard route becomes `/rooms` or `/rooms-overview`
- Responsive: cards stack on mobile, sidebar collapses as existing behavior
- Design references: Remote.com dashboard (action list pattern) + Amplitude (KPI cards + chart pattern)
- Light theme, consistent with existing app design tokens
- Uses existing component patterns: cards, badges, status indicators from design system

## Files Likely Involved
- `app/dashboard/page.tsx` — NEW main dashboard page (or wherever route structure dictates)
- `app/admin/page.tsx` or current dashboard route — rename/move to rooms
- `components/dashboard/KPICard.tsx` — NEW reusable metric card component
- `components/dashboard/NeedsAttention.tsx` — NEW alert list component
- `components/dashboard/RoomStatusCard.tsx` — NEW compact room card
- `components/dashboard/TrendChart.tsx` — NEW chart wrapper
- `components/dashboard/QuickAccessCards.tsx` — NEW navigation cards
- `components/dashboard/FacilityScoreStub.tsx` — NEW stubbed score display
- `components/layouts/DashboardLayout.tsx` — sidebar nav updates (rename, reorder)
- `lib/hooks/useDashboardData.ts` — NEW data fetching hook(s)
- `lib/facilityScoreStub.ts` — NEW simple scoring calculation

## iOS Parity
- [ ] iOS equivalent needed (future — iOS dashboard should mirror key metrics)
- [x] iOS can wait — web first, then port the data layer
- Notes: The KPI cards and alert patterns should be designed with eventual iOS parity in mind. Keep the data fetching logic cleanly separated from UI so the same query patterns can be reused in SwiftUI.

## Known Issues / Constraints
- The current "Dashboard" route has existing links and navigation pointing to it — all references need updating when renaming to Rooms
- Facility ORbit Score is explicitly a stub — do NOT build the full scoring engine, just compute a simple average
- Room "current status" requires comparing current time against today's case schedule — this is derived, not stored
- The Needs Attention queries should be efficient — avoid N+1 patterns, use batch queries
- Chart data should be fetched separately from the rest of the dashboard to avoid blocking the initial render
- The Cmd+K global search is a significant feature on its own — implement a basic version (search cases by ID, surgeons by name) and iterate

## Out of Scope
- Full facility ORbit Score engine (pillar definitions, MAD scoring, weighting) — that's a separate project
- Real-time WebSocket updates for room status — use polling or refresh for now
- Notification system backend (the bell icon shows the same data as Needs Attention, not a separate notification store)
- Mobile-specific dashboard layout (responsive stacking is fine, no separate mobile design)
- Dark mode
- Historical dashboard snapshots or "daily summary" email digests

## Acceptance Criteria
- [ ] New Dashboard page renders at `/dashboard` with all 5 sections (KPIs, Needs Attention, Room Status, Trend Chart, Quick Access)
- [ ] Current room schedule page accessible at `/rooms` with updated nav label
- [ ] All sidebar nav links updated — no broken routes
- [ ] KPI cards show real data from database with trend indicators
- [ ] Needs Attention list surfaces at least 3 alert types from real queries
- [ ] Room status cards reflect today's actual case schedule
- [ ] Trend chart renders 30-day utilization data
- [ ] Facility ORbit Score displays a stubbed composite with letter grade
- [ ] Time context toggle (Today/Week/Month) updates KPI cards
- [ ] Global search (Cmd+K) opens and searches cases + surgeons at minimum
- [ ] Dashboard is the default landing page after login
- [ ] Page loads in < 2 seconds with real data
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
- [ ] Committed with descriptive messages per phase
