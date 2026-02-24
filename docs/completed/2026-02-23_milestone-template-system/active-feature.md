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

## Review Q&A

> Generated by /review on 2026-02-23

**Q1:** Phase 1 currently bundles table creation, data migration, AND RPC rewrites into one migration file. That's risky — if the data migration has a bug, it takes down the RPCs too. Should we split Phase 1 into separate migrations: (a) table creation only, (b) data migration, (c) RPC rewrites?
**A1:** Split into 3 migrations. Separate migrations for tables, data migration, and RPC rewrites. Easier to debug and roll back individually.

**Q2:** Should the RPC rewrite use a dual-read pattern (try new template tables first, fall back to old tables) during the transition? Or hard cutover?
**A2:** Hard cutover. RPC rewrite assumes data migration is complete. Since all 3 migrations run in sequence during `supabase db push`, the data will exist before RPCs execute.

**Q3:** Should `facility_phases` for existing facilities seed from their `phase_definitions` or from a fresh global template? And for new facilities?
**A3:** Both paths. Existing facilities: copy from their `phase_definitions` into `facility_phases`. New facilities: seed from global `phase_templates`. Preserves existing customizations while establishing the clean template pattern going forward.

**Q4:** The template builder needs both drag-to-reorder within phases AND drag from library into builder. Should we use @dnd-kit for everything, native HTML DnD, or hybrid?
**A4:** @dnd-kit for everything. Consistent with existing codebase patterns, better accessibility and keyboard support.

**Q5:** Should the builder be a fixed-height panel with internal scrolling per column, or scroll with the page?
**A5:** Fixed viewport height. Builder fills available viewport height with internal scrolling per column. Each column scrolls independently. Keeps template list, builder canvas, and library all visible simultaneously.

**Q6:** Should shared boundaries (gradient diamond) use pure CSS, SVG, or hybrid rendering?
**A6:** Pure CSS. Rotated div for diamond, CSS linear-gradient for dual-phase background. The template builder is a NEW component so no need to match FlatMilestoneList's SVG approach.

**Q7:** The MilestoneFormModal currently has a Phase Group dropdown. In the new system, phase assignment happens in the template builder. Should the form still show phase_group?
**A7:** Remove from form, keep auto-infer. Remove the phase_group dropdown from MilestoneFormModal entirely. Keep auto-inferring `phase_group` on create (still needed for analytics compatibility). Users won't see or edit it.

**Q8:** The 5-tab layout — should tabs use URL query params, shadcn Tabs + local state, or URL path segments?
**A8:** URL query params. Use `?tab=milestones|phases|templates|procedures|surgeons` in the URL. Allows deep-linking and browser back/forward.

**Q9:** Single-default constraint on `milestone_templates` (one default per facility) — DB trigger, application-level RPC, or partial unique index?
**A9:** DB trigger. BEFORE INSERT/UPDATE trigger that sets `is_default = false` on all other templates in the same facility when one is set to `true`. Consistent with the codebase's trigger-heavy pattern. Race-condition safe.

**Q10:** For Tab 4 (Procedures) and Tab 5 (Surgeons), should these tabs show any preview of the selected template's milestones?
**A10:** Yes — when a template is selected, always show phase-colored milestone chips below the dropdown. Always visible, not expandable/collapsible.

**Q11:** Should sub-phases be built fully, stubbed, or skipped?
**A11:** Build sub-phases fully. Implement `parent_phase_id`, sub-phase rendering in builder (nested inset cards), sub-phase indicators.

**Q12:** Template builder state management — multiple useState, useReducer, or React Query?
**A12:** useReducer + optimistic. Dedicated reducer for builder state with actions like ADD_MILESTONE, REMOVE_MILESTONE, REORDER, ADD_PHASE.

**Q13:** Should the demo generator create templates directly or call `seed_facility_with_templates()`?
**A13:** Use `seed_facility_with_templates()`. Single source of truth for facility provisioning.

