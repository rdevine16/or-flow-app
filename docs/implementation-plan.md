# Implementation Plan: Settings Layout Redesign + Milestones Table Overhaul

## Overview
Replace the settings sidebar with a horizontal tab bar + compact sub-nav pattern, create a settings landing page, redesign the milestones page as a phase-grouped table with collapsed pair rows, and fix the case drawer interval logic. 8 phases, executed sequentially. Each phase is a single Claude Code session with `/phase-start`.

## Branch
`feature/settings-layout-redesign`

## Dependency Graph
```
Phase 1 (Audit + Config) → Phase 2 (pair_label Migration) → Phase 3 (New Layout Shell) → Phase 4 (Landing Page)
                                                                                        → Phase 5 (Migrate All Pages)
                                                                                        → Phase 6 (Milestones Table)
                                                            → Phase 7 (Case Drawer Intervals)
                                                            → Phase 8 (Polish + Cleanup)
```
Phase 1 must come first. Phase 2 (migration) must come before Phases 3-8. Phase 3 must come before 4-6. Phases 4-7 can run in any order after their dependencies. Phase 8 is last.

---

## Phase 1: Audit Current Settings Structure
**Complexity:** Small | **Blockers:** None

### Goal
Map every existing settings page, its route, its category, and how it uses `SettingsLayout`. Build the definitive settings configuration object that drives the new navigation. No code changes — this phase produces a config file and an audit report.

### What To Do
1. **Find all settings routes**:
   ```bash
   find app/settings -name "page.tsx" -type f
   ```
2. **For each page, document**:
   - Route path
   - Page title and description (from the current `<SettingsLayout>` props or page header)
   - Which category it belongs to (General, Clinical, Organization, Case Management)
   - Whether it has role restrictions
   - Whether it's a placeholder/coming-soon page
3. **Read `SettingsLayout.tsx`** — understand its props interface, how it renders the sidebar, what nav items it defines, and how categories are structured. This is the file we're replacing.
4. **Read `navigation-config.tsx`** — check if settings nav items are defined here and whether the settings sidebar in `SettingsLayout` is independent or reads from this config.
5. **Create `lib/settings-config.ts`** — the single source of truth for settings navigation:
   ```typescript
   export const SETTINGS_CATEGORIES = [
     { id: "general", label: "General", icon: "Building2" },
     { id: "clinical", label: "Clinical", icon: "Stethoscope" },
     { id: "organization", label: "Organization", icon: "Users" },
     { id: "cases", label: "Case Management", icon: "ClipboardList" },
   ]
   
   export const SETTINGS_ITEMS = {
     general: [
       { id: "overview", label: "Overview", desc: "...", href: "/settings/overview", icon: "Building" },
       // ...
     ],
     // ...
   }
   ```
   Map every discovered page into this config. Include `badge`, `disabled`, and `roles` fields where relevant.
6. **Document findings** — add a comment block at the top of the config noting: total pages found, any pages that don't fit cleanly into a category, any route naming inconsistencies to fix in Phase 4.

### Files to Create
- `lib/settings-config.ts`

### Files to Read (audit only, no changes)
- `components/layouts/SettingsLayout.tsx`
- `components/layouts/navigation-config.tsx`
- All `app/settings/*/page.tsx` files

### Commit Message
`chore(settings): audit settings structure and create navigation config`

### Test Gate
1. `lib/settings-config.ts` compiles with no errors
2. Every existing settings route is represented in the config
3. `npm run typecheck` passes
4. No functional changes — all pages still render as before

---

## Phase 2: Add `pair_label` Column + Update Interval Medians Function
**Complexity:** Small-Medium | **Blockers:** Phase 1

### Goal
Add the `pair_label` column to `milestone_types` and `facility_milestones`, backfill existing pairs, and rewrite the `get_milestone_interval_medians` DB function to use forward-looking/paired interval semantics. This is shared infrastructure needed by both the milestones settings table (Phase 6) and case drawer intervals (Phase 7).

### What To Do
1. **Create migration: `add_pair_label.sql`**:
   ```sql
   ALTER TABLE public.milestone_types ADD COLUMN pair_label TEXT;
   ALTER TABLE public.facility_milestones ADD COLUMN pair_label TEXT;
   ```
