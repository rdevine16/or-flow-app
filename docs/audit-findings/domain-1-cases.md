# Domain 1: Case Lifecycle Audit

**Audited:** 2026-02-24
**Scope:** Complete case data lifecycle — UI to DB and back
**Files reviewed:** 40+ source files, 65+ migration files, 11 DB tables

---

## Page: Case Creation

**File:** [components/cases/CaseForm.tsx](components/cases/CaseForm.tsx)
**Route:** [app/cases/new/page.tsx](app/cases/new/page.tsx)
**Lines:** ~1,114

### Displays (Form Fields Collected)

| Field | Type | Required | Default | Maps to |
|-------|------|----------|---------|---------|
| `case_number` | text | Yes | `''` | `cases.case_number` |
| `scheduled_date` | date | Yes | today / URL param | `cases.scheduled_date` |
| `start_time` | time | Yes | `'07:30'` | `cases.start_time` |
| `surgeon_id` | UUID select | Yes | `''` | `cases.surgeon_id` |
| `procedure_type_id` | UUID select | Yes | `''` | `cases.procedure_type_id` |
| `or_room_id` | UUID select | Yes | `''` | `cases.or_room_id` |
| `status_id` | UUID select | Yes (hidden) | scheduled status ID | `cases.status_id` |
| `operative_side` | enum select | Conditional | `''` | `cases.operative_side` |
| `payer_id` | UUID select | Optional | `''` | `cases.payer_id` |
| `notes` | textarea | Optional | `''` | `cases.notes` |
| `repRequiredOverride` | boolean/null | Optional | `null` | `cases.rep_required_override` |
| `selectedCompanyIds` | UUID[] | Conditional | `[]` | `case_implant_companies` (M2M) |
| `selectedStaff` | {user_id, role_id}[] | Optional | `[]` | `case_staff` (M2M) |
| `selectedComplexityIds` | UUID[] | Optional | `[]` | `case_complexities` (M2M) |

### Writes

**Primary:** RPC `create_case_with_milestones` (CaseForm.tsx:771-786)
- Inserts into `cases` + auto-creates `case_milestones` from template

**Secondary inserts (CaseForm.tsx:803-859):**
- `case_complexities` (case_id, complexity_id)
- `case_implant_companies` (case_id, implant_company_id)
- `case_device_companies` (case_id, implant_company_id, tray_status) — if rep required
- `case_device_activity` (case_id, implant_company_id, activity_type, message) — if rep required

**Draft mode:** Same RPC with `p_is_draft: true` — skips milestone creation

### Validation

| Layer | What | Location |
|-------|------|----------|
| Zod | `createCaseSchema` — all required fields, types | [lib/validation/schemas.ts:33-59](lib/validation/schemas.ts) |
| Zod | `draftCaseSchema` — only scheduled_date required | [lib/validation/schemas.ts:67-91](lib/validation/schemas.ts) |
| Form | Case number uniqueness (300ms debounce, real-time) | CaseForm.tsx:157-210 |
| Form | Room conflict detection (300ms debounce) | CaseForm.tsx:213-273 |
| Form | Milestone template existence check (blocks submit) | CaseForm.tsx:689-735 |
| Form | Rep required warning (confirmation dialog) | CaseForm.tsx:738-748 |
| DB | UNIQUE(facility_id, case_number) | baseline.sql |
| DB | CHECK on operative_side: 'left'\|'right'\|'bilateral'\|'n/a' | baseline.sql |

### Triggers Fired (on INSERT)

| Trigger | Function | Effect |
|---------|----------|--------|
| `trigger_auto_create_patient_checkin` | `auto_create_patient_checkin()` | Creates `patient_checkins` row with expected arrival time |

**Note:** Milestone creation is NOT via trigger — it happens inside the `create_case_with_milestones` RPC atomically.

### Milestone Template Cascade (in RPC)

1. Check `surgeon_template_overrides` (surgeon + procedure + facility)
2. Check `procedure_types.milestone_template_id`
3. Fall back to `milestone_templates` where `is_default = true`
4. Raise exception if no template found
5. Stamp `milestone_template_id` on case
6. Insert `case_milestones` from `milestone_template_items` (DISTINCT ON facility_milestone_id)

