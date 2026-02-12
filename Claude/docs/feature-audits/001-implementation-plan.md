# Case Creation Full Overhaul — Phased Implementation Plan

## Context

The Case Creation feature in ORbit has accumulated technical debt and gaps since its initial implementation. A comprehensive 9-round developer interview and codebase audit identified: critical bugs (useToast hook violation, no transaction wrapping), missing required field enforcement, no role-based access control, disconnected validation schemas, stale DAL references, and multiple UX gaps (no drafts, no bulk creation, no unsaved changes warning, no staff assignment at creation time). This plan addresses the **full overhaul** requested by the product owner.

---

## Phase 0: Critical Bug Fixes
**Goal:** Fix issues that could cause runtime failures or data corruption today.

### 0.1 — Fix useToast Hook Violation
- **File:** `components/cases/CaseForm.tsx`
- **Bug:** `useToast()` is called inside `initializeCaseMilestones()` (an async function) — violates React Rules of Hooks
- **Fix:** Move `useToast()` call to component top level (already destructured there as `toast`). Replace the inner `useToast()` call with the existing top-level `toast` reference passed into the function or captured via closure.

### 0.2 — Enforce Required Fields Before Submit
- **File:** `components/cases/CaseForm.tsx`
- **Bug:** `surgeon_id`, `procedure_type_id`, `or_room_id`, `scheduled_date` can be submitted as null/empty
- **Fix:** Add client-side validation in `handleSubmit()` that blocks submission and shows inline errors if any required field is empty. Required fields: `scheduled_date`, `start_time`, `surgeon_id`, `procedure_type_id`, `or_room_id`, `case_number`

### 0.3 — Zero Milestones Should Block Case Creation
- **File:** `components/cases/CaseForm.tsx`
- **Issue:** If `procedure_milestone_config` returns zero milestones for a procedure, the case still creates with no milestones, breaking downstream analytics
- **Fix:** After querying `procedure_milestone_config`, if zero milestones are returned, show an error toast ("No milestones configured for this procedure — contact admin") and abort case creation

---

## Phase 1: Transaction Safety + Form Restructure + Inline Validation
**Goal:** Atomic case creation, reordered form matching mental model, real-time validation.

### 1.1 — Create Supabase RPC for Atomic Case Creation
- **New file:** SQL migration for `create_case_with_milestones()` RPC function
- **Logic:** Single transaction that:
  1. Inserts into `cases` (with new `created_by`, `created_at` columns)
  2. Queries `procedure_milestone_config` for the procedure + facility
  3. Inserts all `case_milestones` rows with `recorded_at = NULL`
  4. Returns the created case ID
  5. Rolls back entirely on any failure
- **Pattern:** Follow existing RPC patterns in codebase (e.g., `supabase.rpc('function_name', { params })`)
- **CaseForm update:** Replace the two-step insert (case INSERT then milestone INSERT) with a single `supabase.rpc('create_case_with_milestones', { ... })` call

### 1.2 — Restructure Form Field Order
- **File:** `components/cases/CaseForm.tsx`
- **New order** (matching coordinator mental model):
  1. **Date & Time** (scheduled_date, start_time)
  2. **Surgeon** (surgeon_id) — with preference quick-fill
  3. **Procedure** (procedure_type_id) + **Operative Side** (laterality)
  4. **Room** (or_room_id)
  5. **Case Number** (case_number) — with real-time uniqueness check
  6. **Estimated Duration** (estimated_duration_minutes)
  7. **Anesthesia Type** (anesthesia_type)
  8. **Device/Implant Company** + Rep Required toggle
  9. **Staff Assignment** (new — multi-select)
  10. **Notes** (notes)

### 1.3 — Inline Validation with Zod
- **File:** `lib/validation/schemas.ts` — update `createCaseSchema` to match actual form fields
- **File:** `components/cases/CaseForm.tsx` — wire Zod validation per-field on blur and on submit
- **Behavior:** Red border + error message below field on blur if invalid; all errors shown on submit attempt
- **Reuse:** Existing `validate()` helper from schemas.ts, existing `ValidationError` class

### 1.4 — Real-Time Case Number Uniqueness Check
- **File:** `components/cases/CaseForm.tsx`
- **Behavior:** Debounced (300ms) query to check `cases` table for existing `case_number` within the facility on blur of case number field
- **UI:** Green checkmark if unique, red error if duplicate

### 1.5 — Add `created_by` / `created_at` to Cases
- **Migration:** Add `created_by UUID REFERENCES auth.users(id)` and `created_at TIMESTAMPTZ DEFAULT now()` columns to `cases` table
- **CaseForm:** Pass authenticated user ID as `created_by` in the RPC call
- **Audit:** Already logged via `caseAudit.created()` — no change needed

