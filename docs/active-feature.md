# Feature: Milestone Hierarchy Redesign

## Goal

Redesign the milestone system to support a proper hierarchy: phases defined by boundary milestones, procedure-level milestone configuration, and surgeon-level overrides. This enables accurate phase-level analytics (universal cross-surgeon comparison) alongside detailed milestone-level tracking (surgeon self-improvement). The system must be fully configurable through the UI at both the global admin level (templates for new facilities) and the facility admin level (per-facility customization).

## Background & Design Decisions

### Three Milestone Roles

Every milestone falls into one of three conceptual roles:

| Role | Defines a phase boundary? | Has duration? | Examples |
|------|--------------------------|---------------|----------|
| **Boundary** | Yes — ends one phase, starts next | No (point in time) | patient_in, incision, closing, patient_out |
| **Paired** | No | Yes (start → end) | prep_drape_start/complete, array_start/stop |
| **Point** | No | No | timeout, surgeon_left |

Boundary milestones define where phases start and end. Paired milestones measure sub-interval durations within a phase. Point milestones record that an event happened (no duration, no phase transition).

### Two-Layer Analytics Model

| Layer | Comparison Source | When Valid | Used For |
|-------|------------------|------------|----------|
| **Phase** (universal) | Facility-wide (all surgeons) | Always — boundary milestones are universal | Scorecards, benchmarking, time allocation bars |
| **Milestone** (detail) | Surgeon's own history; facility-wide only with sufficient n-count | Self: always. Cross-surgeon: when n ≥ threshold | Case detail, surgeon self-improvement, trends |

**Key principle:** Phases are for "how do I compare?" Milestones are for "where can I improve?"

**Comparison is identity-based, not position-based.** Surgeons can reorder milestones (different workflow preferences). Analytics match on `facility_milestone_id`, not ordinal position. Surgeon A having anesthesia as step 3 and Surgeon B having it as step 2 does not affect comparison — anesthesia duration is the same measurement for both.

### Global Admin vs Facility Admin

- **Global admin** (`/admin/settings/`) manages templates. Changes here only affect **new facilities** when created. They do NOT push to existing facilities.
- **Facility admin** (`/settings/`) manages their own facility's configuration. Full control over milestones, phases, procedure mappings, and surgeon overrides.
- Both levels need UI for every new entity introduced in this feature.

---

## Database Changes

### NEW TABLE: `phase_definitions`

Defines surgical phases as time spans between boundary milestones. Per-facility, fully configurable.

```sql
CREATE TABLE public.phase_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id         UUID NOT NULL REFERENCES public.facilities(id),
  name                TEXT NOT NULL,           -- 'pre_op', 'surgical', 'closing', 'post_op'
  display_name        TEXT NOT NULL,           -- 'Pre-Op', 'Surgical', 'Closing', 'Post-Op'
  display_order       INTEGER NOT NULL,        -- 1, 2, 3, 4
  start_milestone_id  UUID NOT NULL REFERENCES public.facility_milestones(id),
  end_milestone_id    UUID NOT NULL REFERENCES public.facility_milestones(id),
  color_key           TEXT,                    -- 'blue', 'green', 'amber', 'purple'
  is_active           BOOLEAN DEFAULT true,
  deleted_at          TIMESTAMPTZ,
  UNIQUE(facility_id, name)
);
```

Default seed per facility:

| Phase | display_order | start_milestone | end_milestone | color_key |
|-------|---------------|-----------------|---------------|-----------|
| Pre-Op | 1 | patient_in | incision | blue |
| Surgical | 2 | incision | closing | green |
| Closing | 3 | closing | patient_out | amber |
| Post-Op | 4 | patient_out | room_cleaned | purple |

Note: A milestone can appear in multiple phases (e.g., `incision` is end of Pre-Op AND start of Surgical). This solves the boundary problem.

### NEW TABLE: `phase_definition_templates` (global admin)

Global admin templates that seed new facilities.

```sql
CREATE TABLE public.phase_definition_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,     -- 'pre_op', 'surgical', etc.
  display_name        TEXT NOT NULL,
  display_order       INTEGER NOT NULL,
  start_milestone_type_id  UUID NOT NULL REFERENCES public.milestone_types(id),
  end_milestone_type_id    UUID NOT NULL REFERENCES public.milestone_types(id),
  color_key           TEXT,
  is_active           BOOLEAN DEFAULT true
);
```