### Downstream

- Case appears in cases list, dashboard, check-in page
- Milestones available for recording on case detail page
- Patient checkin auto-created for check-in workflow

### Issues Found

- :red_circle: **CRITICAL:** `cases.start_time` uses `TIME WITHOUT TIME ZONE` — loses timezone context. Should be `TIMESTAMPTZ` or combined with `scheduled_date` into a single `TIMESTAMPTZ`. (baseline.sql)
- :yellow_circle: **HIGH:** `scheduled_duration_minutes` column was dropped (migration 20260219000012) but no replacement exists — procedure `expected_duration_minutes` is used instead but lives on `procedure_types`, not `cases`. Room conflict detection relies on this indirect path.
- :orange_circle: **MEDIUM:** `cases.patient_id` has no UI input in the case creation form. Patient association only happens through check-in flow. Document this as intentional.
- :green_circle: **LOW:** `anesthesiologist_id` column still exists in baseline migration DDL but was dropped in migration 20260222000000. No code references remain.

---

## Page: Case Detail

**File:** [app/cases/[id]/page.tsx](app/cases/[id]/page.tsx)
**Lines:** ~1,677

### Displays (14 queries on load)

| Query | Table(s) | Fields | Purpose |
|-------|----------|--------|---------|
| 1 | `cases` + joins | id, case_number, scheduled_date, start_time, operative_side, procedure_type_id, surgeon_id, or_room_id, is_draft, notes, call_time, surgeon_left_at, milestone_template_id + or_rooms.name, procedure_types.name, case_statuses(id,name), surgeon user | Main case data |
| 2 | `milestone_template_items` | display_order + facility_milestones(id, name, display_name, display_order, pair_with_id, pair_position, source_milestone_type_id) | Template-ordered milestone list |
| 3 | `case_milestones` | id, facility_milestone_id, recorded_at | Recorded milestone timestamps |
| 4 | `case_staff` + joins | id, user_id, role_id + users(name), user_roles(name) | Active staff (removed_at IS NULL) |
| 5 | `users` | id, first_name, last_name, role_id + user_roles(name) | Available staff for assignment |
| 6 | `or_rooms` + `procedure_types` | id, name | Dropdown options for incomplete modal |
| 7 | `case_implants` | * | Hip/knee implant data |
| 8 | `procedure_types` | implant_category | Determines hip vs knee fields |
| 9 | `case_flags` + joins | id, flag_type, severity, metric_value, threshold_value, comparison_scope, delay_type_id, duration_minutes, note, created_by, facility_milestone_id + flag_rules(name, end_milestone), delay_types(display_name) | Threshold flags + delay flags |
| 10 | `delay_types` | id, name, display_name | Dropdown for add delay form |
| 11 | `surgeon_procedure_stats` | median_duration, p25_duration, p75_duration, sample_size | Total time pace calculation |
| 12 | `surgeon_milestone_stats` | milestone_type_id, milestone_name, median_minutes_from_start, p25/p75, sample_size | Per-milestone pace |
| 13 | `users` (surgeon) | closing_workflow, closing_handoff_minutes | Auto-record surgeon_left behavior |
| 14 | `cases` (same surgeon, same day) | id, start_time, case_statuses(name) | "Case 3 of 5 today" badge |

### Writes

| Action | Table.Column | Validation | Trigger |
|--------|-------------|------------|---------|
| Record milestone | `case_milestones.recorded_at` = timestamp | Out-of-order confirmation dialog | None directly; auto-updates case status |
| Undo milestone | `case_milestones.recorded_at` = NULL | Confirmation dialog | Reverts case status if special milestone |
| Auto-set status | `cases.status_id` | Automatic on patient_in/patient_out | Fires `on_case_completed`, `on_case_status_change_detect_issues`, `trg_refresh_stats_on_completion` |
| Record surgeon left | `cases.surgeon_left_at` = timestamp | Button enabled only when closing recorded | None |
| Auto-record surgeon left | `cases.surgeon_left_at` = closing + handoff minutes | PA-closes workflow pref | None |
| Add staff | `case_staff` INSERT (case_id, user_id, role_id) | Role validation | None |
| Remove staff | `case_staff.removed_at` = timestamp | Soft delete | None |
| Add delay | `case_flags` INSERT (flag_type='delay') + `case_delays` INSERT | Delay type required | Dual-write pattern |
| Remove delay | `case_flags` DELETE (hard delete) | Creator only | None |
| Set data_validated | `cases.data_validated` = true, `validated_at`, `validated_by` | Auto after patient_out + 0 issues | `trg_record_stats_on_validation` → `record_case_stats()` |
| Edit implants | `case_implants` UPSERT | Auto-save on blur | None |
| Incomplete case fix | `cases.surgeon_id`, `procedure_type_id`, `or_room_id` | Modal forces completion | Standard triggers |