---

## Phase 2: Draft Cases + Incomplete Case Modal + Role Access + Unsaved Changes
**Goal:** Support partial saves, enforce data completeness, restrict access by role.

### 2.1 — Draft Cases (`is_draft` Boolean)
- **Migration:** Add `is_draft BOOLEAN DEFAULT false` to `cases` table
- **CaseForm:** Add "Save as Draft" button alongside "Create Case"
- **Drafts skip:** milestone pre-creation, required field validation (except date)
- **Cases list:** Show drafts in main list with a visual indicator (e.g., dashed border, "Draft" badge)
- **File:** `app/cases/page.tsx` — add draft filter option, draft indicator in list rows

### 2.2 — Blurry Modal on Incomplete Case Detail
- **File:** `app/cases/[id]/page.tsx`
- **Logic:** On case detail load, check if `surgeon_id`, `procedure_type_id`, `or_room_id`, or `laterality` (when required by procedure) is null
- **UI:** Overlay a modal (using existing `components/ui/Modal.tsx`) that blurs the background and forces the user to fill in missing fields before accessing the case
- **Fields in modal:** Only the missing required fields, pre-populated with any existing data

### 2.3 — Role-Based Access Control
- **New role:** `coordinator` / `scheduler` (between `user` and `facility_admin`)
- **File:** `lib/UserContext.tsx` — add `isCoordinator` to access level checks
- **File:** `app/cases/page.tsx` — hide "New Case" button unless `isAdmin || isFacilityAdmin || isCoordinator`
- **File:** `app/cases/new/page.tsx` — redirect unauthorized users
- **Note:** RLS policies in Supabase should also be updated (separate migration)

### 2.4 — Unsaved Changes Warning
- **File:** `components/cases/CaseForm.tsx`
- **Reuse:** Existing `LeaveConfirm` component from `components/ui/ConfirmDialog.tsx` (already built, just not wired up)
- **Implementation:** Track form dirty state, wire `LeaveConfirm` to show on navigation attempts when form is dirty

---

## Phase 3: Staff Assignment + Duplicate Case + Room Conflict Warnings
**Goal:** Complete the creation workflow with staff, enable case duplication, warn on scheduling conflicts.

### 3.1 — Staff Assignment at Creation
- **File:** `components/cases/CaseForm.tsx`
- **UI:** Multi-select component for staff (role-based: circulating nurse, scrub tech, anesthesiologist, etc.)
- **Note:** Current `components/ui/SearchableDropdown.tsx` is single-select only — need to either extend it or build a `MultiSelectDropdown` variant
- **Data:** Insert into `case_staff` table as part of the RPC transaction (extend `create_case_with_milestones` to accept staff array)

### 3.2 — Duplicate / "Create Similar" Case
- **File:** `app/cases/[id]/page.tsx` — add "Duplicate" button
- **Behavior:** Navigate to `/cases/new?from={caseId}`, pre-populate form with all fields from source case except: `case_number`, `scheduled_date`, milestone data
- **File:** `components/cases/CaseForm.tsx` — read `from` query param, fetch source case, populate form

### 3.3 — Room/Time Conflict Detection (Warning Only)
- **File:** `components/cases/CaseForm.tsx`
- **Trigger:** On room + date + time selection
- **Query:** Check `cases` table for overlapping time slots in the same room on the same date
- **UI:** Yellow warning banner: "Room X has a case scheduled at this time" — does NOT block submission
- **Block schedule integration:** Query `block_schedules` to show surgeon availability hints (informational, not restrictive)

### 3.4 — "Create Another" Post-Submit Option
- **File:** `components/cases/CaseForm.tsx`
- **Behavior:** After successful creation, show success toast with "Create Another" action button (using existing toast `action` parameter)
- **"Create Another":** Resets form but preserves `scheduled_date` and `surgeon_id` (common shared fields)

---

## Phase 4: Bulk Case Creation
**Goal:** Dedicated page for creating multiple cases efficiently.

### 4.1 — Bulk Creation Page
- **New file:** `app/cases/bulk-create/page.tsx`
- **Layout:** Shared header fields (date, surgeon) + spreadsheet-style rows below
- **Each row:** procedure, time, operative side, implant company, rep required toggle
- **Actions:** Add row, remove row, submit all
- **Backend:** Loop through rows calling the `create_case_with_milestones` RPC for each (or create a bulk RPC if performance warrants)
- **Validation:** Validate each row independently, highlight errors per-row
- **Access:** Link from cases list page, same role restrictions as single create

