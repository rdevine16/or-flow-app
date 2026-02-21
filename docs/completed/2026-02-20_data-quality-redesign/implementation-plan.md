# Implementation Plan: Data Quality Page Redesign

**Feature:** Data Quality Page Redesign
**Branch:** `feature/data-quality-redesign`
**Created:** 2026-02-20
**Design Reference:** `docs/data-quality-redesign.jsx`

## Summary

Redesign the Data Quality page from a monolithic 2,026-line file with a center-screen modal into a polished, component-based page with an overlay slide-out drawer for case review. Move the route from `/dashboard/data-quality` to `/data-quality`. Decompose into ~8+ focused components with a quality gauge, case-grouped CSS Grid table, inline scan progress, and a rich Radix Dialog-based review drawer.

## Interview Notes

| Decision | Answer |
|----------|--------|
| Drawer library | **Radix Dialog** — follow CaseDrawer/InsightSlideOver pattern |
| Drawer width | **550px** — match CaseDrawer for visual consistency |
| Drawer behavior | **Overlay** — renders on top of page content, no margin/width adjustment |
| METRIC_REQUIREMENTS location | Move to **lib/dataQuality.ts** alongside other DQ logic |
| Old route handling | **Delete entirely** — no redirect, but update all links across codebase |
| Plan phasing | **Adopt 7-phase plan as-is** from the feature spec |

### Links to Update (found via codebase scan)

**Live code:**
- `components/cases/CasesTable.tsx:152` — `/dashboard/data-quality?caseId=...`
- `lib/hooks/useDashboardAlerts.ts:83` — dashboard alert `linkTo`
- `components/cases/CaseDrawerValidation.tsx:59` — case drawer link
- `lib/breadcrumbs.ts:177` — breadcrumb entry
- `components/layouts/navigation-config.tsx:272` — nav config href

**Test files:**
- `components/cases/__tests__/CasesTable-validation.test.tsx:131`
- `lib/__tests__/breadcrumb-resolver.test.ts:39-40, 276`
- `components/cases/__tests__/CaseDrawerValidation.test.tsx:98`
- `components/layouts/__tests__/Header.breadcrumbs.test.tsx:190-191`
- `components/layouts/__tests__/navigation-config.test.ts:46`

---

## Phase 1: Route Migration & Component Scaffold
**Complexity:** Medium
**Commit:** `feat(data-quality): phase 1 - route migration and component scaffold`

### What it does
- Create `app/data-quality/page.tsx` with Suspense wrapper
- Create `components/data-quality/` directory with skeleton component files (exports + basic structure only)
- Create `DataQualityPage.tsx` as the main orchestrator — copy ALL existing data fetching, state logic, and resolution logic from the old page
- Move `METRIC_REQUIREMENTS` constant to `lib/dataQuality.ts`
- Update `navigation-config.tsx` href from `/dashboard/data-quality` to `/data-quality`
- Update `lib/breadcrumbs.ts`: change key and breadcrumb trail to `Facility > Data Quality`
- Update all cross-codebase links (CasesTable, useDashboardAlerts, CaseDrawerValidation)
- Move `__tests__/metric-requirements.test.ts` to new location
- Update all test files referencing old path
- Delete old `app/dashboard/data-quality/` directory
- Verify page loads at `/data-quality` with existing UI (initially the old UI is fine — just relocated)

### Files touched
- **Create:** `app/data-quality/page.tsx`, `components/data-quality/DataQualityPage.tsx`, skeleton files for QualityGauge, SummaryRow, ScanProgress, FilterBar, IssuesTable, ReviewDrawer, MilestoneTimeline, IssueChip, SeverityBadge
- **Modify:** `components/layouts/navigation-config.tsx`, `lib/breadcrumbs.ts`, `components/cases/CasesTable.tsx`, `lib/hooks/useDashboardAlerts.ts`, `components/cases/CaseDrawerValidation.tsx`, `lib/dataQuality.ts` (add METRIC_REQUIREMENTS)
- **Modify (tests):** `CasesTable-validation.test.tsx`, `breadcrumb-resolver.test.ts`, `CaseDrawerValidation.test.tsx`, `Header.breadcrumbs.test.tsx`, `navigation-config.test.ts`
- **Move:** `app/dashboard/data-quality/__tests__/` to `app/data-quality/__tests__/`
- **Delete:** `app/dashboard/data-quality/`

