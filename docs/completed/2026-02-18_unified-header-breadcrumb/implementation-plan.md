# Implementation Plan: Unified Header Breadcrumb

## Summary
Consolidate the app's breadcrumb navigation into a single, consistent trail in the Header bar. Build a static route map + resolver, a React context for dynamic labels, integrate into the Header, and remove all duplicate per-page breadcrumbs.

## Interview Notes
- **Admin breadcrumbs:** Yes, fix admin mode (currently shows "Dashboard" for all admin pages). Add admin routes to map with full depth (e.g., `Admin > Settings > Milestones`).
- **Settings labels:** Delegate to `getNavItemForPath()` from `settings-nav-config.ts` for `/settings/*` routes — avoid duplicating 28 labels in the route map.
- **UI approach:** Render breadcrumb trail inline in Header.tsx — no coupling to existing `?from=` system or `Breadcrumb` UI component.
- **Case depth:** 3-level trails — `Cases > Case #1042 > Edit`.
- **Admin depth:** Full depth — `Admin > Facilities > [Facility Name]`, `Admin > Settings > Milestones`.
- **Flat pages:** 2-level only — `Facility > Rooms`, `Facility > Block Schedule`, etc.
- **Dashboard nesting:** `Dashboard > Data Quality` for `/dashboard/data-quality` (3-level).

## Dependency Graph
```
Phase 1 (infrastructure) → Phase 2 (header integration) → Phase 3 (remove duplicates + dynamic labels)
```
Strictly sequential — each phase depends on the previous.

---

## Phase 1: Core Breadcrumb Infrastructure

**Complexity:** Medium

### What it does
Build the foundational data layer: a static route-to-breadcrumb map, a resolver function that handles exact matches / dynamic segments / longest-prefix fallback, and a React context for pages to register dynamic labels (e.g., "Case #1042").

### Files touched
- `lib/breadcrumbs.ts` — ADD `RouteSegment` type, `ROUTE_BREADCRUMBS` map, `resolveBreadcrumbs()` function (existing `BREADCRUMB_MAP` / `?from=` system stays untouched)
- `lib/BreadcrumbContext.tsx` — NEW: `BreadcrumbProvider`, `useBreadcrumbLabel()`, `useBreadcrumbContext()`
- `lib/__tests__/breadcrumb-resolver.test.ts` — NEW: unit tests for `resolveBreadcrumbs()`
- `lib/__tests__/breadcrumb-context.test.tsx` — NEW: unit tests for context + hooks

### Route map coverage
Static entries for all non-settings facility routes:
- `/` → Dashboard
- `/dashboard` → Dashboard
- `/dashboard/data-quality` → Dashboard > Data Quality
- `/cases` → Cases
- `/cases/new` → Cases > New Case
- `/cases/bulk-create` → Cases > Bulk Create
- `/cases/[id]` → Cases > [dynamic]
- `/cases/[id]/edit` → Cases > [dynamic] > Edit
- `/cases/[id]/cancel` → Cases > [dynamic] > Cancel
- `/analytics` → Analytics
- `/analytics/surgeons` → Analytics > Surgeon Performance
- `/analytics/block-utilization` → Analytics > Block & Room Utilization
- `/analytics/financials` → Analytics > Financial Analytics
- `/analytics/orbit-score` → Analytics > ORbit Score
- `/analytics/flags` → Analytics > Flags
- `/analytics/kpi` → Analytics > KPI Dashboard
- `/rooms` → Rooms
- `/block-schedule` → Block Schedule
- `/checkin` → Check-In
- `/spd` → SPD
- `/profile` → Profile
- `/settings` → Settings (deeper settings paths handled by `getNavItemForPath()` fallback)