### 4.2 — Operative Side Config
- **Migration:** Add `requires_operative_side BOOLEAN DEFAULT false` to `procedure_types` table (doesn't exist yet)
- **CaseForm:** Conditionally show laterality field based on selected procedure's `requires_operative_side` flag
- **Bulk form:** Same conditional logic per row

---

## Phase 5: Demo Generator + DAL/Schema Cleanup + Testing Foundation
**Goal:** Align all code paths, fix stale references, establish testing baseline.

### 5.1 — Demo Data Generator Audit & Fix
- **File:** `lib/demo-data-generator.ts`
- **Tasks:**
  - Verify milestone creation matches current `procedure_milestone_config` schema (uses `facility_milestone_id`, not `milestone_type_id`)
  - Verify all required related records are created (case_staff, case_implant_companies, etc.)
  - Ensure trigger disable/re-enable is safe and complete
  - Update to use `created_by` field
  - Test with fresh database to confirm full data pipeline works

### 5.2 — DAL Schema Alignment
- **File:** `lib/dal/cases.ts`
- **Tasks:**
  - Update `CaseMilestone` interface: replace `milestone_type_id` with `facility_milestone_id`
  - Update `CASE_DETAIL_SELECT`: fix milestone join to use correct column
  - Update `recordMilestone`: fix upsert conflict column
  - Verify all interfaces match current database schema
  - Add new DAL methods if needed for draft cases, bulk operations

### 5.3 — Validation Schema Alignment
- **File:** `lib/validation/schemas.ts`
- **Tasks:**
  - Rewrite `createCaseSchema` to match actual form fields (remove `patient_name`, `patient_mrn`; add `case_number`, `laterality`, etc.)
  - Add `bulkCreateCaseSchema` for bulk creation
  - Add `draftCaseSchema` (relaxed validation)
  - Ensure CaseForm actually imports and uses these schemas

### 5.4 — Testing Foundation
- **New files:** Test files for critical paths
- **Priority tests:**
  1. RPC function: case + milestones created atomically
  2. Required field validation blocks submission
  3. Case number uniqueness check
  4. Draft save/resume workflow
  5. Role-based access (coordinator can create, regular user cannot)
- **Approach:** Start with integration tests against Supabase (no unit test infra exists yet)

---

## File Impact Summary

| File | Phases | Changes |
|------|--------|---------|
| `components/cases/CaseForm.tsx` | 0,1,2,3 | Bug fixes, restructure, validation, staff, duplicate, conflicts |
| `lib/validation/schemas.ts` | 1,5 | Rewrite schemas to match form |
| `lib/dal/cases.ts` | 5 | Fix stale milestone references |
| `app/cases/new/page.tsx` | 2 | Role guard |
| `app/cases/page.tsx` | 2,4 | Draft indicator, role guard, bulk link |
| `app/cases/[id]/page.tsx` | 2,3 | Blurry modal, duplicate button |
| `lib/demo-data-generator.ts` | 5 | Schema alignment |
| `lib/UserContext.tsx` | 2 | Coordinator role |
| `components/ui/SearchableDropdown.tsx` | 3 | Multi-select variant (or new component) |
| **NEW:** SQL migration(s) | 1,2,4 | RPC, is_draft, created_by, requires_operative_side |
| **NEW:** `app/cases/bulk-create/page.tsx` | 4 | Bulk creation page |

## Verification Plan

After each phase:
1. **Manual testing:** Create a case end-to-end, verify milestones pre-created, check audit log entry
2. **Database verification:** Query `cases`, `case_milestones`, `case_staff` to confirm correct data
3. **Error paths:** Submit with missing fields, duplicate case numbers, overlapping rooms
4. **Role testing:** Test as admin, coordinator, and regular user
5. **Draft workflow:** Save draft, resume, complete, verify milestone creation on finalize
6. **Bulk creation:** Create 5+ cases, verify all have correct milestones and data
7. **Demo generator:** Run demo data generation, verify all tables populated correctly

## Dependencies & Ordering

- Phase 0 has **no dependencies** — can start immediately
- Phase 1.1 (RPC) is the foundation for Phases 1.2-1.5 and beyond
- Phase 2.1 (drafts) depends on Phase 1.1 (RPC needs draft awareness)
- Phase 3.1 (staff) depends on Phase 1.1 (RPC extension)
- Phase 4 depends on Phase 1 (reuses validation + RPC patterns)
- Phase 5 can run in parallel with Phases 3-4 (independent cleanup)