2. **Backfill existing pairs** in the same migration:
   - For `milestone_types`: find rows where `pair_position = 'start'`, derive `pair_label` by stripping " Start" suffix from `display_name` (or `name`). E.g., "Anesthesia Start" → "Anesthesia", "Prep/Drape Start" → "Prep/Drape", "Closing" → "Closing"
   - For `facility_milestones`: same logic, matching by `source_milestone_type_id` or name pattern
   - Handle edge cases: "Closing" / "Closing Complete" — the start milestone is "Closing" which doesn't have " Start" in it. Use a CASE statement with known patterns, falling back to the start milestone's display_name as-is.
3. **Create migration: `update_interval_medians_v2.sql`** — rewrite `get_milestone_interval_medians`:
   - Add `pair_label`, `pair_with_id`, and `pair_position` to the return type
   - Change the interval CTE logic:
     - **Paired milestones (pair_position = 'start')**: interval = end_milestone.recorded_at - start_milestone.recorded_at (join via `pair_with_id`)
     - **Paired milestones (pair_position = 'end')**: excluded from results (consumed by their pair)
     - **Standalone milestones (pair_position IS NULL)**: interval = LEAD(recorded_at) - recorded_at (forward-looking)
     - **Last milestone**: interval = NULL
   - Medians are computed using the same paired/forward-looking semantics across historical cases
   - Keep the same function signature (p_surgeon_id, p_procedure_type_id, p_facility_id) for backward compatibility, but extend the return columns
4. **Update admin milestone pairing UI** (`app/admin/settings/milestones/page.tsx`):
   - Add a `pair_label` text field to the pair creation/edit dialog
   - When creating a pair, set `pair_label` on the start milestone
   - When propagating to facilities, include `pair_label`
5. **Update the facility milestones lookup** (`lib/dal/lookups.ts`):
   - Add `pair_label` to the `FacilityMilestone` interface and SELECT query

### Files to Create
- `supabase/migrations/YYYYMMDD_add_pair_label.sql`
- `supabase/migrations/YYYYMMDD_update_interval_medians_v2.sql`

### Files to Modify
- `app/admin/settings/milestones/page.tsx` — add `pair_label` to pairing UI
- `lib/dal/lookups.ts` — add `pair_label` to FacilityMilestone type and query

### Commit Message
`feat(milestones): add pair_label column and rewrite interval medians to forward-looking/paired logic`

### Test Gate
1. `pair_label` column exists on both tables with correct backfilled values
2. Existing pairs have meaningful labels (e.g., "Anesthesia", "Prep/Drape", "Closing")
3. `get_milestone_interval_medians` returns forward-looking intervals for standalone milestones
4. `get_milestone_interval_medians` returns paired durations for start milestones
5. `get_milestone_interval_medians` excludes end milestones from results
6. Admin pairing UI allows setting `pair_label`
7. `npm run typecheck && npm run lint` passes

---

## Phase 3: Build New Settings Layout Shell
**Complexity:** Medium | **Blockers:** Phase 1

### Goal
Create the `SettingsTabLayout` component that replaces `SettingsLayout`. This phase builds the shell (tab bar + sub-nav + content slot) without migrating any pages — only the milestones page uses it initially as a proof of concept.

### What To Do
1. **Create `SettingsTabLayout.tsx`**:
   - Props: `children`, `activePageId: string` (matches an item id from settings-config)
   - Reads `SETTINGS_CATEGORIES` and `SETTINGS_ITEMS` from `lib/settings-config.ts`
   - Derives `activeCategory` from `activePageId` by finding which category contains that item
   - Renders three layers:
     - **Breadcrumb row**: Facility Name › Settings (clickable → `/settings`) › Active Page Name
     - **Category tab bar**: horizontal tabs for each category, active tab has bottom border
     - **Content area**: flex row with compact sub-nav (220px) + main content (children)
   - Sub-nav shows only items in the active category
   - Tab clicks use `router.push()` to navigate to the first item in that category
   - Sub-nav item clicks use `router.push()` to navigate to that item's href
   - Active states derived from `activePageId` prop — no internal state needed
2. **Style the layout** per the design prototype:
   - Tab bar: white background, bottom border, category icon + label, indigo underline on active
   - Sub-nav: white background, right border, 220px width, rounded highlight on active item
   - Content area: `#f8f9fb` background, padding `28px 36px`
   - Breadcrumb: subtle gray text, 13px, clickable "Settings" link
