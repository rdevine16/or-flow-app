# Phase 5 Progress Report — Demo Generator + DAL/Schema Cleanup + Testing Foundation

**Last updated:** 2026-02-11
**Status:** COMPLETE

---

## Scope

| Sub-task | Description | Status |
|----------|-------------|--------|
| 5.1 | Demo Data Generator Audit & Fix | **COMPLETE** |
| 5.2 | DAL Schema Alignment | **COMPLETE** |
| 5.2b | Lookups DAL Milestone Fix | **COMPLETE** |
| 5.3 | Validation Schema Alignment | **COMPLETE** |
| 5.4 | Testing Foundation | **COMPLETE** |

### UI/UX Decisions Made (from interview)

- **patient_name/patient_mrn:** Not in DB — removed from DAL interface and SELECT strings
- **Demo created_by:** Dedicated system user — resolves facility admin as fallback
- **recordMilestone callers:** Fix DAL + all callers (none found in production code)
- **Test approach:** Mocked tests matching existing Phases 0-4 pattern

---

## All Files Modified / Created

| File | Type | What changed |
|------|------|-------------|
| `lib/dal/cases.ts` | **Modified** | 6 fixes: remove patient_name/patient_mrn from interface + SELECT, fix CaseMilestone to facility_milestone_id, fix CASE_DETAIL_SELECT join, fix recordMilestone method, fix search to use ilike |
| `lib/dal/lookups.ts` | **Modified** | Added FacilityMilestone type, replaced stale milestoneTypes() with facilityMilestones() using correct columns |
| `lib/validation/schemas.ts` | **Modified** | Fixed recordMilestoneSchema: milestone_id → facility_milestone_id |
| `lib/demo-data-generator.ts` | **Modified** | Added createdByUserId to GenerationConfig, system user resolution (facility admin fallback), created_by on all generated cases |
| `app/dashboard/data-quality/page.tsx` | **Modified** | Fixed stale comment: "need to get milestone_type_id" → "Insert new milestone row with facility_milestone_id" |
| `lib/dal/__tests__/cases.test.ts` | **Rewritten** | 11 tests: type alignment (6) + DAL method tests (5) |
| `lib/dal/__tests__/lookups.test.ts` | **NEW** | 6 tests: FacilityMilestone type + facilityMilestones() method |
| `lib/validation/__tests__/schemas.test.ts` | **Modified** | 11 new tests: recordMilestoneSchema (7) + draftCaseSchema (4) |
| `lib/__tests__/demo-data-generator.test.ts` | **NEW** | 8 tests: config types, surgeon profiles, milestone schema verification |

---

## What Was Implemented

### 5.1 Demo Data Generator Audit & Fix

**Audit findings:**
- Milestone schema: Already correct — uses `facility_milestone_id` throughout (both completed and future cases)
- Related records: All created correctly (case_staff, case_implants, case_milestones, case_milestone_stats)
- Trigger safety: Complete — all code paths (success, error, catch) re-enable triggers
- `created_by`: Was missing — now added

**Changes:**
1. Added `createdByUserId?: string` to `GenerationConfig` interface
2. In `generateDemoData()`, resolves system user: uses provided ID, or looks up facility admin as fallback
3. Passed `systemUserId` through to `generateSurgeonCases()`
4. Set `created_by: createdByUserId` on every generated case object
5. Backward compatible — `createdByUserId` is optional, existing callers unaffected

### 5.2 DAL Schema Alignment

**6 confirmed issues fixed in `lib/dal/cases.ts`:**

