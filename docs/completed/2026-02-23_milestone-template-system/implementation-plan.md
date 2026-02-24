# Implementation Plan: Milestone Template System

## Summary
Replace the toggle-based milestone configuration system with a template-based model. Introduces `milestone_templates` as first-class entities, a new `facility_phases` library, and a unified 5-tab settings page. Surgeon overrides simplify from per-milestone toggles to "pick a different template." Includes facility-level UI (5 tabs), admin-level UI (4 tabs), data migration, RPC updates, demo generator updates, analytics RPC rewrites, and old table removal.

## Interview Notes

| Decision | Answer |
|----------|--------|
| Surgeon override model | Template swap — surgeon picks a different template per procedure. No per-milestone editing. |
| Boundary model | Position-based — boundaries computed from adjacency (first/last milestone in a phase). No explicit `start_milestone_id`/`end_milestone_id` on template phases. |
| Phase-to-item schema | `facility_phase_id` on `milestone_template_items` — each item knows its phase. `milestone_template_phases` table removed entirely. |
| Sub-phases | Keep — `facility_phases.parent_phase_id` (1 level deep). Sub-phase items render nested within parent. |
| Tab 1 (Milestones) | Simple searchable table CRUD. No phase grouping — phases assigned in template builder (Tab 3). |
| Tab 2 (Phases) | Phase library CRUD: name, display_name, color. Flat list (nesting in template builder). |
| Tabs 4-5 style | Simple list + template picker. No flow visualization. Clean assignment UI. |
| Analytics RPCs | Update to use template model (resolve milestones from templates). Then drop old tables. |
| Mockup reference | `docs/templates-page.jsx` is canonical. `docs/orbit-milestones-system.jsx` is old/deprecated. |
| Old tables | Drop `procedure_milestone_config` and `surgeon_milestone_config` at end of feature |
| Analytics phases (`phase_definitions`) | Keep as separate system, untouched |
| `phase_group` column on `facility_milestones` | Keep as-is |
| `finalize_draft_case()` surgeon override bug | Fix in this feature |
| Procedure with no template | Fall back to facility's default template |
| Old components (FlatMilestoneList, InheritanceBreadcrumb, buildFlatRows, bracketUtils) | Delete after all tabs are rebuilt |

---

## Schema Overview

### New Tables (Facility Level)
1. **`facility_phases`** — Phase library: `id`, `facility_id`, `name`, `display_name`, `color_key`, `display_order`, `parent_phase_id` (1 level deep for sub-phases), `is_active`, `deleted_at`, `deleted_by`
2. **`milestone_templates`** — Named template per facility: `id`, `facility_id`, `name`, `description`, `is_default` (one default per facility), `is_active`, `deleted_at`, `deleted_by`
3. **`milestone_template_items`** — Ordered milestones in a template with phase assignment: `id`, `template_id`, `facility_milestone_id`, `facility_phase_id` (nullable — can be unphased), `display_order`
4. **`surgeon_template_overrides`** — Surgeon picks different template per procedure: `id`, `facility_id`, `surgeon_id`, `procedure_type_id`, `milestone_template_id`

### New Tables (Global Admin Level)
5. **`phase_templates`** — Global phase library: `id`, `name`, `display_name`, `color_key`, `display_order`, `parent_phase_template_id`, `is_active`
6. **`milestone_template_types`** — Global template definitions: `id`, `name`, `description`, `is_default`, `is_active`
7. **`milestone_template_type_items`** — Global template items: `id`, `template_type_id`, `milestone_type_id`, `phase_template_id`, `display_order`

### Modified Tables
8. **`procedure_types`** — Add `milestone_template_id UUID REFERENCES milestone_templates(id)`
9. **`procedure_type_templates`** — Add `milestone_template_type_id UUID REFERENCES milestone_template_types(id)`

### Tables Removed (at end)
- `procedure_milestone_config`
- `surgeon_milestone_config`
- `procedure_milestone_templates` (replaced by `milestone_template_type_items`)