3. **Wire up one page as proof of concept** — update `app/settings/milestones/page.tsx` to use `<SettingsTabLayout activePageId="milestones">` instead of `<SettingsLayout>`. The milestones page content stays exactly the same for now (badge-heavy list) — we redesign it in Phase 6.
4. **Keep `SettingsLayout.tsx` alive** — don't delete it yet. Other pages still use it. We migrate them all in Phase 5.

### Files to Create
- `components/layouts/SettingsTabLayout.tsx`

### Files to Modify
- `app/settings/milestones/page.tsx` — swap to new layout (content unchanged)

### Commit Message
`feat(settings): create SettingsTabLayout with horizontal tabs and compact sub-nav`

### Test Gate
1. Milestones page renders with new tab bar + sub-nav layout
2. Category tabs display correctly, active category (Case Management) is highlighted
3. Sub-nav shows only Case Management items (Procedure Types, Milestones, Procedure Milestones, Surgeon Preferences)
4. Clicking other category tabs navigates to the first page in that category
5. Breadcrumb shows Facility › Settings › Milestones
6. All other settings pages still render with old `SettingsLayout` (no regression)
7. `npm run typecheck && npm run lint` passes

---

## Phase 4: Settings Landing Page
**Complexity:** Small-Medium | **Blockers:** Phase 3

### Goal
Create the settings landing page that shows all categories and items in a card grid, replacing the need to navigate blind through a sidebar.

### What To Do
1. **Create `SettingsLanding.tsx`** component:
   - Reads from `SETTINGS_CATEGORIES` and `SETTINGS_ITEMS`
   - Renders a 2-column grid of category cards
   - Each card has: category icon + label header, then a list of item rows
   - Each item row: icon, label, description, optional badge, chevron →
   - Clicking an item navigates to its `href`
   - Disabled/coming-soon items show muted styling and no click handler
   - Page header: "Settings" title + "Manage your facility configuration, staff, and case workflows" description
2. **Update `app/settings/page.tsx`**:
   - Replace current content with `<DashboardLayout><Container><SettingsLanding /></Container></DashboardLayout>`
   - No tab bar on the landing page — the tab bar only appears on sub-pages
   - The landing page IS the settings home, so breadcrumb would just be: Facility › Settings
3. **Wire navigation** — clicking "Settings" in the main app sidebar should go to `/settings` (the landing page). Check if this is already the case or if it deep-links to a specific sub-page.

### Files to Create
- `components/settings/SettingsLanding.tsx`

### Files to Modify
- `app/settings/page.tsx` — render SettingsLanding

### Commit Message
`feat(settings): create settings landing page with category card grid`

### Test Gate
1. Landing page renders all categories and items
2. Clicking an item navigates to the correct settings sub-page
3. Coming-soon items show badges and are not clickable
4. Breadcrumb clickable "Settings" on any sub-page returns to landing
5. `npm run typecheck && npm run lint` passes

---

## Phase 5: Migrate All Settings Pages to New Layout
**Complexity:** Medium | **Blockers:** Phase 3

### Goal
Swap every remaining settings page from `<SettingsLayout>` to `<SettingsTabLayout>`. Then delete the old `SettingsLayout` component.

### What To Do
1. **List all settings pages** from the Phase 1 audit config
2. **For each page**, perform the same swap done for milestones in Phase 3:
   - Replace `<SettingsLayout>` (or `<SettingsLayout title="..." description="...">`) with `<SettingsTabLayout activePageId="[matching-id]">`
   - If the page rendered its title/description inside SettingsLayout, move that into the page's own content area (SettingsTabLayout doesn't render titles — each page owns its header)
   - Ensure the `activePageId` matches the item's `id` in `lib/settings-config.ts`
3. **Handle edge cases**:
   - Pages that pass custom props to `SettingsLayout` (like role restrictions) — move that logic into the page itself or into `settings-config.ts`
   - Pages that use `SettingsLayout` children in non-standard ways — adapt case by case
   - Placeholder/coming-soon pages — create simple stub pages if they don't exist
4. **Delete `SettingsLayout.tsx`** — once all pages are migrated, remove the old component
5. **Search codebase for orphan references**:
   ```bash
   grep -r "SettingsLayout" --include="*.tsx" --include="*.ts"
   ```
   Ensure zero references remain to the old component.

### Files to Modify
- Every `app/settings/*/page.tsx` file (except milestones, already done in Phase 3)

### Files to Delete
- `components/layouts/SettingsLayout.tsx`

### Commit Message
`refactor(settings): migrate all settings pages to SettingsTabLayout and remove old sidebar`