When a new facility is created, `phase_definition_templates` are copied into `phase_definitions`, mapping `milestone_type_id` → the facility's corresponding `facility_milestone_id` (via `source_milestone_type_id`).

### NEW TABLE: `surgeon_milestone_config`

Surgeon-level additive/subtractive overrides on top of procedure defaults.

```sql
CREATE TABLE public.surgeon_milestone_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id           UUID NOT NULL REFERENCES public.facilities(id),
  surgeon_id            UUID NOT NULL REFERENCES public.users(id),
  procedure_type_id     UUID NOT NULL REFERENCES public.procedure_types(id),
  facility_milestone_id UUID NOT NULL REFERENCES public.facility_milestones(id),
  is_enabled            BOOLEAN NOT NULL,
  display_order         INTEGER,
  UNIQUE(facility_id, surgeon_id, procedure_type_id, facility_milestone_id)
);
```

**Resolution logic:** For a given surgeon + procedure + facility:
1. Start with `procedure_milestone_config` (the procedure default)
2. LEFT JOIN `surgeon_milestone_config` for this surgeon
3. `COALESCE(surgeon_override.is_enabled, procedure_default.is_enabled)` — surgeon wins when present

### MODIFY: `facility_milestones.phase_group`

**Keep as-is.** `phase_group` remains as a UI display hint (which phase section to show a milestone under in Settings). Phase duration calculations now come from `phase_definitions` instead.

### MODIFY: `create_case_with_milestones()` RPC

Update to merge surgeon overrides:

```sql
INSERT INTO public.case_milestones (case_id, facility_milestone_id, recorded_at, recorded_by)
SELECT
  v_case_id,
  pmc.facility_milestone_id,
  NULL,
  NULL
FROM public.procedure_milestone_config pmc
LEFT JOIN public.surgeon_milestone_config smc
  ON  smc.facility_id = pmc.facility_id
  AND smc.procedure_type_id = pmc.procedure_type_id
  AND smc.facility_milestone_id = pmc.facility_milestone_id
  AND smc.surgeon_id = p_surgeon_id
WHERE pmc.procedure_type_id = p_procedure_type_id
  AND pmc.facility_id = p_facility_id
  AND COALESCE(smc.is_enabled, pmc.is_enabled) = true;
```

### NEW FUNCTION: `get_phase_medians()`

Phase-level medians for universal cross-surgeon comparison.

```sql
get_phase_medians(
  p_facility_id UUID,
  p_procedure_type_id UUID,
  p_surgeon_id UUID
) RETURNS TABLE (
  phase_name          TEXT,
  phase_display_name  TEXT,
  surgeon_median_minutes  NUMERIC,
  surgeon_n               INTEGER,
  facility_median_minutes NUMERIC,
  facility_n              INTEGER
)
```

Calculates: `median(end_milestone.recorded_at - start_milestone.recorded_at)` per phase, grouped by surgeon and facility.

### MODIFY FUNCTION: `get_milestone_interval_medians()`

Add n-count to return values so UI can decide whether to show facility comparison:

```sql
RETURNS TABLE (
  from_milestone_id       UUID,
  to_milestone_id         UUID,
  surgeon_median_minutes  NUMERIC,
  surgeon_n               INTEGER,
  facility_median_minutes NUMERIC,   -- NULL if facility_n < threshold
  facility_n              INTEGER
)
```

### NEW FUNCTION: `seed_facility_phases(facility_id)`

Called when creating a new facility. Copies `phase_definition_templates` → `phase_definitions`, mapping milestone_type_id references to the facility's `facility_milestones` via `source_milestone_type_id`.

---

## Complete Data Hierarchy

```
milestone_types                         (global catalog — read-only reference)
  │
  ├─► phase_definition_templates        (global admin — seeds new facilities)
  │
  └─► facility_milestones               (per-facility milestone definitions)
       │
       ├─► phase_definitions            (per-facility phase boundary config)
       │
       ├─► procedure_milestone_config   (which milestones per procedure)
       │     │
       │     └─► surgeon_milestone_config  (surgeon overrides — additive/subtractive)
       │
       └─► case_milestones              (actual recorded timestamps per case)
              │
              └─► DOWNSTREAM DATA PIPELINE (milestone data flows into all of these)
                   │
                   ├─► cases table (5 denormalized milestone columns)
                   ├─► case_completion_stats (9 timing columns from milestone math)
                   ├─► surgeon_procedure_stats (materialized view — medians)
                   ├─► facility_procedure_stats (materialized view — medians)
                   ├─► surgeon_overall_stats (materialized view — medians)
                   └─► surgeon_scorecards (cached ORbit Scores)
```

