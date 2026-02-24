# Implementation Plan: Migrate Analytics to Template-Based Phase Resolution

## Summary
Replace `phase_definitions` table (now unmanaged — its UI was deleted) with template-based phase boundary resolution. A new SQL resolver function derives phase boundaries from `milestone_template_items` (first/last item per `facility_phase_id`). A TypeScript adapter wraps this to return the existing `PhaseDefInput[]` interface, so all downstream utility functions and components stay unchanged. Cases gain a `milestone_template_id` column to snapshot which template was used at creation. Both `phase_definitions` and `phase_definition_templates` tables are dropped at the end.

## Interview Notes

| Decision | Answer |
|----------|--------|
| Phase scope | Template-aware — each procedure resolves its own template → phase boundaries |
| Interface approach | Adapter/resolver — new function returns `PhaseDefInput[]`, all utility functions unchanged |
| Median filtering | All cases for procedure — don't filter by template |
| Admin cleanup | Drop `phase_definition_templates` too (redundant with `phase_templates`) |
| Case template snapshot | Add `cases.milestone_template_id` to record template at creation time |
| Seeding | Only seed `facility_phases` — stop seeding `phase_definitions` immediately |

---

## Phase 1: Database — Resolver Function, Cases Column, RPC Updates
**Complexity:** Large
**Commit:** `feat(analytics): phase 1 - template phase resolver, cases.milestone_template_id, RPC rewrites`

### What it does
- **Create `resolve_template_phase_boundaries(p_template_id UUID)`** — SQL function that returns `(phase_id, phase_name, phase_display_name, color_key, display_order, parent_phase_id, start_milestone_id, end_milestone_id)` by:
  - Grouping `milestone_template_items` by `facility_phase_id` for the given template
  - Selecting MIN(display_order) item → `start_milestone_id` (first milestone in phase)
  - Selecting MAX(display_order) item → `end_milestone_id` (last milestone in phase)
  - Joining `facility_phases` for name, color, order, parent
  - Filtering only active phases with items in the template
- **Add `milestone_template_id UUID REFERENCES milestone_templates(id)` to `cases` table** (nullable)
- **Update `create_case_with_milestones()`** — after resolving the template via cascade, stamp `milestone_template_id` on the case row
- **Update `finalize_draft_case()`** — same: stamp `milestone_template_id` on the case
- **Backfill existing cases** — resolve template via cascade (surgeon override → procedure type → facility default) and set `milestone_template_id`
- **Rewrite `get_phase_medians()`** — instead of querying `phase_definitions`, accept an additional `p_milestone_template_id` parameter. Use `resolve_template_phase_boundaries(p_milestone_template_id)` to get phase boundaries. If template_id is NULL, resolve from procedure_type → facility default. Median logic stays the same (all cases for procedure, not filtered by template).
- **Remove `seed_facility_phases()` call from `seed_facility_with_templates()`** — delete PART 14. `facility_phases` seeding (PART 15) already handles this.
- **Drop `seed_facility_phases()` function** and the `on_facility_created_seed_phases` trigger

### Files touched
- `supabase/migrations/YYYYMMDD_template_phase_resolver.sql` (new)

### Test gate
1. **Unit:** `resolve_template_phase_boundaries()` returns correct boundaries for a template with phases; handles shared boundaries (same milestone in 2 phases); handles templates with unphased items; returns empty for template with no phases
2. **Integration:** `create_case_with_milestones()` stamps `milestone_template_id`; `finalize_draft_case()` stamps it; backfill populates existing cases; `get_phase_medians()` returns correct medians using template resolver
3. **Workflow:** Create case → verify `milestone_template_id` set → call `get_phase_medians` with case's template → verify phase durations computed correctly

---

## Phase 2: TypeScript Adapter + Frontend Consumer Updates
**Complexity:** Large
**Commit:** `feat(analytics): phase 2 - TypeScript adapter, update all frontend consumers`

### What it does
- **Create `resolvePhaseDefsFromTemplate()` adapter** in `lib/dal/lookups.ts` (or new file):
  - Input: `supabase`, `templateId`
  - Queries `milestone_template_items` grouped by `facility_phase_id`, joins `facility_phases` and `facility_milestones`
  - Returns `PhaseDefInput[]` with derived `start_milestone_id` / `end_milestone_id` (first/last per phase)
  - Includes `start_milestone` and `end_milestone` joined objects for `PhaseDefinitionWithMilestones[]` variant (used by `useMilestoneComparison`)
- **Create `resolveTemplateForCase()` helper**:
  - Input: case (with procedure_type_id, surgeon_id, facility_id, milestone_template_id)
  - Returns template_id: uses `case.milestone_template_id` if set, otherwise resolves via cascade
