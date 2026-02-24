# Project: Migrate Analytics from phase_definitions to Template-Based Phase Resolution
**Completed:** 2026-02-23
**Branch:** feature/analytics-template-phase-resolution
**Duration:** 2026-02-23 → 2026-02-23 (single day)
**Total Phases:** 3 + post-phase polish

## What Was Built
Replaced the `phase_definitions` table (which had no management UI after the phases page was deleted) with template-based phase boundary resolution. A new SQL resolver function (`resolve_template_phase_boundaries`) derives phase boundaries from `milestone_template_items` — grouping by `facility_phase_id` and selecting the first/last item per phase as start/end boundaries.

A TypeScript adapter (`resolvePhaseDefsFromTemplate`) wraps the SQL function and returns the existing `PhaseDefinitionWithMilestones[]` interface, so all downstream utility functions (computePhaseDurations, buildPhaseGroups, computeSubphaseOffsets) remained unchanged. Cases now gain a `milestone_template_id` column to snapshot which template was used at creation time.

Both `phase_definitions` and `phase_definition_templates` tables were dropped. The `seed_facility_phases()` function and its trigger were also removed. Analytics are now fully template-aware — different procedures can have different phase structures based on their assigned template.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Database: resolver function, cases.milestone_template_id, RPC rewrites | f06f0ac |
| 2     | TypeScript adapter, update all frontend consumers | 63a4eb2 |
| 3     | Drop phase_definitions, cleanup dead code | 9c53743 |
| Polish | Phase-grouped milestone rendering, analytics refinements | 055919a |

## Key Files Created/Modified
- `lib/dal/phase-resolver.ts` — NEW: resolvePhaseDefsFromTemplate, resolveDefaultPhaseDefsForFacility, resolveTemplateForCase
- `lib/dal/__tests__/phase-resolver.test.ts` — NEW: unit tests for phase resolver
- `lib/hooks/useMilestoneComparison.ts` — replaced phase_definitions query with template resolution
- `app/analytics/surgeons/page.tsx` — per-case template resolution for phase bars
- `components/analytics/financials/SurgeonDetail.tsx` — per-case template resolution for phase pills
- `components/cases/MilestoneDetailRow.tsx` — phase-grouped rendering with collapsible parent/subphase hierarchy
- `lib/utils/milestoneAnalytics.ts` — new functions: calculatePhaseTimeAllocation, assignMilestonesToPhases, buildPhaseGroups
- `lib/analyticsV2.ts` — updated milestone map, removed deprecated phase_definitions references
- `lib/dal/lookups.ts` — removed lookupsDAL.phaseDefinitions() and PhaseDefinition interface
- `lib/audit-logger.ts` — removed dead phaseDefinitionAudit
- `app/admin/facilities/new/actions.ts` — removed phase_definitions from template config
- `app/admin/facilities/new/page.tsx` — removed facility_phase_definitions count query
- `supabase/migrations/20260223_template_phase_resolver.sql` — resolver function, cases column, RPC rewrites
- `supabase/migrations/20260223_drop_phase_definitions.sql` — drop tables, functions, triggers

## Architecture Decisions
- **Adapter pattern over rewrite**: New resolver returns `PhaseDefinitionWithMilestones[]` (superset of `PhaseDefInput[]`). All utility functions kept their existing interface — smallest blast radius.
- **Per-template phase resolution**: Each case resolves its own template's phase boundaries. Different procedures can have 2, 3, or 4 phases depending on their template.
- **Facility default for flag detection**: `computeProcedureMedians` on surgeons page uses facility default template (consistent boundaries for comparison heuristic).
- **No backfill**: Existing cases use cascade resolution at query time (surgeon override → procedure → facility default). New cases get `milestone_template_id` stamped.
- **Client-side dedup for batch resolution**: Surgeons page collects unique template IDs from day's cases (2-3 max), resolves each once, builds Map for lookup.
- **4-param get_phase_medians**: DROP + recreate with `p_milestone_template_id` parameter. Medians computed across ALL cases for a procedure (INNER JOIN naturally excludes cases missing boundary milestones).

## Database Changes
- **New column**: `cases.milestone_template_id UUID REFERENCES milestone_templates(id)` (nullable)
- **New function**: `resolve_template_phase_boundaries(p_template_id UUID)` — returns phase boundaries from template items
- **Rewritten RPC**: `get_phase_medians(p_facility_id, p_procedure_type_id, p_surgeon_id, p_milestone_template_id)` — 4 params, uses template resolver
- **Updated RPCs**: `create_case_with_milestones()`, `finalize_draft_case()` — stamp milestone_template_id
- **Dropped tables**: `phase_definitions`, `phase_definition_templates`
- **Dropped function**: `seed_facility_phases()`
- **Dropped trigger**: `on_facility_created_seed_phases`
- **Removed from seed_facility_with_templates()**: PART 14 (phase_definitions seeding)
- Migration files: `20260223_template_phase_resolver.sql`, `20260223_drop_phase_definitions.sql`

## Known Limitations / Future Work
- **Missing unit tests**: `calculatePhaseTimeAllocation`, `assignMilestonesToPhases`, `buildPhaseGroups` lack dedicated unit tests
- **Missing integration tests**: Phase-grouped collapsible rendering in MilestoneDetailRow lacks integration tests
- **Interval highlighting**: Milestones tracked within a phase (e.g., anes_start/anes_end in Pre-Op without a subphase) show in milestone interval table but not as visual marks within phase bars — deferred to future enhancement
- **Pre-existing test failures**: 3 unrelated test failures (utilization target config, schedule adherence legend) exist but are not from this project