### Milestone Recording Flow

```
User clicks "Record" → checkMilestoneOrder() → optimistic UI update →
  DB: UPDATE case_milestones SET recorded_at = NOW()
    → if patient_in: UPDATE cases SET status_id = 'in_progress'
    → if closing + PA-closes: UPDATE cases SET surgeon_left_at = closing + handoff
    → if patient_out: UPDATE cases SET status_id = 'completed'
      → RPC run_issue_detection_for_case()
        → 0 issues: UPDATE cases SET data_validated = true
          → trigger: record_case_stats() → UPSERT case_completion_stats (41 columns)
        → >0 issues: data_validated = false (manual review in Data Quality)
```

### Real-time Subscriptions

**Yes — `case_milestones` only**
- Hook: `useMilestoneRealtime()` from [lib/hooks/useMilestoneRealtime.ts](lib/hooks/useMilestoneRealtime.ts)
- Channel: `case-milestones:{caseId}`
- Events: INSERT, UPDATE, DELETE on `case_milestones` where `case_id = {caseId}`
- Purpose: Multi-device sync (iPad + mobile simultaneous use)
- **NOT subscribed:** flags, staff, implants, case metadata (manual refresh only)

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| MilestoneTimelineV2 | [components/cases/MilestoneTimelineV2.tsx](components/cases/MilestoneTimelineV2.tsx) (495 lines) | Main timeline with milestones, flags, delays, surgeon_left nodes |
| AddDelayForm | [components/cases/AddDelayForm.tsx](components/cases/AddDelayForm.tsx) (162 lines) | Delay type grid + duration + note |
| TeamMember | [components/cases/TeamMember.tsx](components/cases/TeamMember.tsx) | Staff row with avatar, role badge, remove |
| ImplantSection | [components/cases/ImplantSection.tsx](components/cases/ImplantSection.tsx) | Hip/knee component tracking |
| FlipRoomCard | [components/cases/FlipRoomCard.tsx](components/cases/FlipRoomCard.tsx) | Next case in different room + "Call Back" |
| IncompleteCaseModal | [components/cases/IncompleteCaseModal.tsx](components/cases/IncompleteCaseModal.tsx) | Blocking modal for missing surgeon/procedure/room |
| TimerChip | [components/cases/TimerChip.tsx](components/cases/TimerChip.tsx) | Total/Surgical time with pace indicators |
| PiPMilestoneWrapper | [components/pip/PiPMilestoneWrapper.tsx](components/pip/PiPMilestoneWrapper.tsx) | Picture-in-picture floating milestone panel |

### Issues Found

- :red_circle: **CRITICAL:** Delay dual-write pattern — `case_flags` (primary) and `case_delays` (legacy) are both written on delay add, but only `case_flags` is deleted on delay removal. `case_delays` row becomes orphaned. (page.tsx:768-826)
- :yellow_circle: **HIGH:** No real-time subscription for `case_flags` or `case_staff`. If two users are on the same case detail page, flag additions and staff changes won't sync until page refresh.
- :yellow_circle: **HIGH:** `record_case_stats()` preconditions require `patient_in` AND `patient_out` milestones recorded. If `total_time_minutes IS NULL`, the function returns early and NO stats row is created. Cases with only partial milestones have no completion stats.
- :orange_circle: **MEDIUM:** Optimistic UI for milestone recording uses `id: "optimistic-{milestoneTypeId}"` — if real-time sync delivers another user's recording before the DB write completes, the optimistic entry and real entry could briefly coexist.
- :orange_circle: **MEDIUM:** `surgeon_left_at` auto-recording (PA-closes workflow) adds `closing_handoff_minutes` to closing timestamp, but this value comes from a separate query on the surgeon's user record. If the preference was recently changed, the cached value may be stale within the session.
- :green_circle: **LOW:** Case detail page makes 14 parallel queries on load. Consider consolidating into fewer queries or an RPC for initial load performance.

