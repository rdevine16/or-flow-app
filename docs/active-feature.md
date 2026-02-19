# Feature: Unify Anesthesiologist as Regular Staff Assignment

## Goal

Remove the dedicated `cases.anesthesiologist_id` column and treat anesthesiologists as regular staff members via the `case_staff` join table — same as nurses, techs, and any other non-surgeon role. This applies to both the web app and iOS app.

## Background

The codebase currently has a **dual-track system** for anesthesiologists:

1. **`cases.anesthesiologist_id`** — a dedicated FK column on the `cases` table pointing to `users.id`
2. **`case_staff` join table** — generic staff assignments (nurses, techs, anesthesiologists)

The demo generator dual-writes to both. The `CaseForm` has a dedicated `SearchableDropdown` for anesthesiologist separate from the `StaffMultiSelect`. Multiple RPCs accept `p_anesthesiologist_id`. The iOS app joins on the FK to display anesthesiologist names.

This complexity is unnecessary. Anesthesiologists should be assigned through `case_staff` like any other staff member.

## Key Decisions

| # | Decision | Answer |
|---|---|---|
| 1 | Dashboard assignment | Drag-and-drop like other staff (StaffAssignmentPanel) |
| 2 | Cardinality | Allow multiple anesthesiologists per case (no limit) |
| 3 | Amber color theme | Keep — distinct clinical role still deserves visual distinction |
| 4 | "Dr." prefix | Remove — only surgeons get "Dr." prefix |
| 5 | `get_anesthesiologist_block_stats` RPC | Drop — dead code, nothing calls it |
| 6 | `AnesthesiaPopover.tsx` | Delete — already dead code, not imported anywhere |
| 7 | iOS app | Update in same feature branch |
| 8 | Active feature file | Overwrite previous plan (scheduled_duration work is done) |

## Affected Systems

### Database
- `cases.anesthesiologist_id` column (to drop)
- `create_case_with_milestones` RPC (remove `p_anesthesiologist_id` param)
- `finalize_draft_case` RPC (remove `p_anesthesiologist_id` param)
- `get_anesthesiologist_block_stats` RPC (drop entirely)
- Surgeon scorecard function (joins on `cases.anesthesiologist_id`)

### Web App
- `components/cases/CaseForm.tsx` — dedicated dropdown, form state, RPC calls
- `components/cases/CaseSummary.tsx` — reads anesthesiologist as separate prop
- `components/cases/CompletedCaseView.tsx` — reads anesthesiologist as separate prop
- `components/cases/StaffMultiSelect.tsx` — already has "Anesthesiologists" section
- `components/ui/AnesthesiaPopover.tsx` — dead code, delete
- `app/cases/[id]/page.tsx` — FK join for anesthesiologist display
- `app/settings/users/page.tsx` — Dr. prefix for anesthesiologist
- `lib/validation/schemas.ts` — `anesthesiologist_id` field
- `lib/demo-data-generator.ts` — dual-write logic

### iOS App
- `Repositories/CaseRepository.swift` — FK join query
- `Models/SurgeonDay.swift` — anesthesiologist property on case model
- `Features/SurgeonHome/SurgeonHomeViewModel.swift` — "most common anesthesiologist" insight
- `Features/SurgeonHome/Components/SurgeonCaseDetailSheet.swift` — display
- `Features/Cases/CaseManagementSections.swift` — color mapping (keep)

---

## Phase 1: Data Migration (Small)

**Goal:** Ensure every `cases.anesthesiologist_id` value has a corresponding `case_staff` row, so nothing is lost when we switch readers.

### 1.1 — Create migration

**File:** `supabase/migrations/20260219100000_migrate_anesthesiologist_to_case_staff.sql`

```sql
-- Migrate cases.anesthesiologist_id → case_staff rows
-- Idempotent: skips cases that already have an anesthesiologist in case_staff

INSERT INTO public.case_staff (case_id, user_id, role_id)
SELECT
  c.id AS case_id,
  c.anesthesiologist_id AS user_id,
  ur.id AS role_id
FROM public.cases c
JOIN public.user_roles ur ON ur.name = 'anesthesiologist'
WHERE c.anesthesiologist_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.case_staff cs
    WHERE cs.case_id = c.id
      AND cs.user_id = c.anesthesiologist_id
      AND cs.role_id = ur.id
      AND cs.removed_at IS NULL
  );
```

### 1.2 — Apply & verify

- Run `supabase db push`
- Verify row counts match: `SELECT COUNT(*) FROM cases WHERE anesthesiologist_id IS NOT NULL` ≈ new `case_staff` rows created