Admin routes (no facility prefix):
- `/admin` → Admin
- `/admin/facilities` → Admin > Facilities
- `/admin/facilities/new` → Admin > New Facility
- `/admin/facilities/[id]` → Admin > Facilities > [dynamic]
- `/admin/audit-log` → Admin > Audit Log
- `/admin/cancellation-reasons` → Admin > Cancellation Reasons
- `/admin/checklist-templates` → Admin > Checklist Templates
- `/admin/complexities` → Admin > Complexities
- `/admin/demo` → Admin > Demo
- `/admin/docs` → Admin > Docs
- `/admin/global-security` → Admin > Global Security
- `/admin/permission-templates` → Admin > Permission Templates
- `/admin/settings/body-regions` → Admin > Settings > Body Regions
- `/admin/settings/cost-categories` → Admin > Settings > Cost Categories
- `/admin/settings/delay-types` → Admin > Settings > Delay Types
- `/admin/settings/implant-companies` → Admin > Settings > Implant Companies
- `/admin/settings/milestones` → Admin > Settings > Milestones
- `/admin/settings/procedure-categories` → Admin > Settings > Procedure Categories
- `/admin/settings/procedure-milestones` → Admin > Settings > Procedure Milestones
- `/admin/settings/procedures` → Admin > Settings > Procedures

### Resolver logic (`resolveBreadcrumbs`)
```
resolveBreadcrumbs(pathname, dynamicLabels, options)
  options: { isAdmin: boolean, facilityName: string | null }
```
1. Exact match in `ROUTE_BREADCRUMBS` → return segments
2. Try replacing path segments with `[id]` or `[token]` placeholders → match dynamic routes
3. For `/settings/*` paths not in map → call `getNavItemForPath(pathname)` and build `[Settings, <label>]`
4. Longest-prefix fallback → return partial match
5. Each segment: `{ label: string, href: string | null }` — last segment has `href: null` (current page)
6. Admin routes (`/admin/*`): segments WITHOUT a facility prefix
7. Non-admin routes: prepend facility name as first segment (`href: '/'`)
8. Dynamic segments marked `[dynamic]` in the map get replaced with labels from `dynamicLabels` map

### BreadcrumbContext design
- `BreadcrumbProvider` holds `Map<string, string>` of pathname-key → label
- `useBreadcrumbLabel(key, label)` — registers a dynamic label, cleans up on unmount
- `useBreadcrumbContext()` — returns the label map (consumed by Header)
- Bail-out: only triggers re-render when a label actually changes (via `useRef` + shallow compare)

### Commit message
`feat(breadcrumbs): phase 1 - route map, resolver, and BreadcrumbContext`

### Test gate
1. **Unit:** `resolveBreadcrumbs()` returns correct segments for: exact matches, dynamic `[id]` routes, settings fallback via `getNavItemForPath`, admin routes (no facility prefix), longest-prefix fallback, unknown routes. BreadcrumbContext registers/unregisters labels correctly.
2. **Integration:** Resolver + settings-nav-config integration — `/settings/financials/cost-categories` returns `[Settings, Cost Categories]`.
3. **Workflow:** Mount a test component that registers a dynamic label → verify context consumers see the label → unmount → verify cleanup.

---

## Phase 2: Header Integration

**Complexity:** Medium

### What it does
Wire the breadcrumb infrastructure into the app. Wrap `DashboardLayout` children with `BreadcrumbProvider`. Replace the Header's flat `Facility > Page Name` display with a dynamic multi-level breadcrumb trail.

### Files touched
- `components/layouts/DashboardLayout.tsx` — wrap content area with `<BreadcrumbProvider>`
- `components/layouts/Header.tsx` — replace flat breadcrumb with dynamic trail rendering

### Header breadcrumb rendering
- Call `resolveBreadcrumbs(pathname, dynamicLabels, { isAdmin, facilityName })`
- Render segments with `ChevronRight` separators
- Clickable segments: `text-slate-500 hover:text-slate-700` as `<Link>`
- Current page (last segment): `text-slate-900 font-semibold`, no link
- Facility logo remains as leftmost element (already exists)
- Truncation: `truncate` class on each segment for space-limited layouts
- Admin mode: no facility prefix segment

### Props changes
- Header already receives `isAdmin` and `pathname` — pass to resolver
- Header is a client component — can call `useBreadcrumbContext()` directly to get dynamic labels

### Commit message
`feat(breadcrumbs): phase 2 - Header dynamic breadcrumb trail and BreadcrumbProvider`

