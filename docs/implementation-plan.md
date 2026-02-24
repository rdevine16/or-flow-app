# Implementation Plan: Milestone Template Cascade Fix & Existing Case Reconciliation

## Summary
Fix the 3 places where the milestone template cascade ignores surgeon overrides: case detail page, `useMilestoneComparison` hook's `expectedNames` query, and the `get_milestone_interval_medians()` RPC. The correct 4-tier resolver (`resolveTemplateForCase`) already exists in `lib/dal/phase-resolver.ts` — the frontend fixes just need to use it. The RPC needs a SQL migration. Tests are written alongside each phase.

## Interview Notes
- **Phase 3 (analytics audit):** Scan confirmed all analytics pages already use correct resolvers (`batchResolveTemplatesForCases`, `resolveDefaultPhaseDefsForFacility`). `get_phase_medians()` receives `p_milestone_template_id` from TypeScript (pre-resolved). Simplified to quick verification pass merged into Phase 2.
- **Phase ordering:** Frontend first (Phase 1), then RPC + audit (Phase 2). User wants to see UI fixes immediately.
- **Test strategy:** Tests written alongside each phase, not in a dedicated final phase.
- **Guard clause:** Keep requiring both `procedureTypeId` AND `facilityId` in `expectedNames` query (don't relax to facilityId-only).
- **CaseForm.tsx:** 2-step cascade is validation-only (checking if ANY template exists). Leave as-is.
- **Demo generator:** Custom 3-tier batch resolver is correct and performance-optimized. Leave as-is.

## Codebase Scan Findings
| Component | Status | Action |
|---|---|---|
| `app/cases/[id]/page.tsx` (lines 209-232) | 2-step inline cascade, missing surgeon override | **Fix in Phase 1** |
| `useMilestoneComparison.ts` `expectedNames` (lines 118-161) | 2-step inline cascade, missing surgeon override | **Fix in Phase 1** |
| `useMilestoneComparison.ts` `phaseDefinitions` + `phaseMedians` | Already uses `resolveTemplateForCase` | No change |
| `get_milestone_interval_medians()` RPC | 2-tier CTE, ignores `p_surgeon_id` for template | **Fix in Phase 2** |
| `get_phase_medians()` RPC | Receives `p_milestone_template_id` (pre-resolved in TS) | No change |
| `app/analytics/surgeons/page.tsx` | Uses `batchResolveTemplatesForCases` | No change |
| `components/analytics/financials/SurgeonDetail.tsx` | Uses `resolveDefaultPhaseDefsForFacility` | No change |
| `CaseForm.tsx` (lines 693-724) | 2-step cascade for validation only | No change (correct for purpose) |
| `lib/demo-data-generator.ts` (lines 454-497) | Custom 3-tier batch resolver | No change (correct + optimized) |
| `lib/dal/phase-resolver.ts` | Full 4-tier cascade | No change (already correct) |

---

## Phase 1: Fix Frontend Template Resolution + Tests
**Complexity:** Small
**Commit:** `fix(milestones): use resolveTemplateForCase for case detail page and expectedNames query`

### What it does
1. **Update `app/cases/[id]/page.tsx`** (lines 209-232):
   - Import `resolveTemplateForCase` from `lib/dal/phase-resolver`
   - Replace the inline 2-step cascade with:
     ```ts
     if (!templateId && caseResult?.procedure_type_id) {
       templateId = await resolveTemplateForCase(supabase, {
         milestone_template_id: null,
         surgeon_id: caseResult.surgeon_id,
         procedure_type_id: caseResult.procedure_type_id,
         facility_id: effectiveFacilityId,
       })
     }
     ```
   - The `caseResult.milestone_template_id` check on line 211 stays — it short-circuits for stamped cases

2. **Update `lib/hooks/useMilestoneComparison.ts`** (lines 118-161):
   - `resolveTemplateForCase` is already imported (used by `phaseDefinitions` and `phaseMedians`)
   - Replace the inline 2-step cascade in the `expectedNames` async function with:
     ```ts
     expectedNames: async (supabase) => {
       if (!procedureTypeId || !facilityId) return []
       const templateId = await resolveTemplateForCase(supabase, {
         milestone_template_id: milestoneTemplateId,
         surgeon_id: surgeonId,
         procedure_type_id: procedureTypeId,
         facility_id: facilityId,
       })
       if (!templateId) return []
       // ... rest of milestone name fetching unchanged
     }
     ```
   - Keep the `procedureTypeId && facilityId` guard (don't relax)

3. **Add/update tests:**
   - `useMilestoneComparison.test.ts`: Add surgeon override scenario for `expectedNames`
   - `app/cases/[id]/__tests__/`: Add template cascade resolution test (surgeon override case shows correct milestones)

### Files touched
- `app/cases/[id]/page.tsx` (modify)
- `lib/hooks/useMilestoneComparison.ts` (modify)
- `lib/hooks/__tests__/useMilestoneComparison.test.ts` (modify)
- `app/cases/[id]/__tests__/` (modify or new test file)

### Test gate
1. **Unit:** `resolveTemplateForCase` is called with correct args (surgeon_id included); surgeon override scenario returns correct `expectedNames`
2. **Integration:** Case with surgeon override shows override template milestones in drawer + detail page
3. **Workflow:** Open case with surgeon override → verify drawer milestones match timeline → verify both match what `create_case_with_milestones` would produce

---

## Phase 2: Fix RPC Migration + Analytics Verification + Tests
**Complexity:** Small
**Commit:** `fix(analytics): add surgeon override to get_milestone_interval_medians RPC + verify analytics pages`

### What it does
1. **Create migration** to update `get_milestone_interval_medians()`:
   - The RPC already receives `p_surgeon_id` as a parameter but doesn't use it for template resolution
   - Update the `resolved_template` CTE to check `surgeon_template_overrides` first:
     ```sql
     resolved_template AS (
       SELECT COALESCE(
         -- 1. Surgeon override
         (SELECT sto.milestone_template_id
          FROM surgeon_template_overrides sto
          WHERE sto.surgeon_id = p_surgeon_id
            AND sto.procedure_type_id = p_procedure_type_id
            AND sto.facility_id = p_facility_id),
         -- 2. Procedure template
         (SELECT pt.milestone_template_id
          FROM procedure_types pt
          WHERE pt.id = p_procedure_type_id),
         -- 3. Facility default
         (SELECT mt.id
          FROM milestone_templates mt
          WHERE mt.facility_id = p_facility_id
            AND mt.is_default = true
            AND mt.is_active = true)
       ) AS template_id
     )
     ```

2. **Apply migration** via `supabase db push`

3. **Quick analytics page verification** (document findings in commit):
   - `/analytics/surgeons` — uses `batchResolveTemplatesForCases` ✅
   - `/analytics/financials` — uses `resolveDefaultPhaseDefsForFacility` ✅
   - `/data-quality` — works with recorded `case_milestones` data ✅
   - `get_phase_medians()` RPC — receives pre-resolved `p_milestone_template_id` from TS ✅

4. **Add tests for RPC behavior** (integration-style, verifying median query returns correct structure)

### Files touched
- `supabase/migrations/YYYYMMDD_fix_interval_medians_surgeon_override.sql` (new)
- Test files for RPC/analytics verification (modify or new)

### Test gate
1. **Unit:** RPC SQL compiles and returns correct columns; analytics pages verified correct
2. **Integration:** Case drawer median bars reflect surgeon-specific template milestones
3. **Workflow:** Surgeon with override template → open case → verify median intervals match template's milestones (not procedure default); navigate all analytics pages for consistency

---

## Dependency Graph
```
Phase 1 (frontend fixes + tests) → Phase 2 (RPC migration + analytics audit + tests)
```

Phases are sequential: Phase 1's frontend fixes should be verified before Phase 2's RPC change, since the hook calls the RPC.

---

## Session Log
<!-- Entries added by /wrap-up -->
