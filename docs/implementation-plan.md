# Implementation Plan: Milestone Hierarchy Redesign

## Summary

Redesign the milestone system to support a three-level hierarchy: facility phases (defined by boundary milestones), procedure-level milestone configuration with per-procedure ordering, and surgeon-level overrides. This enables universal phase-level analytics for cross-surgeon comparison alongside detailed milestone-level tracking for self-improvement. All configuration is manageable through both global admin (templates for new facilities) and facility admin (per-facility customization) UIs.

## Key Decisions from Review

- **Milestone role** is derived, not stored: boundary = in phase_definitions, paired = pair_with_id IS NOT NULL, point = neither
- **Phases page** is a new route `/settings/phases` under Case Management in settings sidebar (position 3, after Milestones)
- **Surgeon milestones page** is a new route `/settings/surgeon-milestones` under Case Management
- **Admin phases** are a section within the existing `/admin/settings/milestones` page
- **Correct default phase boundaries**: Pre-Op (patient_in→incision), Surgical (incision→closing), Closing (closing→closing_complete), Post-Op (closing_complete→patient_out)
- **Three-level display ordering**: facility → procedure → surgeon, with `display_order` added to `procedure_milestone_config`
- **Boundary milestones locked** on procedure and surgeon config pages (always checked, greyed out)
- **Phase contiguity not enforced** — phases are independent time spans, gaps allowed
- **TimeAllocationBar** switches entirely to phase_definitions (no phase_group fallback)
- **N-count threshold = 5** for facility comparison; below threshold: grey out + tooltip
- **State management**: useState + direct Supabase calls (existing pattern)
- **RLS**: facility admin for phase_definitions + surgeon_milestone_config; global admin for phase_definition_templates

---

## Supabase Branch (Development Database)

All database migrations are developed and tested against an isolated Supabase branch before touching production.

| Field | Value |
|-------|-------|
| Branch name | `feature/milestone-hierarchy-redesign` |
| Branch ID | `pytonqwejaxagwywvitb` |
| Pooler host | `aws-0-us-west-2.pooler.supabase.com` |
| User | `postgres.pytonqwejaxagwywvitb` |
| Password | `oKjKolOVlubRoHMbnWsTXHThSYkOvoFQ` |
| State | Full clone — schema + production data |

**Push migrations to branch:**
```bash
supabase db push --db-url "postgresql://postgres.pytonqwejaxagwywvitb:oKjKolOVlubRoHMbnWsTXHThSYkOvoFQ@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
```

**Connect via psql:**
```bash
PGPASSWORD='oKjKolOVlubRoHMbnWsTXHThSYkOvoFQ' /opt/homebrew/opt/libpq/bin/psql "sslmode=require host=aws-0-us-west-2.pooler.supabase.com port=5432 user=postgres.pytonqwejaxagwywvitb dbname=postgres"
```

**Switch dev server between production and branch:**
```bash
./switch-db.sh              # shows which DB you're on
./switch-db.sh branch       # switch to branch DB
./switch-db.sh production   # switch back to production
```
Restart `npm run dev` after switching. The script swaps `.env.local` between `.env.production` and `.env.branch`.

**Workflow per phase:**
1. Write migration file locally → push to branch → `./switch-db.sh branch` → `npm run dev` → test UI against real data → commit

---

## Phase 1: Database Foundation

**What it does:** Creates the three new tables (`phase_definitions`, `phase_definition_templates`, `surgeon_milestone_config`), adds `display_order` to `procedure_milestone_config`, creates the `seed_facility_phases()` function + AFTER INSERT trigger on facilities, seeds templates and migrates existing facilities to have phase definitions.

**Complexity:** Large

**Files touched:**
- `supabase/migrations/YYYYMMDD_phase_definitions.sql` — NEW: `phase_definitions` table, `phase_definition_templates` table, partial unique index, RLS policies
- `supabase/migrations/YYYYMMDD_surgeon_milestone_config.sql` — NEW: `surgeon_milestone_config` table, RLS policies
- `supabase/migrations/YYYYMMDD_procedure_milestone_display_order.sql` — ADD: `display_order` column to `procedure_milestone_config`
- `supabase/migrations/YYYYMMDD_seed_facility_phases.sql` — NEW: `seed_facility_phases()` function, AFTER INSERT trigger on facilities, seed `phase_definition_templates` with 4 default phases, backfill `phase_definitions` for all existing facilities