### Tables Kept As-Is
- `facility_milestones` — Unchanged atom library
- `phase_definitions` — Unchanged analytics-only phase system
- `case_milestones` — Unchanged

---

## Phase 1: Database Schema + Data Migration + RPC Updates
**Complexity:** Large
**Commit:** `feat(milestones): phase 1 - template tables, data migration, RPC updates`

### What it does
- Create facility-level tables: `facility_phases`, `milestone_templates`, `milestone_template_items`, `surgeon_template_overrides`
- Create global admin tables: `phase_templates`, `milestone_template_types`, `milestone_template_type_items`
- Add `milestone_template_id` FK to `procedure_types` and `milestone_template_type_id` FK to `procedure_type_templates`
- RLS policies for all new tables (same pattern as existing milestone tables)
- Enforce single-default constraint: trigger or check constraint ensuring only one `is_default = true` template per facility
- Soft-delete triggers on `facility_phases` and `milestone_templates` via `sync_soft_delete_columns()`
- **Data migration:**
  1. Create `facility_phases` from existing `phase_definitions` (extract name, display_name, color_key, parent mapping)
  2. For each facility, create a "Facility Default" template (`is_default = true`) with ALL active facility_milestones
  3. Populate `milestone_template_items` with `display_order` from facility_milestones, `facility_phase_id` mapped from phase_definitions boundaries
  4. For each procedure type with custom `procedure_milestone_config`: compare enabled set against default template → if different, create a procedure-specific template; otherwise assign default
  5. Set `procedure_types.milestone_template_id` for all procedure types
  6. Convert `surgeon_milestone_config` → determine effective milestone set per surgeon+procedure → match to existing template or create new one → create `surgeon_template_overrides` rows
  7. Create global admin records: `phase_templates` from `phase_definition_templates`, `milestone_template_types` from existing milestone_types patterns
- **RPC updates:**
  - Rewrite `create_case_with_milestones()`: resolve template via cascade (surgeon_template_override → procedure_types.milestone_template_id → facility default template) → milestone_template_items → case_milestones
  - Rewrite `finalize_draft_case()`: same template resolution (fixes existing surgeon override bug)
  - Extend `seed_facility_with_templates()`: seed `facility_phases` from `phase_templates`, `milestone_templates` from `milestone_template_types`, `milestone_template_items` from `milestone_template_type_items`, assign templates to procedure types

### Files touched
- `supabase/migrations/YYYYMMDD_milestone_templates.sql` (new)

### Test gate
1. **Unit:** Verify new tables exist with correct columns, constraints, RLS via Supabase REST API; verify single-default constraint works
2. **Integration:** Verify data migration created correct templates from existing configs; verify `create_case_with_milestones()` resolves from template cascade; verify `finalize_draft_case()` resolves correctly (surgeon override bug fixed); verify `seed_facility_with_templates()` provisions phases + templates
3. **Workflow:** Create case → verify case_milestones match template → verify analytics RPCs still compute correctly (phase_definitions untouched)

---

## Phase 2: Tab Shell + Tab 1 (Milestones) + Tab 2 (Phases)
**Complexity:** Medium
**Commit:** `feat(milestones): phase 2 - tab shell, milestones tab, phases tab`

### What it does
- Rewrite `/settings/milestones` page as a 5-tab layout (horizontal tabs, all on one page)
- Tab routing via state (Tabs 3-5 show placeholder content until built in later phases)
- **Tab 1 — Milestones:**
  - Simple searchable table of facility milestones (no phase grouping — phases assigned in templates)
  - CSS Grid or table rows: name, pair badge (start/end), validation range (min/max minutes), action buttons
  - Add milestone (reuse `MilestoneFormModal` — remove phase dropdown since phases now assigned in templates)
  - Edit milestone (name, display_name, min/max minutes, validation_type, pairing)
  - Archive/restore (reuse `ArchivedMilestonesSection`)
  - Search/filter
