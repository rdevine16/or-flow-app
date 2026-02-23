# Implementation Plan: Milestone Template System

## Summary
Replace the toggle-based milestone configuration system with a template-based model. Introduces `milestone_templates` as first-class entities, a new `facility_phases` library, and a unified 5-tab settings page. Surgeon overrides simplify from per-milestone toggles to "pick a different template." Includes facility-level UI (5 tabs), admin-level UI (4 tabs), data migration, RPC updates, demo generator updates, and old table removal.

## Interview Notes

| Decision | Answer |
|----------|--------|
| Shared boundary storage | Single row per milestone, boundaries computed from adjacency at render time |
| Enabled/disabled toggle on template milestones | Removed — milestone in template = active, remove to exclude |
| Surgeon override model | Pick a different template (no per-milestone editing) |
| Analytics phases (phase_definitions) | Keep as separate system, untouched |
| Phase storage for config UI | New `facility_phases` table (name + color only) |
| Template phase boundary model | Start/end milestone refs on template phases |
| phase_group column on facility_milestones | Keep as-is |
| Old tables (procedure_milestone_config, surgeon_milestone_config) | Drop at end of feature |
| finalize_draft_case() surgeon override bug | Fix in this feature |
| Procedure with no template | Fall back to facility's default template |
| Admin seeding for new facilities | Full provisioning (phases, templates, procedure assignments) |
| Sub-phase model | Own start/end milestone boundaries within parent phase |
| Facility route | `/settings/milestones` with 5 tabs |
| Admin layout | Same tabbed layout — 4 tabs |
| Demo generator | In scope — update to use template model |
| Old components (FlatMilestoneList, InheritanceBreadcrumb, buildFlatRows, bracketUtils) | Delete after all tabs are rebuilt |

---

## Phase 1: Database Schema + Data Migration + RPC Updates
**Complexity:** Large
**Commit:** `feat(milestones): phase 1 - template tables, data migration, RPC updates`

### What it does
- Create facility-level tables: `facility_phases`, `milestone_templates`, `milestone_template_items`, `milestone_template_phases`, `surgeon_template_overrides`
- Create global admin tables: `phase_templates`, `milestone_template_types`, `milestone_template_type_items`, `milestone_template_type_phases`
- Add `milestone_template_id` FK to `procedure_types` and `procedure_type_templates`
- RLS policies for all new tables (same pattern as existing milestone tables)
- Enforce single-default constraint: only one `is_default = true` template per facility
- **Data migration:**
  1. Create `facility_phases` from existing `phase_definitions` (extract name, display_name, color_key)
  2. For each facility, create a "Facility Default" template with ALL active facility_milestones
  3. Populate `milestone_template_items` ordered by display_order
  4. Create `milestone_template_phases` from phase_definitions boundaries (mapped to facility_phases)
  5. For each procedure type with custom configs: compare enabled set against default template → assign default or create procedure-specific template
  6. Set `procedure_types.milestone_template_id`
  7. Convert `surgeon_milestone_config` → match effective set to existing templates or create surgeon-specific templates → create `surgeon_template_overrides` rows
  8. Create global admin records (phase_templates from phase_definition_templates, milestone_template_types from existing patterns)
- **RPC updates:**
  - Rewrite `create_case_with_milestones()`: surgeon_template_override → procedure template → default template → resolve items → case_milestones
  - Rewrite `finalize_draft_case()`: same resolution (fixes surgeon override bug)
  - Extend `seed_facility_with_templates()`: seed facility_phases, milestone_templates, template items/phases, assign templates to procedure types

### Files touched
- `supabase/migrations/YYYYMMDD_milestone_templates.sql` (new)

### Test gate
1. **Unit:** Verify new tables exist with correct columns, constraints, RLS via Supabase REST API
2. **Integration:** Verify data migration created correct templates from existing configs; verify `create_case_with_milestones()` resolves from template cascade; verify `finalize_draft_case()` also resolves correctly (surgeon override bug fixed)
3. **Workflow:** Create case → verify case_milestones match template → verify analytics RPCs still compute correctly (phase_definitions untouched)

---

## Phase 2: Tab Shell + Tab 1 (Milestones) + Tab 2 (Phases)
**Complexity:** Medium
**Commit:** `feat(milestones): phase 2 - tab shell, milestones tab, phases tab`

### What it does
- Rewrite `/settings/milestones` page as a 5-tab layout
- Tab routing via state (all 5 tabs on one page, Tabs 3-5 show placeholder until built)
- **Tab 1 — Milestones:**
  - Facility milestone library with phase-grouped display
  - Add/edit/archive milestones (reuse `MilestoneFormModal`)
  - Milestone pairing management (link/unlink start-end pairs)
  - Validation data editing (min/max minutes, validation_type)
  - Archived milestones section (reuse `ArchivedMilestonesSection`)
- **Tab 2 — Phases:**
  - Phase library CRUD: create/edit/archive phases (name, display_name, color)
  - Simple list with color swatches
  - No hierarchy — nesting happens in Tab 3

