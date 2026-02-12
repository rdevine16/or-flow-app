# Phase 3 Progress Report — Staff Assignment + Room Conflicts + Create Another

**Last updated:** 2026-02-11
**Status:** COMPLETE (including post-testing bug fix)

---

## Scope (adjusted after interview)

| Sub-task | Description | Status |
|----------|-------------|--------|
| 3.1 | Staff Assignment at Creation | **COMPLETE** |
| 3.2 | Duplicate / "Create Similar" Case | **SKIPPED** (user decision) |
| 3.3 | Room/Time Conflict Detection | **COMPLETE** |
| 3.4 | "Create Another" Post-Submit Option | **COMPLETE** |
| 3.5 | Draft Finalization Bug Fix (`milestone_type_id` trigger) | **COMPLETE** |

### UI/UX Decisions Made (from interview)

- **3.1 Staff picker:** Grouped by role (sections: Nurses, Techs, Anesthesiologists)
- **3.2 Duplicate:** Skipped entirely per user request
- **3.3 Conflict warning:** Inline yellow alert below the OR Room field
- **3.4 Create Another:** Carry over **date only** (not surgeon, not room) — via URL query param

---

## All Files Modified / Created

| File | Type | What changed |
|------|------|-------------|
| `components/cases/StaffMultiSelect.tsx` | **NEW** | Multi-select component for staff assignment, grouped by role |
| `components/cases/CaseForm.tsx` | **Modified** | Staff wiring, room conflict detection, Create Another toast |
| `supabase/migrations/20260212000003_phase3_staff_and_conflicts.sql` | **NEW** | RPC update: `p_staff_assignments JSONB` param added |
| `supabase/migrations/20260212000004_fix_milestone_type_id_triggers.sql` | **NEW** | Replaces `trigger_record_case_stats()` to remove stale `NEW.milestone_type_id` reference |
| `components/cases/__tests__/CaseForm.test.tsx` | **Modified** | 18 Phase 3 tests added (14 original + 4 bug-fix); mock fixes for `neq`, `draftChainable`, `useSearchParams` |
| `components/cases/__tests__/StaffMultiSelect.test.tsx` | **NEW** | 10 standalone component tests |

---

## What Was Implemented

### 3.1 Staff Assignment at Creation

**New component:** `StaffMultiSelect.tsx`
- Fetches facility staff from `users` table (joined with `user_roles`)
- Groups staff by role in dropdown sections: **Nurses**, **Techs**, **Anesthesiologists**, **Other**
- Excludes surgeons from the list (primary surgeon is a dedicated form field)
- Accepts `excludeUserIds` prop to filter out the already-selected surgeon
- Searchable with debounced filter
- Selected staff shown as color-coded role tags with remove buttons
- Click-outside-to-close behavior
- Footer with selected count and "Clear all"
- Props: `facilityId`, `selectedStaff: StaffSelection[]`, `onChange`, `excludeUserIds?`, `disabled?`
- `StaffSelection` type: `{ user_id: string; role_id: string }`

**CaseForm wiring:**
1. StaffMultiSelect rendered between Device Rep & Trays and Anesthesiologist sections, guarded by `{userFacilityId && (...)}`
2. Staff passed to RPC calls via `p_staff_assignments: selectedStaff.length > 0 ? JSON.stringify(selectedStaff) : null`
3. `isDirty` useMemo compares `selectedStaff` vs `originalStaff` (length + user_id matching)
4. Edit mode loads existing staff from `case_staff` table (`user_id, role_id` where `removed_at IS NULL`)

**SQL migration:** `create_case_with_milestones()` updated with `p_staff_assignments JSONB DEFAULT NULL`. Inserts into `case_staff` using `jsonb_array_elements()`. Staff is inserted even for drafts. Backward compatible.

### 3.3 Room/Time Conflict Detection

**CaseForm wiring:**
1. `checkRoomConflicts` callback with 300ms debounce queries `cases` for overlapping room+date
2. Joins `users!cases_surgeon_id_fkey` to display surgeon name per conflict
3. In edit mode, excludes current case via `.neq('id', caseId)`
4. Inline amber warning banner with `data-testid="room-conflict-warning"` below OR Room dropdown
5. Shows conflict count, case numbers, times, and surgeon names
6. Informational only — does **NOT** block submission

### 3.4 "Create Another" Post-Submit Option

**CaseForm wiring:**
1. `useSearchParams()` reads `date` query param on mount, overrides default date if present
2. After successful create, shows toast with 8s duration and "Create Another" action button
3. Action navigates to `/cases/new?date={preservedDate}`
4. Primary navigation goes to `/cases`
5. Edit mode shows simpler "Case updated" toast without Create Another

### 3.5 Draft Finalization Bug Fix

**Bug:** Creating a case as draft, then editing and saving it produced: `record "new" has no field "milestone_type_id"`.

**Root cause:** The `finalize_draft_case` RPC inserts milestones into `case_milestones`. The `trg_record_case_stats` trigger (AFTER INSERT on `case_milestones`) calls `trigger_record_case_stats()`, which contained a fallback block: `IF v_milestone_name IS NULL AND NEW.milestone_type_id IS NOT NULL THEN ...`. The `milestone_type_id` column was dropped from `case_milestones` during the v2.0 milestone cleanup, so `NEW.milestone_type_id` causes a runtime error.

**Fix:** SQL migration `20260212000004_fix_milestone_type_id_triggers.sql` uses `CREATE OR REPLACE FUNCTION` to rewrite `trigger_record_case_stats()`:
- Removes the stale `NEW.milestone_type_id` fallback block entirely
- Retains the primary lookup via `facility_milestone_id` (the only valid path now)
- Still fires `record_case_stats()` + `refresh_case_stats()` on `patient_out` milestone
- Safe and idempotent — can be re-run without side effects