- **Tab 2 — Phases:**
  - Phase library CRUD from `facility_phases` table
  - Simple list with color swatches, name, display_name
  - Create/edit/archive phases
  - Color picker from `COLOR_KEY_PALETTE` (8 colors)
  - No hierarchy display — nesting happens in Tab 3 template builder
  - Sub-phase indicator (shows parent if applicable)

### Files touched
- `app/settings/milestones/page.tsx` (rewrite — tab shell + Tab 1 + Tab 2)
- `components/settings/milestones/PhaseLibrary.tsx` (new — Tab 2 content)
- `components/settings/milestones/MilestoneFormModal.tsx` (modify — remove phase_group dropdown)
- `components/settings/milestones/ArchivedMilestonesSection.tsx` (reuse as-is)

### Test gate
1. **Unit:** Tab switching renders correct content; milestone CRUD operations; phase CRUD operations; pair link/unlink; search filtering
2. **Integration:** Create milestone → verify in DB; create phase → verify in DB; edit milestone validation data → verify persisted; archive phase → verify soft delete
3. **Workflow:** Navigate all 5 tabs → verify Tab 1 and Tab 2 are functional, Tabs 3-5 show placeholders

---

## Phase 3: Tab 3 — Template Builder
**Complexity:** Large
**Commit:** `feat(milestones): phase 3 - template builder with drag-and-drop`

### What it does
- Build the 3-column template builder (reference: `docs/templates-page.jsx`):
  - **Column 1 — Template list:** Searchable list, name + default badge, click to select, create/duplicate/archive actions
  - **Column 2 — Builder:** Phase-grouped vertical flow
    - Items grouped by `facility_phase_id`, phases ordered by `display_order`
    - Position-based boundaries: first milestone in a phase starts it, last milestone ends it
    - Shared boundary rendering: when last milestone of phase A equals first milestone of phase B → render once as `SharedBoundary` component (gradient diamond + dual "ENDS A / STARTS B" badges)
    - Sub-phases: items with a `facility_phase_id` whose phase has `parent_phase_id` render nested within parent phase block (1 level deep)
    - Drop zones per phase for dragging in milestones from library
    - Drag-to-reorder milestones within phases (@dnd-kit `SortableContext`)
    - Remove milestone (X button on hover) / remove phase
  - **Column 3 — Library panel:** Tabbed (Milestones | Phases), shows items not yet in template, drag from library into builder
- Template CRUD: create (name + description), duplicate (deep copy all items), set default (enforces single-default), archive
- `buildRenderList()` logic: transforms template items + phases into flat render list handling shared boundaries, edge milestones, interior milestones, sub-phase indicators, drop zones
- Optimistic updates: drag/drop/remove operations update local state immediately, persist to DB

### Files touched
- `app/settings/milestones/page.tsx` (add Tab 3 content)
- `components/settings/milestones/TemplateBuilder.tsx` (new — main 3-column layout + buildRenderList)
- `components/settings/milestones/SharedBoundary.tsx` (new — gradient boundary connector)
- `components/settings/milestones/FlowNode.tsx` (new — edge + interior milestone rows)
- `components/settings/milestones/SubPhaseIndicator.tsx` (new — nested sub-phase card)
- `components/settings/milestones/TemplateList.tsx` (new — left column template list)
- `components/settings/milestones/LibraryPanel.tsx` (new — right column drag source)

### Test gate
1. **Unit:** `buildRenderList` produces correct output for: shared boundaries, edge milestones, sub-phases, empty phases; template CRUD (create, duplicate, set default, archive); duplicate creates independent copy
2. **Integration:** Create template → add phases via drag → add milestones via drag → verify `milestone_template_items` rows match builder state; shared boundary detected when milestone appears as last of phase A and first of phase B; remove milestone → verify DB row deleted
3. **Workflow:** Build a full template from scratch → add phases → drag milestones → create shared boundary → add sub-phase → duplicate template → verify copy is independent → set as default → verify old default cleared

---

