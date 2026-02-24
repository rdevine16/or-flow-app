# Feature: Migrate Analytics from phase_definitions to Template-Based Phase Resolution

## Goal
Replace the `phase_definitions` table (which has no management UI since the dedicated phases page was removed) with template-based phase boundary resolution. Phase boundaries are derived from `facility_phases` + `milestone_template_items` (first/last item per phase = start/end boundary). This makes analytics template-aware: different procedures can have different phase structures based on their assigned template.

## Requirements
1. Add `milestone_template_id` to `cases` table to snapshot the template used at case creation
2. Create a SQL resolver function that derives phase boundaries from template items
3. Create a TypeScript adapter that returns `PhaseDefInput[]` from template resolution (preserves existing utility function interfaces)
4. Rewrite `get_phase_medians` RPC to use template resolution
5. Update all frontend consumers (useMilestoneComparison, surgeons page, SurgeonDetail) to resolve phases from templates
6. Stop seeding `phase_definitions` for new facilities
7. Drop `phase_definitions` and `phase_definition_templates` tables
8. Backfill `milestone_template_id` on existing cases

## Database Context
- Table: `facility_phases` — phase library (name, color, order, parent). NO start/end milestone IDs.
- Table: `milestone_template_items` — ordered milestones in template, with `facility_phase_id` assignment
- Table: `milestone_templates` — named templates per facility, `is_default` flag
- Table: `surgeon_template_overrides` — surgeon picks different template per procedure
- Table: `procedure_types.milestone_template_id` — procedure-level template assignment
- RPC: `get_phase_medians()` — currently queries `phase_definitions`, needs rewrite
- RPC: `create_case_with_milestones()` — already uses template cascade, needs to stamp template_id on case
- RPC: `finalize_draft_case()` — same

## Key Design Decisions
- **Template-aware analytics**: Each procedure resolves its own template → phase boundaries. Different procedures can have different phase structures.
- **Adapter pattern**: New resolver returns `PhaseDefInput[]` with derived start/end milestone IDs. All utility functions (computePhaseDurations, buildPhaseGroups, etc.) keep their existing interface. Smallest blast radius.
- **Median scope**: `get_phase_medians` computes medians across ALL cases for a procedure (not filtered by template). Phase structure displayed comes from the current procedure template.
- **Case template snapshot**: `cases.milestone_template_id` records which template was used at creation time.
- **Drop both tables**: `phase_definitions` AND `phase_definition_templates` (admin-level seeding table, redundant with `phase_templates`)
- **No transition period**: Stop seeding `phase_definitions` immediately; adapter handles everything.

## Files Likely Involved
- `supabase/migrations/` — new migration for cases column, resolver function, RPC rewrites, table drops
- `lib/utils/milestoneAnalytics.ts` — unchanged (adapter preserves PhaseDefInput interface)
- `lib/analyticsV2.ts` — unchanged (same reason)
- `lib/hooks/useMilestoneComparison.ts` — update phase_definitions query to use adapter
- `app/analytics/surgeons/page.tsx` — update phase_definitions query to use adapter
- `components/analytics/financials/SurgeonDetail.tsx` — update phase_definitions query to use adapter
- `lib/dal/lookups.ts` — remove `lookupsDAL.phaseDefinitions()`, add adapter
- `lib/milestone-phase-config.ts` — minor: update comment references

## iOS Parity
- [x] iOS can wait (iOS doesn't query phase_definitions directly)

## Known Issues / Constraints
- Shared boundaries (same milestone in 2 adjacent phases) are handled naturally by the resolver
- Cases without a procedure_type (edge case) fall back to facility default template
- The `phase_group` column on `facility_milestones` is a separate legacy field, untouched by this work

## Out of Scope
- Changing the utility function interfaces (computePhaseDurations, buildPhaseGroups, etc.)
- Modifying the template builder UI
- Touching `phase_group` on `facility_milestones`
- Analytics settings or analytics_settings_template tables

## Acceptance Criteria
- [ ] `phase_definitions` and `phase_definition_templates` tables dropped
- [ ] `cases.milestone_template_id` populated for all existing and new cases
- [ ] Phase durations computed correctly from template resolution
- [ ] `get_phase_medians` RPC returns correct data using template resolver
- [ ] All analytics pages (surgeons, financials, case drawer) render phase data correctly
- [ ] New facility creation works without `phase_definitions` seeding
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