**Migration details:**

`phase_definitions`:
```sql
CREATE TABLE public.phase_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id         UUID NOT NULL REFERENCES public.facilities(id),
  name                TEXT NOT NULL,
  display_name        TEXT NOT NULL,
  display_order       INTEGER NOT NULL,
  start_milestone_id  UUID NOT NULL REFERENCES public.facility_milestones(id),
  end_milestone_id    UUID NOT NULL REFERENCES public.facility_milestones(id),
  color_key           TEXT,
  is_active           BOOLEAN DEFAULT true,
  deleted_at          TIMESTAMPTZ
);
CREATE UNIQUE INDEX phase_definitions_facility_name_active
  ON public.phase_definitions(facility_id, name) WHERE is_active = true;
```

`phase_definition_templates`:
```sql
CREATE TABLE public.phase_definition_templates (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL UNIQUE,
  display_name             TEXT NOT NULL,
  display_order            INTEGER NOT NULL,
  start_milestone_type_id  UUID NOT NULL REFERENCES public.milestone_types(id),
  end_milestone_type_id    UUID NOT NULL REFERENCES public.milestone_types(id),
  color_key                TEXT,
  is_active                BOOLEAN DEFAULT true
);
```

`surgeon_milestone_config`:
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

Default phase templates (seeded in migration):
| Phase | start_milestone | end_milestone | color_key |
|-------|----------------|---------------|-----------|
| Pre-Op | patient_in | incision | blue |
| Surgical | incision | closing | green |
| Closing | closing | closing_complete | amber |
| Post-Op | closing_complete | patient_out | purple |

`seed_facility_phases(p_facility_id)` function: copies `phase_definition_templates` → `phase_definitions`, mapping `milestone_type_id` → `facility_milestone_id` via `source_milestone_type_id`. Skips phases where a boundary milestone doesn't exist at the facility (logs via RAISE NOTICE).

Backfill: runs `seed_facility_phases()` for every existing facility.

AFTER INSERT trigger on `facilities`: calls `seed_facility_phases(NEW.id)`.

**Commit message:** `feat(milestones): phase 1 - database foundation for milestone hierarchy`

**3-stage test gate:**
1. **Unit:** Verify all tables created with correct columns, constraints, and indexes. Verify RLS policies. Verify `seed_facility_phases()` function handles both complete and partial milestone sets.
2. **Integration:** Run `seed_facility_phases()` for existing facilities, verify `phase_definitions` rows match expected boundaries. Verify AFTER INSERT trigger fires on new facility creation.
3. **Workflow:** Create a new facility → verify it gets default phase_definitions seeded from templates. Verify `surgeon_milestone_config` accepts rows with proper FK constraints.

---

## Phase 2: Phase Boundary UI (Facility Settings)

**What it does:** Creates the new `/settings/phases` page with full CRUD for phase definitions. Phase cards with drag-to-reorder, start/end milestone dropdowns, color picker, add/archive phases, and confirmation dialog when changing boundaries.

**Complexity:** Large

**Files touched:**
- `app/settings/phases/page.tsx` — NEW: phases settings page
- `components/settings/phases/PhaseCard.tsx` — NEW: draggable phase card with name, start/end dropdowns, color picker, archive button
- `components/settings/phases/PhaseFormModal.tsx` — NEW: modal for adding new phases
- `components/settings/phases/ArchivedPhasesSection.tsx` — NEW: archived phases with restore
- `lib/settings-nav-config.ts` — ADD: "Phases" nav item after Milestones in Case Management
- `lib/milestone-phase-config.ts` — EXTEND: add color key → PhaseConfig resolver for DB-stored color_key values
- `lib/dal/lookups.ts` — ADD: `phaseDefinitions()` query

**Page structure:**
1. Header: "Phases" + "Add Phase" button
2. Error banner (if any)
3. DndContext with SortableContext — list of PhaseCard components
4. ArchivedPhasesSection