### Files touched
- `app/settings/milestones/page.tsx` (rewrite — tab shell + Tab 1 + Tab 2)
- `components/settings/milestones/PhaseLibrary.tsx` (new — Tab 2 content)
- `components/settings/milestones/MilestoneFormModal.tsx` (modify — add phase dropdown from facility_phases)
- `components/settings/milestones/ArchivedMilestonesSection.tsx` (reuse)

### Test gate
1. **Unit:** Tab switching renders correct content; milestone CRUD operations; phase CRUD operations; pair link/unlink
2. **Integration:** Create milestone → verify in DB; create phase → verify in DB; edit milestone validation data → verify persisted
3. **Workflow:** Navigate all 5 tabs → verify Tab 1 and Tab 2 are functional, Tabs 3-5 show placeholders

---

## Phase 3: Tab 3 — Template Builder
**Complexity:** Large
**Commit:** `feat(milestones): phase 3 - template builder with drag-and-drop`

### What it does
- Build the 3-column template builder (see `docs/templates-page.jsx` mockup):
  - **Column 1 — Template list:** Searchable, name + default badge, click to select
  - **Column 2 — Builder:** Phase-grouped vertical flow
    - Position-based boundaries: first milestone = starts phase, last = ends phase
    - Shared boundary rendering: gradient diamond + dual "ENDS A / STARTS B" badges when last milestone of phase A equals first of phase B
    - Sub-phases: drag phase onto existing phase to nest (one level deep), sub-phases have own start/end milestone refs
    - Drop zones per phase for dragging in milestones
    - Drag-to-reorder milestones within phases
    - Remove milestone/phase (X on hover)
  - **Column 3 — Library panel:** Tabbed (Milestones | Phases), shows unassigned items, drag into builder
- Template CRUD: create (name + description), duplicate, set default, archive
- `buildRenderList()` logic: transforms template phases into flat render list handling shared boundaries, edge milestones, interior milestones, sub-phase indicators
- Auto-save on drag/drop/remove operations (optimistic updates)

### Files touched
- `app/settings/milestones/page.tsx` (add Tab 3 content)
- `components/settings/milestones/TemplateBuilder.tsx` (new — main 3-column layout)
- `components/settings/milestones/SharedBoundary.tsx` (new — gradient boundary connector)
- `components/settings/milestones/FlowNode.tsx` (new — edge + interior milestone rows)
- `components/settings/milestones/SubPhaseIndicator.tsx` (new — nested sub-phase card)
- `components/settings/milestones/TemplateList.tsx` (new — left column template list)
- `components/settings/milestones/LibraryPanel.tsx` (new — right column drag source)

### Test gate
1. **Unit:** buildRenderList produces correct output for shared boundaries, edge milestones, sub-phases; template CRUD operations (create, duplicate, set default, archive)
2. **Integration:** Create template → add phases via drag → add milestones via drag → verify `milestone_template_items` and `milestone_template_phases` rows match; shared boundary computed correctly when milestone appears as last of phase A and first of phase B
3. **Workflow:** Build a full template from scratch (add phases, drag milestones, create sub-phase) → verify builder displays correctly → duplicate template → verify copy is independent

---

## Phase 4: Tab 4 (Procedures) + Tab 5 (Surgeons)
**Complexity:** Medium
**Commit:** `feat(milestones): phase 4 - procedure assignment and surgeon overrides`

### What it does
- **Tab 4 — Procedures:**
  - Flat searchable procedure list showing assigned template name
  - Click procedure → template picker (dropdown or card grid showing all templates)
  - Changing assignment updates `procedure_types.milestone_template_id`
  - Optional: read-only flow preview of the selected template below the picker
- **Tab 5 — Surgeons:**
  - Left panel: surgeon list with override count badges
  - Right panel: procedure list for selected surgeon
  - Each procedure row shows current template (from procedure default or surgeon override)
  - Dropdown to pick a different template or "Use procedure default"
  - Creates/removes `surgeon_template_overrides` rows

### Files touched
- `app/settings/milestones/page.tsx` (add Tab 4 + Tab 5 content)
- `components/settings/milestones/TemplateSelector.tsx` (new — template picker for procedures)
- `components/settings/milestones/SurgeonOverridePanel.tsx` (new — surgeon procedure list with template picker)

### Test gate
1. **Unit:** TemplateSelector renders all templates; clicking card fires onChange; surgeon override panel shows correct default vs override state
2. **Integration:** Assign template to procedure → verify `procedure_types.milestone_template_id` updated; create surgeon override → verify `surgeon_template_overrides` row; remove override → verify row deleted
3. **Workflow:** Assign template to procedure → navigate to Surgeons tab → override for a surgeon → create case via RPC → verify case_milestones match surgeon's override template

---

## Phase 5: Admin 4-Tab Page
**Complexity:** Large
**Commit:** `feat(milestones): phase 5 - admin milestones page with 4 tabs`