- **Update `useMilestoneComparison` hook**:
  - Replace `phase_definitions` query with: resolve template for case → `resolvePhaseDefsFromTemplate(templateId)`
  - Update `get_phase_medians` RPC call to pass `p_milestone_template_id`
  - All downstream processing (calculatePhaseTimeAllocation, buildPhaseGroups, etc.) unchanged — adapter returns same shape
- **Update `app/analytics/surgeons/page.tsx`**:
  - Replace `phase_definitions` query with template resolution
  - For the day analysis: resolve template per case (or use default template for the selected procedure)
  - `computePhaseDurations()` and `computeSubphaseOffsets()` calls unchanged
- **Update `components/analytics/financials/SurgeonDetail.tsx`**:
  - Replace `phase_definitions` query with template resolution
  - Phase duration pills use same `computePhaseDurations()` interface
- **Update `lib/dal/lookups.ts`**:
  - Remove (or deprecate) `lookupsDAL.phaseDefinitions()` — replaced by adapter
- **Update `app/admin/facilities/new/actions.ts`**:
  - Remove `phase_definitions` from template_config (no longer seeded)
- **Update `app/admin/facilities/new/page.tsx`**:
  - Remove `facility_phase_definitions` count query (used for provisioning summary)

### Files touched
- `lib/dal/lookups.ts` (modify — add adapter, remove old function)
- `lib/hooks/useMilestoneComparison.ts` (modify — use adapter)
- `app/analytics/surgeons/page.tsx` (modify — use adapter)
- `components/analytics/financials/SurgeonDetail.tsx` (modify — use adapter)
- `app/admin/facilities/new/actions.ts` (modify — remove phase_definitions config)
- `app/admin/facilities/new/page.tsx` (modify — remove count query)

### Test gate
1. **Unit:** Adapter returns correct `PhaseDefInput[]` from template items; shared boundary produces correct start/end; empty template returns empty array; `resolveTemplateForCase` cascade works (snapshot > procedure > default)
2. **Integration:** `useMilestoneComparison` returns same data shape as before; surgeons page phase bars render correctly; SurgeonDetail phase pills compute correct durations; facility creation works without `phase_definitions` config
3. **Workflow:** Open case drawer → verify TimeAllocationBar shows phases → verify phase groups render with correct colors and durations → navigate to surgeons page → verify CasePhaseBar renders → navigate to financial surgeon detail → verify phase pills render

---

## Phase 3: Drop Tables + Dead Code Cleanup
**Complexity:** Medium
**Commit:** `feat(analytics): phase 3 - drop phase_definitions, cleanup dead code`

### What it does
- **Migration to drop tables:**
  - Drop `phase_definitions` table (cascade)
  - Drop `phase_definition_templates` table (cascade)
  - Drop `seed_facility_phases()` function (if not already dropped in Phase 1)
  - Drop `trigger_seed_facility_phases()` function
  - Drop the `on_facility_created_seed_phases` trigger
- **Remove `PhaseDefinition` interface from `lib/dal/lookups.ts`** (if still present)
- **Remove `lookupsDAL.phaseDefinitions()`** (if deprecated in Phase 2 but not deleted)
- **Remove `phaseDefinitionAudit` from `lib/audit-logger.ts`** (no longer used — old phases page was deleted)
- **Update `lib/milestone-phase-config.ts`** — remove comment references to `phase_definitions`
- **Update `lib/analyticsV2.ts`** — remove deprecated function `@deprecated` references to `phase_definitions`
- **Update test files** (6 files) — update mock data shapes if needed (PhaseDefInput interface is preserved, so most tests should be unchanged; verify and fix any that import phase_definitions-specific types)
- **Remove facility creation template config references:**
  - `app/admin/facilities/new/__tests__/actions.test.ts` — remove `phase_definitions` from mock config
  - `app/admin/facilities/new/__tests__/ClinicalTemplatesStep.test.tsx` — remove phase_definitions count if present
  - `app/admin/facilities/new/__tests__/ReviewStep.test.tsx` — same
- **Final verification:** `npm run typecheck && npm run lint && npm run test`

### Files touched
- `supabase/migrations/YYYYMMDD_drop_phase_definitions.sql` (new)
- `lib/dal/lookups.ts` (cleanup)
- `lib/audit-logger.ts` (remove phaseDefinitionAudit)
- `lib/milestone-phase-config.ts` (update comments)
- `lib/analyticsV2.ts` (update comments)
- Test files (update mocks if needed)
- Facility creation test files (remove phase_definitions references)

### Test gate
1. **Unit:** All remaining tests pass; no TypeScript errors; no lint errors; no dead imports
2. **Integration:** Analytics pages load correctly; case drawer renders phases; facility creation works end-to-end without phase_definitions
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` — all green

---

## Dependency Graph
```
Phase 1 (DB: resolver, cases column, RPCs) ──► Phase 2 (TS adapter, frontend updates)
                                              ──► Phase 3 (Drop tables, cleanup)
```

---

## Session Log
<!-- Entries added by /wrap-up -->
