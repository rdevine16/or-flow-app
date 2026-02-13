# Implementation Plan: Facility Admin Dashboard

> Generated from `docs/active-feature.md`
> Feature branch: `feature/facility-admin-dashboard`

---

## Phase 1: Navigation Restructuring & Route Setup
**Goal:** Rename current Dashboard to Rooms, create new Dashboard route, update all nav links. No new UI — just plumbing.

**Files to modify:**
- `components/layouts/DashboardLayout.tsx` — sidebar nav config (rename items, reorder, update routes)
- Current dashboard page file — move/rename to `/rooms` or `/rooms-overview` route
- `app/dashboard/page.tsx` — NEW empty placeholder page with DashboardLayout wrapper
- Any hardcoded links to the old dashboard route (search codebase for references)
- Auth redirect / default landing page config — point to `/dashboard`

**Steps:**
1. Audit sidebar nav config in DashboardLayout — identify all nav items and their routes
2. Rename "Dashboard" nav item to "Rooms" or "Rooms Overview", update its route
3. Add new "Dashboard" nav item as the first item, pointing to `/dashboard`
4. Create `app/dashboard/page.tsx` with DashboardLayout wrapper and a simple "Dashboard coming soon" placeholder
5. Update the post-login redirect to land on `/dashboard` instead of the old route
6. Search codebase for any hardcoded references to the old dashboard route and update them
7. Verify sidebar nav order matches spec: Dashboard → Rooms → Cases → Surgeons → Analytics → Admin
8. Run 3-stage test gate

**Acceptance:**
- [ ] `/dashboard` renders inside DashboardLayout with placeholder content
- [ ] `/rooms` (or new route) renders the existing room schedule grid
- [ ] Sidebar nav shows correct order with correct labels
- [ ] No broken links — all existing navigation still works
- [ ] Post-login lands on `/dashboard`
- [ ] `npm run typecheck && npm run lint` pass

---

## Phase 2: KPI Cards & Data Layer
**Goal:** Build the KPI card component and the data fetching hooks that power the top row of the dashboard. Wire to real data.

**Files to create:**
- `components/dashboard/KPICard.tsx` — reusable metric card (value, label, trend arrow, trend percentage, optional icon)
- `lib/hooks/useDashboardKPIs.ts` — hook that fetches and computes: OR utilization, cases completed/scheduled, median turnover, on-time start %, facility score stub
- `lib/facilityScoreStub.ts` — simple composite calculation (average of utilization, normalized turnover, FCOTS, 1 - cancellation rate)

**Files to modify:**
- `app/dashboard/page.tsx` — replace placeholder with KPI card row + time context toggle

**Steps:**
1. Design the KPICard component — accepts: label, value (string/number), trend direction (up/down/stable), trend value (percentage string), optional color/icon. Keep it generic and reusable.
2. Build `useDashboardKPIs` hook:
   - Accept `timeRange` parameter: 'today' | 'week' | 'month'
   - Query `case_completion_stats` for the selected period to compute: total scheduled cases, completed cases, median turnover, FCOTS percentage
   - Query rooms + cases for utilization calculation (used time / available time)
   - Compare current period metrics to prior equivalent period for trend calculation
   - Return structured data: `{ utilization, casesCompleted, casesScheduled, medianTurnover, onTimeStartPct, facilityScore, trends }`
3. Build `facilityScoreStub.ts`:
   - Input: utilization %, median turnover (minutes), FCOTS %, cancellation rate
   - Normalize each to 0-1 scale (turnover: lower is better, invert; cancellation: lower is better, invert)
   - Average the four normalized values, scale to 0-100
   - Apply letter grade thresholds (reuse from surgeon scorecard if exported)
   - Return: `{ score: number, grade: string, trend: 'up' | 'down' | 'stable' }`
4. Build time context toggle UI (Today / This Week / This Month) — simple button group above the KPI cards
5. Wire everything together in the dashboard page — KPI cards row with real data, loading states, error handling
6. Run 3-stage test gate

**Acceptance:**
- [ ] 5 KPI cards render with real data from database
- [ ] Time toggle switches between Today/Week/Month and cards update
- [ ] Trend arrows show correct direction based on prior period comparison
- [ ] Facility ORbit Score shows a number and letter grade (stubbed calculation)
- [ ] Loading skeleton shown while data fetches
- [ ] Empty/zero states handled gracefully (e.g., no cases today shows "0" not an error)
- [ ] `useDashboardKPIs` uses `useSupabaseQuery` pattern (or equivalent established pattern)

---

## Phase 3: Needs Attention List
**Goal:** Build the actionable alert list that surfaces operational issues from real data queries.

**Files to create:**
- `components/dashboard/NeedsAttention.tsx` — the list component with icon, title, description, timestamp, click-through
- `lib/hooks/useDashboardAlerts.ts` — hook that runs the alert queries and returns prioritized items

