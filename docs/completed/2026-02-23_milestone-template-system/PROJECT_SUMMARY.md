# Project: Milestone Template System
**Completed:** 2026-02-23
**Branch:** feature/milestone-template-system
**Duration:** 2026-02-23 (phases 1-9 completed in a single day)
**Total Phases:** 9 (split into 11 sub-phases: 1, 2, 3a, 3b, 4, 5a, 5b, 6, 7, 8, 9)

## What Was Built
Replaced the toggle-based milestone configuration system (4 disconnected pages, flat enable/disable per procedure/surgeon) with a template-based model. Milestone Templates are named, reusable compositions of milestones organized into phases. Templates become the single transferable unit: define once, assign to procedures, optionally override per surgeon.

The new system consolidates 4 separate settings pages into a single 5-tab page at `/settings/milestones`: Milestones (atom library), Phases (phase library with colors), Templates (3-column drag-and-drop builder), Procedures (2-column template assignment with timeline preview), and Surgeons (3-column override panel with timeline preview). The admin level has a parallel 4-tab page at `/admin/settings/milestones`.

Case creation now resolves milestones via a template cascade: surgeon override → procedure template → facility default template. This fixes a pre-existing bug where surgeon overrides were ignored in `finalize_draft_case()`.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Template tables, data migration, RPC updates | `6aa5f4f` |
| 2     | Tab shell, milestones tab, phases tab | `3969fff` |
| 3a    | Template builder rendering and CRUD | `05c2acc` |
| 3b    | Drag-and-drop integration for template builder | `9d14fa3` |
| 4     | Procedure assignment and surgeon overrides | `50283af` |
| 5a    | Admin 4-tab shell, milestones tab, phases tab | `d2afabd` |
| 5b    | Admin template builder and procedure type assignment | `1f7b42c` |
| 6     | Demo generator template support | `2eaac1b` |
| 7     | Analytics RPCs, drop legacy tables, clean up | `8b37153` |
| 8     | Builder polish (filled dots, interactive boundaries, legend) | `950fbf4` |
| 9     | Procedure and surgeon tab 2/3-column redesign | `f4e3636` |

## Key Files Created/Modified

### New Components
- `components/settings/milestones/TemplateBuilder.tsx` — 3-column template builder (template list, builder canvas, library panel)
- `components/settings/milestones/FlowNode.tsx` — Milestone row rendering (edge, interior, unassigned)
- `components/settings/milestones/SubPhaseIndicator.tsx` — Nested sub-phase cards with visual indicators
- `components/settings/milestones/TemplateTimelinePreview.tsx` — Read-only template visualization for procedure/surgeon tabs
- `components/settings/milestones/PhaseLibrary.tsx` — Phase CRUD with color picker
- `components/settings/milestones/ProcedureTemplateAssignment.tsx` — 2-column procedure template assignment
- `components/settings/milestones/SurgeonOverridePanel.tsx` — 3-column surgeon override management
- `components/settings/milestones/AdminProcedureTypeAssignment.tsx` — Admin procedure type template assignment

### New Hooks
- `hooks/useTemplateBuilder.ts` — Facility-level template builder state (useReducer + optimistic updates)
- `hooks/useAdminTemplateBuilder.ts` — Admin-level template builder state

### New Utils
- `lib/utils/buildTemplateRenderList.ts` — Transforms template items into flat render list (phases, milestones, boundaries, drop zones)
- `lib/utils/pairOrderValidation.ts` — Validates milestone pair ordering within templates

### Modified Pages
- `app/settings/milestones/page.tsx` — Complete rewrite: 5-tab layout with URL query params
- `app/admin/settings/milestones/page.tsx` — Complete rewrite: 4-tab layout

### Deleted Files (Phase 7 + post-phase cleanup)
- `app/settings/procedure-milestones/page.tsx` — Replaced by Tab 4
- `app/settings/surgeon-milestones/page.tsx` — Replaced by Tab 5
- `app/settings/phases/page.tsx` — Replaced by Tab 2
- `app/admin/settings/phases/page.tsx` — Replaced by Admin Tab 2
- `app/admin/settings/procedure-milestones/page.tsx` — Replaced by Admin Tab 4
- `components/settings/milestones/FlatMilestoneList.tsx` — Replaced by template builder
- `components/settings/milestones/InheritanceBreadcrumb.tsx` — No more 3-tier display
- `components/settings/milestones/SharedBoundary.tsx` — Replaced by two-connected-dots visual
- `components/settings/phases/*` — All old phase components (6 files)
- `components/settings/surgeon-milestones/AddProcedureDropdown.tsx`
- `components/settings/procedure-milestones/*` — All old procedure milestone components
- `lib/utils/buildFlatRows.ts` — Replaced by buildTemplateRenderList
- `lib/utils/bracketUtils.ts` — Replaced by builder UI

