# Implementation Plan: Settings Layout Redesign + Milestones Table Overhaul

## Overview
Replace the settings sidebar with a horizontal tab bar + compact sub-nav pattern, create a settings landing page, and redesign the milestones page as a phase-grouped table. 6 phases, executed sequentially. Each phase is a single Claude Code session with `/phase-start`.

## Branch
`feature/settings-layout-redesign`

## Dependency Graph
```
Phase 1 (Audit + Config) → Phase 2 (New Layout Shell) → Phase 3 (Landing Page)
                                                       → Phase 4 (Migrate All Pages)
                                                       → Phase 5 (Milestones Table)
                                                       → Phase 6 (Polish + Cleanup)
```
Phase 1 must come first. Phase 2 must come before 3-6. Phases 3-5 can run in any order after Phase 2. Phase 6 is last.

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

## Phase 2: Build New Settings Layout Shell
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
3. **Wire up one page as proof of concept** — update `app/settings/milestones/page.tsx` to use `<SettingsTabLayout activePageId="milestones">` instead of `<SettingsLayout>`. The milestones page content stays exactly the same for now (badge-heavy list) — we redesign it in Phase 5.
4. **Keep `SettingsLayout.tsx` alive** — don't delete it yet. Other pages still use it. We migrate them all in Phase 4.

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

## Phase 3: Settings Landing Page
**Complexity:** Small-Medium | **Blockers:** Phase 2

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

## Phase 4: Migrate All Settings Pages to New Layout
**Complexity:** Medium | **Blockers:** Phase 2

### Goal
Swap every remaining settings page from `<SettingsLayout>` to `<SettingsTabLayout>`. Then delete the old `SettingsLayout` component.

### What To Do
1. **List all settings pages** from the Phase 1 audit config
2. **For each page**, perform the same swap done for milestones in Phase 2:
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
- Every `app/settings/*/page.tsx` file (except milestones, already done in Phase 2)

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

## Phase 5: Milestones Table Redesign
**Complexity:** Large | **Blockers:** Phase 2

### Goal
Replace the milestone list (with its badge-heavy rows) with a clean phase-grouped data table with hover-revealed actions.

### What To Do
1. **Analyze the current milestones page** — read `app/settings/milestones/page.tsx` to understand:
   - How milestones are fetched (query to `facility_milestones`, join for pair data)
   - How case usage count is computed (count from `case_milestones` grouped by `facility_milestone_id`)
   - How the current list items render (badges, link icon, edit icon)
   - How add/edit/delete flows work (modal? inline? route change?)
   - How phase is determined (is there a `phase` column on `facility_milestones`, or is it derived from display_order or milestone name?)
2. **Create `PhaseGroupHeader.tsx`**:
   - Props: `phase: "pre-op" | "surgical" | "closing"`
   - Renders a table row spanning all columns with: colored accent bar (3px, phase color), phase label (uppercase, phase color), divider line
   - Phase colors: Pre-Op = indigo, Surgical = cyan, Closing = amber
3. **Create `PairIndicator.tsx`**:
   - Props: `pair: string | null`, `position: "start" | "end" | null`
   - If no pair: render em-dash in muted gray
   - If pair: render directional arrow (→ or ←) + pair name
   - Small icon indicating start (open circle) or end (filled circle)
4. **Create `MilestoneRow.tsx`**:
   - Props: milestone data, onEdit callback, onDelete callback
   - Columns: order number, name (+ ◆ for custom + optional Start/End pill), pair indicator, cases count, valid range, actions
   - Actions (edit/delete icons) visible only on hover — managed with local hover state
   - Delete icon only renders for custom milestones
   - Row has subtle hover background
5. **Create `MilestonesTable.tsx`**:
   - Props: milestones array, onEdit, onDelete
   - Groups milestones by phase
   - Renders table with header row + PhaseGroupHeaders + MilestoneRows
   - Wrapped in white card with border-radius and subtle shadow