---

## Downstream Milestone Data Map

Milestone timestamps don't just live in `case_milestones`. They flow through a pipeline of denormalization, aggregation, and scoring. Every layer must be accounted for when modifying the milestone system.

### Layer 1: `cases` table — 5 Denormalized Milestone Columns

The `cases` table has 5 shortcut columns that duplicate specific milestone timestamps:

| Column | Source Milestone | Used By |
|--------|-----------------|---------|
| `patient_in_at` | patient_in | ORbit Score (case duration start), on-time start calculations |
| `patient_out_at` | patient_out | ORbit Score (case duration end), case completion detection |
| `incision_at` | incision | ORbit Score (surgical start), schedule adherence |
| `prep_drape_complete_at` | prep_drape_complete | ORbit Score (prep-to-incision gap for Availability pillar) |
| `closing_at` | closing | ORbit Score (surgical end), surgical duration |

**Impact:** These are hardcoded to specific milestone names. They work today because every facility has these 5 milestones. If a facility creates a custom boundary milestone that replaces one of these, the denormalized columns wouldn't reflect it. For now this is acceptable — these 5 are universal. But this is a constraint to document.

### Layer 2: `case_completion_stats` — 9 Timing Columns

Written by the `record_case_stats()` trigger when `patient_out` milestone is recorded:

| Column | Milestone Calculation | Downstream Consumers |
|--------|----------------------|---------------------|
| `actual_start_time` | patient_in_at OR incision_at (facility setting) | Mat views, financials |
| `total_duration_minutes` | patient_out - patient_in | Mat views, ORbit Score, financials |
| `surgical_duration_minutes` | closing - incision | Mat views, analytics pages |
| `anesthesia_duration_minutes` | patient_out - patient_in | Mat views |
| `call_to_patient_in_minutes` | patient_in - callback time | Analytics |
| `schedule_variance_minutes` | scheduled_start - actual_start | ORbit Score (Schedule Adherence) |
| `room_turnover_minutes` | this patient_in - prev patient_out (same room) | Analytics, turnover tracking |
| `surgical_turnover_minutes` | same-room surgical turnover | Analytics |
| `scheduled_start_time` | Direct from cases.start_time | Baseline for variance |

**Impact:** These calculations are currently hardcoded in `record_case_stats()`. When we add phase_definitions, we could eventually make these calculations dynamic (e.g., "surgical duration = phase_definitions.surgical.end - phase_definitions.surgical.start"). But for Phase 1, the existing calculations remain valid because the standard boundary milestones don't change.

### Layer 3: Materialized Views (3 views)

Aggregate `case_completion_stats` into median benchmarks:

| View | Granularity | Key Milestone-Derived Columns |
|------|-------------|------------------------------|
| `surgeon_procedure_stats` | Per surgeon × procedure | median total_duration, median surgical_duration, median turnover |
| `facility_procedure_stats` | Per facility × procedure | Same columns at facility level |
| `surgeon_overall_stats` | Per surgeon (all procedures) | Same columns across all procedures |

**Used by:** Case drawer comparison data, full-day financials projections, analytics pages.

### Layer 4: `surgeon_scorecards` — ORbit Score Cache

The `orbitScoreEngine.ts` reads directly from the 5 denormalized columns on `cases`:

| ORbit Score Pillar | Milestone Data Used |
|-------------------|-------------------|
| **Profitability** (30%) | `patient_in_at → patient_out_at` (case duration for margin/minute) |
| **Consistency** (25%) | CV of `patient_in_at → patient_out_at` (case duration variability) |
| **Schedule Adherence** (25%) | `patient_in_at` or `incision_at` vs scheduled start |
| **Availability** (20%) | `prep_drape_complete_at → incision_at` (prep-to-incision gap) |

Results cached in `surgeon_scorecards`, refreshed nightly via Edge Function + pg_cron.

### Layer 5: Client-Side Consumers