## Phase 4: Tab 4 (Procedures) + Tab 5 (Surgeons)
**Complexity:** Medium
**Commit:** `feat(milestones): phase 4 - procedure assignment and surgeon overrides`

### What it does
- **Tab 4 — Procedures:**
  - Searchable procedure list (flat table)
  - Each row shows: procedure name, currently assigned template name, template badge
  - Template picker dropdown per procedure (shows all facility templates)
  - Changing assignment updates `procedure_types.milestone_template_id`
  - Procedures with no explicit assignment show "Using facility default"
- **Tab 5 — Surgeons:**
  - Left panel: searchable surgeon list with override count badges
  - Right panel: procedure list for selected surgeon
  - Each procedure row shows: procedure name, effective template (procedure default or surgeon override)
  - Template dropdown per procedure: select a different template or "Use procedure default"
  - Selecting a template creates `surgeon_template_overrides` row
  - Selecting "Use procedure default" deletes the override row
  - Clear visual distinction between inherited (gray) and overridden (highlighted) assignments

### Files touched
- `app/settings/milestones/page.tsx` (add Tab 4 + Tab 5 content)
- `components/settings/milestones/ProcedureTemplateAssignment.tsx` (new — Tab 4 procedure list with template picker)
- `components/settings/milestones/SurgeonOverridePanel.tsx` (new — Tab 5 surgeon procedure list with template picker)

### Test gate
1. **Unit:** Procedure list renders with correct template names; template picker shows all templates; surgeon panel shows correct default vs override state; override count badges
2. **Integration:** Assign template to procedure → verify `procedure_types.milestone_template_id` updated; create surgeon override → verify `surgeon_template_overrides` row; remove override → verify row deleted; verify cascade: surgeon override takes precedence over procedure assignment
3. **Workflow:** Assign template to procedure → navigate to Surgeons tab → override for a surgeon → create case via RPC → verify case_milestones match surgeon's override template → remove override → create another case → verify uses procedure's template

---

## Phase 5: Admin 4-Tab Page
**Complexity:** Large
**Commit:** `feat(milestones): phase 5 - admin milestones page with 4 tabs`

### What it does
- Rewrite `/admin/settings/milestones` as a 4-tab page:
  - **Admin Tab 1 — Milestones:** Global `milestone_types` CRUD. Propagate to all facilities on add. (Adapted from existing page → move to tab layout.)
  - **Admin Tab 2 — Phases:** Global `phase_templates` CRUD (name, display_name, color_key, parent_phase_template_id). Seeds `facility_phases` for new facilities.
  - **Admin Tab 3 — Templates:** Global `milestone_template_types` CRUD. Same builder UI as facility Tab 3 but references `milestone_types` and `phase_templates` (instead of facility-scoped entities). Includes `milestone_template_type_items` management.
  - **Admin Tab 4 — Procedure Types:** Global `procedure_type_templates` with `milestone_template_type_id` assignment. Each procedure template gets a template type assignment. Seeds `procedure_types.milestone_template_id` for new facilities.
- Merge `/admin/settings/procedure-milestones` into Tab 4 (old page becomes dead)
- Update `seed_facility_with_templates()` to use new admin tables for full provisioning

### Files touched
- `app/admin/settings/milestones/page.tsx` (rewrite — 4-tab layout)
- `app/admin/settings/procedure-milestones/page.tsx` (mark as dead — redirect to admin milestones Tab 4)
- Reuse builder components from Phase 3 with admin data source props

### Test gate
1. **Unit:** Admin tabs render correctly; milestone type propagation fires; phase template CRUD; admin template builder works with global entities
2. **Integration:** Create admin template → assign to procedure type template → create new facility via `seed_facility_with_templates()` → verify facility has correct `facility_phases`, `milestone_templates`, `milestone_template_items`, and `procedure_types.milestone_template_id`
3. **Workflow:** Full admin provisioning: define milestones → define phases → build template → assign to procedures → seed new facility → verify facility config matches admin templates → verify case creation works at new facility

---

