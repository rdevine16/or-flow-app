# Phase 3 Progress Report — Staff Assignment + Room Conflicts + Create Another

**Last updated:** 2026-02-11
**Status:** IN PROGRESS — partially implemented, no tests written yet

---

## Scope (adjusted after interview)

| Sub-task | Description | Status |
|----------|-------------|--------|
| 3.1 | Staff Assignment at Creation | **Partially done** |
| 3.2 | Duplicate / "Create Similar" Case | **SKIPPED** (user decision) |
| 3.3 | Room/Time Conflict Detection | **Partially done** |
| 3.4 | "Create Another" Post-Submit Option | **Not started** |

### UI/UX Decisions Made (from interview)

- **3.1 Staff picker:** Grouped by role (sections: Nurses, Techs, Anesthesiologists)
- **3.2 Duplicate:** Skipped entirely per user request
- **3.3 Conflict warning:** Inline yellow alert below the OR Room field
- **3.4 Create Another:** Carry over **date only** (not surgeon, not room)

---

## What Has Been Completed

### 1. `components/cases/StaffMultiSelect.tsx` — NEW FILE (complete)

Fully implemented multi-select component modeled after `ImplantCompanySelect.tsx`:
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

### 2. `supabase/migrations/20260212_phase3_staff_and_conflicts.sql` — NEW FILE (complete)

SQL migration that replaces `create_case_with_milestones()` RPC with a new version that adds:
- **New parameter:** `p_staff_assignments JSONB DEFAULT NULL`
  - Expects a JSON array of `{"user_id": "<uuid>", "role_id": "<uuid>"}` objects
- **New logic:** After case + milestone creation, inserts into `case_staff` table using `jsonb_array_elements()`
- Staff is inserted even for drafts (team is often known before case details are finalized)
- All existing parameters and behavior are preserved (backward compatible)

**THIS MIGRATION HAS NOT BEEN RUN.** It must be applied to Supabase before the frontend changes will work.

### 3. `components/cases/CaseForm.tsx` — MODIFIED (partially wired)

#### What was added:

**Imports & types (lines 19, 24-33):**
- Import of `StaffMultiSelect` component
- `StaffSelection` interface (`{ user_id: string; role_id: string }`)
- `RoomConflict` interface (`{ case_number: string; start_time: string; surgeon_name: string | null }`)

**State variables (lines 104-111):**
- `selectedStaff` / `setSelectedStaff` — `StaffSelection[]` state
- `originalStaff` / `setOriginalStaff` — for dirty tracking in edit mode
- `roomConflicts` / `setRoomConflicts` — `RoomConflict[]` state
- `checkingConflicts` / `setCheckingConflicts` — loading state for conflict check
- `conflictTimerRef` — debounce timer ref for conflict queries

**Room conflict detection logic (lines 192-245):**
- `checkRoomConflicts()` callback — debounced (300ms) query to `cases` table
  - Filters by `or_room_id`, `scheduled_date`, `facility_id`, `is_draft = false`
  - In edit mode, excludes current case via `.neq('id', caseId)`
  - Joins surgeon name via `users!cases_surgeon_id_fkey`
  - Maps results to `RoomConflict[]` array
- `useEffect` that calls `checkRoomConflicts` when `or_room_id`, `scheduled_date`, or `start_time` changes

#### What is NOT yet wired up:

1. **Staff multi-select JSX** — The `<StaffMultiSelect>` component is imported but NOT yet rendered in the form JSX. It should go between the "Device Rep & Trays" section and the "Anesthesiologist & Payer" section.

2. **Staff passed to RPC** — `selectedStaff` is NOT yet included in the `handleSubmit()` or `handleSaveDraft()` RPC calls. Need to add `p_staff_assignments: selectedStaff.length > 0 ? JSON.stringify(selectedStaff) : null` to both RPC call sites.