### Test Gate
1. Every settings page renders correctly with the new tab bar layout
2. Active category tab and sub-nav item are correctly highlighted on each page
3. Navigation between pages within a category works (sub-nav clicks)
4. Navigation between categories works (tab clicks)
5. `grep -r "SettingsLayout"` returns zero results (fully removed)
6. `npm run typecheck && npm run lint` passes

---

## Phase 6: Milestones Table Redesign (Collapsed Pairs)
**Complexity:** Large | **Blockers:** Phase 2, Phase 3

### Goal
Replace the milestone list (with its badge-heavy rows) with a clean phase-grouped data table using collapsed pair rows and hover-revealed actions. Paired milestones (Anesthesia Start/End, Closing/Closing Complete, etc.) display as a single row using their `pair_label`.

### What To Do
1. **Analyze the current milestones page** — read `app/settings/milestones/page.tsx` to understand:
   - How milestones are fetched (query to `facility_milestones`, join for pair data)
   - How case usage count is computed (count from `case_milestones` grouped by `facility_milestone_id`)
   - How the current list items render (badges, link icon, edit icon)
   - How add/edit/delete flows work (modal? inline? route change?)
   - Phase grouping: use the `phase_group` column on `facility_milestones` (added in earlier migration)
2. **Create `PhaseGroupHeader.tsx`**:
   - Props: `phase: "pre_op" | "surgical" | "closing" | "post_op"`
   - Renders a table row spanning all columns with: colored accent bar (3px, phase color), phase label (uppercase, phase color), divider line
   - Phase colors: Pre-Op = indigo, Surgical = cyan, Closing = amber, Post-Op = slate
3. **Create `MilestoneRow.tsx`** — handles both standalone and collapsed pair rows:
   - Props: milestone data (including `pair_label`, `pair_position`, `pair_with_id`), onEdit callback, onDelete callback
   - **Standalone rows**: order number, name (+ ◆ for custom), type indicator ("Single"), cases count, valid range, actions
   - **Collapsed pair rows**: order number, `pair_label` as display name (+ ◆ for custom), type indicator ("Paired" with link icon), combined cases count (max of start/end), valid range, actions
   - Collapsed pair row can expand on click to show the underlying start/end milestone names as indented sub-rows (for reference only)
   - **End milestones (`pair_position = 'end'`) are NOT rendered as top-level rows** — they are consumed by their pair's collapsed row
   - Actions (edit/delete icons) visible only on hover
   - Delete icon only renders for custom milestones
   - Row has subtle hover background
4. **Create `MilestonesTable.tsx`**:
   - Props: milestones array, onEdit, onDelete
   - **Pre-processing step**: filter out `pair_position = 'end'` milestones from top-level rows. For each `pair_position = 'start'` milestone, attach its partner data for the collapsed display.
   - Groups remaining milestones by `phase_group`
   - Renders table with header row + PhaseGroupHeaders + MilestoneRows
   - Table columns: #, Milestone, Type (Single/Paired), Cases, Valid Range, Actions
   - Wrapped in white card with border-radius and subtle shadow
5. **Create `SettingsStatsRow.tsx`** (reusable):
   - Props: array of `{ label, value, color }` stats
   - Renders horizontal row of compact stat chips
   - Used on milestones page, potentially reusable on other settings pages
6. **Update the milestones page**:
   - Replace the current list rendering with: stats row → info bar → MilestonesTable
   - Keep all existing data fetching — add `pair_label` to the `facility_milestones` SELECT
   - Keep all existing add/edit/delete handlers — just restyle the triggers
   - Edit on a collapsed pair row opens the pair edit dialog (editing both start + end + pair_label)
   - Update the page header: title + description + "Add Custom Milestone" button (indigo)
   - Replace the blue info callout with slim single-line info bar

### Files to Create
- `components/settings/PhaseGroupHeader.tsx`
- `components/settings/MilestoneRow.tsx`
- `components/settings/MilestonesTable.tsx`
- `components/settings/SettingsStatsRow.tsx`

### Files to Modify
- `app/settings/milestones/page.tsx` — replace list with table, update header, fetch `pair_label`

### Commit Message
`feat(settings): redesign milestones page with phase-grouped table and collapsed pair rows`

