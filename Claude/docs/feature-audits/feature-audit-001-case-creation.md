# Feature Audit Brief #001: Case Creation

## Purpose

This document provides a complete audit of the "Create a Case" feature in ORbit — a surgical analytics platform for ambulatory surgery centers. It is designed to be handed to Claude Code so it can review the actual codebase, ask the developer targeted questions about gaps, and implement improvements.

**Claude Code: Read this entire document before reviewing any files. Then review the files listed in Section 3. Then conduct the interview in Section 7.**

---

## 1. What This Feature Does

A user (typically an OR coordinator, charge nurse, or admin) creates a new surgical case on the schedule. This is the foundational action in ORbit — every analytics metric, scorecard calculation, financial report, and utilization number downstream depends on cases being created correctly and completely.

### The User Flow

1. User navigates to the Cases page and clicks "Add Case" (or similar)
2. A `CaseForm` component renders with fields for the case details
3. User fills in: surgeon, procedure, room, date, time, patient name, and optionally payer, staff assignments, and other metadata
4. User submits
5. The app INSERTs a row into the `cases` table
6. The app reads `procedure_milestone_config` to determine which milestones apply to this procedure at this facility
7. The app pre-creates rows in `case_milestones` — one per expected milestone — with `recorded_at = NULL`
8. Additional related records may be created (staff assignments, etc.)
9. User is redirected to the case list or the new case detail page

---

## 2. Database Tables Involved

### 2.1 Primary Table: `cases`

The central table. Every case is one row.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| case_number | text | Human-readable (e.g., "RW-00349") |
| facility_id | uuid (FK → facilities) | Scoped to a facility |
| surgeon_id | uuid (FK → users) | Primary surgeon |
| procedure_type_id | uuid (FK → procedure_types) | What procedure |
| or_room_id | uuid (FK → or_rooms) | Which OR room |
| status_id | uuid (FK → case_statuses) | Defaults to "scheduled" on creation |
| scheduled_date | date | Date of the case |
| start_time | time | Scheduled start time |
| patient_name | text | Patient identifier |
| data_validated | boolean | False on creation; true when data is reviewed |
| is_excluded_from_metrics | boolean | False on creation |

**Triggers on `cases` table:** 8 total (most of any table in the system). These fire on INSERT and UPDATE. Claude Code should identify all 8 and verify they handle the creation path correctly.

**Key questions for Claude Code to investigate:**
- Is `case_number` auto-generated or user-entered? Is it unique per facility?
- What happens if the user picks a room that already has a case at that time? Is there overlap validation?
- Is `status_id` set automatically to "scheduled" or does the form set it?

### 2.2 `case_milestones` — Pre-created on case creation

When a case is created, `CaseForm.tsx` pre-creates rows here with `recorded_at = NULL`. This tells the UI which milestones to display for this case.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| case_id | uuid (FK → cases) | |
| facility_milestone_id | uuid (FK → facility_milestones) | **Primary key for all operations** |
| recorded_at | timestamptz | NULL = not yet recorded |
| recorded_by | uuid (FK → users) | NULL until recorded |

**Critical context:** The system previously had a dual-ID pattern with both `facility_milestone_id` and `milestone_type_id`. As of the v2.0 milestone cleanup, `milestone_type_id` has been DROPPED. All queries must use `facility_milestone_id` exclusively. When global type info is needed for analytics, JOIN through `facility_milestones.source_milestone_type_id`.

**Pre-creation logic lives in:** `CaseForm.tsx` (around line 296-340 based on past review). It queries `procedure_milestone_config` for the selected procedure, then bulk-INSERTs milestone rows.

**Claude Code should verify:**
- Does the pre-creation handle custom milestones (where `source_milestone_type_id` is NULL)?
- What happens if `procedure_milestone_config` has no entries for the selected procedure? Does it fall back to all facility milestones?
- Is there error handling if the milestone INSERT fails? Does the case still get created without milestones (orphaned case)?
- Is the INSERT wrapped in a transaction with the case creation?