3. **Room conflict warning JSX** — The `roomConflicts` state is populated but NOT yet rendered below the OR Room dropdown. Need to add the inline yellow warning banner after the `<SearchableDropdown>` for OR Room (after line 1168).

4. **Dirty state tracking for staff** — `selectedStaff` is NOT yet included in the `isDirty` useMemo calculation. Need to add staff comparison alongside the existing company/complexity comparisons.

5. **Edit mode staff loading** — When editing an existing case, the `fetchCase()` function does NOT yet load existing `case_staff` assignments into `selectedStaff`/`originalStaff`.

6. **"Create Another" (3.4)** — Not started at all. Needs:
   - A `resetFormForCreateAnother()` function that resets all form state but preserves `scheduled_date`
   - Modification of the success path in `handleSubmit()` to show a toast with an `action: { label: 'Create Another', onClick: resetFormForCreateAnother }` instead of immediately calling `router.push('/cases')`
   - The function should NOT navigate — it should clear form data, clear selectedStaff, clear selectedCompanyIds, etc.

---

## Files Summary

| File | Status | Action needed |
|------|--------|---------------|
| `components/cases/StaffMultiSelect.tsx` | **NEW — complete** | None |
| `supabase/migrations/20260212_phase3_staff_and_conflicts.sql` | **NEW — complete** | **Must be run against Supabase** |
| `components/cases/CaseForm.tsx` | **Modified — partial** | See "What is NOT yet wired up" above (6 items) |
| `components/cases/__tests__/CaseForm.test.tsx` | **Not modified** | Need Phase 3 test suite (see below) |

---

## SQL Migrations to Run

```
supabase/migrations/20260212_phase3_staff_and_conflicts.sql
```

This replaces the `create_case_with_milestones()` function with a new version that accepts `p_staff_assignments JSONB DEFAULT NULL`. It is backward-compatible — existing calls without staff assignments will continue to work.

---

## Remaining Work

### 3.1 — Staff Assignment at Creation (finish wiring)

1. **Add `<StaffMultiSelect>` to form JSX** — Insert between Device Rep section and Anesthesiologist section:
   ```tsx
   {userFacilityId && (
     <div>
       <label className="block text-sm font-medium text-slate-700 mb-2">
         Staff Assignment
       </label>
       <StaffMultiSelect
         facilityId={userFacilityId}
         selectedStaff={selectedStaff}
         onChange={setSelectedStaff}
         excludeUserIds={formData.surgeon_id ? [formData.surgeon_id] : []}
       />
       <p className="text-xs text-slate-500 mt-1.5">
         Assign nurses, techs, and other staff to this case (optional)
       </p>
     </div>
   )}
   ```

2. **Pass staff to RPC calls** — In both `handleSubmit()` (create mode RPC call ~line 710) and `handleSaveDraft()` (~line 582), add:
   ```
   p_staff_assignments: selectedStaff.length > 0 ? JSON.stringify(selectedStaff) : null
   ```

3. **Add staff to dirty tracking** — In the `isDirty` useMemo, add:
   ```ts
   if (selectedStaff.length !== originalStaff.length ||
       selectedStaff.some(s => !originalStaff.find(o => o.user_id === s.user_id))) return true
   ```

4. **Load staff in edit mode** — In `fetchCase()`, after loading case data, query:
   ```ts
   const { data: caseStaffData } = await supabase
     .from('case_staff')
     .select('user_id, role_id')
     .eq('case_id', caseId)
     .is('removed_at', null)
   if (caseStaffData) {
     setSelectedStaff(caseStaffData)
     setOriginalStaff(caseStaffData)
   }
   ```

5. **Write tests** — See test plan below

### 3.3 — Room Conflict Detection (finish wiring)

1. **Add conflict warning JSX** — After the OR Room `<SearchableDropdown>` (after line 1168), add:
   ```tsx
   {roomConflicts.length > 0 && (
     <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-2">
       <svg ...warning icon... />
       <div>
         <p className="text-sm font-medium text-amber-800">
           Room has {roomConflicts.length} other case(s) on this date
         </p>
         <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
           {roomConflicts.map(c => (
             <li key={c.case_number}>
               {c.case_number} at {c.start_time}{c.surgeon_name ? ` (${c.surgeon_name})` : ''}
             </li>
           ))}
         </ul>
       </div>
     </div>
   )}
   ```

