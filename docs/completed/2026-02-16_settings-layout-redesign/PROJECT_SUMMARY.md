# Project: Settings Layout Redesign + Milestones Table Overhaul
**Completed:** 2026-02-16
**Branch:** feature/settings-layout-redesign
**Duration:** 2026-02-16 → 2026-02-16
**Total Phases:** 4

## What Was Built
Replaced the legacy settings sidebar navigation (a full-height sidebar with 8 category headers and 27+ nav items that competed visually with the main app sidebar) with a modern horizontal 8-tab bar + compact sub-nav pattern inspired by Stripe/Linear settings. The new layout uses a persistent shell via `app/settings/layout.tsx` — tabs never unmount when navigating between settings pages, making transitions feel instant.

A new settings landing page at `/settings` provides a card grid overview of all 8 categories (General, Check-In, Org, Case Mgmt, Ops, Reps, Financials, Security) with 28 total items, each showing icon, label, description, and optional badges (Soon, New, Admin). The tab bar only appears on sub-pages, keeping the landing page clean and scannable.

The Milestones settings page was simultaneously redesigned from a badge-heavy list into a phase-grouped data table using @tanstack/react-table with 5 columns (#, Milestone, Pair, Valid Range, Actions). Milestones are grouped under 4 phase headers (Pre-Op, Anesthesia, Procedure, Recovery) plus an Unassigned group, each with colored accent bars. Interactive features include @dnd-kit drag-and-drop reordering within phase groups, shared Add/Edit modal, archive with soft-delete, collapsed archived section with restore, and pair-column click-to-scroll.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Settings nav config (8 categories, 28 items), SettingsTabLayout (tabs + sub-nav), SettingsLanding (card grid), settings layout.tsx shell | 14b705a |
| 2     | Migrate all 27 settings pages to new layout, create ComingSoonPlaceholder, delete old SettingsLayout (560 lines) | ae2e1f1 |
| 3     | Milestones phase-grouped table with @tanstack/react-table, PhaseGroupHeader, PairIndicator, MilestoneRow, collapsed archived section, info bar | b578130 |
| 4     | @dnd-kit DnD reorder, MilestoneFormModal (shared Add/Edit), ArchivedMilestonesSection (extracted), optimistic reorder with DB persistence | 42a1d9b |

## Key Files Created/Modified

### New Files
- `lib/settings-nav-config.ts` — Single source of truth for 8 tab groups, 28 items, path-to-category lookup, icons, permissions, badges
- `lib/milestone-phase-config.ts` — Phase display names, DB value to phaseColors key mapping, phase ordering
- `components/settings/SettingsTabLayout.tsx` — Horizontal tab bar (sticky) + compact sub-nav sidebar (220px, sticky) + content area + breadcrumb
- `components/settings/SettingsLanding.tsx` — Card grid overview using CardEnhanced (interactive variant)
- `components/settings/ComingSoonPlaceholder.tsx` — Reusable placeholder for "Soon" items
- `components/settings/milestones/MilestonesTable.tsx` — Phase-grouped @tanstack/react-table with 5 columns
- `components/settings/milestones/PhaseGroupHeader.tsx` — Section header with colored accent bar
- `components/settings/milestones/MilestoneRow.tsx` — Table row with hover action reveal, custom indicator, Start/End pills
- `components/settings/milestones/PairIndicator.tsx` — Pair column with directional arrow + linked name
- `components/settings/milestones/MilestoneFormModal.tsx` — Shared Add/Edit modal with key-based form reset
- `components/settings/milestones/ArchivedMilestonesSection.tsx` — Collapsed archived milestones with Restore action
- `app/settings/layout.tsx` — Persistent shell rendering DashboardLayout + conditional SettingsTabLayout or SettingsLanding
- `app/settings/notifications/page.tsx` — Coming Soon placeholder
- `app/settings/subscription/page.tsx` — Coming Soon placeholder
- `app/settings/integrations/page.tsx` — Coming Soon placeholder

### Modified Files
- `app/settings/page.tsx` — Renders SettingsLanding instead of redirect
- `app/settings/milestones/page.tsx` — Major refactor to use new table components
- All 27 settings page files — Removed DashboardLayout/Container/SettingsLayout wrappers

### Deleted Files
- `components/settings/SettingsLayout.tsx` — Old 560-line sidebar layout, fully replaced

## Architecture Decisions
- **Persistent shell pattern**: `app/settings/layout.tsx` wraps all settings routes, rendering the tab bar and sub-nav once. Individual pages only render their content area. This prevents tab remounting on navigation.
- **Config-driven navigation**: `lib/settings-nav-config.ts` is the single source of truth for all tab groups, items, paths, icons, permissions, and badges. Both SettingsTabLayout and SettingsLanding consume this config.
- **Path-to-category lookup**: A flat map from pathname to category key enables O(1) active tab determination without URL parsing heuristics.
- **Big-bang migration**: All settings pages were migrated at once (Phase 2) rather than incrementally, since the layout.tsx shell wraps children automatically.
- **Phase color mapping**: `milestone-phase-config.ts` maps DB phase values (`pre_op`, `anesthesia`, etc.) to existing `phaseColors` keys from design-tokens.ts, maintaining visual consistency with phase colors used elsewhere in the app.
- **Single DndContext**: One DndContext wraps the entire table, with per-group SortableContexts inside. Cross-group drag is prevented via an ID-to-phase lookup map.
- **Modal for both Add and Edit**: MilestoneFormModal uses key-based form reset (React key prop changes when switching between add/edit) rather than imperative reset.
- **Archive terminology**: "Archive" instead of "Delete" for soft-delete operations, matching the existing `is_active` pattern.

## Database Changes
No database changes. This was a pure frontend refactor.

## Known Limitations / Future Work
- Some new layout components (SettingsLanding, SettingsTabLayout, ComingSoonPlaceholder) lack dedicated unit tests — they are covered by integration through page-level tests
- MilestoneRow, PairIndicator, PhaseGroupHeader lack isolated unit tests — tested through MilestonesTable integration tests
- `settings-nav-config.ts` lacks a dedicated test file — config structure is validated through layout component tests
- "Coming Soon" placeholder pages (Notifications, Subscription, Integrations) need real implementations in future projects
- The `docs/milestone-drawer-redesign.md` file exists as an untracked artifact and may be relevant to future milestone work
