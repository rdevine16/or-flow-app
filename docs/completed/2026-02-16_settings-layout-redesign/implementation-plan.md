# Implementation Plan: Settings Layout Redesign + Milestones Table Overhaul

> Generated: 2026-02-16

## Summary

Replace the current settings sidebar navigation with a horizontal 8-tab bar + compact sub-nav pattern (Stripe/Linear-inspired). Simultaneously redesign the Milestones settings page from a badge-heavy list into a clean, phase-grouped data table with drag-and-drop reordering. This is a pure frontend refactor — no database changes.

## Interview Notes

Key decisions from the user interview + review Q&A (33 questions resolved):

- **8 horizontal tabs** with abbreviated labels: General, Check-In, Org, Case Mgmt, Ops, Reps, Financials, Security
- **Device Reps is its own tab** with Device Reps + Implant Companies (moved from Operations)
- **Orphan pages added**: Closures → Operations, Facilities → Financials
- **Persistent shell** via `app/settings/layout.tsx` — tabs never unmount
- **No tab bar on landing page** — landing is full-width card grid
- **Config lookup map** for active tab determination (path → category)
- **Phase colors**: Key-mapping layer from DB values (`pre_op`, `anesthesia`, etc.) to existing `phaseColors` keys
- **All 5 DB phase groups** shown with empty states for empty groups
- **@tanstack/react-table** for milestones table (consistency with CasesTable)
- **@dnd-kit** for drag-and-drop reordering within phase groups
- **Modal** for both Add and Edit milestone flows
- **Archive** terminology (not Delete) — soft delete with collapsed archived section
- **Skip** Cases count column and stats chips — not actionable in settings context
- **Keep Geist fonts** — no font change
- **animate-fade-in** for page transitions (already in globals.css)
- **Hide inaccessible items** — if entire category empty, hide that tab
- **"Soon" items** shown with badge, navigate to placeholder page
- **Reuse existing** Breadcrumb, CardEnhanced (interactive variant), Modal, SkeletonTable components
- **Separate config file** at `lib/settings-nav-config.ts`
- **Delete old SettingsLayout immediately** — clean break, no fallback
- **Big-bang layout swap** — all pages migrate at once since layout.tsx wraps children automatically

## Tab Structure (8 Tabs, 28 Items)

### Tab 1: General (3 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Overview | `/settings/general` | Building2 | — | — |
| Notifications | `/settings/notifications` | Bell | Soon | settings.manage |
| Subscription | `/settings/subscription` | CreditCard | Soon | settings.manage |

### Tab 2: Check-In (2 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Arrival Settings | `/settings/checkin` | ClipboardCheck | — | settings.manage |
| Checklist Builder | `/settings/checklist-builder` | ClipboardCheck | — | settings.manage |

### Tab 3: Org (2 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Users & Roles | `/settings/users` | Users | — | — |
| Roles & Permissions | `/settings/permissions` | KeyRound | — | users.manage |

### Tab 4: Case Mgmt (7 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Procedure Types | `/settings/procedures` | ClipboardList | — | — |
| Milestones | `/settings/milestones` | Clock | — | — |
| Procedure Milestones | `/settings/procedure-milestones` | Clock | — | settings.manage |
| Surgeon Preferences | `/settings/surgeon-preferences` | Zap | New | settings.manage |
| Delay Types | `/settings/delay-types` | AlertTriangle | — | settings.manage |
| Cancellation Reasons | `/settings/cancellation-reasons` | Ban | — | settings.manage |
| Case Complexities | `/settings/complexities` | AlertTriangle | — | settings.manage |

### Tab 5: Ops (5 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| OR Rooms | `/settings/rooms` | LayoutGrid | — | — |
| Closures | `/settings/closures` | Clock | — | settings.manage |
| Analytics | `/settings/analytics` | BarChart3 | New | settings.manage |
| Case Flags | `/settings/flags` | Flag | New | settings.manage |
| Integrations | `/settings/integrations` | Puzzle | Soon | settings.manage |