### Test Gate
1. Milestones grouped correctly under Pre-Op, Surgical, Closing, Post-Op headers
2. Phase headers render with correct colors and labels
3. Paired milestones display as single collapsed rows using `pair_label` (e.g., "Anesthesia", not "Anesthesia Start" + "Anesthesia End")
4. End milestones (`pair_position = 'end'`) do not appear as separate rows
5. Collapsed pair rows show "Paired" type indicator
6. Expanding a collapsed pair row reveals underlying start/end milestone names
7. Custom milestones show ◆ indicator (no "Global" badge anywhere)
8. No phase badges on any row
9. Stats row shows accurate Active, Custom, and Phases counts
10. Edit icon appears on all rows on hover
11. Delete icon appears only on custom milestone rows on hover
12. Edit and delete actions trigger existing flows correctly
13. Add Custom Milestone button works as before
14. `npm run typecheck && npm run lint` passes

---

## Phase 7: Case Drawer Interval Logic
**Complexity:** Medium | **Blockers:** Phase 2

### Goal
Update the case drawer's milestone tab to use the new forward-looking/paired interval model. Paired milestones collapse into a single row using `pair_label`, standalone milestones show forward-looking intervals (this → next), and the last milestone shows no interval.

### What To Do
1. **Update `milestoneAnalytics.ts`** — rewrite `calculateIntervals()`:
   - Accept pair metadata (`pair_label`, `pair_with_id`, `pair_position`) from the enriched milestone data
   - **Collapse pairs**: For `pair_position = 'start'`, find the matching end milestone and compute interval = end.recorded_at - start.recorded_at. Use `pair_label` as the display name. Remove the end milestone from the output array.
   - **Forward-looking standalone**: For milestones with `pair_position = null`, compute interval = next_milestone.recorded_at - this.recorded_at
   - **Last milestone**: interval = null
   - **Gap time**: Time between a pair-end and the next milestone is not attributed to any row — it contributes to the Idle/Gap bucket in time allocation
   - Update the `MilestoneInterval` type to include `pair_label`, `is_paired`, and optionally `pair_start_time`/`pair_end_time` for tooltip display
2. **Update `useMilestoneComparison.ts`**:
   - Fetch `pair_label`, `pair_with_id`, `pair_position` in the case_milestones query (join from `facility_milestones`)
   - Pass pair metadata through to `calculateIntervals()`
   - The medians from `get_milestone_interval_medians` (updated in Phase 2) already use the new semantics, so delta calculations should work automatically
3. **Update `MilestoneDetailRow.tsx` (MilestoneTable)**:
   - Show interval on all rows except the **last** (currently hides the **first**)
   - For collapsed pair rows, display `pair_label` as the milestone name
   - Optionally show start/end timestamps in the "Time" column as a range (e.g., "10:03 – 10:15") for paired rows
   - Update the `isFirst` → `isLast` logic for the interval/median/delta columns
4. **Update `calculateTimeAllocation()`**:
   - Gap time between pair-end and next milestone should be bucketed into "Idle/Gap"
   - Paired interval time inherits the start milestone's `phase_group`
5. **Update `calculateSwimlaneSections()`**:
   - Collapsed pairs get a single segment proportional to their duration
   - Ensure total widths still sum correctly
6. **Update `CaseDrawerMilestones.tsx`** if needed — ensure pair data flows through to all sub-components (timeline, table, time allocation bar)

### Files to Modify
- `lib/utils/milestoneAnalytics.ts` — core interval logic rewrite
- `lib/hooks/useMilestoneComparison.ts` — fetch pair metadata, pass to analytics
- `components/cases/MilestoneDetailRow.tsx` — render collapsed pairs, fix first→last logic
- `components/cases/CaseDrawerMilestones.tsx` — pass pair data through

### Commit Message
`feat(milestones): rewrite case drawer intervals to forward-looking/paired model`

### Test Gate
1. Paired milestones display as single row in drawer using `pair_label`
2. Paired interval = end.recorded_at - start.recorded_at
3. Standalone interval = next_milestone.recorded_at - this.recorded_at (forward-looking)
4. Last milestone shows "—" for interval, median, and delta
5. First milestone now shows an interval (unlike current behavior)
6. Gap time between pairs appears in Idle/Gap time allocation bucket
7. Median comparisons and delta severity badges display correctly
8. Timeline swimlane renders collapsed pairs as single proportional segments
9. Total case time and total surgical time still compute correctly
10. `npm run typecheck && npm run lint` passes
11. Existing milestone analytics tests updated to reflect new semantics

---