| File | What It Reads | Purpose |
|------|--------------|---------|
| `useMilestoneComparison.ts` | case_milestones + get_milestone_interval_medians RPC | Case drawer interval analysis |
| `milestoneAnalytics.ts` | Processed milestone intervals | Time allocation, swimlane visualization |
| `useCaseMetrics.ts` | cases.patient_in_at | On-time start percentage |
| `useFinancialComparison.ts` | case_completion_stats | Financial benchmarking |
| `useCaseDrawer.ts` | surgeon/facility_procedure_stats mat views | Comparison data in case drawer |
| `stale-case-detection.ts` | case_milestones.recorded_at | Missing milestone alerts |
| `dataQuality.ts` | case_milestones completeness | Data quality validation |

### Key Constraints from Downstream Dependencies

1. **The 5 denormalized columns on `cases` are hardcoded to specific milestones.** These are universal milestones that all facilities track. Custom facility boundary milestones won't automatically flow into these columns. This is acceptable for now — document as future enhancement.

2. **`record_case_stats()` triggers on `patient_out` milestone.** It identifies milestones by name (via facility_milestones.name). If a facility renames or replaces "patient_out", the trigger won't fire. Boundary milestones should be name-locked at the DB level.

3. **`orbitScoreEngine.ts` reads column names directly** (`patient_in_at`, `incision_at`, etc.). The engine doesn't go through phase_definitions. This is fine — ORbit Score uses specific milestone intervals, not phases. But it means the 5 universal milestones must always exist.

4. **Materialized views are refreshed by `refresh_case_stats()`.** Adding new phase-level aggregations (e.g., phase duration medians) would require either new materialized views or the `get_phase_medians()` RPC function approach (preferred — more flexible, no refresh dependency).

---

## UI Changes

### 1. Facility Settings: Milestones Page (`/settings/milestones`)

**Current:** Phase-grouped table with drag-to-reorder, add/edit/archive.

**Changes:**
- Add **Phase Boundaries** section at top showing current phase definitions (start → end milestone for each phase)
- Allow facility admins to edit phase boundaries (change which milestones define each phase)
- Add/remove phases (some facilities might want 3 phases, others 5)
- Visual indicator on boundary milestones (distinguishing them from paired/point milestones)
- When creating a custom milestone, allow assigning to a phase group AND specifying if it's a boundary milestone for any phase

### 2. Facility Settings: Procedure Milestones Page (`/settings/procedure-milestones`)

**Current:** Expandable accordion with checkbox grid per procedure.

**Redesign needed** — current page lacks flexibility for the new hierarchy:
- Show milestones grouped by phase within each procedure's config
- Distinguish boundary milestones (always required, cannot be unchecked) from optional milestones
- Show paired milestones as linked pairs (toggling start also toggles end)
- Add procedure-specific custom milestones inline (e.g., "Add milestone to Mako THA's Surgical phase")
- Display order should be configurable per procedure (not just inherit from facility_milestones)
- Show milestone role indicators (boundary / paired / point)

### 3. Facility Settings: Surgeon Milestones Page (`/settings/surgeon-preferences` or new page)

**New page** (or section within existing surgeon-preferences):
- Select surgeon → Select procedure type
- Shows the procedure's default milestones (from `procedure_milestone_config`)
- Checkboxes to enable/disable milestones for this surgeon (creates `surgeon_milestone_config` rows)
- Drag-to-reorder for this surgeon's display_order
- "Reset to procedure defaults" button (deletes all `surgeon_milestone_config` rows for this surgeon + procedure)
- Visual diff: highlight where surgeon config differs from procedure default
- Boundary milestones are locked (cannot be disabled — phases must remain measurable)

### 4. Global Admin: Milestones Page (`/admin/settings/milestones`)

**Current:** Manages `milestone_types` (global templates).

**Changes:**
- Add Phase Definition Templates section
- Configure default phases with boundary milestone mappings
- These templates seed new facilities only (UI should clearly state this)
- Add info banner: "Changes here apply to new facilities only. Existing facilities manage their own milestones."

### 5. Global Admin: Procedure Milestones Page (`/admin/settings/procedure-milestones`)

**Changes:**
- Mirror the facility-level redesign but operating on template tables
- Configure default milestone sets per procedure type
- These seed new facilities' `procedure_milestone_config` on creation

### 6. Case Drawer: Milestone Tab (existing, calculation improvement)

