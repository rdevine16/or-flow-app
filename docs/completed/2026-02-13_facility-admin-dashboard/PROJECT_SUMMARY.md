# Project: Facility Admin Dashboard
**Completed:** 2026-02-13
**Branch:** feature/facility-admin-dashboard
**Duration:** 2026-02-13 → 2026-02-13
**Total Phases:** 6

## What Was Built
A comprehensive facility admin dashboard that serves as the default landing page after login. The dashboard provides a single-view operational overview combining KPI metrics with trend indicators, actionable alerts surfaced from real database queries, live room status derived from today's case schedule, a 30-day trend chart with metric switching, and quick-access navigation cards to deeper analytics pages.

The existing "Dashboard" route (daily room schedule grid) was renamed to "Rooms" and all navigation was restructured. A global search (Cmd+K) was added to the header along with a notification bell that mirrors the dashboard's Needs Attention alerts. The facility ORbit Score is implemented as a stub (simple average of key metrics) with the understanding that the full scoring engine will be built separately.

Key design decisions include: time-derived room status (not stored — computed from comparing current time against today's case schedule), batched alert queries (one query per alert type, not N+1), independent chart data fetching (doesn't block initial render), and a stubbed facility score that normalizes and averages utilization, turnover, FCOTS, and cancellation rate.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Navigation restructuring & route setup | bc8c19e |
| 2 | KPI cards & data layer | 51a3453 |
| 3 | Needs Attention alert list | 5f79770 |
| 4 | Room Status cards & Today's Surgeons list | fe159d6 |
| 5 | Trend Chart & Quick Access Cards | 7190744 |
| 6 | Global Search, Notification Bell, and Polish | fb9f2eb |

## Key Files Created/Modified

### New Components
- `components/dashboard/FacilityScoreCard.tsx` — stubbed facility score display with letter grade
- `components/dashboard/NeedsAttention.tsx` — prioritized alert list from real data queries
- `components/dashboard/RoomStatusCard.tsx` — compact room status with current/next case
- `components/dashboard/TodaysSurgeons.tsx` — surgeon list with remaining cases and grade badges
- `components/dashboard/TrendChart.tsx` — 30-day line chart with metric selector
- `components/dashboard/QuickAccessCards.tsx` — navigation shortcut cards
- `components/global/NotificationBell.tsx` — header bell icon with alert dropdown
- `components/GlobalSearch.tsx` — Cmd+K search palette for cases, surgeons, rooms

### New Hooks
- `lib/hooks/useDashboardKPIs.ts` — fetches and computes KPI metrics with time range support
- `lib/hooks/useDashboardAlerts.ts` — runs 6 alert type queries, returns prioritized results
- `lib/hooks/useTodayStatus.ts` — derives room statuses and surgeon schedules from today's cases
- `lib/hooks/useTrendData.ts` — fetches aggregated daily metrics for charting

### New Utilities
- `lib/facilityScoreStub.ts` — simple composite score calculation (average of normalized metrics)

### Modified Files
- `app/dashboard/page.tsx` — new dashboard page with all 5 sections
- `components/layouts/DashboardLayout.tsx` — sidebar nav updates (renamed, reordered)
- `components/layouts/navigation-config.tsx` — nav item configuration
- `components/layouts/Header.tsx` — added search icon and notification bell

## Architecture Decisions
- **Room status is derived, not stored** — comparing current time against today's case schedule at query time. "In Case", "Turning Over", "Idle", and "Done" states are computed dynamically.
- **Facility ORbit Score is a stub** — simple average of (utilization, inverse turnover, FCOTS, 1 - cancellation rate) scaled to 0-100. NOT the full MAD-based scoring engine.
- **Alert queries are batched** — one query per alert type (validation, missing milestones, behind schedule, score decline, stale cases, block conflicts). No N+1 patterns.
- **Chart data fetches independently** — trend chart doesn't block initial dashboard render.
- **Time context toggle** — Today/This Week/This Month shifts KPI card data and trend comparisons.
- **Global search is v1** — basic search across cases (by ID/number), surgeons (by name), and rooms (by name). Not a full Spotlight clone.
- **Notification bell reuses alert hook** — same `useDashboardAlerts` hook powers both the dashboard Needs Attention list and the header notification dropdown.

## Database Changes
No new tables, columns, views, triggers, migrations, or RPC functions were created. All data is read from existing tables and views:
- `cases` — status, scheduling, validation flags
- `case_milestones` — milestone recording timestamps
- `case_completion_stats` — pre-computed case statistics
- `rooms` — room names and facility association
- `surgeons` / `providers` — surgeon information
- `facility_settings` — configuration thresholds

## Known Limitations / Future Work
- **Facility ORbit Score** is explicitly a stub — full scoring engine (pillar definitions, MAD scoring, weighting) is a separate project
- **No real-time updates** — room status uses page load / manual refresh, not WebSocket polling
- **Notification bell** shows same data as dashboard alerts, not a separate notification store
- **No mobile-specific layout** — responsive stacking only
- **No dark mode** support
- **Test coverage gaps** — GlobalSearch.tsx and useTodayStatus.ts lack dedicated unit tests; no end-to-end workflow tests exist
- **3 minor lint issues** — 2 unescaped quotes in GlobalSearch.tsx, 1 unused import in NeedsAttention.tsx
