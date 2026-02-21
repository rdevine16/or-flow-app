# Feature: Unify Anesthesia into Staff System

## Goal
Remove the dedicated anesthesiologist dropdown from the case form and unify anesthesia assignment into the existing `case_staff` multi-select system. Currently anesthesiologists can be double-booked — assigned via both `cases.anesthesiologist_id` (dedicated dropdown) AND the `case_staff` table (staff multi-select). This creates data duplication, confusing UI, and potential for the same person appearing twice on a case team. After this change, anesthesiologists are managed exactly like nurses and techs, with a warning shown when no anesthesia staff is assigned to a case.

## Requirements
1. Migrate existing `cases.anesthesiologist_id` data into `case_staff` rows (no data loss)
2. Drop the `cases.anesthesiologist_id` column and its foreign key
3. Remove the dedicated anesthesiologist `SearchableDropdown` from CaseForm
4. Remove the `AnesthesiaPopover` component from case detail
5. Keep anesthesiologists in `StaffMultiSelect` (already there in the `ROLE_SECTIONS` array)
6. Show a warning banner/indicator on the case form when no staff member with role `anesthesiologist` is assigned
7. Update the case detail team display to no longer render anesthesia from a dedicated field
8. Update the `create_case_with_milestones` RPC to remove the `p_anesthesiologist_id` parameter
9. Update the demo data generator to assign anesthesia only via `case_staff`

## Database Context
- Table: `cases` — has `anesthesiologist_id uuid` FK to `users(id)` (TO BE REMOVED)
- Table: `case_staff` — `case_id`, `user_id`, `role_id`, `removed_at` (soft delete) — this becomes the SOLE mechanism
- Table: `user_roles` — has `anesthesiologist` role entry
- RPC: `create_case_with_milestones` — has `p_anesthesiologist_id` param (TO BE REMOVED)
- FK: `cases_anesthesiologist_id_fkey` → `users(id)` (TO BE DROPPED)

## UI/UX
- Route: `/cases/new`, `/cases/[id]` (edit), `/cases/[id]` (detail view)
- CaseForm: Remove anesthesiologist dropdown, keep StaffMultiSelect (already includes anesthesiologists)
- CaseForm: Add amber/yellow warning banner when no anesthesiologist is in selectedStaff
- Case Detail: Remove separate anesthesia line from team section; anesthesiologists appear in staff list
- StaffAssignmentPanel (dashboard): No change needed — already shows anesthesiologists from case_staff
- AnesthesiaPopover: Delete component entirely

## Files Likely Involved
- `components/cases/CaseForm.tsx` — remove anesthesiologist dropdown, add missing-anesthesia warning
- `components/cases/StaffMultiSelect.tsx` — already includes anesthesiologists (minimal changes)
- `components/ui/AnesthesiaPopover.tsx` — DELETE this component
- `app/cases/[id]/page.tsx` — remove anesthesiologist from case query join + team display
- `components/dashboard/StaffAssignmentPanel.tsx` — verify no dedicated anesthesia logic
- `lib/dal/cases.ts` — remove anesthesiologist_id references from queries
- `lib/demo-data-generator.ts` — stop setting anesthesiologist_id, assign only via case_staff
- `supabase/migrations/` — new migration: data migration + drop column + update RPC
- `hooks/useStaffAssignment.ts` — verify no dedicated anesthesia logic
- `types/staff-assignment.ts` — verify no dedicated anesthesia types

## iOS Parity
- [ ] iOS equivalent needed
- [x] iOS can wait

## Known Issues / Constraints
- Must migrate existing data BEFORE dropping the column — cases with `anesthesiologist_id` set need corresponding `case_staff` rows created
- Avoid duplicate `case_staff` rows if the same anesthesiologist was already in both systems
- The `create_case_with_milestones` RPC signature change requires updating all callers
- Pre-existing typecheck errors in test files (mock types) are not related to this feature

## Out of Scope
- Enforcing a maximum of one anesthesiologist per case (multiple anesthesia staff is valid)
- Changes to the surgeon assignment (surgeon stays as a dedicated field — different relationship)
- Analytics queries that reference anesthesiologist (these read from case_staff already)
- iOS app changes (deferred)

## Acceptance Criteria
- [ ] No `anesthesiologist_id` column remains on the `cases` table
- [ ] All existing anesthesiologist assignments preserved in `case_staff` (no data loss)
- [ ] CaseForm shows anesthesiologists only in staff multi-select (no dedicated dropdown)
- [ ] Warning displayed when case has no anesthesiologist in staff list
- [ ] Case detail team section shows anesthesiologists from `case_staff` only
- [ ] `AnesthesiaPopover` component deleted
- [ ] `create_case_with_milestones` RPC no longer accepts `p_anesthesiologist_id`
- [ ] Demo data generator assigns anesthesia via `case_staff` only
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