**Files to modify:**
- `app/dashboard/page.tsx` — add Needs Attention section to left column of a two-column layout

**Steps:**
1. Define the alert type interface:
   ```typescript
   interface DashboardAlert {
     id: string
     type: 'validation' | 'missing_milestones' | 'behind_schedule' | 'score_decline' | 'block_conflict' | 'stale_cases'
     priority: 'high' | 'medium' | 'low'
     title: string
     description: string
     count?: number
     timestamp?: string
     linkTo: string  // route to navigate to
   }
   ```
2. Build `useDashboardAlerts` hook with individual query functions for each alert type:
   - **Unvalidated cases:** `SELECT count(*) FROM cases WHERE data_validated = false AND status = 'completed'` (cases completed but not validated)
   - **Missing milestones:** `SELECT cases.id FROM cases JOIN milestones ON... WHERE scheduled_date <= today AND recorded_at IS NULL AND status NOT IN ('cancelled', 'scheduled')` — cases that should have data but don't
   - **Behind schedule:** Compare current time against today's case schedule — find rooms where the current case started late or is running over. This is derived at query time, not stored.
   - **Score decline:** Read surgeon ORbit Scores, flag any that dropped below 30 (or configurable threshold from facility_settings)
   - **Stale cases:** `SELECT count(*) FROM cases WHERE status = 'scheduled' AND scheduled_date < today` — past cases never updated
   - **Block conflicts:** Query block schedule for overlapping assignments (same room, same time, different surgeons)
3. Prioritize alerts: high = behind schedule + block conflicts, medium = missing data + unvalidated, low = score decline + stale
4. Build the NeedsAttention component — render as a card with a list, each item clickable. Show priority icon (color-coded dot or icon), title, description, and a subtle chevron indicating it's clickable.
5. Handle empty state: "All clear — no items need attention" with a checkmark icon
6. Limit display to 6 items with "View All (X)" link if more exist
7. Restructure dashboard page to two-column layout (65% left / 35% right) with Needs Attention on the left
8. Run 3-stage test gate

**Acceptance:**
- [ ] At least 3 alert types surface real data from the database
- [ ] Alerts are prioritized (high → medium → low)
- [ ] Each alert item is clickable and navigates to the correct page
- [ ] Empty state renders when no alerts exist
- [ ] Alert queries are batched (not N+1 — one query per alert type, not per case)
- [ ] Dashboard layout is now two-column

---

## Phase 4: Room Status & Today's Surgeons
**Goal:** Build the right column showing compact room status cards and today's surgeon list.

**Files to create:**
- `components/dashboard/RoomStatusCard.tsx` — compact card showing room name, status, current/next case
- `components/dashboard/TodaysSurgeons.tsx` — mini-list of surgeons operating today
- `lib/hooks/useTodayStatus.ts` — hook that derives room statuses and surgeon schedules from today's cases

**Files to modify:**
- `app/dashboard/page.tsx` — add right column content