---

## Page: Cases List

**File:** [app/cases/page.tsx](app/cases/page.tsx)
**DAL:** [lib/dal/cases.ts](lib/dal/cases.ts) (lines 354-428)
**Hook:** [lib/hooks/useCasesPage.ts](lib/hooks/useCasesPage.ts)

### Displays (Table Columns)

| Column | Source | Notes |
|--------|--------|-------|
| Checkbox | `cases.id` | For bulk export |
| Procedure | `procedure_types.name`, `cases.case_number`, `procedure_types.procedure_category_id` | Joined |
| Surgeon | `users.first_name`, `users.last_name` | Via surgeon_id FK |
| Room | `or_rooms.name` | Joined |
| Date | `cases.scheduled_date`, `cases.start_time` | Direct |
| Status | `case_statuses.name` | Joined |
| Duration | `case_completion_stats.total_duration_minutes` (completed), computed elapsed (in_progress), `procedure_types.expected_duration_minutes` (scheduled) | Mixed sources |
| Validation | `cases.is_excluded_from_metrics`, presence in metric_issues | Batch query |
| Flags | Count/severity from `case_flags` | Separate batch query via `casesDAL.flagsByCase()` |
| Actions | Edit / Cancel / View | Inline icons |

### Query (lib/dal/cases.ts:130-139)

```sql
SELECT id, case_number, scheduled_date, start_time, status_id,
       data_validated, is_excluded_from_metrics, or_room_id, surgeon_id, facility_id,
       created_at, created_by,
       surgeon:users!cases_surgeon_id_fkey(first_name, last_name),
       or_room:or_rooms(name),
       case_status:case_statuses(name),
       procedure_type:procedure_types(id, name, procedure_category_id, expected_duration_minutes),
       case_completion_stats(total_duration_minutes)
FROM cases
WHERE facility_id = ?
```

### Filters (lib/dal/cases.ts:368-406)

| Filter | Method | Applied |
|--------|--------|---------|
| Facility | `facility_id = ?` | Always |
| Date range | `scheduled_date BETWEEN ? AND ?` | Most tabs |
| Tab status | `status_id = ?` (scheduled/in_progress/completed) | Per tab |
| Data quality tab | `id IN (caseIds with unresolved metric_issues)` | DQ tab only |
| Search | `case_number ILIKE '%?%'` | On `case_number` only |
| Surgeon | `surgeon_id IN (?)` | Entity filter |
| Room | `or_room_id IN (?)` | Entity filter |
| Procedure | `procedure_type_id IN (?)` | Entity filter |

### Pagination

- **Type:** Offset-based (`.range(from, from + size - 1)`)
- **Page size:** 25
- **Total count:** Uses Supabase `count: 'exact'` header

### Bulk Operations

- Export selected rows (CSV)
- Export all filtered rows (up to 5,000)
- No bulk edit/delete

### Issues Found

- :yellow_circle: **HIGH:** Search uses `ILIKE '%term%'` on `case_number` only — no index, full table scan on large datasets. Should add GIN trigram index or full-text search. Cannot search by surgeon name, procedure, or room.
- :orange_circle: **MEDIUM:** Offset-based pagination degrades on large result sets (>50k rows). Cursor-based pagination would scale better.
- :green_circle: **LOW:** `case_completion_stats.total_duration_minutes` used for completed case duration but calculated differently from live elapsed timer for in-progress cases — could cause visual inconsistency when a case transitions.

---

## Page: Case Cancellation

**File:** [app/cases/[id]/cancel/page.tsx](app/cases/[id]/cancel/page.tsx)
**Modal:** [components/cases/CancelCaseModal.tsx](components/cases/CancelCaseModal.tsx)

### Displays