## Phase 6: Demo Generator Update
**Complexity:** Medium
**Commit:** `feat(milestones): phase 6 - demo generator template support`

### What it does
- Update the demo data generator to use the template model:
  - Create `facility_phases` during facility setup
  - Create `milestone_templates` (at least default + 1-2 specialty variants)
  - Populate `milestone_template_items` with phase assignments
  - Assign templates to generated procedure types via `procedure_types.milestone_template_id`
  - Use template resolution (instead of old `procedure_milestone_config`) for case milestone generation
  - Create `surgeon_template_overrides` for a subset of demo surgeons (realistic variation)
- Verify SSE streaming endpoint still works with template-based milestone creation
- Update purge function to clean up new template tables

### Files touched
- Demo generator engine files (scan at phase start: `app/api/demo-generate/`, `lib/demo-generator/` or equivalent)
- Generator facility setup logic
- Generator case creation logic
- Generator purge logic

### Test gate
1. **Unit:** Generator creates templates with correct milestone/phase structure; purge cleans up template tables
2. **Integration:** Run full generation → verify created cases have milestones resolved from templates → verify surgeon overrides applied correctly → verify purge removes all generated data
3. **Workflow:** Generate demo data → navigate to facility settings → verify templates visible in Tab 3 → verify procedure assignments in Tab 4 → verify surgeon overrides in Tab 5

---

## Phase 7: Analytics RPC Updates + Old Table Drop + Dead Code Cleanup
**Complexity:** Large
**Commit:** `feat(milestones): phase 7 - analytics RPCs, drop legacy tables, clean up`

### What it does
- **Analytics RPC updates:**
  - Rewrite `get_milestone_interval_medians()` to resolve expected milestones from template cascade (instead of `procedure_milestone_config.is_enabled`)
  - Verify `get_phase_medians()` still works (uses `phase_definitions` which is untouched)
  - Verify all analytics consumers (TimeAllocationBar, CaseDrawerMilestones, useMilestoneComparison) work correctly
- **End-to-end verification:**
  - Template → case creation pipeline: all resolution paths
  - Edge cases: empty template, procedure with no template (falls back to default), surgeon with no overrides, new facility seeding
- **DB migration to drop old tables:**
  - Drop `procedure_milestone_config`
  - Drop `surgeon_milestone_config`
  - Drop `procedure_milestone_templates` (replaced by `milestone_template_type_items`)
  - Drop related triggers/functions
- **Delete dead code:**
  - `app/settings/procedure-milestones/page.tsx` (replaced by Tab 4)
  - `app/settings/surgeon-milestones/page.tsx` (replaced by Tab 5)
  - `app/admin/settings/procedure-milestones/page.tsx` (merged into admin Tab 4)
  - `components/settings/milestones/FlatMilestoneList.tsx`
  - `components/settings/milestones/InheritanceBreadcrumb.tsx`
  - `components/settings/surgeon-milestones/AddProcedureDropdown.tsx`
  - `components/settings/procedure-milestones/ProcedureMilestoneList.tsx`
  - `components/settings/procedure-milestones/PhaseSection.tsx`
  - `components/settings/procedure-milestones/ProcedureMilestoneRow.tsx`
  - `lib/utils/buildFlatRows.ts`
  - `lib/utils/bracketUtils.ts`
- Remove dead imports across codebase
- Update `lib/settings-nav-config.ts`: remove old routes (procedure-milestones, surgeon-milestones), update milestones route
- Remove old sidebar nav links to deleted pages
- Delete test files for deleted components
- Final: `npm run typecheck && npm run lint && npm run test`

### Files touched
- `supabase/migrations/YYYYMMDD_drop_legacy_milestone_tables.sql` (new)
- `supabase/migrations/YYYYMMDD_update_analytics_rpcs.sql` (new — rewrite `get_milestone_interval_medians`)
- All dead code files listed above (delete)
- `lib/settings-nav-config.ts` (update routes)
- Various files with dead imports (clean up)
- Test files for deleted components (delete)