2. **Write tests** — See test plan below

### 3.4 — "Create Another" Post-Submit (not started)

1. **Add `resetFormForCreateAnother()` function** — Resets all state to defaults, preserving only `scheduled_date`:
   - Reset `formData` to initial values but keep `scheduled_date`
   - Clear `selectedStaff`, `selectedCompanyIds`, `selectedComplexityIds`
   - Reset `repRequiredOverride` to null
   - Clear `fieldErrors`, `error`
   - Reset `originalData` to new initial values (so dirty tracking works correctly)
   - Reset `caseNumberUnique` to null

2. **Modify success path** — Instead of `router.push('/cases')` after successful create, show:
   ```ts
   showToast({
     type: 'success',
     title: 'Case created',
     message: `${formData.case_number} created successfully`,
     action: {
       label: 'Create Another',
       onClick: resetFormForCreateAnother,
     },
   })
   router.push('/cases')
   ```
   **Note:** Need to decide if we navigate away AND show the toast action (toast persists across navigation) or stay on the create page. Current toast system auto-dismisses in ~5 seconds. If user clicks "Create Another" in the toast before it dismisses, we'd need to navigate back to `/cases/new`. **Alternative approach:** Don't navigate on create — instead show success + "Create Another" button inline, with a "Go to Cases" link. This avoids the timing issue.

3. **Write tests** — See test plan below

---

## Test Plan (all pending)

Tests should be added to `components/cases/__tests__/CaseForm.test.tsx` following the existing Phase 0/1/2 patterns.

### 3.1 Staff Assignment Tests
- `renders StaffMultiSelect component in create mode when facilityId is available`
- `passes selectedStaff and onChange to StaffMultiSelect`
- `passes surgeon_id as excludeUserIds to StaffMultiSelect`
- `includes p_staff_assignments in RPC call when staff are selected`
- `sends null for p_staff_assignments when no staff selected`
- `includes staff in draft save RPC call`

### 3.3 Room Conflict Tests
- `shows conflict warning when room has existing cases on same date`
- `hides conflict warning when no conflicts found`
- `hides conflict warning when room/date/time are not all filled`
- `excludes current case from conflict check in edit mode`
- `conflict warning does not block form submission`

### 3.4 Create Another Tests
- `shows success toast with Create Another action after case creation`
- `resets form but preserves scheduled_date when Create Another is clicked`
- `clears staff, companies, complexities on Create Another`
- `resets case number uniqueness state on Create Another`

### StaffMultiSelect Component Tests (new test file)
- `renders loading skeleton while fetching staff`
- `shows grouped sections (Nurses, Techs, Anesthesiologists)`
- `excludes surgeons from the list`
- `filters out excludeUserIds`
- `toggles staff selection on click`
- `shows selected staff as colored tags`
- `removes staff when tag X is clicked`
- `filters staff by search query`
- `shows selected count in footer`
- `clears all selections when Clear all is clicked`

---

## Architecture Notes

- The `StaffMultiSelect` component fetches its own data (like `ImplantCompanySelect`) rather than receiving staff as props from the parent. This is consistent with the existing pattern and avoids prop-drilling.
- The RPC accepts staff as JSONB rather than `UUID[]` because we need both `user_id` and `role_id` per assignment. Using JSONB allows structured data without needing a custom PostgreSQL type.
- Room conflict detection uses debounced queries (300ms) to avoid hammering the database on rapid field changes, consistent with the case number uniqueness check pattern.
- The `checkRoomConflicts` function uses a Supabase join (`users!cases_surgeon_id_fkey`) to get the surgeon name for each conflicting case, providing helpful context in the warning.
