# Phase 2 Progress Report — Case Creation Overhaul

**Last updated:** 2026-02-11
**Status:** COMPLETE

---

## Files Modified / Created

### 1. `supabase/migrations/20260212_phase2_draft_cases.sql` — SQL Migration (RUN)

- Adds `is_draft BOOLEAN NOT NULL DEFAULT false` column to `cases` table
- Replaces `create_case_with_milestones()` RPC with new version accepting `p_is_draft` parameter
- Creates new `finalize_draft_case()` RPC
- **Pushed to Supabase on 2026-02-11**

### 2. `supabase/migrations/20260212_phase2_coordinator_role.sql` — Documentation Migration

- Documents the `coordinator` access_level value in the users table

### 3. `lib/validation/schemas.ts` — MODIFIED

- Added `draftCaseSchema` — relaxed Zod schema where only `scheduled_date` is required
- Added `DraftCaseInput` type export

### 4. `components/cases/CaseForm.tsx` — MODIFIED (2.1 + 2.4)

- **2.1:** Added "Save as Draft" button to action bar (create mode only)
- **2.1:** `handleSaveDraft()` — validates with relaxed schema, calls RPC with `p_is_draft: true`, auto-generates `DRAFT-{timestamp}` case number if empty
- **2.1:** Submit button shows "Finalize Case" when editing a draft
- **2.1:** Draft finalization branch calls `finalize_draft_case` RPC
- **2.4:** Added `isDirty` useMemo — compares formData, selectedCompanyIds, selectedComplexityIds, repRequiredOverride against original values
- **2.4:** Added `handleCancel` — shows LeaveConfirm dialog when dirty, navigates directly when clean
- **2.4:** Added `beforeunload` event listener when form is dirty
- **2.4:** Rendered `<LeaveConfirm>` component with Stay/Leave buttons
- **2.4:** Sets `originalData` in create mode for dirty tracking

### 5. `app/cases/page.tsx` — MODIFIED (2.1 + 2.3)

- **2.1:** Added `is_draft` to Case interface and query select
- **2.1:** Draft rows get dashed amber border + "Draft" badge pill
- **2.1:** Drafts link to `/cases/${id}/edit` instead of detail view
- **2.1:** Draft pseudo-status shown in status column
- **2.1:** Draft filter handling separates "draft" from real statuses
- **2.3:** Guarded "New Case" button with `canCreateCases`

### 6. `components/filters/CaseFilterBar.tsx` — MODIFIED (2.1)

- Added `{ value: 'draft', label: 'Drafts' }` to STATUS_OPTIONS

### 7. `components/cases/IncompleteCaseModal.tsx` — NEW (2.2)

- Modal with backdrop blur for incomplete case detail pages
- Uses SearchableDropdown for surgeon, procedure, room fields
- Inline validation — requires all missing fields before save

### 8. `app/cases/[id]/page.tsx` — MODIFIED (2.2)

- Added `surgeon_id`, `or_room_id`, `is_draft` to CaseData interface and query
- Fetches dropdown data (surgeons, procedures, rooms) for modal
- Detects incomplete non-draft cases and shows IncompleteCaseModal
- Added `handleIncompleteSave` function

### 9. `lib/UserContext.tsx` — MODIFIED (2.3)

- Added `'coordinator'` to accessLevel type union
- Added `isCoordinator` and `canCreateCases` computed values
- `canCreateCases = isGlobalAdmin || isFacilityAdmin || isCoordinator`

### 10. `app/cases/new/page.tsx` — MODIFIED (2.3)

- Added redirect guard: unauthorized users are sent to `/cases`

### 11. `app/settings/users/page.tsx` — MODIFIED (2.3)

- Added "Coordinator" option to access level dropdown
- Updated `getAccessLevelLabel` function

---

## Tests

| Test File | Tests | Status |
|-----------|-------|--------|
| `components/cases/__tests__/CaseForm.test.tsx` | 33 tests (Phase 0+1+2) | All pass |
| `components/cases/__tests__/IncompleteCaseModal.test.tsx` | 8 tests | All pass |
| `lib/__tests__/UserContext.test.tsx` | 4 tests | All pass |

**Phase 2 test breakdown:**
- 2.1 Draft Cases: 8 tests (Save as Draft button, RPC calls, draft finalization, error handling)
- 2.2 Incomplete Case Modal: 8 tests (rendering, validation, save, field interactions)
- 2.3 Role-Based Access: 4 tests (canCreateCases for each role)
- 2.4 Unsaved Changes Warning: 6 tests (clean cancel, dirty cancel, Leave/Stay, beforeunload, revert detection)

**Full suite: 79 tests across 7 files, all passing.**

---

## Summary Table

| Sub-task | Status |
|----------|--------|
| 2.1 SQL migration | Done + pushed |
| 2.1 Draft schema | Done |
| 2.1 CaseForm draft button + logic | Done |
| 2.1 Cases list draft UI | Done |
| 2.1 Tests | Done (8 tests) |
| 2.2 Incomplete case modal | Done |
| 2.2 Tests | Done (8 tests) |
| 2.3 Role-based access | Done |
| 2.3 Tests | Done (4 tests) |
| 2.4 Unsaved changes warning | Done |
| 2.4 Tests | Done (6 tests) |
