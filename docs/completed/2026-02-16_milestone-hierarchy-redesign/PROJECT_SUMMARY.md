# Project: Milestone Hierarchy Redesign
**Completed:** 2026-02-16
**Branch:** feature/milestone-hierarchy-redesign
**Duration:** 2026-02-16 (all 8 phases completed in a single day)
**Total Phases:** 8

## What Was Built
Redesigned the milestone system to support a three-level hierarchy: facility phases (defined by boundary milestones), procedure-level milestone configuration with per-procedure ordering, and surgeon-level overrides. This enables universal phase-level analytics for cross-surgeon comparison alongside detailed milestone-level tracking for self-improvement.

The system introduces `phase_definitions` (per-facility phase boundary configuration), `phase_definition_templates` (global admin templates that seed new facilities), and `surgeon_milestone_config` (surgeon-level additive/subtractive overrides on top of procedure defaults). All configuration is manageable through both global admin (templates for new facilities) and facility admin (per-facility customization) UIs.

Phase-level analytics were integrated into the case drawer with a new `get_phase_medians()` database function, collapsible phase header rows in the milestone table, n-count display with grey-out below threshold (n < 5), and TimeAllocationBar sourcing from phase_definitions boundary milestone timestamps.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Database foundation (3 new tables, seed function, triggers) | `fdddc43` |
| 1-fix | Add missing sync_soft_delete trigger to phase_definitions | `62eae83` |
| 2 | Facility phase boundary UI with CRUD + reorder | `ead5507` |
| 3 | Global admin phase definition templates | `8ad01ea` |
| 4 | Procedure milestones redesign with phase grouping + ordering | `6da68c6` |
| 5 | Surgeon milestone config UI with overrides | `dcba9e8` |
| 6 | Surgeon override merge in case creation pipeline | `2d87851` |
| 7 | Phase medians, analytics integration, n-count display | `05fb27e` |
| 8 | Admin procedure milestones redesign with phase grouping | `60cce2b` |

## Key Files Created/Modified

### New Pages
- `app/settings/phases/page.tsx` — Phase boundary configuration (facility-level)
- `app/settings/surgeon-milestones/page.tsx` — Surgeon milestone overrides
- `app/settings/procedure-milestones/page.tsx` — Rewritten with phase grouping + drag reorder
- `app/admin/settings/milestones/page.tsx` — Extended with Phase Definition Templates section
- `app/admin/settings/procedure-milestones/page.tsx` — Rewritten with phase grouping for templates

### New Components
- `components/settings/phases/PhaseCard.tsx` — Draggable phase card with boundary dropdowns
- `components/settings/phases/PhaseFormModal.tsx` — Add new phase modal
- `components/settings/phases/ArchivedPhasesSection.tsx` — Archived phases with restore
- `components/settings/phases/PhaseTemplateSection.tsx` — Admin template section
- `components/settings/phases/PhaseTemplateCard.tsx` — Template phase card
- `components/settings/phases/PhaseTemplateFormModal.tsx` — Template add/edit modal
- `components/settings/procedure-milestones/PhaseSection.tsx` — Phase group header
- `components/settings/procedure-milestones/ProcedureMilestoneList.tsx` — Ordered list with drag handles
- `components/settings/procedure-milestones/ProcedureMilestoneRow.tsx` — Row with checkbox, lock, pair indicators
- `components/settings/surgeon-milestones/SurgeonMilestoneRow.tsx` — Override row with amber highlighting

### Modified Components
- `components/cases/MilestoneDetailRow.tsx` — Collapsible phase headers with duration/median/delta
- `components/cases/MilestoneComparisonToggle.tsx` — N-count display, grey-out below threshold
- `components/cases/CaseDrawerMilestones.tsx` — Phase data integration

### Data Layer
- `lib/dal/lookups.ts` — Added `phaseDefinitions()`, `surgeonMilestoneConfig()` queries
- `lib/hooks/useMilestoneComparison.ts` — Phase medians fetch, n-count handling
- `lib/utils/milestoneAnalytics.ts` — `calculatePhaseTimeAllocation()`, `assignMilestonesToPhases()`, `buildPhaseGroups()`
- `lib/milestone-phase-config.ts` — `phaseConfigFromColorKey()` helper
- `lib/settings-nav-config.ts` — Added Phases and Surgeon Milestones nav items

## Architecture Decisions

1. **Milestone role is derived, not stored.** Boundary = referenced in `phase_definitions`, Paired = `pair_with_id IS NOT NULL`, Point = neither. No schema change needed.
2. **Phase contiguity not enforced.** Phases are independent time spans — gaps between phases are acceptable.
3. **Three-level display ordering:** facility → procedure → surgeon, with `display_order` on `procedure_milestone_config` and `surgeon_milestone_config`.
4. **Boundary milestones locked.** On procedure and surgeon config pages, boundary milestones are always checked and greyed out to ensure phase calculations always have the data they need.
5. **TimeAllocationBar switched entirely to phase_definitions.** No phase_group fallback — legacy `calculateTimeAllocation()` deprecated.
6. **N-count threshold = 5** for facility comparison. Below threshold: greyed out + tooltip.
7. **State management:** useState + direct Supabase calls (existing pattern maintained).
8. **Surgeon override resolution:** `COALESCE(surgeon.is_enabled, procedure.is_enabled)` — surgeon wins when present.
9. **Ordering is read-time only.** `case_milestones` are unordered rows; display order resolved at read time via COALESCE(surgeon > procedure > facility).

## Database Changes

### New Tables
- `phase_definitions` — Per-facility phase boundary configuration
- `phase_definition_templates` — Global admin templates that seed new facilities
- `surgeon_milestone_config` — Surgeon-level overrides on procedure defaults

### New Functions
- `seed_facility_phases(p_facility_id)` — Copies templates → phase_definitions, mapping milestone_type_id → facility_milestone_id
- `get_phase_medians(p_facility_id, p_procedure_type_id, p_surgeon_id)` — Phase-level medians with n-counts

### Modified Functions
- `create_case_with_milestones()` — LEFT JOIN surgeon_milestone_config with COALESCE for milestone resolution

### Triggers
- `on_facility_created_seed_phases` — AFTER INSERT on facilities, calls seed_facility_phases()
- `sync_soft_delete` on `phase_definitions` — Maintains is_active/deleted_at consistency

### Migration Files
- `20260216000001_phase_definitions.sql`
- `20260216000002_surgeon_milestone_config.sql`
- `20260216000003_seed_facility_phases.sql`
- `20260216000004_phase_definitions_soft_delete_trigger.sql`
- `20260216000005_update_create_case_with_milestones.sql`
- `20260216000006_get_phase_medians.sql`

## Known Limitations / Future Work

- **5 universal milestones are hardcoded in the pipeline:** patient_in, incision, prep_drape_complete, closing, patient_out. These appear as denormalized columns on `cases` and are used by `record_case_stats()`, `orbitScoreEngine.ts`, and materialized views. Custom phase boundaries work alongside these, not as replacements.
- **`get_milestone_interval_medians()` n-count return type was NOT modified** (documented in spec but deferred — phase medians cover the primary use case).
- **Some UI components lack unit tests:** Phase settings pages, PhaseCard, PhaseFormModal, PhaseTemplateSection, MilestoneComparisonToggle, MilestoneDetailRow. Core logic and reusable components are tested.
- **iOS parity deferred:** iOS consumes the data but doesn't have admin UIs for phase/surgeon config yet.
- **Phase-level ORbit Score recalculation:** Future enhancement once phase medians are stable.