## Architecture Decisions

1. **Template cascade for case creation:** surgeon_template_override → procedure_types.milestone_template_id → facility default template. Raises exception if no template found.
2. **Position-based boundaries:** Phase boundaries computed from adjacency (first/last milestone in phase). No explicit start/end refs stored.
3. **Shared boundaries rendered as two-connected-dots:** Originally used gradient diamonds (SharedBoundary.tsx), then replaced with a simpler two-connected-dots visual showing dual phase colors.
4. **@dnd-kit for all drag-and-drop:** Consistent with existing codebase patterns. Library-to-builder drag, reorder within phases.
5. **useReducer + optimistic updates:** Builder state managed via dedicated reducer with actions like ADD_MILESTONE, REMOVE_MILESTONE, REORDER, ADD_PHASE.
6. **One parameterized TemplateBuilder component:** Used for both facility and admin levels. Parent provides data source via props.
7. **URL query params for tab routing:** `?tab=milestones|phases|templates|procedures|surgeons` for deep-linking.
8. **DB trigger for single-default constraint:** BEFORE INSERT/UPDATE trigger ensures only one `is_default = true` template per facility.
9. **Hard cutover for RPCs:** No dual-read pattern. Data migration runs first, then RPCs use new tables exclusively.
10. **Sub-phases fully implemented:** `parent_phase_id` with 1-level nesting. Sub-phase items render as nested inset cards in builder.

## Database Changes

### New Tables (Facility Level)
- `facility_phases` — Phase library (name, display_name, color_key, display_order, parent_phase_id)
- `milestone_templates` — Named templates (name, description, is_default)
- `milestone_template_items` — Ordered milestones with phase assignment (template_id, facility_milestone_id, facility_phase_id, display_order)
- `surgeon_template_overrides` — Surgeon picks different template per procedure

### New Tables (Global Admin Level)
- `phase_templates` — Global phase library for seeding
- `milestone_template_types` — Global template definitions
- `milestone_template_type_items` — Global template items with phase assignment

### Modified Tables
- `procedure_types` — Added `milestone_template_id` FK
- `procedure_type_templates` — Added `milestone_template_type_id` FK

### Dropped Tables
- `procedure_milestone_config` — Replaced by template assignment
- `surgeon_milestone_config` — Replaced by surgeon_template_overrides
- `procedure_milestone_templates` — Replaced by milestone_template_type_items

### Migrations
- `20260223_milestone_template_tables.sql` — New tables + RLS + triggers
- `20260223_milestone_data_migration.sql` — Migrate existing configs to templates
- `20260223_milestone_rpc_updates.sql` — Rewrite create_case_with_milestones, finalize_draft_case, seed_facility_with_templates
- `20260223_drop_legacy_milestone_tables.sql` — Drop old tables
- `20260223_update_analytics_rpcs.sql` — Rewrite get_milestone_interval_medians
- `20260223200000_template_block_order.sql` — Template block ordering support
- `20260223200001_template_sub_phase_map.sql` — Sub-phase mapping support

### RPC Changes
- `create_case_with_milestones()` — Rewritten to resolve from template cascade
- `finalize_draft_case()` — Rewritten with template cascade (fixes surgeon override bug)
- `seed_facility_with_templates()` — Extended to provision phases, templates, template items
- `get_milestone_interval_medians()` — Rewritten to use template model

## Known Limitations / Future Work
- `actions.test.ts` for facility creation wizard needs mock update for extended `seed_facility_with_templates` RPC signature
- Missing tests for TemplateTimelinePreview, useAdminTemplateBuilder, useMilestoneComparison
- Template versioning / changelog not implemented (out of scope)
- Template sharing between facilities not implemented (out of scope)
- Bulk template assignment to multiple procedures not implemented (out of scope)
- iOS app changes not needed (uses same DB, picks up template model automatically via RPCs)
