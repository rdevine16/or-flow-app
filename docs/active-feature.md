# Feature: Milestone Template System

## Goal
Replace the current toggle-based milestone configuration (4 disconnected pages, flat enable/disable per procedure/surgeon) with a **template-based system**. Milestone Templates are named, reusable compositions of milestones organized into phases. Templates become the single transferable unit: define once, assign to procedures, optionally override per surgeon.

**New configuration flow (single page, 5 tabs):**
1. **Milestones** — Define the atoms (facility milestone library)
2. **Phases** — Define phase identities (name + color, no hierarchy)
3. **Templates** — Compose milestones into phase-organized, ordered arrangements
4. **Procedures** — Assign a template to each procedure type
5. **Surgeons** — Optionally assign a different template per surgeon+procedure

## Architecture Overview

### Current System (toggle-based, 3-level inheritance)
```
facility_milestones (base pool)
  └─ procedure_milestone_config (per procedure: enable/disable each milestone)
       └─ surgeon_milestone_config (per surgeon+procedure: override enable/disable)
```
4 separate pages. No reusability — if 8 procedures use the same milestones, you have 8 independent configs that can drift.

### New System (template-based)
```
facility_milestones (atom library — unchanged)
facility_phases (name + color + optional parent_phase_id — new)
  └─ milestone_templates (named bundles)
       └─ milestone_template_items (ordered milestones, each with facility_phase_id)
            └─ procedure_types.milestone_template_id (procedure → template)
                 └─ surgeon_template_overrides (surgeon picks different template)
```
1 page, 5 tabs. Templates are reusable. Surgeon overrides are just "pick a different template." Phase boundaries are position-based (first/last milestone in a phase group), not explicit start/end refs.

## Requirements

### Database

#### New Tables (Facility Level)
1. **`facility_phases`** — Phase library: name, display_name, color_key, display_order, parent_phase_id (1 level deep for sub-phases), is_active, soft delete.
2. **`milestone_templates`** — Named template per facility: name, description, is_default flag (one default per facility), is_active, soft delete.
3. **`milestone_template_items`** — Ordered milestones in a template with phase assignment: template_id, facility_milestone_id, facility_phase_id (which phase this item belongs to), display_order. Phase boundaries computed from adjacency at render time (first item = starts phase, last item = ends phase). Shared boundaries auto-detected when last item of phase A equals first item of phase B.
4. **`surgeon_template_overrides`** — Surgeon picks a different template per procedure: facility_id, surgeon_id, procedure_type_id, milestone_template_id.

#### New Tables (Global Admin Level)
5. **`phase_templates`** — Global phase library for seeding new facilities. Includes parent_phase_template_id for sub-phases.
6. **`milestone_template_types`** — Global milestone template definitions.
7. **`milestone_template_type_items`** — Global template milestone items with phase_template_id assignment.

#### Modified Tables
10. **`procedure_types`** — Add `milestone_template_id UUID REFERENCES milestone_templates(id)`.
11. **`procedure_type_templates`** — Add `milestone_template_type_id UUID REFERENCES milestone_template_types(id)` (for admin seeding).

#### Tables Kept As-Is
- **`facility_milestones`** — Unchanged. Still the atom library. `phase_group` column stays.
- **`phase_definitions`** — Unchanged. Stays as the analytics-only phase system. RPCs (`get_phase_medians`, `get_milestone_interval_medians`) continue reading from it.
- **`case_milestones`** — Unchanged. Still pre-created with `recorded_at = NULL`.

#### Tables Dropped (at end of feature)
- **`procedure_milestone_config`** — Replaced by template assignment on procedure_types.
- **`surgeon_milestone_config`** — Replaced by surgeon_template_overrides.

#### Data Migration
1. Create `facility_phases` rows from existing `phase_definitions` (extract name, display_name, color_key, parent mapping).
2. For each facility, create a "Facility Default" template containing ALL active facility_milestones.
3. Populate `milestone_template_items` with display_order from facility_milestones, `facility_phase_id` mapped from phase_definitions boundaries.
4. For each procedure type with custom `procedure_milestone_config`: if enabled set differs from default template, create a procedure-specific template; otherwise assign default.
6. Set `procedure_types.milestone_template_id` for all procedure types.
7. Convert `surgeon_milestone_config` to `surgeon_template_overrides`: determine effective milestone set per surgeon+procedure, match to existing template or create new one.
8. Create global admin equivalents (phase_templates, milestone_template_types, etc.) from existing template tables.