- Case summary (case_number, scheduled_date, surgeon, procedure)
- Cancellation reasons dropdown (from `cancellation_reasons` table)
- Context metrics: month cancellation count, surgeon 90-day cancel rate, day-of flag

### Writes

| Column | Value | Validation |
|--------|-------|------------|
| `cases.status_id` | cancelled status UUID | Required |
| `cases.cancelled_at` | current timestamp | Auto |
| `cases.cancelled_by` | user ID | Auto |
| `cases.cancellation_reason_id` | selected reason UUID | Required |
| `cases.cancellation_notes` | text | Optional |

### Related Records Handling

- Milestones are **NOT deleted** — preserved for analytics
- Audit log captures milestone count at cancellation
- `case_completion_stats` — no row created (data_validated never set)
- `case_flags` — existing flags preserved
- `case_staff` — not modified

### Issues Found

- :orange_circle: **MEDIUM:** Cancellation is a status change, not a soft delete. But `cancelled_at`/`cancelled_by`/`cancellation_reason_id`/`cancellation_notes` are separate columns from the status system — effectively a parallel cancellation metadata system. This is fine architecturally but worth documenting.
- :green_circle: **LOW:** No trigger fires specifically on cancellation — it's just a status change that fires `on_case_status_change_detect_issues` and `trg_refresh_stats_on_completion`.

---

## Page: Bulk Case Creation

**File:** [app/cases/bulk-create/page.tsx](app/cases/bulk-create/page.tsx)

### Displays

- Shared header: `scheduled_date`, `surgeon_id`
- Per-row fields: `case_number`, `start_time`, `procedure_type_id`, `or_room_id`, `operative_side`, `implant_company_ids[]`, `rep_required_override`
- Max 20 rows

### Writes

- Same RPC `create_case_with_milestones` called per row
- Same secondary inserts for implant companies

### Key Differences from Single Creation

- No patient fields
- Streamlined validation (`bulkCaseRowSchema`)
- Shared surgeon/date reduces redundant input
- No staff assignment (bulk scheduling only)
- No complexities (can be added later on case detail)

### Issues Found

- :orange_circle: **MEDIUM:** Each row calls the RPC individually — no batch RPC. For 20 cases this means 20 separate DB transactions. Consider a batch RPC for atomicity and performance.
- :green_circle: **LOW:** No room conflict detection in bulk mode (single creation has it).

---

## Page: Completed Case View

**File:** [components/cases/CompletedCaseView.tsx](components/cases/CompletedCaseView.tsx)

### Displays

| Field | Source |
|-------|--------|
| Case number, date, time, operative_side, notes | `cases` table (props) |
| Surgeon name | `users` table (props) |
| All milestone timestamps | `case_milestones` (props) |
| Staff assignments | `case_staff` (props) |
| Surgeon average total time | `surgeon_procedure_averages` table (props) |
| Per-milestone averages | `surgeon_milestone_averages` table (props) |
| Implant details (hip/knee components) | `case_implants` (props) |
| Device companies | `case_device_companies` (props) |
| Patient call time | `cases.call_time` (props) |

### Metrics Calculated

- Start variance: scheduled vs actual patient_in
- Total time: patient_in → patient_out
- Surgical time: incision → closing
- Comparison vs surgeon averages (total, surgical, anesthesia)

### Financial Data

**NOT displayed in this component.** Financial metrics are in `case_completion_stats` and displayed on analytics pages, not here.

### Issues Found

- :orange_circle: **MEDIUM:** CompletedCaseView compares actual vs `surgeon_procedure_averages.avg_total_minutes` — this uses **average**, not **median**. Platform standard is median-based. The `surgeon_procedure_stats` table has `median_duration` which should be used instead.
- :green_circle: **LOW:** Props-based architecture means data staleness depends on parent component's refresh behavior.

---

## Downstream Consumers

### Analytics Overview (`app/analytics/page.tsx`)

**Query:** Calculates live from `cases` + `case_milestones` via `calculateAnalyticsOverview()`
**Case fields used:** id, surgeon_id, procedure_type_id, scheduled_date, start_time, or_room_id, patient_in_at, patient_out_at, incision_at, closing_at, prep_drape_complete_at
**Joins case_completion_stats:** No (calculates live from milestones)