**Steps:**
1. Build `useTodayStatus` hook:
   - Fetch today's cases with room and surgeon joins
   - For each room: determine current status by comparing current time against case schedule
     - "In Case" = current time is between a case's wheels_in and wheels_out (or started but not finished)
     - "Turning Over" = between cases (last case wheels_out but next case hasn't started)
     - "Idle" = no active case and next case is > X minutes away
     - "Done" = all cases for this room are completed
   - For each room: identify current case (surgeon name, procedure) and next case if applicable
   - For surgeons: group today's cases by surgeon, count remaining, pull their latest ORbit Score grade
2. Build RoomStatusCard component:
   - Room name header
   - Status badge (color-coded: green=In Case, yellow=Turning Over, gray=Idle, blue=Done)
   - Current case: surgeon name + procedure type (or "Next: [surgeon] at [time]" if idle)
   - Mini progress indicator: simple bar showing how far through the day's cases this room is (e.g., 3 of 5)
   - Clickable — links to the room in the Rooms Overview page
3. Build TodaysSurgeons component:
   - Simple list: surgeon name, "X cases remaining", ORbit Score letter grade badge
   - Sorted by cases remaining (most first) or alphabetical
   - Each row links to the surgeon's scorecard
4. Wire both into the dashboard right column
5. Run 3-stage test gate

**Acceptance:**
- [ ] Room status cards show for each active room with correct current status
- [ ] Status correctly derived from today's case schedule and current time
- [ ] Room cards are clickable and navigate to the correct room
- [ ] Today's Surgeons list shows surgeons with cases today, their remaining count, and grade
- [ ] Right column renders below Room Status, above or after the surgeon list
- [ ] Handles "no cases today" gracefully (empty rooms show as Idle or hidden)

---

## Phase 5: Trend Chart & Quick Access Cards
**Goal:** Add the 30-day trend chart and the bottom-row navigation shortcut cards.

**Files to create:**
- `components/dashboard/TrendChart.tsx` — time-series chart with metric selector dropdown
- `components/dashboard/QuickAccessCards.tsx` — horizontal row of shortcut cards
- `lib/hooks/useTrendData.ts` — hook that fetches aggregated daily metrics for charting

**Files to modify:**
- `app/dashboard/page.tsx` — add chart section and quick access row below the two-column area

**Steps:**
1. Build `useTrendData` hook:
   - Accept `metric` parameter: 'utilization' | 'turnover' | 'caseVolume' | 'facilityScore'
   - Query `case_completion_stats` (or materialized views) aggregated by day for the last 30 days
   - Return array of `{ date: string, value: number }` for charting
   - For facility score: compute the stub score per day (may be expensive — consider caching or simplified version)
2. Build TrendChart component:
   - Metric selector dropdown in the top-right of the chart card
   - Line chart using existing charting library (recharts or chart.js — match what's already in the project)
   - X-axis: dates, Y-axis: metric value with appropriate label
   - Responsive width, fixed height (~250-300px)
   - Loading state while data fetches (don't block the rest of the dashboard — fetch independently)
3. Build QuickAccessCards component:
   - 4-5 cards in a horizontal row (grid or flex, wrap on mobile)
   - Each card: icon, title, one-line description, links to a route
   - Cards: "Surgeon Scorecards" → /surgeons, "Block Utilization" → /analytics/blocks (or equivalent), "Financial Summary" → /analytics/financial, "Schedule Accuracy" → /analytics/schedule, "Case Analytics" → /cases
   - Use subtle hover effect, consistent with existing card patterns
4. Wire both into the dashboard page — chart as a full-width section between the two-column area and quick access
5. Run 3-stage test gate

**Acceptance:**
- [ ] Trend chart renders with 30-day utilization data by default
- [ ] Metric dropdown switches between at least 3 metrics and chart updates
- [ ] Chart loads independently from rest of dashboard (lazy/separate fetch)
- [ ] Quick access cards render with correct links to existing pages
- [ ] Chart is responsive and doesn't break layout on resize
- [ ] All 5 dashboard sections now visible: KPIs → Two-column (Alerts + Rooms) → Chart → Quick Access

---

## Phase 6: Global Search (Cmd+K) & Polish
**Goal:** Implement basic global search in the header, notification bell, and final polish pass on the complete dashboard.

**Files to create:**
- `components/global/CommandSearch.tsx` — Cmd+K search modal/palette
- `lib/hooks/useGlobalSearch.ts` — hook that searches cases, surgeons, rooms

**Files to modify:**
- `components/layouts/DashboardLayout.tsx` — add search icon + keyboard shortcut listener + notification bell to header
- `app/dashboard/page.tsx` — final layout polish, spacing, loading orchestration

**Steps:**
1. Build `useGlobalSearch` hook:
   - Accept search query string
   - Debounce input (300ms)
   - Search cases by ID or procedure name, surgeons by name, rooms by name
   - Return categorized results: `{ cases: [...], surgeons: [...], rooms: [...] }`
   - Limit to 5 results per category
2. Build CommandSearch component:
   - Modal/palette that opens on Cmd+K (or clicking search icon)
   - Input field at top, results grouped by category below
   - Each result shows: icon (case/surgeon/room), primary text, secondary text
   - Click result → navigate to that page
   - Escape or click outside → close
   - Keep it simple — this is v1, not a full Spotlight clone
3. Add notification bell to header:
   - Badge showing count of Needs Attention items
   - Click opens a dropdown showing the same alerts as the dashboard (reuse `useDashboardAlerts`)
   - Each item clickable, same as on dashboard
4. Final polish:
   - Review all spacing, alignment, and visual consistency against reference images
   - Ensure loading states are smooth (skeleton loaders, not spinners)
   - Verify all click-through links work
   - Test with empty data (new facility, no cases)
   - Test with realistic data volumes
   - Verify responsive behavior (sidebar collapsed, narrow viewport)
5. Run 3-stage test gate (full pass — all dashboard features)

**Acceptance:**
- [ ] Cmd+K opens search palette from anywhere in the app
- [ ] Search returns results for cases, surgeons, and rooms
- [ ] Clicking a search result navigates to the correct page
- [ ] Notification bell shows alert count badge
- [ ] Bell dropdown shows alerts matching dashboard Needs Attention
- [ ] Dashboard loads cleanly with no layout shift
- [ ] All dashboard sections render correctly with real data
- [ ] Empty state (no cases, new facility) doesn't error
- [ ] Responsive layout works at common breakpoints
- [ ] All tests pass: `npm run typecheck && npm run lint && npm run test`
- [ ] No TypeScript `any` types introduced

---

## Session Log

<!-- /wrap-up appends entries here -->