**PhaseCard UI:**
- Drag handle (GripVertical, same as MilestoneRow)
- Phase name (editable inline or via click)
- Start milestone dropdown (all active facility milestones, flat list, sorted by display_order)
- "→" arrow
- End milestone dropdown (same list)
- Color swatch/picker (from predefined palette: blue, green, amber, purple, teal, indigo, rose, slate)
- Archive button (with usage warning)
- Changing a boundary milestone triggers ConfirmDialog: "Changing this boundary will affect how phase durations are calculated for all cases. Historical analytics will recalculate."

**Commit message:** `feat(milestones): phase 2 - facility phase boundary UI with CRUD + reorder`

**3-stage test gate:**
1. **Unit:** PhaseCard renders correctly with milestone names. PhaseFormModal validates required fields. Color picker shows palette. Archived section shows/hides.
2. **Integration:** Create a phase → verify it appears in DB. Edit boundary milestone → verify confirm dialog appears → verify DB update. Archive → verify soft delete. Restore → verify reactivation. Reorder → verify display_order updates.
3. **Workflow:** Load phases page with default 4 phases → edit Surgical phase end milestone → confirm dialog → save → verify milestone table on milestones page reflects the phase change context.

---

## Phase 3: Phase Boundary UI (Global Admin)

**What it does:** Adds Phase Definition Templates section to the existing `/admin/settings/milestones` page. Mirrors facility-level UI but operates on `phase_definition_templates` table. Info banner about "new facilities only" behavior.

**Complexity:** Medium

**Files touched:**
- `app/admin/settings/milestones/page.tsx` — MODIFY: add Phase Definition Templates section
- `components/settings/phases/PhaseTemplateSection.tsx` — NEW: section component for admin page showing phase templates with CRUD
- `components/settings/phases/PhaseTemplateCard.tsx` — NEW: template card (similar to PhaseCard but uses milestone_types instead of facility_milestones)
- `components/settings/phases/PhaseTemplateFormModal.tsx` — NEW: add/edit modal for templates

**Section placement:** Above the existing milestone types table on the admin milestones page. Info banner: "Phase templates define the default phases for new facilities. Changes here do not affect existing facilities."

**Key difference from facility-level:** Dropdowns show `milestone_types` (global catalog) instead of `facility_milestones`.

**Commit message:** `feat(milestones): phase 3 - global admin phase definition templates`

**3-stage test gate:**
1. **Unit:** PhaseTemplateSection renders with correct milestone_types in dropdowns. Info banner displays. CRUD operations on templates.
2. **Integration:** Create/edit/archive templates → verify DB changes. Verify templates use milestone_type_id references correctly.
3. **Workflow:** Edit a phase template → create a new facility → verify the facility's phase_definitions reflect the updated template (via the AFTER INSERT trigger + seed function).

---

## Phase 4: Procedure Milestones Page Redesign

**What it does:** Redesigns `/settings/procedure-milestones` from a flat checkbox grid to phase-grouped, drag-to-reorder ordered lists per procedure. Boundary milestones are locked on. Paired milestone auto-toggle preserved. `display_order` on `procedure_milestone_config` is used for per-procedure ordering. Link to milestones page for creating new milestones.

**Complexity:** Large

**Files touched:**
- `app/settings/procedure-milestones/page.tsx` — REWRITE: new layout with phase-grouped drag-reorder lists
- `components/settings/procedure-milestones/ProcedureMilestoneList.tsx` — NEW: ordered list with drag handles + checkboxes per procedure, grouped by phase
- `components/settings/procedure-milestones/ProcedureMilestoneRow.tsx` — NEW: draggable row with checkbox, lock indicator for boundaries, pair indicator
- `components/settings/procedure-milestones/PhaseSection.tsx` — NEW: phase group header within procedure accordion

**UX changes:**
- Expand procedure accordion → see milestones grouped by phase (Pre-Op section, Surgical section, etc.)
- Each milestone row: drag handle | checkbox | milestone name | role indicator (boundary lock icon, paired link, point dot)
- Boundary milestones: checkbox is checked + greyed out, lock icon, tooltip "Required for phase tracking"
- Paired milestones: hide `pair_position = 'end'`, auto-toggle pair on check/uncheck (existing logic)
- Drag-to-reorder within phase groups (saves to `procedure_milestone_config.display_order`)
- Bottom of each procedure: link "Need a new milestone? Create one in Milestones settings →"
- Bulk actions preserved: "Select All", "Clear All" (skipping locked boundary milestones)