### Test gate
1. **Unit:** All remaining tests pass; no TypeScript errors; no lint errors
2. **Integration:** Analytics RPCs return correct data using template resolution; template CRUD + procedure assignment + surgeon override + case creation all work end-to-end with old tables gone
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green; verify analytics pages load correctly with template-based milestone resolution

---

## Phase 8: Template Builder + Preview Polish
**Complexity:** Medium
**Commit:** `feat(milestones): phase 8 - builder polish (filled dots, interactive boundaries, legend)`

### What it does
Visual and interactivity polish for the template builder and timeline preview. Three focus areas:

#### 8.1 — Replace checkmarks with filled dots
- **FlowNode.tsx**: Replace the `M20 6L9 17l-5-5` checkmark SVG path in EdgeMilestone, InteriorMilestone, and UnassignedMilestone with a simple filled circle in the phase color (or slate for unassigned). No SVG path needed — just a `border-radius: 50%` filled div.
- **TemplateTimelinePreview.tsx**: Same change — replace checkmark circles with filled dots for consistency across all milestone types (edge, interior, unassigned, sub-phase milestones).
- **SubPhaseIndicator.tsx**: Replace checkmark icons in sub-phase milestone rows with filled dots.

#### 8.2 — Interactive shared boundaries
- **SharedBoundary.tsx**: Add hover state with remove (X) button, matching FlowNode pattern. Add drag handle (GripVertical) on hover.
- **SharedBoundary removal confirmation**: Radix `AlertDialog` — "Removing this milestone will break the shared boundary between {Phase A} and {Phase B}. Continue?" with Cancel/Remove actions.
- **SharedBoundary DnD**: Make SharedBoundary a sortable item that belongs to both the ending and starting phase `SortableContext`s. When dragged within either phase, it reorders normally. Phase edges recompute automatically from new positions via `buildRenderList`.
- **TemplateBuilder.tsx**: Update `groupByPhase` to include shared boundary items in both adjacent phase `SortableContext`s. Update `handleDragEnd` to handle shared boundary reordering (determine which phase the item landed in, call `reorderItemsInPhase`). Add `AlertDialog` for shared boundary removal confirmation.

#### 8.3 — Legend update
- **TemplateBuilder.tsx**: Update builder legend items:
  - Filled dot icon → "Milestone"
  - Gradient diamond icon → "Shared boundary (removable)"
  - Drag handle icon → "Drag to reorder"

### Files touched
- `components/settings/milestones/FlowNode.tsx` (modify — replace checkmark with filled dot)
- `components/settings/milestones/TemplateTimelinePreview.tsx` (modify — replace checkmark with filled dot)
- `components/settings/milestones/SubPhaseIndicator.tsx` (modify — replace checkmark with filled dot)
- `components/settings/milestones/SharedBoundary.tsx` (modify — add hover X, drag handle, DnD sortable)
- `components/settings/milestones/TemplateBuilder.tsx` (modify — update groupByPhase for shared boundary DnD, add AlertDialog, update legend)

### Test gate
1. **Unit:** FlowNode renders filled dots (no checkmark SVG path); SharedBoundary renders X button on hover; SharedBoundary AlertDialog appears on X click; buildRenderList output unchanged; legend shows updated items
2. **Integration:** Remove shared boundary via X → AlertDialog confirms → milestone removed from template → both adjacent phases lose their shared edge → DB row deleted; drag shared boundary within phase → reorder works → phase edges recompute correctly
3. **Workflow:** Build template with shared boundary → hover shows X + drag handle → remove via confirmation → boundary breaks cleanly → add milestone back to create new boundary → drag to reorder → verify positions persist after page reload

---

## Phase 9: Procedure + Surgeon Tab Redesign
**Complexity:** Medium
**Commit:** `feat(milestones): phase 9 - procedure and surgeon tab 2/3-column redesign`

### What it does
Redesign Tab 4 (Procedures), Tab 5 (Surgeons), and Admin Tab 4 (Procedure Types) from flat tables to multi-column layouts with template timeline previews.

