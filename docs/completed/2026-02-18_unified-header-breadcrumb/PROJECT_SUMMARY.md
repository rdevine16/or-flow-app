# Project: Unified Header Breadcrumb
**Completed:** 2026-02-18
**Branch:** feature/unified-header-breadcrumb
**Duration:** 2026-02-18 → 2026-02-18
**Total Phases:** 3

## What Was Built
Consolidated the app's breadcrumb navigation into a single, consistent trail in the Header bar. Previously, the app had two disconnected breadcrumb layers — a shallow Header display that never deepened past the top-level nav item, and scattered per-page breadcrumbs in analytics and settings pages. Many pages had no breadcrumb at all.

The new system uses a static route-to-breadcrumb map with a resolver function that handles exact matches, dynamic `[id]` segments, and a settings-nav-config fallback. A React context (`BreadcrumbProvider`) allows pages to register dynamic labels (e.g., "Case #1042") that replace generic placeholders in the Header trail. All per-page breadcrumbs were removed, giving every page exactly one breadcrumb in a consistent location.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Route map, resolver, and BreadcrumbContext | a934114 |
| 2     | Header dynamic breadcrumb trail and BreadcrumbProvider | 6d31800 |
| 3     | Remove duplicate breadcrumbs, add dynamic labels | c365520 |
| fix   | BreadcrumbLabel component inside DashboardLayout children | 6376661 |
| fix   | PhaseCard setState-in-effect lint error | 4eb81b5 |

## Key Files Created/Modified
### New
- `lib/breadcrumbs.ts` — `ROUTE_BREADCRUMBS` map, `RouteSegment` type, `resolveBreadcrumbs()` resolver
- `lib/BreadcrumbContext.tsx` — `BreadcrumbProvider`, `useBreadcrumbLabel()`, `useBreadcrumbContext()`, `BreadcrumbLabel` component
- `lib/__tests__/breadcrumb-resolver.test.ts` — 30 unit tests for resolver
- `lib/__tests__/breadcrumb-context.test.tsx` — 8 unit tests for context
- `components/layouts/__tests__/Header.breadcrumbs.test.tsx` — 26 integration tests for Header breadcrumb rendering

### Modified
- `components/layouts/Header.tsx` — replaced flat breadcrumb with dynamic trail rendering
- `components/layouts/DashboardLayout.tsx` — wrapped content with `BreadcrumbProvider`
- `components/analytics/AnalyticsBreadcrumb.tsx` — removed `<nav>` breadcrumb, kept page header
- `components/settings/SettingsTabLayout.tsx` — removed `<Breadcrumb>` render
- `components/settings/SettingsLanding.tsx` — removed breadcrumb render
- `app/cases/[id]/page.tsx` — added `BreadcrumbLabel` for "Case #1042"
- `app/cases/[id]/cancel/page.tsx` — added `BreadcrumbLabel` for case label
- `app/admin/facilities/[id]/page.tsx` — added `BreadcrumbLabel` for facility name

### Also on this branch (non-breadcrumb)
- `app/settings/phases/page.tsx` — replaced HTML5 drag-and-drop with @dnd-kit
- `components/settings/phases/PhaseCard.tsx` — rewritten for @dnd-kit, lint fix
- `components/cases/CaseDrawerFinancials.tsx` — margin gauges fix, projected/actual badge
- `lib/hooks/useFinancialComparison.ts` — configurable benchmark case count
- `app/settings/analytics/page.tsx` — financial_benchmark_case_count setting

## Architecture Decisions
- **Static map over URL parsing:** Labels like "ORbit Score", "Block & Room Utilization" can't be derived from URL slugs, so a static map is the right approach.
- **Settings delegation:** Settings labels are resolved via `getNavItemForPath()` from `settings-nav-config.ts` rather than duplicating 28 labels in the route map.
- **Split contexts:** `LabelsContext` (read) and `RegisterContext` (write) are separate to minimize re-renders — registering a label doesn't cause all consumers to re-render.
- **BreadcrumbLabel component:** Added as a render-based alternative to `useBreadcrumbLabel` hook because page components are parents of `DashboardLayout`, not children. The component is placed as a child of `DashboardLayout` to sit inside the `BreadcrumbProvider`.
- **Old system preserved:** The existing `BREADCRUMB_MAP` and `?from=` query parameter system was intentionally left in place — it's used by `DrillDownLink` for drill-down navigation, which is a different concern.

## Database Changes
- Migration `20260219000010_add_financial_benchmark_case_count.sql` — adds `financial_benchmark_case_count` column to `facility_analytics_settings` (non-breadcrumb change on this branch)

## Known Limitations / Future Work
- The old `BREADCRUMB_MAP` / `?from=` system could be removed once drill-down links are migrated
- Mobile/responsive breadcrumb display not addressed (sidebar handles mobile nav)
- 3 pre-existing test failures in `AnalyticsComponentsPhase2.test.tsx` (DayTimeline/CasePhaseBarNested) — unrelated to this branch
- Missing test coverage for: PhaseCard (rewritten), useFinancialComparison (new benchmark), SettingsLanding/SettingsTabLayout (breadcrumb removal)