#### RPC Updates
- **`create_case_with_milestones()`** — Rewrite milestone resolution: surgeon_template_override → procedure_types.milestone_template_id → facility default template. Resolve template → items → case_milestones.
- **`finalize_draft_case()`** — Same template resolution (fixes existing bug where surgeon overrides were ignored).
- **`seed_facility_with_templates()`** — Extend to seed facility_phases, milestone_templates, template items (with phase assignments), and assign templates to procedure types.
- **`get_milestone_interval_medians()`** — Rewrite to resolve expected milestones from template cascade instead of `procedure_milestone_config.is_enabled`.

### UI — Facility Level (`/settings/milestones`)

#### Tab Shell
- 5-tab horizontal navigation: Milestones | Phases | Templates | Procedures | Surgeons
- All tabs on one page at `/settings/milestones`

#### Tab 1: Milestones
- Simple searchable table of facility milestones (no phase grouping — phases assigned in template builder)
- Create/edit milestones with validation data (min/max minutes, validation_type)
- Milestone pairing (link start/end pairs like Anesthesia Start ↔ Anesthesia End)
- Archive/restore
- Reuse existing `MilestoneFormModal` component (remove phase_group dropdown)

#### Tab 2: Phases
- Phase library CRUD: name, display_name, color
- Simple list — no hierarchy here (nesting happens in template builder)
- Sub-phase indicator (shows parent if applicable)
- Archive/restore

#### Tab 3: Templates (main builder — see mockup `docs/templates-page.jsx`)
- **3-column layout**: Template list (left) | Builder (center) | Library (right)
- **Template list**: Searchable, shows name + default badge. Click to select.
- **Builder**: Phase-grouped vertical flow showing milestones in order.
  - Items grouped by `facility_phase_id`, phases ordered by display_order.
  - Position-based boundaries: first milestone in a phase starts it, last ends it.
  - Shared boundaries: if the last milestone of phase A equals the first of phase B, render once with gradient diamond + dual "ENDS A / STARTS B" badges.
  - Sub-phases: items assigned to a phase with `parent_phase_id` render nested within parent phase block (one level deep).
  - Drop zones per phase for dragging in milestones.
  - Drag-to-reorder milestones within phases (@dnd-kit).
  - Remove milestone (X button on hover).
- **Library panel**: Tabbed (Milestones | Phases). Shows unassigned items. Drag from library into builder.
- **Template CRUD**: Create (name + description), duplicate, set default, archive.
- No enabled/disabled toggle — if a milestone is in the template, it's active.

#### Tab 4: Procedures
- Simple searchable procedure list (flat table)
- Each row shows procedure name + assigned template name
- Template picker dropdown per procedure
- Changing assignment updates `procedure_types.milestone_template_id`
- Procedures with no assignment show "Using facility default"

#### Tab 5: Surgeons
- Left panel: searchable surgeon list with override count badges
- Right panel: procedure list for selected surgeon
- Each procedure shows effective template (procedure default or surgeon override)
- Template dropdown per procedure: pick different template or "Use procedure default"
- Creates/removes `surgeon_template_overrides` rows
- Clear visual distinction between inherited (gray) and overridden (highlighted)

### UI — Global Admin Level (`/admin/settings/milestones`)

#### 4-tab layout: Milestones | Phases | Templates | Procedure Types

- **Admin Tab 1: Milestones** — Global milestone_types CRUD. Propagates to all facilities on add. (Existing page, adapted to tab layout.)
- **Admin Tab 2: Phases** — Global phase_templates CRUD. Name + color. Seeds facility_phases for new facilities.
- **Admin Tab 3: Templates** — Global milestone_template_types CRUD. Same builder UI as facility level but references milestone_types and phase_templates instead of facility-scoped entities.
- **Admin Tab 4: Procedure Types** — Global procedure_type_templates with template assignment. Each procedure template gets a milestone_template_type_id. Seeds procedure_types.milestone_template_id for new facilities.