#### 9.1 — Procedure tab (Tab 4) → 2-column layout
- **Left column (~300px):** Searchable procedure list. Each item shows procedure name + small template name badge. Click to select (blue highlight). No category column.
- **Right column (flex-1):** Selected procedure's template dropdown at top, then `TemplateTimelinePreview` below showing the full visual timeline. Inherited templates show "Using facility default" label.
- **Empty state:** Right column shows "Select a procedure to view its template" with icon when nothing selected.
- **Height:** `calc(100vh - 220px)` with internal scrolling per column, matching Templates tab.

#### 9.2 — Surgeon tab (Tab 5) → 3-column layout
- **Column 1 (~240px):** Searchable surgeon list with override count badges. Click to select.
- **Column 2 (~260px):** Procedure list for selected surgeon. Each item shows procedure name + small "Override" amber badge if surgeon has an override. Click to select.
- **Column 3 (flex-1):** Surgeon+procedure header, template dropdown (change override), status badge (Override amber / Inherited slate), then `TemplateTimelinePreview` below.
- **Empty states:** Column 2: "Select a surgeon" prompt. Column 3: "Select a procedure" prompt.
- **Height:** Fill viewport with internal scrolling per column.

#### 9.3 — Admin Procedure Types tab → 2-column layout
- **Same pattern as facility Tab 4** but queries global tables (`procedure_type_templates`, `milestone_template_types`). "Use global default" instead of "Use facility default."

### Files touched
- `components/settings/milestones/ProcedureTemplateAssignment.tsx` (rewrite — 2-column layout)
- `components/settings/milestones/SurgeonOverridePanel.tsx` (rewrite — 3-column layout)
- `components/settings/milestones/AdminProcedureTypeAssignment.tsx` (rewrite — 2-column layout)

### Test gate
1. **Unit:** Procedure tab renders 2-column layout; surgeon tab renders 3-column layout; empty states appear when no selection; template badges show on list items; override badges appear correctly
2. **Integration:** Select procedure → right column shows correct template + timeline; change template via dropdown → DB updates → timeline refreshes; select surgeon → procedures load → select procedure → override/inherited status correct; create override → badge appears in procedure list; remove override → badge disappears
3. **Workflow:** Full assignment flow: select procedure → view timeline → change template → navigate to Surgeons → select surgeon → select same procedure → create override → verify different timeline shown → remove override → verify reverts to procedure's template

---

## Dependency Graph
```
Phase 1 (DB) ──► Phase 2 (Tab Shell + Tabs 1-2) ──► Phase 3 (Tab 3: Builder)
                                                 ──► Phase 4 (Tabs 4-5)
              Phase 3,4 ──────────────────────────► Phase 5 (Admin)
              Phase 5 ────────────────────────────► Phase 6 (Demo Generator)
              Phase 6 ────────────────────────────► Phase 7 (Analytics + Cleanup)
              Phase 7 ────────────────────────────► Phase 8 (Builder + Preview Polish)
              Phase 8 ────────────────────────────► Phase 9 (Tab 4/5 Redesign)
```

---

## Interview Notes (Post-Phase 7 Polish)

| Decision | Answer |
|----------|--------|
| Uncommitted TemplateTimelinePreview work | Commit standalone before starting Phase 8 |
| Phase DnD scope | Boundary milestones only — phase headers stay fixed |
| Multi-phase boundaries | A milestone is only ever shared between 2 adjacent phases |
| Shared boundary removal UX | Radix AlertDialog with confirmation message |
| Multi-phase boundary visual | N/A — always exactly 2 phases, existing SharedBoundary visual is sufficient |
| Procedure tab empty state | "Select a procedure to view its template" prompt only — no default template preview |
| Filled dots everywhere | FlowNode + TemplateTimelinePreview + SubPhaseIndicator — all get filled dots |
| SharedBoundary DnD | Belongs to both adjacent phase SortableContexts, phase edges recompute on drag |