## Phase 8: Polish, Animations, and Cleanup
**Complexity:** Small-Medium | **Blockers:** Phases 4, 5, 6, 7

### Goal
Final polish pass: consistent design tokens, transitions, animation, dead code removal, and integration testing across all settings pages.

### What To Do
1. **Transitions and animations**:
   - Page content fade-in on navigation between settings pages (CSS `animation: fadeIn`)
   - Tab bar: smooth underline transition when switching categories
   - Sub-nav: subtle background transition on hover and active state
   - Milestones table: row hover transition (background color), collapsed pair expand/collapse animation
   - Stats chips: staggered slide-in on page load
2. **Design token audit** across all new components:
   - Verify DM Sans and JetBrains Mono are loaded (check `tailwind.config.ts` or global CSS)
   - Verify color consistency: indigo-500, emerald-500, cyan-500, amber-500, slate grays
   - Verify border-radius consistency (14px for cards, 10px for buttons, 8px for sub-elements)
   - Verify spacing consistency (padding, gaps, margins match the prototype)
3. **Landing page polish**:
   - Staggered card animation on load
   - Hover states on category cards (subtle lift/shadow)
   - Badge styling consistency (emerald for "New", slate for "Soon")
4. **Dead code cleanup**:
   ```bash
   grep -r "SettingsLayout" --include="*.tsx" --include="*.ts"
   grep -r "settingsNav\|settingsSidebar\|SettingsSidebar" --include="*.tsx" --include="*.ts"
   ```
   Remove any orphaned imports, unused nav configurations, or dead CSS classes related to the old settings layout.
   Also clean up any old backward-looking interval code or comments in milestoneAnalytics.ts.
5. **Integration testing** — manually verify every settings page:
   - Navigate to Settings landing → verify all cards render
   - Click into each settings page → verify tab bar highlights correct category
   - Verify sub-nav highlights correct item
   - Verify breadcrumb is correct on every page
   - Verify back-navigation (browser back button, breadcrumb click)
   - Verify milestones settings page: phase grouping, collapsed pairs, hover actions, stats row, add/edit/delete flows
   - Verify case drawer milestones tab: collapsed pairs, forward-looking intervals, correct medians and deltas
   - Verify role gating: if a non-admin user accesses settings, role-restricted items should be hidden
6. **Handle edge cases**:
   - Direct URL navigation (e.g., typing `/settings/milestones` directly) — should render correctly with proper tab/sub-nav state
   - Deep linking from other parts of the app (e.g., clicking "Settings" on a milestone from the case detail page)
   - Browser back/forward navigation through settings pages
   - Cases with missing paired milestones (e.g., start recorded but not end) — show partial data gracefully
   - Cases where pair_label is null for legacy paired milestones — fall back to start milestone display_name

### Files to Modify
- `components/layouts/SettingsTabLayout.tsx` — animation and transition refinements
- `components/settings/SettingsLanding.tsx` — hover states and stagger animations
- `components/settings/MilestonesTable.tsx` — row transition polish, pair expand animation
- `components/settings/SettingsStatsRow.tsx` — stagger animation
- `tailwind.config.ts` — add custom fonts if not already present
- Any files with dead `SettingsLayout` references

### Commit Message
`feat(settings): design polish, animations, and dead code cleanup`

### Test Gate
1. All animations are smooth and don't cause layout shifts
2. Tab switching feels responsive (no flash of wrong content)
3. Every settings page renders correctly with new layout
4. No dead code references to old `SettingsLayout`
5. Direct URL navigation works for every settings route
6. Browser back/forward works correctly
7. Role-gated items are properly hidden
8. Milestones settings table: collapsed pairs expand/collapse smoothly
9. Case drawer: intervals correct for both paired and standalone milestones
10. Edge cases handled: missing pair-end, null pair_label fallback
11. `npm run typecheck && npm run lint` passes
12. No unused imports or dead CSS remain

---

## Session Log

| Phase | Description | Status | Date | Notes |
|-------|-------------|--------|------|-------|
| 1 | Audit + Config | pending | — | — |
| 2 | pair_label Migration + Interval Medians | pending | — | — |
| 3 | New Layout Shell | pending | — | — |
| 4 | Landing Page | pending | — | — |
| 5 | Migrate All Pages | pending | — | — |
| 6 | Milestones Table (Collapsed Pairs) | pending | — | — |
| 7 | Case Drawer Intervals | pending | — | — |
| 8 | Polish + Cleanup | pending | — | — |