**Q14:** Should milestone pairing stay in MilestoneFormModal or be an inline table action?
**A14:** Inline table action. Click-to-pair mode: click 'Link' on milestone A → row highlights → click milestone B → auto-assign start/end roles based on display order. Badge shows partner. 'Unlink' to break.

**Q15:** Should analytics RPC rewrites (`get_milestone_interval_medians`) and the `useMilestoneComparison` hook migration happen in Phase 7 or earlier?
**A15:** Phase 7 with other analytics. Keep all analytics-related migrations together. Old tables coexist with new template tables until Phase 7 drops them.

**Q16:** RLS policies for new tables — match existing patterns, tighter admin policies, or service role bypass?
**A16:** Match existing patterns. Facility tables: facility-scoped RLS. Global tables: role-based RLS (global_admin write, all authenticated read).

**Q17:** How should unphased milestones (null `facility_phase_id`) render in the template builder?
**A17:** Separate 'Unassigned' section at bottom of the builder. Users can drag them into a phase or leave them unphased.

**Q18:** Data fetching for the template builder — separate useSupabaseQuery calls, custom hook, or page-level fetch?
**A18:** Custom hook: `useTemplateBuilder(templateId)` that bundles all queries and exposes the useReducer dispatch for mutations.

**Q19:** Should the library panel show ALL facility milestones (grayed out if already in template) or only available ones?
**A19:** Only show available (not in template). When a milestone is removed from builder, it reappears in library.

**Q20:** When dropping a phase into the builder, should it auto-populate with matching milestones or start empty?
**A20:** Drop empty, add milestones manually. Phase drops as an empty container with a drop zone.

**Q21:** Template duplicate UX — auto-name + inline rename, modal prompt, or silent auto-name?
**A21:** Auto-name + inline rename. Immediately create "Template Name (Copy)" and select it. Name field is editable for renaming.

**Q22:** What happens when archiving a template that's assigned to procedures?
**A22:** Block with warning. Show "This template is assigned to N procedures. Reassign them before archiving." Prevent the archive action.

**Q23:** What about archiving the facility's DEFAULT template?
**A23:** Prevent archiving default. Archive button disabled with tooltip: "Set a different template as default before archiving this one."

**Q24:** For the admin builder (Phase 5), should we build one parameterized builder component or two separate components?
**A24:** One component, data via props. TemplateBuilder accepts milestones, phases, templates, and CRUD callbacks as props. Parent page provides the correct data source.

**Q25:** Should Phase 3 (Template Builder, marked 'Large') be split into sub-phases?
**A25:** Yes, split. 3a: Builder rendering (buildRenderList, FlowNode, SharedBoundary, SubPhaseIndicator, template CRUD). 3b: DnD integration (library panel, drag from library to builder, reorder within phases).

**Q26:** Should Phase 5 (Admin Page, marked 'Large') also be split?
**A26:** Yes, split. 5a: Admin Tab 1 (Milestones) + Tab 2 (Phases). 5b: Admin Tab 3 (Templates builder) + Tab 4 (Procedure Types).

**Q27:** Should the nav consolidate to a single 'Milestones' item or keep any separate items?
**A27:** Remove all, keep only 'Milestones' at `/settings/milestones`. All 5 tabs live there. Remove Phases, Procedure Milestones, Surgeon Milestones from nav.

**Q28:** Phase 5 updates `seed_facility_with_templates()`, Phase 7 drops old tables — correct timing?
**A28:** Yes. Phase 5 seed update → Phase 7 drop. Safe timeline.

**Q29:** What happens if the template cascade finds no template at all (no surgeon override, no procedure template, no facility default)?
**A29:** Raise exception. "No milestone template found for this procedure. Please assign a template in Settings > Milestones." Prevents creating a case with zero milestones.

## Review Q&A — Post-Phase 7 UI Polish

> Generated by /review on 2026-02-23

**Q1:** In FlowNode.tsx, each milestone has a colored circle with a checkmark SVG (✓) as its visual marker on the timeline rail. You want to remove the "checkbox" feel. What should replace it?
**A1:** Filled dot. Replace the checkmark circle with a simple filled circle/dot in the phase color. Clean, minimal, universally understood as a timeline node.