### Tab 6: Reps (2 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Device Reps | `/settings/device-reps` | User | — | — |
| Implant Companies | `/settings/implant-companies` | FlaskConical | New | settings.manage |

### Tab 7: Financials (6 items)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Overview | `/settings/financials` | DollarSign | — | financials.view |
| Facility Details | `/settings/facilities` | Building2 | — | financials.view |
| Cost Categories | `/settings/financials/cost-categories` | Calculator | — | financials.view |
| Payers | `/settings/financials/payers` | Building2 | — | financials.view |
| Procedure Pricing | `/settings/financials/procedure-pricing` | Tag | — | financials.view |
| Surgeon Variance | `/settings/financials/surgeon-variance` | User | — | financials.view |

### Tab 8: Security (1 item)
| Item | Path | Icon | Badge | Permission |
|------|------|------|-------|------------|
| Audit Log | `/settings/audit-log` | FileText | Admin | audit.view |

---

## Phases

### Phase 1: Settings Nav Config + Tab Layout Shell

**What it does:** Creates the nav config (single source of truth), the new SettingsTabLayout component (horizontal tabs + compact sub-nav), the settings landing page (card grid), and the `app/settings/layout.tsx` persistent shell. This is the foundation all other phases build on.

**Files touched:**
- `lib/settings-nav-config.ts` — **NEW** — 8 groups, 28 items, path-to-category lookup, icons, permissions, badges, descriptions
- `components/settings/SettingsTabLayout.tsx` — **NEW** — horizontal tab bar (sticky) + compact sub-nav sidebar (220px, sticky) + content area + breadcrumb
- `components/settings/SettingsLanding.tsx` — **NEW** — card grid overview using CardEnhanced (interactive variant), grouped by category
- `app/settings/layout.tsx` — **NEW** — persistent shell that renders DashboardLayout + conditionally renders SettingsTabLayout (sub-pages) or SettingsLanding (landing page)
- `app/settings/page.tsx` — **MODIFY** — render SettingsLanding instead of redirect to `/settings/procedures`

**Commit message:** `feat(settings): phase 1 - settings nav config, tab layout shell, and landing page`

**Test gate:**
1. **Unit:** Nav config returns correct items for different permission sets (admin vs user). Tab layout renders correct active tab for given pathname. Landing page renders all 8 category cards.
2. **Integration:** Tab bar highlights correct tab when navigating to a sub-page. Sub-nav shows correct items for active category. Breadcrumb renders Facility > Settings > Page Name. Permission-gated items are hidden for unauthorized users. Empty categories hide their tabs.
3. **Workflow:** Dashboard → click Settings → see landing page (no tab bar) → click a category item → see tab bar + sub-nav + content area → click "Settings" in breadcrumb → back to landing page.

**Complexity:** Large

---

### Phase 2: Migrate All Settings Pages + Cleanup

**What it does:** Removes old SettingsLayout wrapper from every settings page. Since `app/settings/layout.tsx` now provides the persistent shell (DashboardLayout + SettingsTabLayout), individual pages only render their content. Also creates placeholder pages for "Coming Soon" items, and deletes the old SettingsLayout component.

