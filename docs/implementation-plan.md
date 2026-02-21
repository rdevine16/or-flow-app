# Implementation Plan: Unify Anesthesia into Staff System

## Summary
Remove the dedicated `cases.anesthesiologist_id` column and unify all anesthesia assignment through the existing `case_staff` table. This eliminates data duplication, the confusing dual-assignment UI, and the risk of the same person appearing twice on a case team. After this change, anesthesiologists are managed identically to nurses and techs via `StaffMultiSelect`.

## Interview Notes
- **Legacy RPCs:** Delete `get_anesthesiologist_block_stats` (unused/no callers). Rewrite `get_surgeon_day_overview` to pull anesthesiologist from `case_staff` instead of the dedicated column.
- **Display components:** CaseSummary.tsx and CompletedCaseView.tsx both render anesthesiologist from the dedicated field — both still in active use, must be updated.
- **Warning UX:** Inline amber warning directly below `StaffMultiSelect`, always visible when no anesthesiologist is in the staff list (even on initial load).
- **Both RPCs:** Update both `create_case_with_milestones` AND `finalize_draft_case` to remove `p_anesthesiologist_id`.

## Codebase Scan Findings
- **DAL is clean:** `lib/dal/cases.ts` has no `anesthesiologist_id` references
- **StaffMultiSelect already works:** Anesthesiologists are in `ROLE_SECTIONS` (line 33)
- **StaffAssignmentPanel is role-agnostic:** Only a cosmetic display override (`anesthesiologist` → `Anesthesia`)
- **useStaffAssignment hook:** Completely generic, no dedicated anesthesia logic
- **Demo data generator:** Currently sets BOTH `cases.anesthesiologist_id` AND `case_staff` rows (dual assignment)
- **Edge functions:** No anesthesiologist references found
- **Bulk create page:** Already skips `p_anesthesiologist_id` (passes null implicitly)

---

## Phase 1: Database Migration
**Complexity:** Medium

### What it does
Single migration file that:
1. Migrates existing `cases.anesthesiologist_id` data into `case_staff` rows (de-duplicated)
2. Drops FK constraint `cases_anesthesiologist_id_fkey`
3. Drops column `cases.anesthesiologist_id`
4. Updates `create_case_with_milestones` RPC — removes `p_anesthesiologist_id` parameter
5. Updates `finalize_draft_case` RPC — removes `p_anesthesiologist_id` parameter
6. Drops `get_anesthesiologist_block_stats` RPC (unused)
7. Updates `get_surgeon_day_overview` RPC — rewrites anesthesiologist lookup to use `case_staff` joined to `user_roles`

### Files touched
- `supabase/migrations/20260222000000_unify_anesthesia_into_staff.sql` (NEW)

### Data migration strategy
```sql
-- Insert into case_staff where anesthesiologist_id is set but NOT already in case_staff
INSERT INTO case_staff (case_id, user_id, role_id)
SELECT c.id, c.anesthesiologist_id, ur.role_id
FROM cases c
JOIN user_roles ur ON ur.name = 'anesthesiologist'
WHERE c.anesthesiologist_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM case_staff cs
  WHERE cs.case_id = c.id
  AND cs.user_id = c.anesthesiologist_id
  AND cs.removed_at IS NULL
);
```

### Commit message
`feat(db): phase 1 — migrate anesthesiologist_id to case_staff and drop column`

### 3-stage test gate
1. **Unit:** Verify migration SQL is syntactically valid, data migration handles duplicates
2. **Integration:** After push, verify case_staff rows exist for previously-assigned anesthesiologists; verify column is gone
3. **Workflow:** Verify existing RPC callers still work (create_case_with_milestones without the removed param)

---

## Phase 2: CaseForm Cleanup + Warning Banner
**Complexity:** Medium

### What it does
1. Remove anesthesiologist dropdown (`SearchableDropdown`) from CaseForm
2. Remove `anesthesiologist_id` from `FormData` interface and all form state
3. Remove anesthesiologist fetch logic (lines ~400-412)
4. Remove `p_anesthesiologist_id` from all RPC calls (create, draft save, finalize, update)
5. Add inline amber warning below `StaffMultiSelect` when no staff member with `anesthesiologist` role is in `selectedStaff`
6. Update validation schemas to remove `anesthesiologist_id`
7. Delete `components/ui/AnesthesiaPopover.tsx`

### Files touched
- `components/cases/CaseForm.tsx` — remove dropdown, state, RPC params; add warning
- `components/ui/AnesthesiaPopover.tsx` — DELETE
- `lib/validation/schemas.ts` — remove `anesthesiologist_id` from create/edit schemas

### Commit message
`feat(case-form): phase 2 — remove anesthesiologist dropdown, add missing-anesthesia warning`

### 3-stage test gate
1. **Unit:** Warning renders when no anesthesiologist in staff; warning hides when anesthesiologist present
2. **Integration:** CaseForm submits successfully without anesthesiologist_id; staff assignments still work
3. **Workflow:** Create case → assign anesthesiologist via StaffMultiSelect → verify warning disappears → save → verify case_staff row exists

---

## Phase 3: Case Detail + Display Components + Demo Data + Tests
**Complexity:** Medium

### What it does
1. Update case detail page (`app/cases/[id]/page.tsx`) — remove `anesthesiologist:users!cases_anesthesiologist_id_fkey` join; show anesthesiologist(s) from case_staff in team section
2. Update `CaseSummary.tsx` — remove dedicated anesthesiologist display, show from case_staff
3. Update `CompletedCaseView.tsx` — remove anesthesiologist from metadata grid + team section, show from case_staff
4. Update `lib/demo-data-generator.ts` — stop setting `anesthesiologist_id` on cases, assign only via case_staff
5. Update tests: CaseForm tests (remove anesthesiologist_id from mocks), validation schema tests, any TeamMember tests referencing the dedicated field

### Files touched
- `app/cases/[id]/page.tsx` — remove FK join, update team display
- `components/cases/CaseSummary.tsx` — update anesthesiologist display source
- `components/cases/CompletedCaseView.tsx` — update anesthesiologist display source
- `lib/demo-data-generator.ts` — remove anesthesiologist_id assignment
- `components/cases/__tests__/CaseForm.test.tsx` — update mocks
- `lib/validation/__tests__/schemas.test.ts` — remove anesthesiologist_id from test data

### Commit message
`feat(case-detail): phase 3 — unify anesthesia display from case_staff, update demo data and tests`

### 3-stage test gate
1. **Unit:** Case detail renders anesthesiologist from case_staff; CaseSummary/CompletedCaseView display correctly
2. **Integration:** Demo data generator creates valid cases with anesthesiologist only in case_staff
3. **Workflow:** Full pass: `npm run typecheck && npm run lint && npm run test` — all green

---

## Dependency Chain
```
Phase 1 (DB migration) → Phase 2 (CaseForm) → Phase 3 (Detail + Cleanup)
```
Phase 1 must be applied (`supabase db push`) before Phase 2 code runs against the live DB. Phases 2 and 3 could theoretically be done in either order, but Phase 2 first is cleaner since the form is the primary write path.
