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

## Review Q&A

> Generated by /review on 2026-02-16

**Q1:** The spec lists 4 category tabs (General, Clinical, Organization, Case Management) but the current SettingsLayout has 8 groups (General, Check-In, Organization, Case Management, Operations, Financials, Device Reps, Security & Compliance). How should the 8 existing groups map to tabs?
**A1:** Keep all 8 as tabs. Map the current 8 sidebar groups directly to 8 horizontal tabs. Most faithful to existing structure.

**Q2:** With 8 horizontal tabs, space gets tight. Should labels be abbreviated, full with scroll, icons + labels, or wrap to 2 rows?
**A2:** Abbreviated labels always. Shorten long labels (e.g., "Case Mgmt", "Security", "Device Reps") to fit 8 tabs on most screens without scrolling.

**Q3:** The settings landing page (/settings) shows a card grid with all categories and items. With 8 categories and 27+ items, how should the cards be displayed?
**A3:** Full cards with all items. Each of the 8 category cards shows all its items as clickable rows (icon, label, description, chevron, badge). Scrollable page.

**Q4:** Should the compact sub-nav be a left sidebar, a horizontal sub-nav below tabs, or handle long lists differently?
**A4:** Left sidebar (220px), allow scrolling. If a category has 7+ items, they all show and scroll if needed. Matches Stripe/Linear pattern.

**Q5:** Should the category tabs and sub-nav be a persistent shell (tabs stay mounted, content swaps) or pure navigation links (full page transitions)?
**A5:** Persistent shell. Tab bar + sub-nav sidebar are rendered once by a parent layout (Next.js layout.tsx). Navigating between settings pages only swaps the content area. Tabs never unmount/remount. Feels instant.

**Q6:** Should we reuse the existing Breadcrumb component or build a settings-specific one?
**A6:** Reuse existing Breadcrumb from components/ui/Breadcrumb.tsx. Pass items as props: [{label: facilityName, href: '/'}, {label: 'Settings', href: '/settings'}, {label: pageName}].

**Q7:** For the landing page category cards, should we use CardEnhanced, a custom component, or raw Tailwind?
**A7:** Use CardEnhanced with the 'interactive' variant. Build item rows as a simple list inside Card.Content. Consistent with existing patterns.

**Q8:** The spec wants 3 phase groups (Pre-Op, Surgical, Closing) but the DB has 5 (pre_op, anesthesia, procedure, recovery, turnover). How to map?
**A8:** Show all 5 phase groups as separate section headers. More accurate to the data.

**Q9:** With 5 phase groups, we need 5 accent colors. Use existing phaseColors from design-tokens.ts or create new ones?
**A9:** Use existing phaseColors from design-tokens.ts: blue (Pre-Op), amber (Anesthesia), purple (Procedure), green (Recovery), yellow (Turnover). Consistent with how phases are colored elsewhere.

**Q10:** Should the milestones table use @tanstack/react-table (like CasesTable) or a simpler custom table?
**A10:** Use @tanstack/react-table for consistency with CasesTable. Can use grouping features for phase sections.

**Q11:** Should the Pair column be display-only, clickable to edit, or display + link to paired milestone?
**A11:** Display + link to paired milestone. Shows the paired name as a clickable link that scrolls to or highlights the paired milestone row in the table.

**Q12:** Should the "Cases" count column fetch eagerly, lazily, or be skipped?
**A12:** Skip counts entirely. Remove the Cases column. Usage counts aren't actionable in settings context and add query overhead.

**Q13:** Should stat chips above the table use inline badges, MetricCardCompact, StatsCard, or be skipped?
**A13:** Skip stats entirely. The phase group headers already communicate structure. Active/Custom counts are visible in the table itself.

**Q14:** Updated table columns: #, Milestone, Pair, Valid Range, Actions. Keep all 5, drop Valid Range, or add other columns?
**A14:** Keep all 5 columns: #, Milestone (◆ custom indicator + Start/End pill), Pair (→ linked name or —), Valid Range (monospace), Actions (hover edit/archive).