### Test gate
1. **Unit:** Header renders correct breadcrumb trail for various pathnames. All segments except the last are clickable `<Link>` elements. Last segment is bold, non-clickable.
2. **Integration:** DashboardLayout + Header + BreadcrumbContext work together. A child page registering a dynamic label causes the Header to update.
3. **Workflow:** Navigate `/analytics/surgeons` → verify Header shows `Facility > Analytics > Surgeon Performance`. Navigate `/settings/users` → verify `Facility > Settings > Users & Roles`.

---

## Phase 3: Remove Duplicates + Dynamic Labels

**Complexity:** Medium

### What it does
Remove all per-page breadcrumbs (now redundant since the Header handles everything). Wire `useBreadcrumbLabel` into case detail pages and admin facility detail. Clean up unused imports. Run full acceptance testing.

### Files touched
- `components/analytics/AnalyticsBreadcrumb.tsx` — remove `<nav>` from `AnalyticsPageHeader`, keep H1/description/actions. Remove unused `AnalyticsBreadcrumb` default export.
- `components/settings/SettingsTabLayout.tsx` — remove `<Breadcrumb>` render + breadcrumb items construction. Remove `Breadcrumb` import.
- `components/settings/SettingsLanding.tsx` — remove breadcrumb render + items. Remove `Breadcrumb` import. Clean up `userData` usage if only for breadcrumb.
- `app/cases/[id]/page.tsx` — add `useBreadcrumbLabel` to register "Case #1042" from loaded data
- `app/cases/[id]/edit/page.tsx` — add `useBreadcrumbLabel` for the case label
- `app/cases/[id]/cancel/page.tsx` — add `useBreadcrumbLabel` for the case label
- `app/admin/facilities/[id]/page.tsx` — add `useBreadcrumbLabel` for facility name

### Dynamic label implementation
- Case pages: After data loads, call `useBreadcrumbLabel('/cases/[id]', \`Case #\${caseData.case_number}\`)`
- Fallback while loading: resolver shows generic "Case" until the hook fires
- Admin facility: `useBreadcrumbLabel('/admin/facilities/[id]', facilityData.name)`

### Cleanup checklist
- `AnalyticsBreadcrumb` default export — remove (no external consumers)
- `Breadcrumb` import in `SettingsTabLayout` — remove
- `Breadcrumb` import in `SettingsLanding` — remove
- `getNavItemForPath` import in `SettingsTabLayout` — keep (still used for SubNav active state)
- `InheritanceBreadcrumb` — leave alone (config inheritance UI, not a navigation breadcrumb)

### Commit message
`feat(breadcrumbs): phase 3 - remove duplicate breadcrumbs, add dynamic labels`

### Test gate
1. **Unit:** `AnalyticsPageHeader` renders title/description/actions but no `<nav>`. `SettingsTabLayout` renders TabBar/SubNav but no Breadcrumb. Case detail pages register correct dynamic labels.
2. **Integration:** Full page renders — analytics pages show header breadcrumb but no inline breadcrumb. Settings pages show header breadcrumb but no per-page breadcrumb. Case detail shows "Case #1042" in header.
3. **Workflow:** Navigate through analytics → settings → case detail → admin facility detail. Verify every page shows exactly ONE breadcrumb (in the Header), no duplicates, all segments clickable, all labels correct. Run `npm run typecheck && npm run lint && npm run test`.

---

## Complexity Summary

| Phase | Scope | Files | Complexity |
|-------|-------|-------|------------|
| 1 | Route map + resolver + context + tests | 4 new/modified | Medium |
| 2 | Header rendering + DashboardLayout wrapper | 2 modified | Medium |
| 3 | Remove duplicates + dynamic labels + cleanup | 7-8 modified | Medium |

---

## Session Log
<!-- Claude Code appends session summaries here during execution -->

---

## Phase Checklist

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| 1 | Route map, resolver, and BreadcrumbContext | Done | a934114 |
| 2 | Header dynamic breadcrumb trail + BreadcrumbProvider | Done | 6d31800 |
| 3 | Remove duplicate breadcrumbs + dynamic labels | Done | c365520 |
