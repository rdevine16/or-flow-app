# Feature: Settings Layout Redesign + Milestones Table Overhaul

## Goal
Replace the current settings sidebar navigation (which creates a second vertical nav competing with the main app sidebar) with a horizontal category tab bar + compact sub-nav pattern inspired by Stripe/Linear settings. Simultaneously redesign the Milestones settings page from a badge-heavy list into a clean, phase-grouped data table. This improves settings discoverability, reduces nav depth, and makes the most-configured settings page (Milestones) feel professional and scannable.

## Requirements

### Settings Layout Restructure

#### Remove Settings Sidebar
1. Remove the current `SettingsLayout` component that renders a full-height sidebar with category headers and 12+ nav items
2. The main app sidebar (DashboardLayout) remains unchanged — Settings is still a single icon/link in the primary nav
3. No changes to the main app navigation structure or `navigation-config.tsx` facility nav groups

#### Settings Landing Page
4. Create a new Settings landing page at `/settings` that shows a **card grid overview** of all settings categories
5. Each category card (General, Clinical, Organization, Case Management) contains its settings items as clickable rows
6. Each item row shows: icon, label, description, chevron, and optional badge (e.g., "Soon", "New")
7. Clicking an item navigates to that settings sub-page
8. This landing page replaces the need to "know" which category a setting lives under — all settings are visible at once

#### Horizontal Category Tab Bar
9. When on any settings sub-page, display a **horizontal tab bar** below the top header with category tabs: General, Clinical, Organization, Case Management
10. Each tab has an icon and label
11. Clicking a tab navigates to the first item in that category
12. Active tab has a bottom border indicator (indigo)
13. Tab bar is sticky below the main header/breadcrumb

#### Compact Sub-Navigation
14. Within each category tab, display a **compact sidebar** (220px) showing only the 2-5 items in the active category
15. Active item has a highlighted background state
16. Items show icon, label, and optional badge
17. This replaces the full 12+ item settings sidebar — each category's sub-nav is short and contextual

#### Breadcrumb Navigation
18. Breadcrumb trail: Facility Name › Settings › [Active Page Name]
19. "Settings" in breadcrumb is clickable and returns to the landing page
20. Active page name is bold

#### URL Structure
21. Settings landing: `/settings`
22. Sub-pages: `/settings/milestones`, `/settings/users-roles`, `/settings/procedure-types`, etc.
23. Existing settings routes should be preserved or redirected — Claude Code should audit current routes under `app/settings/` and map them to the new structure
24. Each settings sub-page wraps its content in the new layout (tab bar + sub-nav + content area) instead of the old `SettingsLayout`

### Milestones Page Redesign

#### Remove Badge Overload
25. Remove the per-row "Global" / "Custom" badges — Global is the default, Custom gets a subtle ◆ diamond indicator
26. Remove the per-row phase badges ("Pre-Op", "Surgical", "Closing") — phase is communicated by section grouping instead
27. Retain Start/End indicators as minimal pills on the milestone name (small, not full badges)

#### Phase-Grouped Table
28. Group milestones under **section headers**: Pre-Op, Surgical, Closing
29. Each section header has a colored accent bar (indigo for Pre-Op, cyan for Surgical, amber for Closing) and a divider line
30. Milestones render as table rows within their phase group, maintaining display_order within each group

#### Table Columns
31. **#** — display order number (monospace, muted)
32. **Milestone** — name + optional ◆ for custom + optional Start/End pill
33. **Pair** — linked milestone name with directional arrow (→ for start, ← for end), or em-dash if unpaired
34. **Cases** — count of cases using this milestone (monospace)
35. **Valid Range** — validation range string (monospace, muted)
36. **Actions** — edit and delete icons, revealed on row hover only. Delete only shown for custom milestones.

#### Stats Row
37. Above the table, show compact stat chips: Active Milestones count, Custom count, Phases count
38. Each chip has a colored background matching its meaning

#### Info Bar
39. Replace the current blue info callout box with a slim, single-line info bar explaining Global vs Custom distinction
40. Reference the ◆ indicator so users understand what it means

#### Add Custom Milestone
41. "Add Custom Milestone" button in the page header (primary indigo style)
42. Existing create functionality should be preserved — just restyled

#### Table Interactions
43. Row hover state: subtle indigo background tint
44. Hover reveals action icons (edit, delete) aligned right
45. Edit icon on all milestones, delete icon only on custom milestones
46. Clicking edit opens existing edit flow (modal or inline — preserve current pattern)
47. Clicking delete opens existing delete confirmation (preserve current pattern)

### Design Language (Consistent with Case Detail Redesign)
48. Typography: DM Sans for UI, JetBrains Mono for numbers/IDs/ranges
49. Color system: Indigo primary, Emerald for success states, Amber for warnings, Slate grays for secondary
50. Cards: 14px border-radius, subtle borders, minimal shadows
51. Hover states reveal actions progressively
52. Animations: fade-in on page/tab transitions

## Database Context