### 2.3 `case_statuses` — Lookup table

| Status | Description |
|--------|-------------|
| scheduled | Default for new cases |
| in_progress | Case has started (first milestone recorded) |
| completed | Case is finished |
| cancelled | Case was cancelled |
| on_hold | Temporarily paused |

**Claude Code should verify:** Is the transition from "scheduled" to "in_progress" automatic (trigger-based) or manual? There's a trigger called `trigger_update_patient_status_from_milestone` that may handle this.

### 2.4 `case_staff` — Staff assignments

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| case_id | uuid (FK → cases) | |
| user_id | uuid (FK → users) | |
| role_id | uuid (FK → roles) | Their role on this case |

**Claude Code should verify:**
- Is staff assigned during case creation or after (on the case detail page)?
- Is the surgeon automatically added to `case_staff` when the case is created, or is `cases.surgeon_id` the only surgeon reference?
- Can a case exist with zero staff assignments?

### 2.5 Reference Tables Read During Creation

These are not written to during case creation but are queried to populate dropdowns and drive logic:

| Table | Purpose | Scoped To |
|-------|---------|-----------|
| `facilities` | User's facility context | Global |
| `users` (filtered by role) | Surgeon dropdown, staff selection | Facility |
| `procedure_types` | Procedure dropdown | Facility |
| `or_rooms` | Room dropdown | Facility |
| `facility_milestones` | Milestone definitions | Facility |
| `procedure_milestone_config` | Which milestones for which procedure | Facility + Procedure |
| `payers` | Insurance payer dropdown (if captured at creation) | Facility |
| `roles` | Staff role assignments | Facility |
| `block_schedules` | Could be used to suggest room/time | Facility |

### 2.6 Tables Written To DOWNSTREAM (not at creation, but triggered later)

These tables are populated after the case progresses — but their schema requirements mean the case must be created correctly for them to work:

| Table | When Populated | Depends On |
|-------|---------------|------------|
| `case_completion_stats` | When `data_validated` = true (trigger: `record_case_stats()`) | Correct milestones, surgeon, room, procedure, payer |
| `surgeon_milestone_averages` | Recalculated via RPC | Milestone timestamps + facility_milestone_id |
| `surgeon_procedure_averages` | Recalculated via RPC | Complete case data |
| `case_milestone_stats` | Materialized view refresh | Milestone timestamps |

**This is critical:** If a case is created missing its `procedure_type_id`, `or_room_id`, or `surgeon_id`, the downstream analytics pipeline will either error or produce incorrect results. The form MUST enforce that all required fields are populated.

---

## 3. Files to Review

Claude Code should examine these files in the codebase. Paths are approximate — search for the actual locations.

### Web App (Next.js)

| File | What It Does |
|------|-------------|
| `components/cases/CaseForm.tsx` | **PRIMARY FILE** — the form component for creating/editing cases |
| `app/cases/new/page.tsx` or equivalent | The page route that renders CaseForm for creation |
| `app/cases/[id]/page.tsx` | Case detail page — shows how a created case is consumed |
| `app/cases/page.tsx` | Case list page — shows created cases |
| Any file referencing `from('cases').insert` | All case creation paths |
| Any file referencing `from('case_milestones').insert` | All milestone pre-creation paths |

### iOS App (SwiftUI)

| File | What It Does |
|------|-------------|
| `CasesView.swift` | Case list |
| `CaseDetailView.swift` | Case detail with milestone recording |
| `CaseViewModel.swift` or similar | Data layer for cases |
| Any file with `case_milestones` references | iOS milestone handling |

### Database

| Item | What To Check |
|------|--------------|
| All 8 triggers on `cases` table | What fires on INSERT? |
| `trigger_update_patient_status_from_milestone` | Auto-status transitions |
| `record_case_stats()` function | Downstream data pipeline |
| `calculate_case_stats()` function | Core calculation engine |
| RLS policies on `cases` | Who can create cases? |
| RLS policies on `case_milestones` | Who can create milestones? |