### What it does
- Rewrite `/admin/settings/milestones` as a 4-tab page:
  - **Admin Tab 1 — Milestones:** Global milestone_types CRUD. Propagate to all facilities on add. (Adapted from existing page.)
  - **Admin Tab 2 — Phases:** Global phase_templates CRUD (name, display_name, color_key). Seeds `facility_phases` for new facilities.
  - **Admin Tab 3 — Templates:** Global milestone_template_types CRUD. Builder UI referencing milestone_types and phase_templates (instead of facility-scoped entities).
  - **Admin Tab 4 — Procedure Types:** Global procedure_type_templates with milestone_template_type_id assignment. Seeds `procedure_types.milestone_template_id` for new facilities.
- Merge `/admin/settings/procedure-milestones` into Tab 4 (old page becomes dead)
- Update `seed_facility_with_templates()` to seed from new admin tables

### Files touched
- `app/admin/settings/milestones/page.tsx` (rewrite — 4-tab layout)
- `app/admin/settings/procedure-milestones/page.tsx` (delete — merged into admin milestones)
- Components from Phase 3 reused with admin data sources (TemplateBuilder, SharedBoundary, etc.)

### Test gate
1. **Unit:** Admin tabs render correctly; milestone type propagation works; phase template CRUD
2. **Integration:** Create admin template → assign to procedure type template → create new facility via `seed_facility_with_templates()` → verify facility has correct phases, templates, and procedure assignments
3. **Workflow:** Full admin provisioning: define milestones → define phases → build template → assign to procedures → seed new facility → verify facility config matches admin templates

---

## Phase 6: Demo Generator Update
**Complexity:** Medium
**Commit:** `feat(milestones): phase 6 - demo generator template support`

### What it does
- Update the demo data generator to use the template model:
  - Create milestone templates during facility setup
  - Assign templates to generated procedure types
  - Use template resolution (instead of old procedure_milestone_config) for case milestone generation
  - Optionally create surgeon-specific template overrides for demo surgeons
- Verify SSE streaming endpoint still works with template-based milestone creation

### Files touched
- Demo generator engine files (exact files TBD — scan generator at phase start)
- Possibly `app/api/demo-generate/` route handlers

### Test gate
1. **Unit:** Generator creates templates with correct milestone/phase structure
2. **Integration:** Run full generation → verify created cases have milestones from templates → verify surgeon overrides applied correctly
3. **Workflow:** Generate demo data → navigate to facility settings → verify templates visible in Tab 3 → verify procedure assignments in Tab 4

---

## Phase 7: Integration + Old Table Drop + Dead Code Cleanup
**Complexity:** Medium
**Commit:** `feat(milestones): phase 7 - drop legacy tables, clean up dead code`

### What it does
- End-to-end verification of template → case creation pipeline
- Edge case verification: empty template, procedure with no template (falls back to default), surgeon with no overrides, new facility seeding
- Verify analytics queries still work: `get_milestone_interval_medians()`, `get_phase_medians()`, TimeAllocationBar, CaseDrawerMilestones
- **DB migration to drop old tables:**
  - Drop `procedure_milestone_config`
  - Drop `surgeon_milestone_config`
  - Drop `procedure_milestone_templates` (global admin equivalent, replaced by milestone_template_type_items)
  - Remove any triggers/functions referencing dropped tables
- **Delete dead code:**
  - `app/settings/procedure-milestones/page.tsx`
  - `app/settings/surgeon-milestones/page.tsx`
  - `components/settings/milestones/FlatMilestoneList.tsx`
  - `components/settings/milestones/InheritanceBreadcrumb.tsx`
  - `components/settings/surgeon-milestones/AddProcedureDropdown.tsx`
  - `lib/utils/buildFlatRows.ts`
  - `lib/utils/bracketUtils.ts`
- Remove dead imports across codebase
- Remove old sidebar nav links to deleted pages
- Update any redirects or references
- Final: `npm run typecheck && npm run lint && npm run test`

### Files touched
- `supabase/migrations/YYYYMMDD_drop_legacy_milestone_tables.sql` (new)
- All files listed above (delete)
- Various files with dead imports (clean up)
- Navigation/sidebar config (remove old routes)
- Test files for deleted components (delete)

### Test gate
1. **Unit:** All remaining tests pass; no TypeScript errors; no lint errors
2. **Integration:** Template CRUD + procedure assignment + surgeon override + case creation all work end-to-end with old tables gone
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green

---

## Dependency Graph
```
Phase 1 (DB) ──► Phase 2 (Tab Shell + Tabs 1-2) ──► Phase 3 (Tab 3: Builder)
                                                 ──► Phase 4 (Tabs 4-5)
              Phase 3,4 ──────────────────────────► Phase 5 (Admin)
              Phase 5 ────────────────────────────► Phase 6 (Demo Generator)
              Phase 6 ────────────────────────────► Phase 7 (Cleanup)
```

Phases 3 and 4 can theoretically run in parallel after Phase 2, but per workflow rules, one phase per session.