**Changes:**
- TimeAllocationBar now sources durations from `phase_definitions` (boundary milestone timestamps) instead of inferring from `phase_group`
- Milestone comparison toggle shows n-count alongside facility median
- For surgeon-specific milestones with low facility n-count: show "Surgeon median only (tracked by N surgeons)" or similar messaging
- Phase-level summary row at top of milestone table

### 7. Analytics Pages (existing, enhancement)

**Changes:**
- Surgeon comparison views operate at phase level (guaranteed apples-to-apples)
- Drill-down into milestone detail shows comparison only where data is sufficient
- n-count displayed alongside all median values

---

## Files Likely Involved

### Database Migrations
- `supabase/migrations/YYYYMMDD_create_phase_definitions.sql` — new table + seed function
- `supabase/migrations/YYYYMMDD_create_phase_definition_templates.sql` — global admin templates
- `supabase/migrations/YYYYMMDD_create_surgeon_milestone_config.sql` — new table
- `supabase/migrations/YYYYMMDD_update_create_case_with_milestones.sql` — add surgeon override merge
- `supabase/migrations/YYYYMMDD_get_phase_medians.sql` — new DB function
- `supabase/migrations/YYYYMMDD_update_get_milestone_interval_medians.sql` — add n-count

### Settings Pages
- `app/settings/milestones/page.tsx` — add phase boundaries section
- `app/settings/procedure-milestones/page.tsx` — redesign with phase grouping + flexibility
- `app/settings/surgeon-preferences/page.tsx` — add surgeon milestone config (or new page)
- `app/admin/settings/milestones/page.tsx` — add phase definition templates
- `app/admin/settings/procedure-milestones/page.tsx` — mirror facility redesign for templates

### Components
- `components/settings/milestones/MilestonesTable.tsx` — add boundary indicators + phase boundary section
- `components/settings/milestones/PhaseGroupHeader.tsx` — update for phase_definitions
- `components/settings/milestones/MilestoneFormModal.tsx` — add role/type fields
- NEW: `components/settings/milestones/PhaseBoundaryConfig.tsx` — phase boundary editor
- NEW: `components/settings/milestones/SurgeonMilestoneConfig.tsx` — surgeon override UI
- `components/settings/procedure-milestones/` — redesigned components

### Data Layer
- `lib/dal/lookups.ts` — add `phaseDefinitions()`, `surgeonMilestoneConfig()` queries
- `lib/hooks/useMilestoneComparison.ts` — integrate phase medians + n-count
- `lib/utils/milestoneAnalytics.ts` — update time allocation to use phase_definitions
- `lib/milestone-phase-config.ts` — update to source from phase_definitions table instead of hardcoded config
- `lib/utils/inferPhaseGroup.ts` — keep as fallback for custom milestones without explicit phase_group

### Case Display
- `components/cases/CaseDrawerMilestones.tsx` — add phase summary, n-count display
- `components/cases/TimeAllocationBar.tsx` — source from phase_definitions
- `components/cases/MilestoneTimeline.tsx` — update phase coloring from phase_definitions

---

## Testing Strategy

### Enhanced UI-Level Testing (CRUD Operations)

Each phase of implementation must include UI-level tests that simulate real user workflows, not just database function tests. Test the full cycle:

1. **Create** — add a new entity through the UI form, verify it appears in the list, verify it persists in the database
2. **Read** — load the page, verify all entities render correctly with proper grouping/ordering
3. **Edit** — modify an entity through the UI (rename, reorder, change phase, toggle enabled), verify changes persist
4. **Archive** — soft-delete through the UI, verify it disappears from active list, verify it appears in archived section, verify `is_active = false` in DB
5. **Restore** — restore from archived section, verify it reappears in active list

**Test entities to cover:**
- Phase definitions (create, edit boundary milestones, reorder, archive)
- Facility milestones (create custom, edit, reorder within phase, archive, restore)
- Procedure milestone config (enable/disable milestones, add procedure-specific milestones)
- Surgeon milestone config (enable/disable overrides, reorder, reset to defaults)
- Case milestone creation (verify correct milestones created based on surgeon + procedure config)

**Integration tests (cross-entity):**
- Create a custom milestone → assign to a procedure → assign to a surgeon → create a case → verify case_milestones has the right rows
- Archive a milestone → verify it's removed from future case creation but existing cases retain it
- Change phase boundary → verify TimeAllocationBar recalculates correctly
- Surgeon override disables a milestone → create a case → verify milestone is excluded