---

## 4. Known Issues and Technical Debt

Based on prior audit work, these issues exist in or around case creation:

### 4.1 No Transaction Wrapping
Case creation and milestone pre-creation are separate operations. If milestone creation fails, the case exists without milestones. This means the case detail page will show zero milestones, and the case will appear broken.

**Ideal fix:** Wrap case INSERT + milestone INSERTs in a Supabase RPC function that runs as a single transaction, or use Supabase's `.insert()` with proper error handling that deletes the case if milestones fail.

### 4.2 Milestone Pre-Creation Is App Code, Not a Trigger
The pre-creation logic lives in `CaseForm.tsx` (client-side). This means:
- Cases created via the demo data generator use different logic
- Cases created from iOS (if ever implemented) would need to replicate this
- There's no database-level guarantee that a case has its milestones

**Ideal fix:** Move milestone pre-creation to a database trigger on `cases` INSERT, or to an RPC function that both web and iOS call.

### 4.3 No Room/Time Conflict Detection
Based on prior review, there's no validation preventing two cases from being scheduled in the same room at the same time. The block scheduling system exists separately but isn't enforced during case creation.

### 4.4 iOS Cannot Create Cases
The iOS app can view and record milestones on existing cases but has no case creation flow. All cases must be created via the web app.

### 4.5 Case Number Generation
Unclear whether case numbers are auto-generated with a facility-specific prefix or manually entered. If manual, there's potential for duplicates. If auto, Claude Code should verify the generation logic handles concurrent creation.

### 4.6 Payer Assignment Timing
It's unclear whether payer is assigned at case creation or later. Financial analytics (`case_completion_stats`) need `payer_id` to calculate reimbursement. If payer isn't set at creation, there needs to be a clear workflow for adding it before the case is validated.

---

## 5. What "Fully Baked" Looks Like

A production-ready case creation feature should have:

### Data Integrity
- [ ] All required fields enforced (surgeon, procedure, room, date, time)
- [ ] Case + milestones created atomically (transaction or RPC)
- [ ] Room/time conflict detection (warn or prevent double-booking)
- [ ] Case number uniqueness enforced per facility
- [ ] Status automatically set to "scheduled"
- [ ] `facility_id` automatically set from user's session context

### User Experience
- [ ] Form pre-populates facility-scoped dropdowns (surgeons, procedures, rooms, payers)
- [ ] Room dropdown filters by availability (no rooms already booked at that time)
- [ ] Procedure selection drives which milestones will be tracked
- [ ] Clear validation messages for missing required fields
- [ ] Loading states during submission
- [ ] Error handling with user-friendly messages
- [ ] Redirect to case detail or case list after creation
- [ ] Ability to assign staff (surgeon, anesthesiologist, nurse, tech) during creation

### Integration with Block Scheduling
- [ ] If the surgeon has a block in a room, suggest that room
- [ ] If the time falls outside scheduled block hours, warn the user
- [ ] Block utilization analytics need to correlate cases to blocks

### Analytics Readiness
- [ ] Every field that `case_completion_stats` needs should be populated or have a clear workflow to populate before validation
- [ ] Milestone pre-creation must match `procedure_milestone_config` exactly
- [ ] The `data_validated` field defaults to false — there should be a validation workflow

### Security & Access Control
- [ ] RLS policies restrict case creation to appropriate roles (admin, coordinator — not read-only staff)
- [ ] Cases can only be created within the user's own facility
- [ ] Audit trail: who created the case and when (created_at, created_by columns or equivalent)

---

## 6. Edge Cases to Test

Claude Code should verify how the system handles each of these:

1. **Creating a case with a procedure that has zero milestone configurations** — does it create a case with no milestones? Is this valid?
2. **Creating a case on a date when the selected room is closed** (no `available_hours` for that day)
3. **Creating two cases in the same room at the same time** — what happens?
4. **Creating a case for a surgeon who has a block in a different room at that time**
5. **Form submission while offline or with network interruption** — partial data?
6. **Creating a case and immediately navigating away** — do milestones still get created?
7. **Selecting a surgeon then changing the procedure** — do the milestone pre-creation options update?
8. **A facility with custom milestones** (e.g., `array_start`, `array_end` with no `source_milestone_type_id`) — are these included in pre-creation?
9. **Case creation by different user roles** — can a surgeon create their own case? Can staff?
10. **Concurrent case creation** — two users creating cases simultaneously for the same room/time

---

## 7. Claude Code Interview Questions

**Claude Code: After reviewing the codebase against this brief, ask the developer these questions. Adapt based on what you find — skip questions you can answer from the code, and add new ones based on issues you discover.**

### Architecture Questions
1. Is case creation wrapped in a transaction with milestone pre-creation? If not, what happens on partial failure?
2. Where does case number generation logic live? Is it a database sequence, app-side counter, or user-entered?
3. Why is milestone pre-creation in app code rather than a database trigger? Was this intentional?
4. Are there any plans to allow case creation from the iOS app?

### Validation Questions
5. What validation exists for room/time conflicts? Can two cases be scheduled in the same room at overlapping times?
6. Is payer required at creation or added later? What's the workflow for ensuring it's set before data validation?
7. What happens if a user creates a case with a procedure that has no `procedure_milestone_config` entries?
8. Is there validation that the surgeon is active and belongs to this facility?

### Downstream Impact Questions
9. Walk me through what happens between case creation and `case_completion_stats` being populated. What's the full pipeline?
10. If a field is missing at creation (e.g., `payer_id`), at what point does it become a problem for analytics?
11. Are there any materialized views or triggers that fire on case INSERT that could fail silently?

### UX Questions
12. After creation, where does the user land? Case detail? Case list? 
13. Is there inline validation (field-level errors) or only on-submit validation?
14. Can a case be created as a draft/partial and completed later?
15. Is there a "duplicate case" feature for creating similar cases quickly (e.g., same surgeon, same procedure, different time)?

### Security Questions
16. Which user roles can create cases? Where is this enforced — app code, RLS, or both?
17. Is there an audit trail for case creation (created_by, created_at)?
18. Can a user create a case in a facility they don't belong to? How is this prevented?

### Testing Questions
19. Are there any existing tests for case creation? Unit tests, integration tests, E2E tests?
20. What test data setup is needed? Does the test need a facility, surgeon, procedure, room, and milestone config before it can create a case?

---

## 8. Test Plan Outline

After the audit and improvements are made, these tests should be written:

### Unit Tests
- CaseForm validation logic (required fields, date validation, time validation)
- Case number generation (uniqueness, format)
- Milestone pre-creation logic (correct milestones for procedure, handles custom milestones)

### Integration Tests
- Create case → verify `cases` row exists with correct fields
- Create case → verify `case_milestones` rows match `procedure_milestone_config`
- Create case → verify all 8 triggers on `cases` fire without error
- Create case with missing required field → verify rejection
- Create case → validate → verify `case_completion_stats` populates

### Edge Case Tests
- Concurrent creation in same room/time
- Procedure with zero milestones configured
- Facility with custom milestones
- Case creation by unauthorized role (should fail)
- Case creation in foreign facility (should fail via RLS)

### E2E Tests
- Full user flow: login → navigate to cases → create case → verify in list → open detail → verify milestones present
- Create case → record milestones → validate → verify analytics

---

## 9. Related Features (Out of Scope for This Brief)

These features interact with case creation but have their own audit briefs:

- **Milestone Recording** (what happens after a case exists)
- **Case Editing** (modifying surgeon, procedure, time after creation)
- **Case Cancellation** (status change + analytics impact)
- **Data Validation** (the workflow that triggers `record_case_stats()`)
- **Block Scheduling** (how blocks relate to room/time suggestions)
- **Analytics Engine** (how `analyticsV2.ts` consumes case data)