1. **`CaseListItem` interface:** Removed `patient_name` and `patient_mrn` (columns don't exist in DB)
2. **`CASE_LIST_SELECT`:** Removed `patient_name, patient_mrn` from SELECT string
3. **`CaseMilestone` interface:** Changed `milestone_type_id` → `facility_milestone_id`, changed join type from `milestone_type` to `facility_milestone` with correct shape (name, display_name, display_order)
4. **`CASE_DETAIL_SELECT`:** Changed milestone join from `milestone_type:milestone_types(name, key, display_order)` to `facility_milestone:facility_milestones(name, display_name, display_order)`
5. **`recordMilestone()` method:** Renamed param `milestoneTypeId` → `facilityMilestoneId`, upsert column `milestone_type_id` → `facility_milestone_id`, conflict `case_id,milestone_type_id` → `case_id,facility_milestone_id`, select string updated
6. **`search()` method:** Removed `patient_name.ilike` from `.or()` filter, changed to `.ilike('case_number', ...)` since patient_name doesn't exist in DB

**Caller analysis:** `casesDAL.recordMilestone()` has zero callers in production code — the case detail page writes directly to Supabase (already using `facility_milestone_id` correctly). No caller updates needed.

### 5.2b Lookups DAL Milestone Fix

**`lib/dal/lookups.ts`:**
- Added `FacilityMilestone` interface (id, name, display_name, display_order, is_active, source_milestone_type_id)
- Replaced `milestoneTypes()` method (which used stale `milestone_type_id` column on facility_milestones) with `facilityMilestones()` method that queries facility_milestones directly using correct columns
- `lookupsDAL.milestoneTypes()` had zero callers in production code — safe replacement

### 5.3 Validation Schema Alignment

**Audit findings:**
- `createCaseSchema`: Already correct (matches CaseForm fields from Phase 1)
- `draftCaseSchema`: Already correct (added in Phase 2)
- `bulkCaseRowSchema` + `bulkCaseSubmissionSchema`: Already correct (added in Phase 4)
- CaseForm imports and uses schemas: Confirmed (imports createCaseSchema, draftCaseSchema, validateField)

**One fix:**
- `recordMilestoneSchema`: Changed `milestone_id` → `facility_milestone_id` to match v2.0 schema

### 5.4 Testing Foundation

**36 new tests written across 4 files. Total: 170 tests, 11 files, 0 failures.**

#### DAL Tests (11 tests in `lib/dal/__tests__/cases.test.ts`)
- [x] CaseListItem does not include patient_name or patient_mrn
- [x] CaseListItem includes created_by field
- [x] CaseListItem allows null created_by
- [x] CaseMilestone uses facility_milestone_id instead of milestone_type_id
- [x] CaseMilestone includes facility_milestone join shape
- [x] CaseDetail inherits from CaseListItem without patient fields
- [x] recordMilestone should upsert with facility_milestone_id column
- [x] recordMilestone should select facility_milestone_id in return data
- [x] recordMilestone should return error when upsert fails
- [x] search should search by case_number only (no patient_name)

Note: Previous Phase 1.5 DAL tests (3 tests) were replaced by the 11 Phase 5.2 tests above.

#### Lookups DAL Tests (6 tests in `lib/dal/__tests__/lookups.test.ts`) — NEW
- [x] FacilityMilestone should include source_milestone_type_id instead of milestone_type_id
- [x] FacilityMilestone should allow null source_milestone_type_id for custom milestones
- [x] facilityMilestones should query facility_milestones table directly
- [x] facilityMilestones should return empty array when no milestones found
- [x] facilityMilestones should return error when query fails

#### Validation Schema Tests (11 new tests in `lib/validation/__tests__/schemas.test.ts`)
- [x] recordMilestoneSchema accepts valid milestone recording with facility_milestone_id
- [x] recordMilestoneSchema uses facility_milestone_id not milestone_id or milestone_type_id
- [x] recordMilestoneSchema rejects non-UUID case_id
- [x] recordMilestoneSchema rejects non-UUID facility_milestone_id
- [x] recordMilestoneSchema rejects non-ISO timestamp
- [x] recordMilestoneSchema accepts optional recorded_by and notes
- [x] recordMilestoneSchema rejects notes over 500 characters
- [x] draftCaseSchema requires only scheduled_date
- [x] draftCaseSchema rejects empty scheduled_date
- [x] draftCaseSchema accepts all fields as empty strings
- [x] draftCaseSchema accepts a fully-populated draft

#### Demo Generator Tests (8 tests in `lib/__tests__/demo-data-generator.test.ts`) — NEW
- [x] GenerationConfig accepts createdByUserId as optional field
- [x] GenerationConfig accepts createdByUserId when provided
- [x] SurgeonProfileInput has required fields for generation
- [x] SurgeonProfileInput supports all speed profiles
- [x] SurgeonProfileInput supports all specialties
- [x] SurgeonProfileInput supports flip room configuration
- [x] Demo generator should use facility_milestone_id in milestone records
- [x] Demo generator should set created_by on generated case data
- [x] Demo generator should initialize future case milestones with null recorded_at

---

## Codebase-Wide `milestone_type_id` Audit

During Phase 5, a full audit of `milestone_type_id` references was conducted across the codebase:

| Location | Status | Notes |
|----------|--------|-------|
| `case_milestones` table | **DROPPED** | Column removed in v2.0. All code uses `facility_milestone_id` |
| `lib/dal/cases.ts` CaseMilestone | **FIXED (Phase 5)** | `milestone_type_id` → `facility_milestone_id` |
| `lib/dal/cases.ts` CASE_DETAIL_SELECT | **FIXED (Phase 5)** | Join changed to `facility_milestones` |
| `lib/dal/cases.ts` recordMilestone | **FIXED (Phase 5)** | Param, upsert, conflict all fixed |
| `lib/dal/lookups.ts` milestoneTypes | **FIXED (Phase 5)** | Replaced with `facilityMilestones()` |
| `lib/validation/schemas.ts` recordMilestoneSchema | **FIXED (Phase 5)** | `milestone_id` → `facility_milestone_id` |
| `app/dashboard/data-quality/page.tsx` | **FIXED (Phase 5)** | Stale comment updated |
| `facility_milestones.source_milestone_type_id` | **CORRECT** | FK to global milestone_types, intentional |
| `surgeon_milestone_averages.milestone_type_id` | **CORRECT** | Analytics table uses global type IDs |
| `surgeon_milestone_stats.milestone_type_id` | **CORRECT** | Analytics table uses global type IDs |
| `case_milestone_stats.milestone_type_id` | **CORRECT** | Stats table uses global type IDs |
| `types/pace.ts` | **CORRECT** | References analytics tables, which do use `milestone_type_id` |
| `app/cases/[id]/page.tsx` recordMilestone | **CORRECT** | Already uses `facility_milestone_id` (inline Supabase, not DAL) |
| `lib/demo-data-generator.ts` | **CORRECT** | Already uses `facility_milestone_id` |
| `supabase/migrations/` trigger fix | **CORRECT** | Phase 3 migration already removed stale reference |

---

## Known Issues / Follow-ups

1. **casesDAL is not wired to production code** — The DAL methods are correct but no page/component imports from `casesDAL`. The case detail page and others write directly to Supabase. Future migration to DAL is a separate effort.
2. **`CaseForAnalytics` references denormalized columns** (`patient_in_at`, `patient_out_at`, etc.) — These may or may not exist on the `cases` table. No callers use `casesDAL.listForAnalytics()` so this is a deferred cleanup.
3. **Pre-existing TypeScript errors in test files** — 12 pre-existing TS errors in Phase 0-4 test files (bulk-create, CaseForm, SearchableDropdown, logger). None from Phase 5 changes.
4. **Pre-existing benign `act()` warnings** — Phase 3 conflict detection tests produce React act() warnings in stderr (cosmetic only).