**Q15:** Should row actions say "Archive" (current term, soft delete) or "Delete" (spec term)?
**A15:** Archive (keep current term). Matches the soft delete behavior and allows restoration. Less alarming for users.

**Q16:** Should editing milestones use a modal, inline expansion, or slide-out drawer?
**A16:** Switch to modal. Better fit for a structured table — doesn't break column alignment. Uses existing Modal component.

**Q17:** Should the info bar use the existing Alert component, a simple styled div, or be skipped?
**A17:** Simple styled div. One-line with subtle background and left border accent. "◆ indicates a custom milestone. All others are global defaults."

**Q18:** Should the "Add Custom Milestone" flow use a modal, inline form, or same modal as edit?
**A18:** Modal for Add too. Consistent with the new edit modal pattern.

**Q19:** What animation pattern for settings page transitions?
**A19:** animate-fade-in only. Simple opacity fade when switching pages. Already defined in globals.css. Subtle and professional.

**Q20:** Should we switch to DM Sans / JetBrains Mono per spec, or keep existing Geist fonts?
**A20:** Keep Geist fonts (Geist Sans and Geist Mono). Changing fonts would create inconsistency with other pages.

**Q21:** Should inaccessible settings items be hidden, shown as disabled, or shown with access-denied on click?
**A21:** Hide inaccessible items. Same as current behavior — items the user can't access don't appear. If an entire category is empty for a user, hide that tab too.

**Q22:** Should "Coming Soon" items (Notifications, Subscription, Integrations) appear in the new layout?
**A22:** Show with 'Soon' badge, clickable. Navigates to a placeholder page. Lets users know features are planned.

**Q23:** When a phase group has zero milestones, should it be hidden or shown with empty state?
**A23:** Show all 5 phase groups with empty state. "No milestones in this phase" message for empty groups.

**Q24:** Loading state: skeleton table, spinner, or progressive loading?
**A24:** Skeleton table using SkeletonTable from components/ui/Skeleton.tsx. Phase group headers can be static with skeleton rows beneath.

**Q25:** Where should archived milestones appear in the new table design?
**A25:** Separate section below table. Collapsed by default with toggle to expand. Shows archived milestones with Restore action.

**Q26:** Should we migrate all settings pages in one big-bang phase or incrementally?
**A26:** Big-bang in layout phase. Build new SettingsTabLayout with layout.tsx, then swap all pages at once. Since layout.tsx wraps child routes automatically, individual pages just need their old SettingsLayout wrapper removed.

**Q27:** Build order: layout first or milestones first?
**A27:** Layout first, then milestones. Layout is the foundation all pages need. Milestones redesign is one page within the new layout.

**Q28:** Delete old SettingsLayout immediately or keep as fallback?
**A28:** Delete immediately. Clean break, no dead code.

**Q29:** Should the settings nav config (8 groups, 27+ items) live in a separate file or inline in the layout component?
**A29:** Separate config file (e.g., lib/settings-nav-config.ts). Imported by SettingsTabLayout, SettingsLanding, and any future components. Single source of truth.

**Q30:** Should the landing page (/settings) show the tab bar?
**A30:** No tab bar on landing page. Landing page is a full-width card grid overview. Tabs only appear on settings sub-pages. Clean hierarchy: Landing → Tab + Sub-nav + Content.

**Q31:** Active tab determination: config lookup, Next.js route groups, or URL segment convention?
**A31:** Config lookup map. A config object maps each settings path to its category. Tab layout reads pathname and looks up active category. Matches current SettingsLayout pattern.

**Q32:** Scroll behavior: sticky tabs + sticky sub-nav, sticky tabs only, or everything scrolls?
**A32:** Sticky tabs + sticky sub-nav. Tab bar sticks below header. Sub-nav sidebar is also sticky and independently scrollable. Content area scrolls normally. Matches Stripe settings behavior.

**Q33:** Should drag-and-drop reordering of milestones be preserved in the new table?
**A33:** Keep drag-and-drop reorder. Drag handles on each table row for reordering within a phase group.
