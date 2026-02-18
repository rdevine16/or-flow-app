# Feature: Unified Header Breadcrumb

## Goal
Consolidate the app's breadcrumb navigation into a single, consistent trail in the Header bar that automatically deepens as users navigate into sub-pages. Remove all duplicate per-page breadcrumbs.

## Problem
The app currently has two separate breadcrumb layers that don't work together:
1. **Header** (always visible, top bar): Shows `Facility Name > [Top-Level Nav Item]` but never deepens — navigating to `/analytics/surgeons` still shows just "Analytics"
2. **Per-page breadcrumbs**: Some pages render their own breadcrumbs inside the content area:
   - Analytics sub-pages use `AnalyticsPageHeader` to show `Analytics > Surgeon Performance`
   - Settings pages use `SettingsTabLayout` with `<Breadcrumb>` to show `Facility > Settings > [Page]`
   - `SettingsLanding` has its own `Facility > Settings` breadcrumb
   - Many pages have no breadcrumb at all (kpi, flags, orbit-score, cases, rooms, etc.)

## Requirements

### Unified Header Breadcrumb
1. The Header bar should display a full breadcrumb trail that automatically deepens based on the current route
2. Examples:
   - `/analytics` → `Facility > Analytics`
   - `/analytics/surgeons` → `Facility > Analytics > Surgeon Performance`
   - `/settings/users` → `Facility > Settings > Users & Roles`
   - `/settings/financials/cost-categories` → `Facility > Settings > Cost Categories`
   - `/cases/[id]` → `Facility > Cases > Case #1042`
3. All segments except the last should be clickable links for navigation
4. The last segment should be bold, non-clickable (current page indicator)
5. The facility name (first segment) should link to `/` (dashboard)
6. Admin mode pages show breadcrumbs without facility prefix (e.g., `Admin > Facilities`)

### Remove Per-Page Breadcrumbs
7. Remove the `<nav>` breadcrumb from `AnalyticsPageHeader` — keep the title/description/actions (H1)
8. Remove the breadcrumb from `SettingsTabLayout` — keep TabBar and SubNav
9. Remove the breadcrumb from `SettingsLanding` — keep the landing page cards

### Dynamic Segment Labels
10. Case detail pages (`/cases/[id]`) should display "Case #1042" (from data) instead of the raw UUID
11. While case data is loading, fall back to a generic label
12. A context-based hook (`useBreadcrumbLabel`) enables any page to register a custom label for its dynamic segment

## Database Context
- No database changes needed
- No new tables or migrations

## UI/UX
- Breadcrumb lives in the existing Header bar (64px tall, `components/layouts/Header.tsx`)
- Uses existing design language: `text-slate-500` for clickable segments, `text-slate-900 font-semibold` for current page, `ChevronRight` separators
- Facility logo and name remain as the leftmost element (already in Header)
- Truncation via `truncate` class on segments when space is limited

## Technical Approach

### Route-to-Breadcrumb Map
- Static `ROUTE_BREADCRUMBS` map in `lib/breadcrumbs.ts` mapping pathnames to segment arrays
- Labels like "Block Utilization" and "ORbit Score" can't be derived from URL slugs — static map is required
- `resolveBreadcrumbs(pathname, dynamicLabels)` function handles exact match, dynamic segments, and longest-prefix fallback

### Settings Breadcrumbs
- Settings uses existing `getNavItemForPath()` from `lib/settings-nav-config.ts` (28 items across 8 categories)
- Avoids duplicating all settings labels in the route map
- Header calls `getNavItemForPath(pathname)` to get the settings page label

### BreadcrumbContext
- New `lib/BreadcrumbContext.tsx` — provider + hooks
- `BreadcrumbProvider` wraps `DashboardLayout` content
- `useBreadcrumbLabel(pathnameKey, label)` — pages register dynamic labels
- `useBreadcrumbContext()` — Header reads dynamic labels
- Bail-out optimization: no re-render if label unchanged

## Files Likely Involved
- `lib/breadcrumbs.ts` — add `ROUTE_BREADCRUMBS`, `RouteSegment` type, `resolveBreadcrumbs()`
- `lib/BreadcrumbContext.tsx` — NEW: provider + hooks for dynamic labels
- `components/layouts/DashboardLayout.tsx` — wrap with `BreadcrumbProvider`
- `components/layouts/Header.tsx` — replace static breadcrumb with dynamic trail
- `components/analytics/AnalyticsBreadcrumb.tsx` — remove `<nav>`, keep page header
- `components/settings/SettingsTabLayout.tsx` — remove breadcrumb
- `components/settings/SettingsLanding.tsx` — remove breadcrumb
- `app/cases/[id]/page.tsx` — add `useBreadcrumbLabel` hook
- `app/cases/[id]/edit/page.tsx` — add `useBreadcrumbLabel` hook (if exists)

## iOS Parity
- [ ] Not applicable — iOS app has its own navigation patterns

## Known Issues / Constraints
- The existing `BREADCRUMB_MAP` and `?from=` system in `lib/breadcrumbs.ts` stays untouched for now (used by `DrillDownLink` for drill-down navigation)
- `AnalyticsPageHeader` keeps its H1/description/actions — only the breadcrumb `<nav>` is removed
- Settings `TabBar` and `SubNav` are NOT breadcrumbs and remain unchanged
- Admin mode has no facility prefix since there's no impersonation active
- Pre-existing lint error in PhaseCard.tsx (unrelated, ignore)

## Out of Scope
- Removing the old `BREADCRUMB_MAP` / `?from=` system (still used by drill-down links)
- Modifying the Sidebar or SubNavigation
- Adding breadcrumbs to the mobile/responsive sidebar
- iOS implementation

## Acceptance Criteria
- [ ] Header shows full breadcrumb trail on ALL pages (analytics, settings, cases, rooms, etc.)
- [ ] Intermediate breadcrumb segments are clickable and navigate correctly
- [ ] No duplicate breadcrumbs in page content area (analytics, settings)
- [ ] `/analytics/surgeons` shows `Facility > Analytics > Surgeon Performance`
- [ ] `/settings/financials/cost-categories` shows `Facility > Settings > Cost Categories`
- [ ] `/cases/[uuid]` shows `Facility > Cases > Case #[number]` after data loads
- [ ] Admin mode pages show breadcrumbs without facility prefix
- [ ] `AnalyticsPageHeader` still renders title/description/actions (just no nav)
- [ ] Settings TabBar and SubNav still work correctly
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
- [ ] Committed with descriptive messages per phase