### Surgeons Analytics (`app/analytics/surgeons/page.tsx`)

**Query:** Per-surgeon metrics from `cases` + `case_milestones`
**Uses:** `resolveTemplateForCase()` for template-aware phase boundaries
**Joins case_completion_stats:** No (calculates live)

### Data Quality (`app/data-quality/page.tsx`)

**Query:** `metric_issues` table (not cases directly)
**On review drawer open:** Fetches case + case_milestones for milestone editing
**Joins case_completion_stats:** No

### Dashboard (`app/dashboard/page.tsx`)

**Queries:** Multiple hooks (useDashboardKPIs, useTodayStatus, useScheduleTimeline)
**Case fields:** scheduled_date, start_time, status_id, or_room_id, surgeon_id + milestone timestamps
**Joins case_completion_stats:** No (real-time calculations)

### RoomGridView / CaseListView (`components/dashboard/`)

**Data:** Props from parent (pre-fetched cases)
**Groups:** By room, identifies active/next/completed
**CaseListView also shows:** `operative_side`

### Check-In Page (`app/checkin/page.tsx`)

**Query:** `patient_checkin_records` → `cases` join
**Case fields:** case_number, scheduled_date, start_time, or_room, procedure_type, surgeon, patient

### Issues Found

- :yellow_circle: **HIGH:** Analytics pages calculate durations live from milestones rather than reading `case_completion_stats`. This means analytics values may differ from the denormalized stats if milestone timestamps are edited after validation. The two systems can drift.
- :orange_circle: **MEDIUM:** Dashboard calculates metrics in real-time from milestones but `case_completion_stats` is the "source of truth" for historical analytics. No reconciliation mechanism exists if the two diverge.
- :green_circle: **LOW:** Check-in page queries through `patient_checkin_records` which depends on the auto-create trigger firing on case INSERT. If the trigger fails silently, cases won't appear in check-in.

---

## DB Architecture Review

### Table: cases (31 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| `start_time TIME WITHOUT TIME ZONE` | :red_circle: CRITICAL | Loses timezone context. Combined with `scheduled_date DATE`, timezone math requires manual composition. Should be `TIMESTAMPTZ`. |
| `anesthesiologist_id` still in baseline DDL | :green_circle: LOW | Dropped in migration 20260222000000. No code references. Dead column in baseline only. |
| No soft delete | :orange_circle: MEDIUM | Cases use status-based lifecycle (scheduled → completed/cancelled) rather than soft delete. `is_excluded_from_metrics` serves a similar purpose. Intentional design. |
| `or_room_id`, `procedure_type_id`, `surgeon_id` nullable | :green_circle: LOW | Required for draft case workflow. Form validation catches this for non-draft creates. |

### Table: case_milestones (7 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| `facility_milestone_id` nullable | :orange_circle: MEDIUM | Should be NOT NULL — every milestone must reference a facility milestone. May have been nullable for legacy migration. |
| No soft delete | :green_circle: LOW | Hard delete is appropriate for milestone records (undo = set recorded_at to NULL). |

### Table: case_completion_stats (41 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| Financial columns use unbounded `NUMERIC` | :orange_circle: MEDIUM | `reimbursement`, `soft_goods_cost`, `hard_goods_cost`, `or_cost`, `profit`, etc. use `NUMERIC` without precision. Consider `NUMERIC(10,2)` for storage optimization and consistency. |
| `scheduled_start_time TIME WITHOUT TIME ZONE` | :yellow_circle: HIGH | Same timezone issue as `cases.start_time`. |
| `actual_start_time TIME WITHOUT TIME ZONE` | :yellow_circle: HIGH | Same issue. |
| 41 columns — all used? | :orange_circle: MEDIUM | Need to verify all 41 columns are read somewhere in the UI. Potential dead columns: `surgical_turnover_minutes`, `surgeon_room_count`, `surgeon_case_sequence`, `room_case_sequence`. |

### Table: case_delays (8 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| `duration_minutes` nullable | :orange_circle: MEDIUM | Delays should have duration. Consider NOT NULL with default 0. |
| Dual-write orphans | :red_circle: CRITICAL | `case_delays` rows are created alongside `case_flags` rows when adding delays, but only `case_flags` rows are deleted on removal. `case_delays` accumulates orphan rows. |