**Commit message:** `feat(milestones): phase 4 - procedure milestones redesign with phase grouping + ordering`

**3-stage test gate:**
1. **Unit:** ProcedureMilestoneRow renders locked state for boundary milestones. Drag handle functions within phase groups. Pair indicator shows correctly.
2. **Integration:** Toggle milestone → verify procedure_milestone_config update. Verify boundary milestones can't be unchecked. Reorder milestones within a phase → verify display_order saved. Paired milestone toggle → verify both start+end toggle.
3. **Workflow:** Open procedure milestones → expand a procedure → verify milestones grouped by phase → reorder within Surgical → save → create a case for this procedure → verify case_milestones appear in the reordered display_order.

---

## Phase 5: Surgeon Milestone Config UI

**What it does:** Creates the new `/settings/surgeon-milestones` page. Surgeon selector → procedure selector → shows procedure defaults with override toggles. Drag-to-reorder for surgeon-specific ordering. Prominent amber highlight for overrides. Reset to defaults button. Boundary milestones locked.

**Complexity:** Large

**Files touched:**
- `app/settings/surgeon-milestones/page.tsx` — NEW: surgeon milestones settings page
- `components/settings/surgeon-milestones/SurgeonMilestoneConfig.tsx` — NEW: main config component with surgeon+procedure selectors
- `components/settings/surgeon-milestones/SurgeonMilestoneRow.tsx` — NEW: milestone row with override toggle, default indicator, drag handle
- `lib/settings-nav-config.ts` — ADD: "Surgeon Milestones" nav item in Case Management (after Surgeon Preferences)
- `lib/dal/lookups.ts` — ADD: `surgeonMilestoneConfig()` query

**Page structure:**
1. Header: "Surgeon Milestones"
2. Surgeon dropdown (all surgeons at facility)
3. Procedure type dropdown (appears after surgeon selected)
4. Once both selected: milestone list grouped by phase
5. Each row: drag handle | toggle | milestone name | "Default: enabled/disabled" | override badge (amber)
6. Boundary milestones: toggle locked on, greyed out, tooltip "Required for phase tracking — cannot be overridden"
7. Override rows: amber/yellow-50 background + "Override" badge
8. "Reset to Procedure Defaults" button — clears all surgeon_milestone_config rows for this surgeon+procedure
9. Footer: counts showing "N overrides active"

**Commit message:** `feat(milestones): phase 5 - surgeon milestone config UI with overrides`

**3-stage test gate:**
1. **Unit:** SurgeonMilestoneRow renders override highlight. Boundary milestones show locked state. Reset button appears when overrides exist.
2. **Integration:** Toggle a milestone → verify surgeon_milestone_config row created. Toggle back to match default → verify row removed (no unnecessary overrides). Reset to defaults → verify all config rows deleted. Boundary toggle → verify it can't be changed.
3. **Workflow:** Select surgeon → select procedure → override 2 milestones → verify amber highlights → reset to defaults → verify all highlights gone → re-override → create a case for this surgeon+procedure → verify case_milestones reflect the surgeon's config.

---

## Phase 6: Update Case Creation Pipeline

**What it does:** Modifies `create_case_with_milestones()` RPC to merge surgeon overrides from `surgeon_milestone_config`. Uses `COALESCE(surgeon.is_enabled, procedure.is_enabled)` resolution. Display order remains read-time only.

**Complexity:** Small

**Files touched:**
- `supabase/migrations/YYYYMMDD_update_create_case_with_milestones.sql` — MODIFY: add LEFT JOIN to surgeon_milestone_config in the case_milestones INSERT

**Updated query in `create_case_with_milestones()`:
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

**Commit message:** `feat(milestones): phase 6 - surgeon override merge in case creation pipeline`