### Test gate
1. **Unit:** METRIC_REQUIREMENTS exported from lib/dataQuality.ts correctly
2. **Integration:** Page loads at `/data-quality`, navigation link works, breadcrumb shows `Facility > Data Quality`
3. **Workflow:** Click "Needs Validation" in CasesTable → navigates to `/data-quality?caseId=...` → page loads with filter

---

## Phase 2: Summary Row & Quality Gauge
**Complexity:** Medium
**Commit:** `feat(data-quality): phase 2 - summary row with quality gauge`

### What it does
- Build `QualityGauge.tsx` — half-circle SVG arc with animated progress, color-coded by score (green >= 90, amber >= 70, red < 70)
- Build `SeverityBadge.tsx` — dot + count + label badge with severity coloring
- Build `SummaryRow.tsx` — grid layout: gauge card (left) + 3 stat cards in right grid (Open Issues, Expiring Soon, By Severity)
- Wire into `DataQualityPage.tsx`, replacing old summary cards
- Use JetBrains Mono for numeric values, DM Sans for labels

### Files touched
- **Create/populate:** `components/data-quality/QualityGauge.tsx`, `components/data-quality/SeverityBadge.tsx`, `components/data-quality/SummaryRow.tsx`
- **Modify:** `components/data-quality/DataQualityPage.tsx`

### Test gate
1. **Unit:** QualityGauge renders correct arc percentage and color for scores 95, 75, 45
2. **Integration:** Summary row shows real data from `calculateDataQualitySummary()`
3. **Workflow:** Run detection → summary cards update with new counts

---

## Phase 3: Scan Progress & Header
**Complexity:** Small
**Commit:** `feat(data-quality): phase 3 - scan progress and header redesign`

### What it does
- Build page header with shield icon (gradient background), title, description
- Add scan status indicator (colored dot + timestamp) in header area
- Add "Run Detection" button with gradient styling
- Build `ScanProgress.tsx` — inline progress bar with gradient track (blue to purple), step labels with checkmarks
- Replace the old detection modal with inline progress (card that appears below header when scan runs)
- Scanning spinner animation on button

### Files touched
- **Create/populate:** `components/data-quality/ScanProgress.tsx`
- **Modify:** `components/data-quality/DataQualityPage.tsx`

### Test gate
1. **Unit:** ScanProgress renders correct percentage and step labels
2. **Integration:** Scan button triggers detection, progress shows inline (not modal), step labels update with checkmarks
3. **Workflow:** Run scan → progress completes → last scan timestamp updates and persists across page reload (localStorage)

---

## Phase 4: Filter Bar & Issues Table
**Complexity:** Large
**Commit:** `feat(data-quality): phase 4 - filter bar and case-grouped issues table`

### What it does
- Build `IssueChip.tsx` — severity-colored issue type badge (red/amber/blue)
- Build `FilterBar.tsx` — issue type select, show resolved checkbox, selection count, bulk exclude button, case/issue count summary, URL filter chip
- Build `IssuesTable.tsx` — CSS Grid table grouped by case:
  - Table header with select-all checkbox
  - Grid columns: checkbox, case info, issue types, severity, expires, action button
  - Case rows: case number (mono, blue), surgeon, procedure, side, affected milestones summary
  - Issue type chips with severity coloring
  - Severity column with colored dot + issue count
  - Expiration with color coding (red <= 7d, amber <= 14d)
  - Row hover state, active row highlight (blue left-border when drawer open)
  - Error-severity rows get red left border
  - "Review" button on each row
- Wire filter state, selection state, and row click → drawer open

### Files touched
- **Create/populate:** `components/data-quality/IssueChip.tsx`, `components/data-quality/FilterBar.tsx`, `components/data-quality/IssuesTable.tsx`
- **Modify:** `components/data-quality/DataQualityPage.tsx`

### Test gate
1. **Unit:** IssueChip renders correct colors for each severity, FilterBar shows/hides bulk action button
2. **Integration:** Table renders with real case-grouped data, filters work (type filter, show resolved), checkboxes work (individual, select-all), URL filter chip appears for `?caseId=`
3. **Workflow:** Filter by issue type → table updates → select cases → bulk exclude button appears with count

---

## Phase 5: Review Drawer — Structure & Case Info
**Complexity:** Medium
**Commit:** `feat(data-quality): phase 5 - review drawer structure and case info`