### Phase 1 Commit
`feat(db): phase 1 - migrate anesthesiologist_id data to case_staff`

### Phase 1 Test Gate
1. **Unit:** Migration SQL is idempotent (running twice produces no duplicates)
2. **Integration:** `case_staff` rows exist for every case that had an `anesthesiologist_id`
3. **Workflow:** Existing app still works — column still exists, RPCs unchanged

---

## Phase 2: Web App — CaseForm & Data Layer (Medium)

**Goal:** Stop writing `anesthesiologist_id` on cases. The `StaffMultiSelect` already handles anesthesiologist selection — just remove the dedicated dropdown and RPC parameter.

### 2.1 — CaseForm.tsx

- Remove `anesthesiologist_id: string` from `FormData` interface (line 50)
- Remove `anesthesiologist_id: ''` from initial state (line 92)
- Remove `const [anesthesiologists, setAnesthesiologists] = useState(...)` (line 127)
- Remove the `useEffect` that fetches anesthesiologist users (lines 365-376)
- Remove `p_anesthesiologist_id` from all 3 RPC calls (lines 607, 733, 839)
- Remove `anesthesiologist_id` from the direct update object (line 709)
- Remove the dedicated `SearchableDropdown` for "Anesthesiologist" (section 8, lines 1372-1380)
- Remove `anesthesiologist_id` from edit mode population (line 431)
- In edit mode: load existing `case_staff` anesthesiologist entries into `selectedStaff` initial state
- Update `excludeUserIds` on StaffMultiSelect to also exclude surgeon (already done)
- Remove Dr. prefix from StaffMultiSelect anesthesiologist display (if present)

### 2.2 — Validation schemas

**File:** `lib/validation/schemas.ts`

- Remove `anesthesiologist_id: z.string().optional().or(z.literal(''))` from `createCaseSchema` (line 54)
- Remove same from `draftCaseSchema` (line 86)

### 2.3 — Settings users page

**File:** `app/settings/users/page.tsx`

- Line 631: Remove `|| roleName === 'anesthesiologist'` from the "Dr." prefix condition

### Phase 2 Commit
`feat(cases): phase 2 - remove dedicated anesthesiologist form field, use StaffMultiSelect`

### Phase 2 Test Gate
1. **Unit:** `npx tsc --noEmit` — clean compile, validation schemas pass
2. **Integration:** Create a case with anesthesiologist via StaffMultiSelect → verify `case_staff` row created
3. **Workflow:** Edit existing case → anesthesiologist appears in staff multi-select, not as separate field

---

## Phase 3: Web App — Display Components & Cleanup (Medium)

**Goal:** Switch all readers from `cases.anesthesiologist_id` FK join to `case_staff` join. Delete dead code.

### 3.1 — Case detail page

**File:** `app/cases/[id]/page.tsx`

- Remove `anesthesiologist:users!cases_anesthesiologist_id_fkey (id, first_name, last_name)` from query (line 201)
- Remove `anesthesiologist` type from the interface (line 81)
- Remove `const anesthesiologist = getJoinedValue(caseData?.anesthesiologist)` (line 996)
- Update team count: remove `+ (anesthesiologist ? 1 : 0)` (line 1483)
- Remove the dedicated `<TeamMember>` render for anesthesiologist (line 1487)
- The anesthesiologist will now appear naturally in the `assignedStaff` list from `case_staff`

### 3.2 — CaseSummary.tsx

- Remove `anesthesiologist` from props interface (line 45)
- Remove the anesthesiologist conditional render block (lines 357-375)
- Anesthesiologist will appear in the regular staff list from `case_staff`

### 3.3 — CompletedCaseView.tsx

- Remove `anesthesiologist` from props (line 91)
- Remove case header "Anesthesiologist" row (lines 704-708)
- Remove surgical team panel anesthesiologist section (lines 871-881)
- Anesthesiologist will appear in the staff list naturally

### 3.4 — Delete dead code

- Delete `components/ui/AnesthesiaPopover.tsx` entirely

### 3.5 — Demo data generator

**File:** `lib/demo-data-generator.ts`

- Remove `anesthesiologist_id` from `CaseRecord` interface (line 67)
- Remove `anesthesiologist_id: anesId` from case data (line 831)
- Keep writing to `case_staff` (already does this — line 898)
- Remove the `skipAnes` logic for 30% of hand/wrist cases (the staff assignment path handles it)

### Phase 3 Commit
`feat(cases): phase 3 - read anesthesiologist from case_staff, remove FK display logic`