### Table: case_flags (14 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| `flag_rule_id` nullable | :green_circle: LOW | Delay-type flags don't have a rule. Threshold flags should always have one. |
| `facility_milestone_id` nullable | :green_circle: LOW | Added later (migration 20260216100000). Threshold flags from older versions may not have this. |

### Table: case_staff (7 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| Uses `removed_at` soft delete | :green_circle: OK | Correct pattern for tracking staff assignment history. |

### Table: case_implants (29 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| `case_id` nullable | :red_circle: CRITICAL | Implants should ALWAYS be associated with a case. This FK should be NOT NULL. |
| All text columns for sizes | :orange_circle: MEDIUM | Sizes stored as TEXT (e.g., "52", "3.5") — prevents numeric comparisons or aggregation. Consider structured types. |

### Table: case_device_activity (9 columns)

No issues found. Audit log table with appropriate types.

### Table: case_device_companies (13 columns)

No issues found. Proper NOT NULL on required fields.

### Table: case_statuses (4 columns)

| Issue | Severity | Description |
|-------|----------|-------------|
| `display_order` nullable | :green_circle: LOW | Should have explicit ordering. Minor issue. |

### Table: case_complexities (5 columns)

No issues found. Simple M2M junction table.

---

## Soft Delete Summary

| Table | Soft Delete | Pattern |
|-------|-------------|---------|
| cases | No | Status-based lifecycle + `is_excluded_from_metrics` |
| case_milestones | No | `recorded_at = NULL` serves as "not recorded" |
| case_completion_stats | No | `is_excluded` boolean |
| case_delays | No | Hard delete (but orphaned by dual-write bug) |
| case_flags | No | Hard delete |
| case_staff | Yes | `removed_at` timestamp |
| case_complexities | No | Hard delete |
| case_implants | No | Hard delete |
| case_device_activity | No | Append-only audit log |
| case_device_companies | No | Hard delete |
| case_statuses | No | Lookup table |

---

## Triggers on Cases (All 8 Verified)

| # | Trigger | Event | Function | Effect |
|---|---------|-------|----------|--------|
| 1 | `on_case_completed` | AFTER UPDATE (status change) | `trigger_recalculate_averages()` | Recalculates surgeon median times |
| 2 | `on_case_status_change_detect_issues` | AFTER UPDATE (status change) | `trigger_issue_detection_on_case_update()` | Runs flag/issue detection |
| 3 | `set_cases_updated_at` | BEFORE UPDATE | `update_updated_at_column()` | Sets `updated_at = NOW()` |
| 4 | `trg_record_stats_on_validation` | AFTER UPDATE (data_validated) | `trigger_record_stats_on_validation()` | Creates `case_completion_stats` row |
| 5 | `trg_refresh_stats_on_completion` | AFTER UPDATE (status change) | `trigger_refresh_stats_on_completion()` | Refreshes materialized views |
| 6 | `trg_remove_stats_on_invalidation` | AFTER UPDATE (data_validated) | `trigger_remove_stats_on_invalidation()` | Deletes stats if data_validated → false |
| 7 | `trg_sync_exclusion_to_stats` | AFTER UPDATE (is_excluded_from_metrics) | `trigger_sync_exclusion_to_stats()` | Syncs exclusion flag to stats |
| 8 | `trigger_auto_create_patient_checkin` | AFTER INSERT/UPDATE | `auto_create_patient_checkin()` | Creates/updates patient_checkins |

---

## record_case_stats() Function

**Location:** Migration 20260222200006 (line 379)
**Triggered by:** `trg_record_stats_on_validation` when `data_validated` flips to TRUE

### Preconditions
1. `cases.data_validated = TRUE`
2. `cases.is_excluded_from_metrics != TRUE`
3. `patient_in` AND `patient_out` milestones recorded (required for `total_time_minutes`)

### Calculations (41 columns)
- **Timing:** total_duration, surgical_duration, anesthesia_duration, call_to_patient_in, schedule_variance, room_turnover, surgical_turnover
- **Sequencing:** is_first_case (room/surgeon), surgeon_room_count, case_sequence (room/surgeon)
- **Financial:** reimbursement, costs (soft/hard goods, OR time), profit, debits, credits, net_cost
- **Metadata:** case_number, facility_id, surgeon_id, procedure_type_id, payer_id, or_room_id, case_date