### Case Creation Resolution (new cascade)
```
1. Check surgeon_template_overrides for (surgeon_id, procedure_type_id)
   → If found, use that template
2. Check procedure_types.milestone_template_id
   → If found, use that template
3. Fall back to facility's default template (is_default = true)
4. Resolve template → milestone_template_items → create case_milestones rows
```

## Design References
- **Mockup**: `docs/templates-page.jsx` — Template builder tab with 3-column layout, shared boundary rendering, sub-phase indicators, drag-and-drop library
- **Color system**: Uses phase colors from `lib/milestone-phase-config.ts`
- **Component library**: shadcn/ui, lucide-react, Tailwind CSS

## Files Likely Involved

### New Files
- `components/settings/milestones/TemplateBuilder.tsx` — 3-column template builder
- `components/settings/milestones/SharedBoundary.tsx` — Gradient boundary connector
- `components/settings/milestones/FlowNode.tsx` — Milestone row in builder (edge vs interior)
- `components/settings/milestones/SubPhaseIndicator.tsx` — Nested sub-phase card
- `components/settings/milestones/PhaseLibrary.tsx` — Phase CRUD for Tab 2
- `components/settings/milestones/TemplateSelector.tsx` — Template picker for Tab 4/5
- `supabase/migrations/YYYYMMDD_milestone_templates.sql` — New tables + data migration + RPC updates

### Modified Files
- `app/settings/milestones/page.tsx` — Complete rewrite with 5-tab layout
- `app/admin/settings/milestones/page.tsx` — Rewrite with 4-tab layout
- `app/admin/settings/procedure-milestones/page.tsx` — May merge into admin milestones page
- `lib/milestone-phase-config.ts` — Add facility_phases color resolution
- `components/settings/milestones/MilestoneFormModal.tsx` — Reuse for Tab 1

### Deleted Files (at end)
- `app/settings/procedure-milestones/page.tsx` — Replaced by Tab 4
- `app/settings/surgeon-milestones/page.tsx` — Replaced by Tab 5
- `components/settings/milestones/FlatMilestoneList.tsx` — Replaced by template builder
- `components/settings/milestones/InheritanceBreadcrumb.tsx` — No more 3-tier display
- `lib/utils/buildFlatRows.ts` — Replaced by template render logic
- `lib/utils/bracketUtils.ts` — Pair brackets replaced by builder UI
- `components/settings/surgeon-milestones/AddProcedureDropdown.tsx` — Surgeon page simplified

### Kept As-Is (analytics layer — untouched)
- `lib/utils/milestoneAnalytics.ts`
- `lib/hooks/useMilestoneComparison.ts`
- `lib/hooks/useMilestoneRealtime.ts`
- `lib/milestone-order.ts`
- `lib/utils/pairIssues.ts` — May reuse for Tab 1 pair validation
- `lib/utils/inferPhaseGroup.ts` — May reuse for auto-suggesting phase_group
- `components/cases/CaseDrawerMilestones.tsx`
- `components/cases/TimeAllocationBar.tsx`

## Out of Scope
- Changes to `phase_definitions` table or analytics RPCs
- Template versioning / changelog
- Template sharing between facilities
- Drag-to-reorder phases within the builder (phases ordered by display_order, manual reorder is a follow-up)
- Bulk template assignment to multiple procedures at once
- iOS app updates (uses same DB, will pick up template model automatically for case creation)

## Acceptance Criteria
- [ ] All new tables created with RLS policies
- [ ] Data migration preserves all existing procedure + surgeon milestone configs
- [ ] `create_case_with_milestones()` resolves milestones from template cascade
- [ ] `finalize_draft_case()` resolves milestones from template cascade (bug fix)
- [ ] `seed_facility_with_templates()` provisions new facilities with phases, templates, and procedure assignments
- [ ] Facility page: 5 working tabs with full CRUD on each
- [ ] Template builder: drag-and-drop milestones/phases, shared boundary rendering, sub-phases
- [ ] Admin page: 4 working tabs with template CRUD and procedure assignment
- [ ] Demo generator creates and uses templates
- [ ] Old tables (`procedure_milestone_config`, `surgeon_milestone_config`) dropped
- [ ] Dead code cleaned up
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