**Comparison/analytics tests:**
- Record milestones on a case → verify phase medians compute correctly
- Compare two surgeons with different milestone sets → verify phase comparison works, milestone comparison shows appropriate n-count messaging
- Surgeon-specific milestone with n=1 → verify facility comparison shows appropriate fallback message

### Database-Level Tests
- RPC function tests for `create_case_with_milestones()` with surgeon overrides
- `get_phase_medians()` correctness with various data scenarios
- `get_milestone_interval_medians()` n-count accuracy
- `seed_facility_phases()` correctly maps milestone_type_id → facility_milestone_id
- Soft delete cascade behavior (archive milestone → impact on phase_definitions referencing it)

---

## Implementation Phases

### Phase 1: Database Foundation
- Create `phase_definitions` table + migration
- Create `phase_definition_templates` table + migration
- Create `surgeon_milestone_config` table + migration
- Write `seed_facility_phases()` function
- Seed default phase_definition_templates
- Seed phase_definitions for existing facilities (data migration from current phase_group assignments)
- **Tests:** DB function tests + verify data migration correctness

### Phase 2: Phase Boundary UI (Facility Settings)
- Add Phase Boundaries section to `/settings/milestones` page
- `PhaseBoundaryConfig` component: view/edit phase definitions
- Add/remove phases, change boundary milestones, reorder
- DAL queries for phase_definitions CRUD
- **Tests:** Full CRUD cycle for phase definitions through UI

### Phase 3: Phase Boundary UI (Global Admin)
- Add Phase Definition Templates section to `/admin/settings/milestones`
- Mirror facility-level UI but operating on template tables
- Info banner about "new facilities only" behavior
- Update facility creation flow to call `seed_facility_phases()`
- **Tests:** CRUD for templates + verify new facility seeding

### Phase 4: Procedure Milestones Page Redesign
- Redesign `/settings/procedure-milestones` with phase grouping
- Boundary milestone locking (cannot uncheck)
- Paired milestone linking (toggle start toggles end)
- Inline add for procedure-specific custom milestones
- Per-procedure display_order configuration
- **Tests:** Full CRUD cycle + boundary lock verification + paired toggle verification

### Phase 5: Surgeon Milestone Config UI
- New surgeon milestone section/page
- Surgeon + procedure selector
- Enable/disable overrides with visual diff from procedure default
- Drag-to-reorder for surgeon display_order
- "Reset to defaults" functionality
- Boundary milestone lock (surgeons cannot disable phase boundaries)
- **Tests:** Full CRUD cycle + reset to defaults + verify override resolution

### Phase 6: Update Case Creation Pipeline
- Modify `create_case_with_milestones()` to merge surgeon overrides
- Verify case_milestones are created correctly for all config combinations
- **Tests:** Create cases with various surgeon/procedure configs, verify milestone sets

### Phase 7: Phase Medians & Analytics Integration
- Implement `get_phase_medians()` DB function
- Update `get_milestone_interval_medians()` to return n-count
- Update `useMilestoneComparison` hook for phase medians + n-count
- Update TimeAllocationBar to source from phase_definitions
- Update MilestoneTable to show n-count and comparison source messaging
- **Tests:** Analytics accuracy tests + n-count threshold behavior + UI display verification

### Phase 8: Global Admin Procedure Milestones
- Redesign `/admin/settings/procedure-milestones` to mirror facility-level
- Template tables for procedure milestone defaults
- Verify new facility seeding includes procedure milestone config
- **Tests:** CRUD for templates + new facility seeding verification

---

## iOS Parity
- [ ] iOS equivalent needed (eventually — surgeon milestone config, phase-based analytics)
- [x] iOS can wait — web is the admin/configuration platform; iOS consumes the data

## Known Issues / Constraints
- `milestone_types` CREATE TABLE not in migration files (created via Supabase UI before migration tracking started)
- `procedure_milestone_config` CREATE TABLE not in migration files (same reason)
- Some facilities have duplicate sequence_numbers in facility_milestones (sort by display_order, tiebreak on id)
- `cases` table has 8 triggers — modifications to case creation must be tested carefully
- Existing `phase_group` column on `facility_milestones` stays as UI display hint; NOT used for duration calculation
- **5 universal milestones are hardcoded throughout the pipeline:** patient_in, incision, prep_drape_complete, closing, patient_out. These appear as denormalized columns on `cases`, are used by `record_case_stats()`, `orbitScoreEngine.ts`, and materialized views. These 5 milestones must always exist at every facility and cannot be renamed or removed. Custom phase boundaries work alongside these, not as replacements.
- **`record_case_stats()` triggers on the `patient_out` milestone name.** If a facility changes the boundary milestone for the end of their last phase, the trigger still fires on `patient_out`. This is correct behavior — stats should compute when the case is complete.
- **Surgeon scorecards are nightly-refreshed, not real-time.** Changes to milestone data won't be reflected in ORbit Scores until the next nightly run.