- Table: `facility_milestones` — id, facility_id, name, display_name, display_order, pair_with_id, pair_position, is_active, scope (global/custom), source_milestone_type_id, phase, valid_min, valid_max
- Table: `milestone_types` — id, name (global milestone definitions)
- Table: `procedure_milestone_config` — facility_id, procedure_type_id, facility_milestone_id, display_order
- Table: `case_milestones` — references facility_milestone_id (used for "Cases Used" count)
- No database changes required — this is a pure frontend/layout refactor

## UI/UX

- Settings landing route: `/settings`
- Sub-page routes: `/settings/milestones`, `/settings/overview`, etc.
- The layout applies to ALL settings pages, not just milestones — every settings page gets the new tab bar + sub-nav pattern
- Settings pages currently use `<DashboardLayout><Container><SettingsLayout>` wrapper — the new layout replaces `SettingsLayout`
- Must support both facility_admin and global_admin roles — some settings items may be role-gated
- Responsive: settings pages are used on desktop monitors only (admin context)

## Files Likely Involved

### Layout Components
- `components/layouts/SettingsLayout.tsx` — **REPLACE** — current sidebar layout, will be replaced with new tab-based layout
- `components/layouts/SettingsTabLayout.tsx` — **NEW** — horizontal tabs + compact sub-nav + content area
- `components/layouts/SettingsLanding.tsx` — **NEW** — card grid overview component
- `components/layouts/DashboardLayout.tsx` — **NO CHANGES** — main app layout stays the same
- `components/layouts/navigation-config.tsx` — **AUDIT** — check if settings nav items are defined here, update references

### Settings Pages
- `app/settings/page.tsx` — **MODIFY** — becomes the landing page
- `app/settings/milestones/page.tsx` — **MAJOR REFACTOR** — new table layout
- `app/settings/overview/page.tsx` — **MODIFY** — wrap with new layout
- `app/settings/procedure-types/page.tsx` — **MODIFY** — wrap with new layout
- `app/settings/procedure-milestones/page.tsx` — **MODIFY** — wrap with new layout
- All other `app/settings/*/page.tsx` — **MODIFY** — swap `SettingsLayout` for `SettingsTabLayout`

### New Milestones Components
- `components/settings/MilestonesTable.tsx` — **NEW** — phase-grouped data table
- `components/settings/MilestoneRow.tsx` — **NEW** — individual table row with hover actions
- `components/settings/PhaseGroupHeader.tsx` — **NEW** — section header with accent bar
- `components/settings/PairIndicator.tsx` — **NEW** — pair column display
- `components/settings/SettingsStatsRow.tsx` — **NEW** — reusable stats chips above tables (can be used on other settings pages too)

## iOS Parity
- [ ] iOS equivalent needed (future — settings are web-only for now)
- Notes: iOS does not currently have a settings section. When added, it should follow native iOS Settings patterns (grouped list) rather than mirroring the web tab layout.

## Known Issues / Constraints
- Current `SettingsLayout` is imported by every settings page individually — each page wraps itself with `<DashboardLayout><Container><SettingsLayout>`. The migration to the new layout requires updating every settings page file.
- Some settings items are marked "Soon" (Notifications, Subscription) — these should be present in the nav but disabled or showing a placeholder page
- The milestones page currently fetches from `facility_milestones` and counts usage from `case_milestones` — no query changes needed, just presentation
- `navigation-config.tsx` has a `facilityNavGroups` section that includes settings links — these route definitions should be audited for consistency with the new URL structure
- Settings pages use a mix of `useUser` context and direct Supabase queries — no changes to data fetching patterns, just layout wrappers

## Out of Scope
- Global admin settings pages (`/admin/settings/*`) — these have their own nav structure and are separate from facility settings
- Adding new settings functionality (Notifications, Subscription) — just placeholder pages
- Mobile/responsive layout for settings — admin-only, desktop context
- Database schema changes — this is purely frontend
- Changes to the main app sidebar or `DashboardLayout`

## Acceptance Criteria
- [ ] Settings landing page shows all categories and items in a card grid
- [ ] Horizontal category tabs appear on all settings sub-pages
- [ ] Compact sub-nav shows only items within the active category
- [ ] Breadcrumb navigation works: Facility › Settings › Page Name
- [ ] All existing settings pages render correctly with the new layout
- [ ] Old `SettingsLayout` sidebar is fully removed (no dead code)
- [ ] Milestones page uses a phase-grouped table instead of badge-heavy list
- [ ] Phase badges removed — phase communicated by section headers
- [ ] Global/Custom distinction uses ◆ indicator, not badges
- [ ] Pair column shows linked milestone names structurally
- [ ] Table actions (edit, delete) appear on hover only
- [ ] Stats chips show correct counts above the table
- [ ] Navigation between settings pages preserves active category tab state
- [ ] Role-gated items are properly hidden for non-admin users
- [ ] All tests pass (`npm run typecheck && npm run lint`)
- [ ] No TypeScript `any` types introduced
- [ ] Committed with descriptive messages per phase