### What it does
- Build `ReviewDrawer.tsx` using Radix Dialog pattern (matching CaseDrawer/InsightSlideOver):
  - Fixed overlay panel, 550px wide, right edge
  - Semi-transparent backdrop overlay (no content push)
  - Slide-in/out animation with cubic-bezier via Radix `data-[state=open/closed]`
  - Close on backdrop click + Escape key
- Drawer header: gradient icon + "Review Case" title, close button, case number + surgeon/procedure/side
- Issues banner: severity-colored background, issue count, issue type chips, detection time
- Case details section: 3-column grid (procedure, side, date, scheduled start, surgeon, room)
- Wire drawer open/close to table row "Review" button clicks

### Files touched
- **Create/populate:** `components/data-quality/ReviewDrawer.tsx`
- **Modify:** `components/data-quality/DataQualityPage.tsx`, `components/data-quality/IssuesTable.tsx`

### Test gate
1. **Unit:** ReviewDrawer renders with correct case info, issues banner shows severity colors
2. **Integration:** Clicking "Review" opens drawer as overlay (page does NOT shift), backdrop renders, close button and backdrop click close drawer, active row highlighted in table
3. **Workflow:** Click Review on case → drawer opens → verify case info matches table row → close → highlight removed

---

## Phase 6: Review Drawer — Impact, Timeline & Actions
**Complexity:** Large
**Commit:** `feat(data-quality): phase 6 - drawer impact analysis, milestone timeline, and resolution actions`

### What it does
- Impact analysis section: 2-column layout — "Cannot Calculate" (red, X icons) + "Can Calculate" (green, check icons) using METRIC_REQUIREMENTS from lib/dataQuality.ts
- Build `MilestoneTimeline.tsx` — vertical track with:
  - Connected nodes (filled green = recorded, hollow = missing, filled amber = issue)
  - Milestone name, time display, issue/modified badges
  - Edit/Add buttons with datetime-local input
  - Pair arrows for duration milestone pairs
- Resolution notes textarea
- Drawer footer (sticky): "Open Case" link button (left), "Exclude" (red) + "Validate & Resolve" (green gradient) on right
- Validation warning flow: shows when metrics would be lost, offers go back or continue
- Stale case special handling: detect stale issue types, show Mark Completed / Mark Cancelled buttons instead
- Wire ALL resolution actions: approve, exclude, milestone save, stale case actions
- Audit logging on all resolution actions

### Files touched
- **Create/populate:** `components/data-quality/MilestoneTimeline.tsx`
- **Modify:** `components/data-quality/ReviewDrawer.tsx`, `components/data-quality/DataQualityPage.tsx`

### Test gate
1. **Unit:** MilestoneTimeline renders nodes with correct status colors, impact analysis updates when milestones change
2. **Integration:** Milestone editing works (add/edit timestamps), "Validate & Resolve" resolves all case issues and sets data_validated, "Exclude" marks case excluded, validation warning shows when metrics would be lost, stale case actions work
3. **Workflow:** Open case with issues → edit milestone → impact updates → click Validate & Resolve → issues resolved → case disappears from table → audit log written

---

## Phase 7: Polish, Edge Cases & Testing
**Complexity:** Medium
**Commit:** `feat(data-quality): phase 7 - polish, edge cases, and comprehensive testing`

### What it does
- Page load animations (fade-in stagger on summary, filter bar, table)
- Empty state (no issues — green checkmark illustration)
- Loading state (skeletons)
- Bulk exclude confirmation (uses existing ConfirmDialog)
- "Open Case" navigation (opens `/cases/[id]` in new tab)
- Clean up any remaining old code references
- Run full test suite (`npm run typecheck && npm run lint && npm run test`), fix any regressions
- Verify no TypeScript `any` types
- Test all acceptance criteria end-to-end

### Files touched
- **Modify:** Various `components/data-quality/*.tsx` files for polish
- **Possibly modify:** Test files for regressions

### Test gate
1. **Unit:** Empty state renders for 0 issues, loading state shows skeletons
2. **Integration:** All acceptance criteria verified, bulk exclude with confirmation works, Open Case navigates correctly
3. **Workflow:** Full end-to-end: load page → run detection → filter → select → bulk exclude → review case → edit milestones → validate → all resolved → empty state shows

---

## Acceptance Criteria Checklist

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