## Out of Scope
- Phase-level ORbit Score recalculation (future — once phase medians are stable)
- iOS admin UI for milestone/phase configuration
- Real-time collaborative editing of milestone config (single-user settings pages)
- Milestone recording workflow changes on iOS (iOS records timestamps, config comes from DB)

## Acceptance Criteria
- [ ] Phase definitions table created and seeded for all existing facilities
- [ ] Phase boundary UI functional at facility level (CRUD + reorder)
- [ ] Phase definition templates functional at global admin level
- [ ] New facility creation seeds phase_definitions from templates
- [ ] Surgeon milestone config table created with override resolution logic
- [ ] Surgeon milestone UI functional (enable/disable/reorder/reset)
- [ ] Procedure milestones page redesigned with phase grouping and flexibility
- [ ] `create_case_with_milestones()` correctly merges surgeon overrides
- [ ] `get_phase_medians()` returns accurate phase-level medians with n-count
- [ ] `get_milestone_interval_medians()` returns n-count for UI threshold decisions
- [ ] TimeAllocationBar sources from phase_definitions
- [ ] Case drawer shows appropriate comparison messaging based on n-count
- [ ] Boundary milestones cannot be disabled by surgeons
- [ ] All UI-level CRUD tests pass (create, read, edit, archive, restore)
- [ ] All DB function tests pass
- [ ] No TypeScript `any` types introduced
- [ ] `npm run typecheck && npm run lint && npm run test` passes

---

## Review Q&A

> Generated by /review on 2026-02-16

**Q1:** The spec defines 8 implementation phases. Do you want to implement all 8, or prioritize a subset first?
**A1:** All 8 phases. Full implementation, one phase per session.

**Q2:** The spec has `color_key` on `phase_definitions` storing values like 'blue', 'green'. `milestone-phase-config.ts` already defines rich `PhaseConfig` types with Tailwind classes. Should `color_key` map to these existing configs?
**A2:** Yes — map `color_key` to `PhaseConfig`. DB stores 'blue'/'green'/etc., client resolves to full Tailwind class set via existing `PHASE_CONFIG_MAP` pattern.

**Q3:** The spec introduces a `milestone_role` concept (boundary, paired, point) but no column exists. How should we store/derive it?
**A3:** Derive from existing data. Boundary = referenced in `phase_definitions`. Paired = `pair_with_id IS NOT NULL`. Point = neither. No schema change, computed client-side.

**Q4:** Should the `UNIQUE(facility_id, name)` constraint on `phase_definitions` conflict with soft-deleted rows?
**A4:** Use a partial unique index: `UNIQUE(facility_id, name) WHERE is_active = true`. Facilities can archive phases freely, but cannot delete/archive global milestones.

**Q5:** Where should the Phase Boundary Config UI go on the milestones page?
**A5:** Separate page — `/settings/phases`. Own route under Case Management in settings sidebar.

**Q6:** Tab system within milestones page, new route, or nested routes?
**A6:** Put it under Case Management in settings as its own page.

**Q7:** Where should "Phases" appear in the Case Management nav list?
**A7:** After Milestones (position 3). Order: Procedure Types → Milestones → Phases → Procedure Milestones → ...

**Q8:** For the Phase Boundary Config UI — each phase card has name, start/end milestone dropdowns, color picker, drag handle, archive. When changing a boundary milestone, should we warn about analytics impact?
**A8:** Warning + confirm dialog. Show a confirmation modal explaining the impact on phase duration calculations.

**Q9:** Which milestones should appear in the phase boundary start/end dropdowns?
**A9:** All active milestones in a flat list (sorted by display_order). Any milestone can be a phase boundary. Maximum flexibility.

