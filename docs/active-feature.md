# Feature: Data Quality Page Redesign

**Branch:** `feature/data-quality-redesign`
**Created:** 2026-02-20
**Design Reference:** `docs/data-quality-redesign.jsx`

## Goal

Redesign the Data Quality page from a monolithic 2,026-line page with a center-screen modal into a polished, component-based page with an overlay slide-out drawer for case review. Move the route from `/dashboard/data-quality` to `/data-quality` (top-level, matching the app's standard routing pattern). The new design features a quality gauge, case-grouped table, inline scan progress, and a rich review drawer with milestone timeline and impact analysis.

## Problem

The current Data Quality page has several issues:
1. **Wrong route location:** It's the only feature nested under `/dashboard/` — everything else (analytics, cases, settings) is top-level
2. **Monolithic file:** All 2,026 lines live in a single `page.tsx` with no component decomposition
3. **Modal-based review:** The current review flow uses a center-screen modal that's cramped and disconnects the user from the issues table
4. **Basic summary cards:** Simple text-only cards without visual hierarchy — no quality gauge, no severity breakdown visualization
5. **Flat issue list:** Issues are listed individually rather than grouped by case, making it hard to see the case-level picture
6. **Modal-based scan progress:** Detection scan shows in a blocking modal instead of inline

## Requirements

### Route Restructuring
1. Move the page from `app/dashboard/data-quality/` to `app/data-quality/`
2. Update the navigation config href from `/dashboard/data-quality` to `/data-quality`
3. Move existing tests to the new location
4. Clean up the old route directory

### Page Layout — Summary Row
5. Quality Score card with half-circle gauge visualization (SVG arc, color-coded: green >= 90, amber >= 70, red < 70)
6. Stats grid (3 cards): Open Issues (count + cases affected), Expiring Soon (within 7 days), By Severity (error/warning/info badges)
7. Grid layout: gauge card on left, 3 stat cards in a right-side grid

### Page Layout — Scan & Detection
8. Scan status indicator in the header area (dot + timestamp, green=current, amber=stale)
9. "Run Detection" button with gradient styling in the header
10. Inline scan progress bar (NOT a modal) — shows steps with checkmarks as they complete
11. Progress bar uses a gradient track (blue to purple)

### Page Layout — Filter Bar
12. Filter bar with issue type dropdown, "Show resolved" checkbox, selection count, and "Exclude Selected" bulk action
13. Summary count (X cases / Y issues) in the filter bar

### Page Layout — Issues Table
14. CSS Grid table with columns: checkbox, case info, issue types, severity, expires, action button
15. Issues grouped by case (one row per case, not per individual issue)
16. Case info shows: case number (mono, blue), surgeon, procedure, side, and affected milestones summary
17. Issue type chips with severity coloring (red for error, amber for warning, blue for info)
18. Severity column with colored dot + issue count
19. Expiration column with color coding (red <= 7d, amber <= 14d, default otherwise)
20. Row hover state, active row highlight (blue-left border when drawer open for that case)
21. Error-severity rows get a red left border
22. Select-all checkbox in the table header
23. "Review" button on each row that opens the drawer

### Review Drawer (Slide-Over Panel)
24. Fixed-position drawer, 520px wide, slides in from the right edge
25. **OVERLAY behavior** — the drawer renders on top of the page content (no margin/width adjustment to the main content)
26. Semi-transparent backdrop overlay when drawer is open
27. Smooth slide animation (cubic-bezier transition)
28. Drawer header: icon + "Review Case" title, close button, case number + surgeon/procedure/side
29. Issues banner: severity-colored background, issue count, issue type chips, "detected X days ago" text
30. Case details section: 3-column grid showing procedure, side, date, scheduled start, surgeon, room
31. Impact analysis section: 2-column layout — "Cannot Calculate" (red, X icons) and "Can Calculate" (green, check icons) metrics
32. Milestone timeline: vertical track with connected nodes (filled green = recorded, hollow = missing, filled amber = issue), milestone name, time display, edit/add buttons
33. Resolution notes textarea
34. Drawer footer (sticky): "Open Case" link button (left), "Exclude" button (red) + "Validate & Resolve" button (green gradient) on right

### Existing Functionality to Preserve
35. All resolution logic (approve, exclude, bulk exclude, mark completed, mark cancelled for stale cases)
36. Milestone inline editing with datetime input
37. Impact calculation (METRIC_REQUIREMENTS mapping)
38. Validation warning flow (missing milestones -> affected metrics -> continue anyway)
39. Stale case detection and special handling (stale_in_progress, abandoned_scheduled, no_activity)
40. Audit logging via `dataQualityAudit`
41. URL-based case filter (`?caseId=`) with removable chip
42. Data loading via `lib/dataQuality.ts` (fetchMetricIssues, calculateDataQualitySummary, etc.)
43. LocalStorage-based last scan time persistence

## Database Context

No database changes needed. The page uses existing tables and functions:
- `metric_issues` — issue records with resolution tracking
- `issue_types` — lookup table (too_fast, missing, impossible, incomplete, stale_in_progress, etc.)
- `resolution_types` — lookup table (approved, excluded, expired)
- `case_milestones` — milestone timestamps per case
- `facility_milestones` — facility-specific milestone definitions with pairing
- `cases` — case records with `data_validated`, `is_excluded_from_metrics` flags
- `run_issue_detection_for_case()` — Postgres RPC for milestone detection
- `expire_old_issues()` — Postgres RPC for expiration

## UI/UX

- **Route:** `/data-quality` (moved from `/dashboard/data-quality`)
- **Design reference:** `docs/data-quality-redesign.jsx`
- **Drawer behavior:** Overlay (renders on top of page, does NOT push/collapse main content)
- **Color system:** Uses existing Tailwind palette — blue-600 primary, amber for warnings, red for errors, green for success
- **Font usage:** DM Sans for body (already the app font), JetBrains Mono for numeric values (case numbers, scores, times)
- **Icons:** lucide-react (Shield, AlertTriangle, Check, Clock, RefreshCw, Filter, Eye, Ban, ExternalLink, Activity, X, ChevronRight)
- **Animations:** Fade-in on page load, slide transitions on drawer, spin on scan button, progress bar animation

## What Changes

| Area | Current | New |
|------|---------|-----|
| Route | `/dashboard/data-quality` | `/data-quality` |
| Page structure | Single 2,026-line file | Decomposed into ~8 components |
| Review flow | Center-screen modal | Overlay slide-out drawer |
| Summary | 4 text cards in a row | Quality gauge + 3 stat cards |
| Scan progress | Blocking modal | Inline progress bar |
| Issue display | Individual issue rows | Case-grouped rows with chips |
| Table layout | Flexbox divs | CSS Grid with proper columns |

## What Doesn't Change

- `lib/dataQuality.ts` — all fetch/detection/resolution functions stay as-is
- `lib/audit-logger.ts` — audit logging calls stay the same
- Database schema — no migrations needed
- Resolution logic — approve, exclude, bulk exclude, stale case flows
- METRIC_REQUIREMENTS constant — stays in the page component (or moves to a shared file)
- URL-based filtering (`?caseId=`)

## Files Likely Involved

### Create
- `app/data-quality/page.tsx` — new page entry point (Suspense wrapper)
- `components/data-quality/DataQualityPage.tsx` — main page component (orchestrator)
- `components/data-quality/QualityGauge.tsx` — half-circle SVG gauge
- `components/data-quality/SummaryRow.tsx` — gauge card + 3 stat cards
- `components/data-quality/ScanProgress.tsx` — inline scan progress bar
- `components/data-quality/FilterBar.tsx` — filters, show resolved, bulk actions
- `components/data-quality/IssuesTable.tsx` — CSS Grid case-grouped table
- `components/data-quality/ReviewDrawer.tsx` — slide-over panel with all review sections
- `components/data-quality/MilestoneTimeline.tsx` — vertical timeline with edit capability
- `components/data-quality/IssueChip.tsx` — severity-colored issue type badge
- `components/data-quality/SeverityBadge.tsx` — severity indicator with dot + count

### Modify
- `components/layouts/navigation-config.tsx` — update href to `/data-quality`
- `lib/breadcrumbs.ts` — add `/data-quality` route breadcrumb entry

### Delete
- `app/dashboard/data-quality/page.tsx` — replaced by new location
- `app/dashboard/data-quality/__tests__/` — move tests to new location

### Reference (read-only)
- `lib/dataQuality.ts` — data fetching, detection, resolution (unchanged)
- `lib/audit-logger.ts` — audit logging (unchanged)
- `docs/data-quality-redesign.jsx` — design mockup

## iOS Parity
- [ ] Not applicable — iOS app does not have a data quality page

## Known Issues / Constraints
- The design mockup uses inline styles and its own Icon component — we translate to Tailwind + lucide-react
- The mockup shows the drawer pushing content (`marginRight`) — per user requirement, the drawer should OVERLAY instead
- The mockup uses raw JSX with no data fetching — all data integration comes from existing `lib/dataQuality.ts`
- Pre-existing typecheck errors in test files (mock types) — not blocking
- The `METRIC_REQUIREMENTS` constant currently lives in the page file — will move to a shared location
- The existing validation warning overlay (absolute positioning inside the modal) needs to be adapted for the drawer context

## Out of Scope
- Database schema changes or new migrations
- Changes to `lib/dataQuality.ts` detection/resolution logic
- New issue types or detection algorithms
- Mobile/responsive layout optimization
- Settings page for data quality configuration
- Historical trend charts for quality scores
- iOS implementation

## Acceptance Criteria
- [ ] Page loads at `/data-quality` with correct breadcrumb (`Facility > Data Quality`)
- [ ] `/dashboard/data-quality` no longer exists (old route removed)
- [ ] Navigation sidebar links to `/data-quality`
- [ ] Quality gauge renders correctly with color-coded arc (green/amber/red)
- [ ] Summary cards show open issues, expiring soon, severity breakdown
- [ ] "Run Detection" button triggers scan with inline progress bar (not modal)
- [ ] Issues table groups by case with correct columns and CSS Grid layout
- [ ] Clicking "Review" opens overlay drawer (page content is NOT pushed/collapsed)
- [ ] Drawer shows: issues banner, case details, impact analysis, milestone timeline, notes
- [ ] Milestone editing works in the drawer (add/edit timestamps)
- [ ] "Validate & Resolve" resolves all issues for the case and marks `data_validated`
- [ ] "Exclude" marks case excluded from metrics and resolves issues
- [ ] Bulk selection and "Exclude Selected" works from the table
- [ ] Stale case special handling (mark completed/cancelled) works in the drawer
- [ ] URL filter (`?caseId=`) still works with removable chip
- [ ] "Open Case" button navigates to `/cases/[id]`
- [ ] All existing tests pass or are updated for new file locations
- [ ] `npm run typecheck && npm run lint && npm run test` passes
- [ ] No TypeScript `any` types introduced

## Implementation Plan

### Phase 1: Route Migration & Component Scaffold
Move the page to `/data-quality`, update navigation, and create the component file structure with placeholder components.

**Scope:**
- Create `app/data-quality/page.tsx` with Suspense wrapper
- Create `components/data-quality/` directory with skeleton files
- Create `DataQualityPage.tsx` as the main orchestrator — copy existing data fetching/state logic from the old page
- Update `navigation-config.tsx` href
- Update `lib/breadcrumbs.ts` with new route
- Move `__tests__/` to new location
- Remove old `app/dashboard/data-quality/` directory

**Test gate:**
- Page loads at `/data-quality` with existing functionality (can use old UI initially)
- Navigation link works
- Breadcrumb shows correctly
- Old route no longer exists
- Existing tests pass at new location

### Phase 2: Summary Row & Quality Gauge
Build the quality gauge SVG component and the redesigned summary row.

**Scope:**
- `QualityGauge.tsx` — half-circle SVG arc with animated progress, color-coded by score
- `SummaryRow.tsx` — grid layout: gauge card (left) + 3 stat cards (right)
- `SeverityBadge.tsx` — dot + count + label badge
- Wire into `DataQualityPage.tsx`, replacing old summary cards

**Test gate:**
- Gauge renders with correct arc percentage and color
- Summary cards show real data (open issues, expiring, severity)
- Responsive layout works

### Phase 3: Scan Progress & Header
Build the redesigned header with scan status and inline progress bar.

**Scope:**
- Page header with shield icon, title, description
- Scan status indicator (dot + timestamp) in header
- "Run Detection" button with gradient styling
- `ScanProgress.tsx` — inline progress bar with step labels and checkmarks
- Replace the old detection modal with inline progress

**Test gate:**
- Scan button triggers detection
- Progress shows inline (not in a modal)
- Step labels update with checkmarks as scan progresses
- Last scan time persists across page loads

### Phase 4: Filter Bar & Issues Table
Build the redesigned filter bar and case-grouped issues table.

**Scope:**
- `FilterBar.tsx` — issue type select, show resolved checkbox, selection count, bulk exclude button, case count summary
- `IssueChip.tsx` — severity-colored issue type badge
- `IssuesTable.tsx` — CSS Grid table grouped by case
  - Table header with select-all
  - Case rows with: checkbox, case info (number, surgeon, procedure, side, milestones), issue chips, severity indicator, expiry, review button
  - Row hover/active states, left-border severity/active indicators
- Wire filter state and selection state

**Test gate:**
- Table renders with real case-grouped data
- Filters work (type, show resolved)
- Checkboxes work (individual, per-case, select-all)
- Bulk exclude button appears when items selected
- URL filter chip appears for `?caseId=` param

### Phase 5: Review Drawer — Structure & Case Info
Build the drawer shell with overlay behavior and the top sections.

**Scope:**
- `ReviewDrawer.tsx` — fixed overlay panel (520px, right edge, backdrop overlay)
- Slide-in/out animation with cubic-bezier
- Backdrop click to close
- Drawer header (icon, title, close button, case info)
- Issues banner (severity-colored, issue count, chips, detection time)
- Case details section (3-column grid)
- Wire drawer open/close to table row clicks

**Test gate:**
- Clicking "Review" opens drawer as overlay (page does NOT shift)
- Backdrop renders behind drawer
- Close button and backdrop click close the drawer
- Case info and issues display correctly

### Phase 6: Review Drawer — Impact, Timeline & Actions
Complete the drawer with impact analysis, milestone timeline, and action buttons.

**Scope:**
- Impact analysis section (can/cannot calculate metrics in 2-column layout)
- `MilestoneTimeline.tsx` — vertical track with:
  - Connected nodes (filled green = recorded, hollow = missing, filled amber = issue)
  - Milestone name, time display, issue/modified badges
  - Edit/Add buttons with datetime-local input
- Resolution notes textarea
- Drawer footer (sticky): Open Case, Exclude, Validate & Resolve buttons
- Validation warning flow (adapted from modal to drawer context)
- Stale case special handling (mark completed/cancelled buttons)
- Wire all resolution actions (approve, exclude, milestone save)

**Test gate:**
- Impact analysis updates when milestones are edited
- Milestone editing works (add timestamp, edit existing)
- "Validate & Resolve" resolves all case issues
- "Exclude" marks case excluded
- Validation warning shows when metrics would be lost
- Stale case actions work (mark completed/cancelled)
- Audit logging fires on resolution

### Phase 7: Polish, Edge Cases & Testing
Final polish, animations, edge case handling, and comprehensive testing.

**Scope:**
- Page load animations (fade-in stagger on summary, filter bar, table)
- Empty state (no issues found — green checkmark)
- Loading state (spinner)
- Bulk exclude modal/confirmation
- "Open Case" navigation (new tab)
- Clean up any remaining old code references
- Run full test suite, fix any regressions
- Typecheck, lint, verify no `any` types

**Test gate:**
- All acceptance criteria met
- `npm run typecheck && npm run lint && npm run test` passes
- No TypeScript `any` types
- Animations are smooth and non-janky
- Edge cases handled (0 issues, 1 issue, many issues, all resolved)
