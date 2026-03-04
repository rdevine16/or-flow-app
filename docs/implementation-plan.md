# Implementation Plan: Voice Command Settings UI

## Summary
Build a two-column settings page for managing voice command aliases used by the iOS Room Mode. Left column lists objectives (milestones + utility actions) with filter tabs. Right column shows aliases grouped by action type with add/delete. Includes a separate global admin page for managing default templates.

## Interview Notes
- **Migration:** Create a formal migration for voice_command_aliases (table exists in prod but no local migration)
- **Nav placement:** Operations tab in settings sidebar
- **Scope:** Global templates (facility_id=NULL) managed by global admin on separate page + facility-specific aliases on the main page
- **Left column:** Tabs/filter to switch between Milestones and Actions
- **Add behavior:** Duplicate check across all objectives before saving
- **Delete behavior:** Hard delete (remove row entirely)
- **Global admin:** Separate /settings/voice-commands/global page
- **Right panel:** Grouped by action_type with section headers (Record, Cancel)

---

## Phases

### Phase 1: Database Migration + DAL
**What:** Create migration to formalize `voice_command_aliases` table in version control. Create DAL module with query/mutation functions for listing, adding, and deleting aliases.
**Complexity:** Small

**Files touched:**
- NEW: `supabase/migrations/YYYYMMDDHHMMSS_create_voice_command_aliases.sql`
- NEW: `lib/dal/voice-commands.ts`
- MODIFY: `lib/dal/index.ts` — export new DAL

**Details:**
- Migration uses `CREATE TABLE IF NOT EXISTS` since table exists in prod
- Include RLS policies (facility-scoped: users can manage their own facility + global_admin bypass)
- Include indexes on `facility_id`, `milestone_type_id`, `action_type`
- DAL functions: `listByFacility()`, `listGlobal()`, `addAlias()`, `deleteAlias()`, `checkDuplicate()`
- Types: `VoiceCommandAlias`, `VoiceAliasInsert`

**Commit:** `feat(voice-commands): phase 1 - migration and data access layer`

**3-stage test gate:**
1. Unit: DAL function signatures and types compile
2. Integration: Query returns expected shape from Supabase
3. Workflow: Verify migration applies cleanly (CREATE IF NOT EXISTS)

---

### Phase 2: Settings Nav + Page Scaffolding
**What:** Add "Voice Commands" to Operations tab in settings nav. Create page route with two-column layout — left panel with search + Milestones/Actions filter tabs showing objectives, right panel with empty state. Wire up data fetching for milestone types and utility action types.
**Complexity:** Medium

**Files touched:**
- MODIFY: `lib/settings-nav-config.ts` — add Voice Commands item to Operations
- NEW: `app/settings/voice-commands/page.tsx` — server page
- NEW: `app/settings/voice-commands/PageClient.tsx` — client component with two-column layout

**Details:**
- Nav item: `{ id: 'voice-commands', label: 'Voice Commands', href: '/settings/voice-commands', icon: Mic, permission: 'settings.manage' }`
- Left column (~280px): search bar + two filter tabs (Milestones / Actions)
- Milestones tab: query `milestone_types` ordered by `display_order` — shows Patient In, Anesthesia Start, etc.
- Actions tab: hardcoded list of utility action types — Next Patient, Surgeon Left, Undo Last, Confirm Pending, Cancel Pending
- Selected item highlighted with `bg-blue-50 border border-blue-200`
- Right panel: empty state with "Select a command to view aliases" when nothing selected
- Follow Procedures page two-column pattern exactly

**Commit:** `feat(voice-commands): phase 2 - settings nav and page scaffolding`

**3-stage test gate:**
1. Unit: Nav config includes voice-commands item in operations category
2. Integration: Page renders with left column showing milestones and actions
3. Workflow: Navigate Settings → Operations → Voice Commands → see left panel with milestones

---

### Phase 3: Right Panel — Alias Detail View
**What:** When an objective is selected, the right panel shows all aliases grouped by action_type sections (Record, Cancel). Each alias row shows the phrase, an "AI Learned" badge if `auto_learned=true`, and a delete button. Add-new-phrase input at the bottom of each section with duplicate detection across all objectives.
**Complexity:** Large

**Files touched:**
- MODIFY: `app/settings/voice-commands/PageClient.tsx` — add right panel logic
- NEW: `components/settings/voice-commands/AliasGroupSection.tsx` — section for one action_type
- NEW: `components/settings/voice-commands/AliasRow.tsx` — individual alias row
- NEW: `components/settings/voice-commands/AddAliasInput.tsx` — inline add with duplicate check