**Q10:** Should the UI enforce that phases must be contiguous (no gaps)?
**A10:** Don't enforce contiguity. Phases are independent time spans. Gaps between phases are fine.

**Q11:** Where should surgeon milestone config live?
**A11:** New page: `/settings/surgeon-milestones`. Dedicated page under Case Management with its own sidebar nav item.

**Q12:** How should the visual diff for surgeon overrides appear?
**A12:** Prominent row highlight. Rows where surgeon differs from procedure default get amber/yellow background + 'Override' badge.

**Q13:** Should boundary milestones be locked (always checked, not toggleable) per procedure?
**A13:** Yes — locked on for all procedures. Boundary milestones are always checked and greyed out. Phase calculations always have the data they need.

**Q14:** Correct phase boundary definitions (correcting the spec)?
**A14:**
- Pre-Op: patient_in → incision
- Surgical: incision → closing (start)
- Closing: closing → closing_complete
- Post-Op: closing_complete → patient_out
Seed with fallback — if a boundary milestone doesn't exist at a facility, seed fewer phases and log a warning.

**Q15:** Should `get_phase_medians()` follow the same pattern as `get_milestone_interval_medians()`?
**A15:** Yes — same pattern. Validated cases only, PERCENTILE_CONT(0.5), minimum 5 cases before showing facility comparison. Below threshold: grey out + tooltip.

**Q16:** Should TimeAllocationBar switch entirely to phase_definitions-based calculations?
**A16:** Yes — switch to phase_definitions only. Use boundary milestone timestamps. Works retroactively on all existing cases. Remove old phase_group bucketing code.

**Q17:** How should phase summaries appear in the case drawer milestone table?
**A17:** Collapsible phase headers. Phase header rows (e.g., 'Surgical: 40m | Median: 38m | +2m') that expand to show individual milestone rows. Consistent with settings page pattern.

**Q18:** Should milestone display order be customizable at two levels (facility → surgeon) or three (facility → procedure → surgeon)?
**A18:** Three levels: facility → procedure → surgeon. Add `display_order` to `procedure_milestone_config`.

**Q19:** Should case_milestones store resolved display_order, or is ordering a read-time concern?
**A19:** Ordering is read-time only. case_milestones are unordered rows. Display order resolved at read time via COALESCE(surgeon > procedure > facility).

**Q20:** Should global admin phases be a separate page or section within admin milestones?
**A20:** Section within `/admin/settings/milestones`. Phase Definition Templates added as a section on the existing admin milestones page.

**Q21:** Where should `seed_facility_phases()` be called?
**A21:** SQL trigger on facilities table (AFTER INSERT). Automatic, can't be forgotten. Global admin default phases are published to new facilities upon creation.

**Q22:** How should the below-threshold n-count state display in the case drawer?
**A22:** Grey out + tooltip. Show the median value greyed out with tooltip explaining low confidence. Still visible but clearly marked.

**Q23:** Should the procedure milestones page keep the existing paired milestone UX (hide end milestones, auto-toggle)?
**A23:** Keep existing pattern. Hide end milestones, auto-toggle paired milestones. Already proven.

**Q24:** Should new pages follow the same state management pattern (useState + direct Supabase calls)?
**A24:** Yes — same pattern. Local state, direct Supabase calls, optimistic updates. Consistent with existing settings pages.

**Q25:** Should we allow inline milestone creation on the procedure milestones page?
**A25:** No — keep separation. Custom milestones are created on the Milestones page only. Procedure Milestones page just toggles existing milestones. Add a link: 'Need a new milestone? Create one in Milestones settings.'

**Q26:** Should we add drag-to-reorder on the procedure milestones page for per-procedure ordering?
**A26:** Yes — add drag-to-reorder per procedure. Switch from checkbox grid to an ordered list with drag handles + checkboxes.

**Q27:** What should the Phases page empty state look like?
**A27:** Global admin default phases are seeded to new facilities via SQL trigger on creation. Empty state is unlikely under normal usage — add a minimal safety-net message.

**Q28:** Which analytics surfaces should get phase-level comparison treatment in Phase 7?
**A28:** All analytics surfaces — case drawer, surgeon profiles, dashboard, and any comparison views.

**Q29:** Who can edit phases and surgeon milestone configs? What RLS pattern?
**A29:** Facility admin only. Same RLS pattern as existing milestones: admin role can create/edit/archive, all facility members get read access. `phase_definition_templates` is global admin only.