6. **Create `SettingsStatsRow.tsx`** (reusable):
   - Props: array of `{ label, value, color }` stats
   - Renders horizontal row of compact stat chips
   - Used on milestones page, potentially reusable on other settings pages
7. **Update the milestones page**:
   - Replace the current list rendering with: stats row → info bar → MilestonesTable
   - Keep all existing data fetching and state management
   - Keep all existing add/edit/delete handlers — just restyle the triggers
   - Update the page header: title + description + "Add Custom Milestone" button (indigo)
   - Replace the blue info callout with slim single-line info bar
8. **Determine phase mapping** — if `facility_milestones` doesn't have a `phase` column:
   - Option A: Derive from `display_order` ranges (e.g., 1-6 = pre-op, 7 = surgical, 8-13 = closing)
   - Option B: Derive from milestone name patterns (check for keywords: anesthesia/prep/timeout → pre-op, incision → surgical, closing/dressing/patient out/room ready → closing)
   - Option C: Add a `phase` column (out of scope per spec, but Claude Code should note if it would be cleaner)
   - Choose the least fragile option and document the decision

### Files to Create
- `components/settings/PhaseGroupHeader.tsx`
- `components/settings/PairIndicator.tsx`
- `components/settings/MilestoneRow.tsx`
- `components/settings/MilestonesTable.tsx`
- `components/settings/SettingsStatsRow.tsx`

### Files to Modify
- `app/settings/milestones/page.tsx` — replace list with table, update header

### Commit Message
`feat(settings): redesign milestones page with phase-grouped table`

### Test Gate
1. Milestones grouped correctly under Pre-Op, Surgical, Closing headers
2. Phase headers render with correct colors and labels
3. Pair column shows linked milestone names with directional arrows
4. Custom milestones show ◆ indicator (no "Global" badge anywhere)
5. No phase badges on any row
6. Stats row shows accurate Active, Custom, and Phases counts
7. Edit icon appears on all rows on hover
8. Delete icon appears only on custom milestone rows on hover
9. Edit and delete actions trigger existing flows (modal, etc.) correctly
10. Add Custom Milestone button works as before
11. `npm run typecheck && npm run lint` passes

---

## Phase 6: Polish, Animations, and Cleanup
**Complexity:** Small-Medium | **Blockers:** Phases 3, 4, 5

### Goal
Final polish pass: consistent design tokens, transitions, animation, dead code removal, and integration testing across all settings pages.

### What To Do
1. **Transitions and animations**:
   - Page content fade-in on navigation between settings pages (CSS `animation: fadeIn`)
   - Tab bar: smooth underline transition when switching categories
   - Sub-nav: subtle background transition on hover and active state
   - Milestones table: row hover transition (background color)
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
5. **Integration testing** — manually verify every settings page:
   - Navigate to Settings landing → verify all cards render
   - Click into each settings page → verify tab bar highlights correct category
   - Verify sub-nav highlights correct item
   - Verify breadcrumb is correct on every page
   - Verify back-navigation (browser back button, breadcrumb click)
   - Verify milestones page: phase grouping, hover actions, stats row, add/edit/delete flows
   - Verify role gating: if a non-admin user accesses settings, role-restricted items should be hidden
6. **Handle edge cases**:
   - Direct URL navigation (e.g., typing `/settings/milestones` directly) — should render correctly with proper tab/sub-nav state
   - Deep linking from other parts of the app (e.g., clicking "Settings" on a milestone from the case detail page)
   - Browser back/forward navigation through settings pages

### Files to Modify
- `components/layouts/SettingsTabLayout.tsx` — animation and transition refinements
- `components/settings/SettingsLanding.tsx` — hover states and stagger animations
- `components/settings/MilestonesTable.tsx` — row transition polish
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
8. Milestones table interactions all function (edit, delete, add, hover)
9. `npm run typecheck && npm run lint` passes
10. No unused imports or dead CSS remain

---

## Session Log

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 1 | pending | — | — |
| 2 | pending | — | — |
| 3 | pending | — | — |
| 4 | pending | — | — |
| 5 | pending | — | — |
| 6 | pending | — | — |