**Files touched:**
- `app/settings/general/page.tsx` — **MODIFY** — remove DashboardLayout/Container/SettingsLayout wrappers
- `app/settings/analytics/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/audit-log/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/cancellation-reasons/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/checkin/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/checklist-builder/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/closures/page.tsx` — **MODIFY** — remove wrappers (currently missing SettingsLayout)
- `app/settings/complexities/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/delay-types/page.tsx` — **MODIFY** — remove wrappers (currently missing SettingsLayout)
- `app/settings/device-reps/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/facilities/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/financials/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/financials/cost-categories/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/financials/payers/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/financials/procedure-pricing/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/financials/surgeon-variance/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/flags/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/implant-companies/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/milestones/page.tsx` — **MODIFY** — remove wrappers (milestones redesign is Phase 3/4)
- `app/settings/permissions/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/procedures/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/users/page.tsx` — **MODIFY** — remove wrappers
- `app/settings/rooms/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/procedure-milestones/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/surgeon-preferences/page.tsx` — **MODIFY** — remove wrappers (if exists)
- `app/settings/notifications/page.tsx` — **NEW** — placeholder "Coming Soon" page
- `app/settings/subscription/page.tsx` — **NEW** — placeholder "Coming Soon" page
- `app/settings/integrations/page.tsx` — **NEW** — placeholder "Coming Soon" page
- `components/settings/ComingSoonPlaceholder.tsx` — **NEW** — reusable placeholder component for "Soon" items
- `components/settings/SettingsLayout.tsx` — **DELETE** — old sidebar layout, fully replaced

**Commit message:** `feat(settings): phase 2 - migrate all settings pages to new layout, delete old SettingsLayout`

**Test gate:**
1. **Unit:** Each settings page renders without errors after wrapper removal. ComingSoonPlaceholder renders title, description, and icon.
2. **Integration:** Every settings route renders inside the new tab layout with correct active tab and sub-nav. "Coming Soon" pages are accessible and show placeholder content. No broken imports referencing deleted SettingsLayout.
3. **Workflow:** Navigate through every settings tab → click each sub-nav item → verify correct page renders → verify tab stays highlighted → verify breadcrumb updates. Test with both admin and non-admin users.

**Complexity:** Large (many files, but mostly mechanical changes)

---

### Phase 3: Milestones Table — Core Structure