**3-stage test gate:**
1. **Unit:** RPC function handles: no surgeon config (uses procedure defaults), surgeon enables extra milestone, surgeon disables a milestone, surgeon has no overrides for this procedure.
2. **Integration:** Create cases with various surgeon+procedure configs → verify case_milestones rows match expected enabled set. Verify boundary milestones always present (since they're locked at config level).
3. **Workflow:** Configure surgeon overrides on UI (Phase 5) → create a case via the web app → open case drawer → verify milestone list matches the surgeon's customized config.

---

## Phase 7: Phase Medians & Analytics Integration

**What it does:** Implements `get_phase_medians()` DB function, updates `get_milestone_interval_medians()` to return n-count, updates the case drawer (TimeAllocationBar, MilestoneTable with collapsible phase headers, n-count display with grey-out), updates useMilestoneComparison hook. Updates all analytics surfaces with phase-level comparison.

**Complexity:** Large

**Files touched:**
- `supabase/migrations/YYYYMMDD_get_phase_medians.sql` — NEW: `get_phase_medians()` function
- `supabase/migrations/YYYYMMDD_update_milestone_interval_medians.sql` — MODIFY: add `surgeon_n`, `facility_n` to return type
- `lib/hooks/useMilestoneComparison.ts` — MODIFY: add phase medians fetch, n-count handling, phase definitions fetch
- `lib/utils/milestoneAnalytics.ts` — MODIFY: replace `calculateTimeAllocation` to use phase_definitions (boundary milestone timestamps), add phase median types, remove old phase_group bucketing
- `components/cases/TimeAllocationBar.tsx` — MODIFY: source from phase_definitions-based allocations
- `components/cases/MilestoneDetailRow.tsx` — MODIFY: add collapsible phase header rows with phase duration + median + delta
- `components/cases/CaseDrawerMilestones.tsx` — MODIFY: pass phase data, handle n-count threshold display
- `components/cases/MilestoneComparisonToggle.tsx` — MODIFY: show n-count, grey-out facility option when n < 5 with tooltip
- `lib/milestone-phase-config.ts` — MODIFY: extend color resolution to work with phase_definitions color_key

**`get_phase_medians()` function:**
- Parameters: `p_facility_id`, `p_procedure_type_id`, `p_surgeon_id`
- Returns: `phase_name, phase_display_name, color_key, display_order, surgeon_median_minutes, surgeon_n, facility_median_minutes, facility_n`
- Logic: JOIN `phase_definitions` with `case_milestones` to get boundary milestone timestamps, calculate `end - start` per phase per case, then `PERCENTILE_CONT(0.5)` grouped by surgeon and facility
- Only validated cases (`data_validated = true`)
- `facility_median_minutes` = NULL when `facility_n < 5`

**Collapsible phase headers in MilestoneTable:**
- Phase header row: colored left border + phase name + total duration + median + delta badge
- Click to expand/collapse individual milestone rows within that phase
- Default: expanded

**N-count display:**
- MilestoneComparisonToggle: "Facility Median (n=12)" or "Facility Median (n=3)" greyed out with tooltip "Minimum 5 cases recommended for reliable comparison"
- Individual median values: when n < 5, show greyed out with tooltip

**Commit message:** `feat(milestones): phase 7 - phase medians, analytics integration, n-count display`

**3-stage test gate:**
1. **Unit:** `get_phase_medians()` returns correct medians for known data. `calculateTimeAllocation` uses phase_definitions boundaries. Phase header rows render with correct totals. N-count grey-out works below threshold.
2. **Integration:** Record milestones on a case → call `get_phase_medians()` → verify surgeon and facility medians. Verify n-count accuracy. Verify TimeAllocationBar renders correct proportions from phase_definitions.
3. **Workflow:** Open case drawer for a completed case → verify TimeAllocationBar shows phases from phase_definitions → verify MilestoneTable has collapsible phase headers → toggle to facility median → verify n-count display → verify grey-out when data insufficient.

---

## Phase 8: Global Admin Procedure Milestones Redesign

**What it does:** Redesigns `/admin/settings/procedure-milestones` to mirror the facility-level redesign (Phase 4) but operating on template tables. Phase-grouped, ordered lists with drag-to-reorder. Verifies new facility seeding includes procedure milestone config.

**Complexity:** Medium

**Files touched:**
- `app/admin/settings/procedure-milestones/page.tsx` — REWRITE: phase-grouped drag-reorder layout matching facility-level design
- `components/settings/procedure-milestones/ProcedureMilestoneList.tsx` — EXTEND: support template mode (milestone_types instead of facility_milestones, procedure_type_templates instead of procedure_types)
- `components/settings/procedure-milestones/ProcedureMilestoneRow.tsx` — EXTEND: support template mode

**Key differences from facility-level:**
- Uses `milestone_types` instead of `facility_milestones`
- Uses `procedure_type_templates` instead of `procedure_types`
- Uses `procedure_milestone_templates` instead of `procedure_milestone_config`
- Info banner: "Template configurations only apply during facility creation. Existing facilities are NOT affected."
- Phase groups come from `phase_definition_templates` instead of `phase_definitions`

**Commit message:** `feat(milestones): phase 8 - admin procedure milestones redesign with phase grouping`

**3-stage test gate:**
1. **Unit:** Admin page renders with milestone_types and procedure_type_templates. Phase grouping matches phase_definition_templates. Boundary lock uses template phase definitions.
2. **Integration:** Toggle milestone template → verify procedure_milestone_templates update. Reorder → verify display_order saved. Verify boundary milestones locked based on phase_definition_templates.
3. **Workflow:** Edit admin procedure milestone templates → create a new facility → verify the facility's procedure_milestone_config matches the template configuration including display_order.

---

## Phase Summary

| Phase | Description | Complexity | Key Files |
|-------|------------|------------|-----------|
| 1 | Database Foundation | Large | 4 migration files |
| 2 | Facility Phase Boundary UI | Large | 5 new files, 2 modified |
| 3 | Global Admin Phase Templates | Medium | 1 modified, 4 new components |
| 4 | Procedure Milestones Redesign | Large | 1 rewrite, 3 new components |
| 5 | Surgeon Milestone Config UI | Large | 4 new files, 2 modified |
| 6 | Case Creation Pipeline Update | Small | 1 migration file |
| 7 | Phase Medians & Analytics | Large | 2 migrations, 7 modified files |
| 8 | Admin Procedure Milestones | Medium | 1 rewrite, 2 extended components |

**Dependencies:** Phase 1 → all others. Phase 2 → Phase 3 (shared components). Phase 4 → Phase 8 (shared components). Phase 5 → Phase 6 (surgeon config must exist before case creation uses it). Phase 2 + 4 → Phase 7 (phase_definitions must exist for analytics).

---

## Session Log

### Phase 1 — COMPLETE
- **Commit:** `fdddc43` feat(milestones): phase 1 - database foundation for milestone hierarchy
- **Fix commit:** `62eae83` fix(milestones): add missing sync_soft_delete trigger to phase_definitions
- **Tables created:** phase_definitions, phase_definition_templates, surgeon_milestone_config
- **Seed:** 4 default phase templates, backfilled all 6 facilities with 4 phases each
- **Trigger:** on_facility_created_seed_phases (AFTER INSERT on facilities)
- **Note:** procedure_milestone_config.display_order already existed in baseline — no migration needed

### Phase 2 — COMPLETE
- **Commit:** `ead5507` feat(milestones): phase 2 - facility phase boundary UI with CRUD + reorder
- **New route:** /settings/phases with PhaseCard, PhaseFormModal, ArchivedPhasesSection
- **Nav:** Added "Phases" to settings-nav-config.ts under Case Management

### Phase 3 — COMPLETE
- **Commit:** `8ad01ea` feat(milestones): phase 3 - global admin phase definition templates
- **New components:** PhaseTemplateSection, PhaseTemplateCard, PhaseTemplateFormModal
- **Modified:** /admin/settings/milestones page with Phase Definition Templates section

### Phase 4 — COMPLETE
- **Commit:** `6da68c6` feat(milestones): phase 4 - procedure milestones redesign with phase grouping + ordering
- **Rewritten:** /settings/procedure-milestones — flat checkbox grid → phase-grouped drag-to-reorder lists
- **New components:** PhaseSection, ProcedureMilestoneList, ProcedureMilestoneRow
- **Tests:** 25 new tests (PhaseSection 7, ProcedureMilestoneRow 11, ProcedureMilestoneList 7)
- **Boundary milestones:** Locked on (checked + greyed out + lock icon), derived from phase_definitions

### Phase 5 — PENDING (next)
### Phase 6 — PENDING
### Phase 7 — PENDING
### Phase 8 — PENDING