### Writes
- **UPSERT** into `case_completion_stats` (INSERT ON CONFLICT case_id DO UPDATE)

---

## All Issues Summary (Ranked by Severity)

### :red_circle: CRITICAL (3)

1. **Delay dual-write orphan bug** — Adding a delay writes to both `case_flags` and `case_delays`, but removing only deletes from `case_flags`. Legacy `case_delays` rows accumulate as orphans. Fix: also delete from `case_delays` on removal, or stop dual-writing. ([app/cases/[id]/page.tsx:768-826](app/cases/[id]/page.tsx))

2. **`case_implants.case_id` nullable** — Should be NOT NULL. Implants without a case association are nonsensical. Fix: migration to add NOT NULL constraint after backfilling any NULL rows. (baseline.sql)

3. **`cases.start_time` uses `TIME WITHOUT TIME ZONE`** — Loses timezone context. All timestamp arithmetic must manually combine with `scheduled_date`. Same issue in `case_completion_stats.scheduled_start_time` and `actual_start_time`. Fix: migrate to `TIMESTAMPTZ` or document the intentional pattern with timezone handling convention. (baseline.sql)

### :yellow_circle: HIGH (4)

4. **Analytics vs stats drift** — Analytics pages calculate durations live from milestones, while `case_completion_stats` is the denormalized source of truth. If milestones are edited after validation, the two systems diverge with no reconciliation. Fix: either always read from `case_completion_stats` for historical data, or re-trigger `record_case_stats()` when milestones change on validated cases.

5. **No real-time sync for flags/staff** — Case detail page subscribes to `case_milestones` changes only. If two users are on the same case, flag additions and staff changes don't sync. Fix: add subscriptions for `case_flags` and `case_staff` tables.

6. **Search only matches `case_number`** — ILIKE without index; can't search by surgeon, procedure, or room. Full table scan on large datasets. Fix: add GIN trigram index on `case_number` and consider full-text search across multiple fields.

7. **`case_completion_stats` TIME columns** — `scheduled_start_time` and `actual_start_time` use `TIME WITHOUT TIME ZONE`, inheriting the timezone issue from the source.

### :orange_circle: MEDIUM (8)

8. **CompletedCaseView uses average, not median** — Compares actual vs `avg_total_minutes` but platform standard is median. Should use `surgeon_procedure_stats.median_duration`.

9. **Bulk create has no batch RPC** — 20 cases = 20 individual RPC calls. No atomicity guarantee. Room conflict detection not available.

10. **`case_milestones.facility_milestone_id` nullable** — Should be NOT NULL; every milestone must reference a facility milestone.

11. **Financial columns use unbounded NUMERIC** — `case_completion_stats` financial fields have no precision specified. `NUMERIC(10,2)` would ensure consistency.

12. **`case_delays.duration_minutes` nullable** — Delays without duration lose critical data.

13. **Offset-based pagination** — Cases list uses `.range()` which degrades on large datasets (>50k rows).

14. **`cases.patient_id` has no creation UI** — Only set via check-in flow. Document as intentional.

15. **Cancellation metadata parallel to status** — `cancelled_at/by/reason_id/notes` columns are separate from the status system. Architecturally fine but should be documented.

### :green_circle: LOW (6)

16. **14 parallel queries on case detail load** — Consider consolidating into fewer queries or an RPC.

17. **`case_statuses.display_order` nullable** — Should have explicit ordering.

18. **Implant sizes stored as TEXT** — Prevents numeric comparison or aggregation.

19. **`anesthesiologist_id` in baseline DDL** — Dropped in later migration, no code references remain.

20. **`case_completion_stats` potential dead columns** — `surgical_turnover_minutes`, `surgeon_room_count`, `surgeon_case_sequence`, `room_case_sequence` may not be displayed anywhere in the UI.

21. **Duration display inconsistency** — Cases list shows `case_completion_stats.total_duration_minutes` for completed cases but computed elapsed for in-progress. Visual jump when status transitions.