---

## SQL Migrations — MUST BE RUN

```
supabase/migrations/20260212000003_phase3_staff_and_conflicts.sql
supabase/migrations/20260212000004_fix_milestone_type_id_triggers.sql
```

**Migration 1** replaces `create_case_with_milestones()` with a new version accepting `p_staff_assignments JSONB DEFAULT NULL`. Backward-compatible.

**Migration 2** replaces `trigger_record_case_stats()` to remove the stale `NEW.milestone_type_id` fallback. Fixes the draft finalization error. Must be applied before drafts can be finalized.

---

## Tests — All Passing

**28 Phase 3 tests written. 107 tests total across the project. 0 failures.**

### CaseForm Phase 3 Tests (18 tests)

**3.1 Staff Assignment (6 tests):**
- [x] `renders StaffMultiSelect component in create mode when facilityId is available`
- [x] `passes selectedStaff and onChange to StaffMultiSelect`
- [x] `passes surgeon_id as excludeUserIds to StaffMultiSelect`
- [x] `includes p_staff_assignments in RPC call when staff are selected`
- [x] `sends null for p_staff_assignments when no staff selected`
- [x] `includes staff in draft save RPC call`

**3.3 Room Conflict Detection (5 tests):**
- [x] `shows conflict warning when room has existing cases on same date`
- [x] `hides conflict warning when no conflicts found`
- [x] `hides conflict warning when room/date/time are not all filled`
- [x] `excludes current case from conflict check in edit mode`
- [x] `conflict warning does not block form submission`

**3.4 Create Another (3 tests):**
- [x] `shows success toast with Create Another action after case creation`
- [x] `reads date query param and uses it as initial scheduled_date`
- [x] `uses default date when no date query param is provided`

**3.5 Draft Finalization (4 tests):**
- [x] `calls finalize_draft_case RPC when submitting a draft case`
- [x] `shows error when finalize_draft_case RPC fails with milestone_type_id error`
- [x] `shows success toast and navigates on successful finalization`
- [x] `does not call regular update when editing a draft`

### StaffMultiSelect Component Tests (10 tests)

- [x] `renders loading skeleton while fetching staff`
- [x] `shows grouped sections (Nurses, Techs, Anesthesiologists)`
- [x] `excludes surgeons from the list`
- [x] `filters out excludeUserIds`
- [x] `toggles staff selection on click`
- [x] `shows selected staff as colored tags`
- [x] `removes staff when tag X is clicked`
- [x] `filters staff by search query`
- [x] `shows selected count in footer`
- [x] `clears all selections when Clear all is clicked`

### Test Infrastructure Fixes Applied

These were pre-existing issues in the Phase 0-2 test mocks that surfaced during Phase 3 test writing:

1. **Added `neq` to chainable Supabase mock** — was missing entirely, caused unhandled `TypeError: query.neq is not a function` whenever the conflict check ran in edit mode tests
2. **Fixed Phase 2 `draftChainable` mock** — was missing `is`, `neq`, `order`, and `then` methods. The incomplete chain caused lingering timer errors when the conflict useEffect fired after draft case data loaded with a populated `or_room_id`
3. **Added `useSearchParams` mock** to `next/navigation` — required for the Create Another `?date=` query param feature
4. **Added `StaffMultiSelect` mock** to CaseForm tests — follows the same pattern as `ImplantCompanySelect` mock (renders data-testid, exposes Add/Clear buttons for test interaction)
5. **Added `mockSearchParams` reset** to all `beforeEach` blocks — prevents state leaking between tests
6. **Added `setupDraftEditMode` helper** for 3.5 tests — creates a full edit-mode mock with `is_draft: true`, overridable RPC responses, and proper chainable mocks for `case_staff`, `case_implant_companies`, `case_complexities`

---

## Architecture Notes

- `StaffMultiSelect` fetches its own data (like `ImplantCompanySelect`) rather than receiving staff as props from the parent. Consistent with existing patterns, avoids prop-drilling.
- The RPC accepts staff as JSONB rather than `UUID[]` because we need both `user_id` and `role_id` per assignment. JSONB avoids needing a custom PostgreSQL type.
- Room conflict detection uses 300ms debounced queries, consistent with the case number uniqueness check pattern.
- `checkRoomConflicts` uses a Supabase join (`users!cases_surgeon_id_fkey`) to get surgeon names for conflict context.
- "Create Another" uses URL query params (`?date=YYYY-MM-DD`) rather than in-memory state because the component unmounts during navigation. Works even with bookmarks.
- The `milestone_type_id` trigger fix uses `CREATE OR REPLACE FUNCTION` to rewrite `trigger_record_case_stats()`, removing the stale `NEW.milestone_type_id` fallback. This is safe and idempotent — the migration can be re-run without side effects.

---

## Known Issues / Follow-ups

1. **SQL migrations must be run** — both Phase 3 migrations must be applied to Supabase before staff assignment and draft finalization work end-to-end
2. **Benign `act()` warnings** — the edit-mode conflict tests and draft finalization tests produce React `act()` warnings in stderr due to debounced state updates in `setTimeout` callbacks. These are cosmetic and do not affect test correctness. Could be eliminated by adopting `vi.useFakeTimers()` in a future cleanup pass.
3. **Staff edit-mode updates not yet wired** — the CaseForm loads existing staff in edit mode and tracks dirty state, but the `handleSubmit` update path does not yet diff and update `case_staff` rows (add new / remove old). Currently only the create and draft paths pass `p_staff_assignments`. This is a Phase 5 cleanup item.