**What it does:** Redesigns the milestones settings page from the current list/card layout into a phase-grouped data table using @tanstack/react-table. Creates the table structure with 5 columns (#, Milestone, Pair, Valid Range, Actions), phase group section headers with accent colors, the info bar, loading skeleton, and empty states.

**Files touched:**
- `components/settings/milestones/MilestonesTable.tsx` — **NEW** — main table component with @tanstack/react-table, phase grouping logic, column definitions
- `components/settings/milestones/PhaseGroupHeader.tsx` — **NEW** — section header with colored accent bar, phase label, milestone count
- `components/settings/milestones/MilestoneRow.tsx` — **NEW** — table row with hover action reveal (edit/archive icons), ◆ custom indicator, Start/End pills
- `components/settings/milestones/PairIndicator.tsx` — **NEW** — pair column: directional arrow + linked name (clickable to scroll), or em-dash
- `lib/milestone-phase-config.ts` — **NEW** — phase display names, DB value → phaseColors key mapping, phase ordering
- `app/settings/milestones/page.tsx` — **MAJOR REFACTOR** — replace current milestone list with new MilestonesTable, add info bar, integrate with existing data fetching

**Commit message:** `feat(settings): phase 3 - milestones phase-grouped table with core columns and styling`

**Test gate:**
1. **Unit:** MilestonesTable renders milestones grouped by phase. PhaseGroupHeader shows correct color per phase. MilestoneRow displays ◆ for custom, Start/End pills. PairIndicator shows arrow + name or em-dash. Empty phase groups show "No milestones in this phase" message.
2. **Integration:** Table loads data from existing useSupabaseQuery hook. Phase groups match actual DB phase values. Hover on rows reveals action icons. SkeletonTable shows during loading. Info bar renders below header.
3. **Workflow:** Navigate to Milestones settings → see phase-grouped table with all 5 phases → hover rows to see actions → verify pair links are clickable and scroll to target row.

**Complexity:** Large

---

### Phase 4: Milestones Table — Interactions

**What it does:** Adds all interactive features to the milestones table: drag-and-drop reordering within phase groups (using @dnd-kit), Add/Edit milestone modals, archive action with confirmation, collapsed archived milestones section with restore, and pair-column click-to-scroll behavior.

**Files touched:**
- `components/settings/milestones/MilestonesTable.tsx` — **MODIFY** — integrate DnD context per phase group, add archived section toggle
- `components/settings/milestones/MilestoneRow.tsx` — **MODIFY** — add drag handle, DnD sortable behavior, archive click handler
- `components/settings/milestones/MilestoneFormModal.tsx` — **NEW** — shared modal for Add and Edit flows (display name, phase group, validation range, pairing)
- `components/settings/milestones/ArchivedMilestonesSection.tsx` — **NEW** — collapsed section below table with archived milestones and Restore action
- `app/settings/milestones/page.tsx` — **MODIFY** — wire up modal state, add/edit/archive handlers, refetch logic

**Commit message:** `feat(settings): phase 4 - milestones DnD reorder, add/edit modals, archive/restore`

**Test gate:**
1. **Unit:** Drag handle appears on each row. DnD reorders items within a phase group only (not across groups). MilestoneFormModal validates required fields. ArchivedMilestonesSection toggles open/closed.
2. **Integration:** Reorder persists new display_order to DB. Add milestone creates record and appears in correct phase group. Edit milestone saves changes. Archive soft-deletes and moves to archived section. Restore re-activates and returns to table. Audit logging fires for all mutations.
3. **Workflow:** Add custom milestone via modal → see it in table → drag to reorder within phase → edit via modal → archive → expand archived section → restore → verify it returns to correct phase group.

**Complexity:** Large

---

## Phase Dependency Graph

```
Phase 1 (Nav Config + Tab Layout)
    └── Phase 2 (Migrate All Pages)
        └── Phase 3 (Milestones Table Core)
            └── Phase 4 (Milestones Interactions)
```

All phases are sequential. Each phase produces one commit.

## Risk Notes

- **Phase 2 is high-touch** — modifying 20+ files. Each file is a mechanical change (remove wrapper imports), but any missed file will break. Run typecheck after every batch of changes.
- **Phase 3 requires understanding @tanstack/react-table grouping** — reference CasesTable for patterns.
- **Phase 4 DnD + react-table combo** — @dnd-kit needs to wrap individual phase group sections, not the entire table. Reference SortableList.tsx and RoomOrderModal.tsx for patterns.
- **Financials sub-routes** (`/settings/financials/cost-categories`, etc.) need special handling in the config lookup map since they're nested deeper than other settings routes.

## Session Log

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 1 | complete | 2026-02-16 | Nav config (8 categories, 28 items), SettingsTabLayout (tabs + sub-nav), SettingsLanding (card grid), settings layout.tsx shell, page.tsx landing. Commit: 14b705a |
| 2 | complete | 2026-02-16 | Removed DashboardLayout/Container/SettingsLayout wrappers from all 27 settings pages. Created ComingSoonPlaceholder component. Deleted old SettingsLayout.tsx (560 lines). Fixed 4 pages with incomplete wrapper removal. All 1216 tests passing. |
| 3 | complete | 2026-02-16 | Created milestone-phase-config.ts (4 phases + unassigned), PhaseGroupHeader, PairIndicator, MilestoneRow, MilestonesTable components. Refactored milestones page from badge-heavy list to phase-grouped @tanstack/react-table with 5 columns (#, Milestone, Pair, Valid Range, Actions). Added collapsed archived section, slim info bar. 24 new tests (8 config + 16 table). All 1240 tests passing. Commit: b578130 |
| 4 | complete | 2026-02-16 | Added @dnd-kit DnD reordering (single DndContext outside table, per-group SortableContexts inside). Created MilestoneFormModal (shared Add/Edit with key-based form reset). Created ArchivedMilestonesSection (extracted from page). Refactored page.tsx to use new components. Optimistic reorder with DB persistence. Cross-group drag prevented via ID→phase lookup map. 22 new tests (12 modal + 10 archived). All 1262 tests passing. Commit: 42a1d9b |