**Q2:** Currently, shared boundaries (where Phase A's last milestone = Phase B's first milestone) are completely non-interactive in the builder — no X button, no drag handle. Is this the removal issue, or regular edge milestones too?
**A2:** Both shared boundaries AND regular edge milestones are the issue. User wants to be able to remove any milestone regardless of its position.

**Q3:** When the user removes a shared boundary milestone, what should happen to the two phases?
**A3:** Confirm + remove milestone. Show a confirmation warning explaining that removing this milestone will break the shared boundary between two phases, then proceed with removal if confirmed.

**Q4:** For the shared boundary visual treatment in the builder, where should the remove button go?
**A4:** X on hover, matching other milestones. Keeps it consistent — hover reveals the action. The confirmation dialog handles the safety concern.

**Q5:** For the edge milestone badges and overall boundary interactivity — what's the core issue?
**A5:** Boundaries need full interactivity:
- User should be able to remove any milestone attached to a boundary
- Need intuitive removal of milestones from boundaries
- Milestones should be draggable and droppable
- Phase boundaries should also be draggable and droppable
- User should be able to add a milestone to multiple boundaries

**Q6:** When you drag a shared boundary milestone to a new position, what should happen to the two phases?
**A6:** Phases auto-adjust. Dragging the boundary milestone recomputes phase edges automatically. If you move it, the adjacent milestones become the new phase edges. Boundaries are always positional.

**Q7:** Procedure tab redesign — how should the template selection work in the new 2-column layout?
**A7:** Dropdown above timeline. Right column shows: template name dropdown at top, then the full visual timeline below. Click a procedure on the left, right column updates. One procedure visible at a time.

**Q8:** Should the procedure list (left column) still show the category?
**A8:** Drop category entirely. Users know their procedures. Keep the list clean.

**Q9:** Should procedure list items show the currently assigned template name?
**A9:** Name + template badge. Show the procedure name with a small template name badge/label. Lets you scan all assignments without clicking each one.

**Q10:** Surgeon tab — should the third column have a template dropdown to change the override?
**A10:** Template dropdown + timeline. Third column shows: surgeon+procedure name header, template dropdown (to change override), status badge (Override/Inherited), then the full timeline preview below.

**Q11:** In the surgeon tab's procedure column (column 2), what should each procedure item show?
**A11:** Name + override badge. Procedure name with a small 'Override' amber badge if the surgeon has an override for it.

**Q12:** Column height approach for surgeon tab?
**A12:** Fill viewport, matching Templates tab. Use `height: calc(100vh - 220px)` with internal scrolling per column.

**Q13:** Empty states for the new layouts?
**A13:** Contextual prompts. Show helpful prompts: 'Select a procedure to view its template' in the right column. For surgeon tab: column 2 shows 'Select a surgeon', column 3 shows 'Select a procedure'.

**Q14:** Should TemplateTimelinePreview render the same full timeline or a compact version in the narrower columns?
**A14:** Same full timeline. Reuse TemplateTimelinePreview as-is.

**Q15:** Should TemplateTimelinePreview also use filled dots instead of checkmarks?
**A15:** Yes, filled dots everywhere. Update both FlowNode.tsx AND TemplateTimelinePreview.tsx for consistency.

**Q16:** Should the builder legend be updated or removed?
**A16:** Update legend. Update items: filled dot icon with 'milestone', gradient diamond with 'shared boundary (removable)', drag handle with 'drag to reorder'.

**Q17:** Should these changes be one phase or multiple?
**A17:** Two phases. Phase A: template builder + preview changes (dots, interactive boundaries). Phase B: procedure + surgeon tab redesigns.

**Q18:** Shared boundary DnD — how should it participate in SortableContexts?
**A18:** Belongs to both phases. Render as special item in both ending and starting phase SortableContexts. When dragged within either phase, it reorders normally. Phase edges recompute automatically.