### Phase 3 Test Gate
1. **Unit:** `npx tsc --noEmit` — clean compile
2. **Integration:** Case detail page shows anesthesiologist in staff list from case_staff
3. **Workflow:** View completed case → anesthesiologist appears in team section via staff assignments

---

## Phase 4: iOS App (Medium)

**Goal:** Update all iOS code to read anesthesiologist from `case_staff` instead of `cases.anesthesiologist_id`.

### 4.1 — CaseRepository.swift

- Remove `anesthesiologist:users!cases_anesthesiologist_id_fkey(first_name, last_name)` from query (line 184)
- Add `case_staff(user_id, role_id, user_roles(name), users(first_name, last_name))` join if not already present
- Filter for role name `'anesthesiologist'` in the results

### 4.2 — SurgeonDay.swift

- Remove `anesthesiologist: StaffInfo?` property from `SurgeonCase` (line 104)
- Add computed property that finds anesthesiologist(s) from a `staff` array
- Update `CodingKeys`, `init(from:)`, and manual init
- Update `anesthesiologistName` computed property

### 4.3 — SurgeonHomeViewModel.swift

- Update "most common anesthesiologist" insight (lines 135-136) to read from staff array instead of `case.anesthesiologistName`

### 4.4 — SurgeonCaseDetailSheet.swift

- Update display (line 140) to read from staff array
- Update preview data (line 259)

### 4.5 — CaseManagementSections.swift

- Keep `"anesthesiologist": .orbitOrange` color mapping — no change needed

### Phase 4 Commit
`feat(ios): phase 4 - read anesthesiologist from case_staff instead of cases column`

### Phase 4 Test Gate
1. **Unit:** Xcode build succeeds, no compile errors
2. **Integration:** Surgeon home shows anesthesiologist name from case_staff data
3. **Workflow:** Case detail sheet displays anesthesiologist correctly

---

## Phase 5: Database Cleanup (Medium)

**Goal:** Drop the column, update all RPCs, remove dead functions. This is the point of no return.

### 5.1 — Migration

**File:** `supabase/migrations/20260219200000_drop_anesthesiologist_id.sql`

```sql
-- 1. Drop the get_anesthesiologist_block_stats function (dead code)
DROP FUNCTION IF EXISTS public.get_anesthesiologist_block_stats(uuid, date, date);

-- 2. Recreate create_case_with_milestones WITHOUT p_anesthesiologist_id
-- (full function body, dropping the param and removing the column from INSERT)

-- 3. Recreate finalize_draft_case WITHOUT p_anesthesiologist_id
-- (full function body, dropping the param and removing the column from UPDATE)

-- 4. Update surgeon scorecard function to join through case_staff
-- instead of cases.anesthesiologist_id

-- 5. Drop the column
ALTER TABLE public.cases DROP COLUMN IF EXISTS anesthesiologist_id;
```

### 5.2 — Apply & verify

- Run `supabase db push`
- Verify column is gone: `SELECT anesthesiologist_id FROM cases LIMIT 1` → error
- Verify RPCs work: create a test case via RPC without `p_anesthesiologist_id`

### Phase 5 Commit
`feat(db): phase 5 - drop cases.anesthesiologist_id column, clean up RPCs`

### Phase 5 Test Gate
1. **Unit:** `npx tsc --noEmit` — clean compile (no code references the column)
2. **Integration:** `supabase db push` succeeds, RPCs callable without anesthesiologist param
3. **Workflow:** Full create → view → complete case flow works end-to-end

---

## Files Involved

### Modified Files (Web)
- `components/cases/CaseForm.tsx`
- `components/cases/CaseSummary.tsx`
- `components/cases/CompletedCaseView.tsx`
- `app/cases/[id]/page.tsx`
- `app/settings/users/page.tsx`
- `lib/validation/schemas.ts`
- `lib/demo-data-generator.ts`

### Deleted Files (Web)
- `components/ui/AnesthesiaPopover.tsx`

### New Files
- `supabase/migrations/20260219100000_migrate_anesthesiologist_to_case_staff.sql`
- `supabase/migrations/20260219200000_drop_anesthesiologist_id.sql`

### Modified Files (iOS)
- `Repositories/CaseRepository.swift`
- `Models/SurgeonDay.swift`
- `Features/SurgeonHome/SurgeonHomeViewModel.swift`
- `Features/SurgeonHome/Components/SurgeonCaseDetailSheet.swift`

### Test Files (may need updates)
- `lib/validation/__tests__/schemas.test.ts`
- `lib/dal/__tests__/cases.test.ts`