**Details:**
- When a milestone is selected: show `record` and `cancel` sections (both action types apply)
- When a utility action is selected: show only the relevant action_type section (e.g., `next_patient` only has `next_patient` aliases)
- AliasGroupSection: header with action type label + count badge, list of AliasRow items, AddAliasInput at bottom
- AliasRow: phrase text, "AI Learned" purple badge if `auto_learned=true`, delete (trash icon) on hover with confirm dialog
- AddAliasInput: text input + "Add" button, on submit: check `checkDuplicate()` DAL function → if exists, show warning toast with conflicting objective name → if unique, insert and refetch
- Delete: hard delete via `deleteAlias()` DAL function → remove from list → toast confirmation
- Loading skeleton while aliases fetch

**Commit:** `feat(voice-commands): phase 3 - alias detail panel with add and delete`

**3-stage test gate:**
1. Unit: AliasGroupSection renders correct sections, AddAliasInput validates duplicates
2. Integration: Select objective → aliases load grouped by action type → add/delete persists
3. Workflow: Select "Incision" → see Record + Cancel sections → add phrase → duplicate warning → add unique phrase → delete a phrase → verify iOS would read updated data

---

### Phase 4: Global Admin Templates Page
**What:** Create separate `/settings/voice-commands/global` page for global admins to manage default templates (`facility_id=NULL` aliases). Same two-column layout but queries global aliases only. Add nav item visible only to global admins.
**Complexity:** Medium

**Files touched:**
- NEW: `app/settings/voice-commands/global/page.tsx`
- NEW: `app/settings/voice-commands/global/PageClient.tsx`
- MODIFY: `lib/settings-nav-config.ts` — add global admin sub-item with admin badge

**Details:**
- Route only accessible to global_admin users (check `access_level` in UserContext)
- Queries `voice_command_aliases` where `facility_id IS NULL`
- Same two-column layout and components as facility page (reuse AliasGroupSection, AliasRow, AddAliasInput)
- Adds/deletes target `facility_id=NULL` records
- Nav item: `{ id: 'voice-commands-global', label: 'Voice Templates', href: '/settings/voice-commands/global', icon: Mic, badge: 'admin' }`
- Header text explains: "Default voice commands applied to new facilities"
- Changes only affect new facilities — no cascade to existing

**Commit:** `feat(voice-commands): phase 4 - global admin templates page`

**3-stage test gate:**
1. Unit: Global page queries facility_id=NULL aliases only
2. Integration: Global admin can add/delete global template aliases
3. Workflow: Global admin navigates to global page → edits defaults → verifies facility page unaffected

---

### Phase 5: Polish + Tests
**What:** Permission gating (`settings.manage`), empty states, loading skeletons, error handling, search functionality in left panel, responsive behavior. Full test suite covering unit, integration, and workflow scenarios.
**Complexity:** Medium

**Files touched:**
- MODIFY: `app/settings/voice-commands/PageClient.tsx` — polish, search filter, error states
- NEW: `app/settings/voice-commands/__tests__/PageClient.test.tsx`
- NEW: `app/settings/voice-commands/__tests__/voice-commands-workflow.test.tsx`
- NEW: `components/settings/voice-commands/__tests__/AliasGroupSection.test.tsx`
- NEW: `components/settings/voice-commands/__tests__/AddAliasInput.test.tsx`

**Details:**
- Permission gate: `can('settings.manage')` — read-only view without manage permission (hide add/delete)
- Search in left panel: filter objectives by name (debounced, case-insensitive)
- Empty states: no aliases for selected objective, no search results
- Loading: skeleton rows in both panels while data fetches
- Error: ErrorBanner at top of page on fetch failure
- Keyboard: Enter to add alias, Escape to clear input
- Responsive: stack panels vertically on small screens

**Commit:** `feat(voice-commands): phase 5 - polish, permissions, and test suite`

**3-stage test gate:**
1. Unit: Components render in all states (loading, empty, error, populated), permission gating works
2. Integration: Permission gating blocks non-admins from add/delete, duplicate detection works cross-objective
3. Workflow: Full flow — navigate → select milestone → add alias → delete alias → switch tabs → select action → verify

---

## Phase Summary

| # | Phase | Complexity | Key Files |
|---|-------|-----------|-----------|
| 1 | Database migration + DAL | Small | migration, voice-commands.ts, dal/index.ts |
| 2 | Settings nav + page scaffolding | Medium | settings-nav-config.ts, PageClient.tsx |
| 3 | Right panel: alias detail view | Large | PageClient.tsx, AliasGroupSection, AliasRow, AddAliasInput |
| 4 | Global admin templates page | Medium | global/PageClient.tsx, settings-nav-config.ts |
| 5 | Polish + tests | Medium | PageClient.tsx, test files |

**Total: 5 phases** (1 small, 3 medium, 1 large)
