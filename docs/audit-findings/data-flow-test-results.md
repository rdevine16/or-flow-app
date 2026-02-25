# Data Flow Test Results

**Script:** `scripts/audit-data-flow-test.ts`
**Status:** Not yet executed — review script before running
**Date:** _(fill in after running)_

## How to Run

```bash
npx tsx scripts/audit-data-flow-test.ts
```

## What the Script Tests

| Step | What | Verifies |
|------|------|----------|
| 1 | Prerequisites | Facility, surgeon, procedure type, milestone template cascade, status IDs |
| 2 | Case Creation | `create_case_with_milestones` RPC creates correct milestones from template |
| 3 | Milestone Recording | All milestones accept timestamps, ordered by template `display_order` |
| 4 | Stats Pipeline | `data_validated = true` triggers `record_case_stats()` → populates `case_completion_stats` |
| 5 | Materialized Views | `surgeon_procedure_stats` and `surgeon_overall_stats` include test case |
| 6 | Analytics Queries | `get_milestone_interval_medians`, `get_phase_medians`, `get_flag_analytics` RPCs work |
| 7 | Cleanup | `data_validated = false` removes stats, hard delete removes case |

## Data Flow Diagram

```
CaseForm (UI)
  ↓
create_case_with_milestones (RPC)
  ├── INSERT INTO cases (stamps milestone_template_id)
  └── INSERT INTO case_milestones (from milestone_template_items, DISTINCT on facility_milestone_id)
       ↓
MilestoneTimeline (UI) → UPDATE case_milestones SET recorded_at = ...
  ↓ (trigger: trg_record_case_stats on patient_out milestone)
  ↓ (but only fires if data_validated = true)
  ↓
UPDATE cases SET status_id = 'completed'
  ├── trg_refresh_stats_on_completion → refresh_all_stats() (5 materialized views)
  ├── on_case_completed → recalculate_surgeon_averages()
  └── on_case_status_change_detect_issues → run_issue_detection_for_case()
       ↓
UPDATE cases SET data_validated = true
  └── trg_record_stats_on_validation → record_case_stats()
       ├── calculate_case_stats() → durations, costs
       ├── INSERT INTO case_completion_stats (41 columns)
       └── INSERT INTO case_milestone_stats (per-milestone intervals)
            ↓
Analytics Pages query:
  ├── case_completion_stats (direct)
  ├── surgeon_procedure_stats (materialized view)
  ├── surgeon_overall_stats (materialized view)
  ├── get_milestone_interval_medians (RPC)
  ├── get_phase_medians (RPC)
  └── get_flag_analytics (RPC)
```

## Known Timing Gap

The materialized views are refreshed when status changes to 'completed' (`trg_refresh_stats_on_completion`), but `case_completion_stats` is populated later when `data_validated` is set to true. This means:

1. Views are refreshed **before** the stats row exists
2. The stats row won't appear in views until the **next** refresh
3. In production, this is mitigated by having many cases (the stale view is only missing the latest case)
4. The `refresh_all_stats()` RPC can be called manually if needed

**Potential improvement:** Add a second `refresh_all_stats()` call in `trigger_record_stats_on_validation`.

## Results

_(paste terminal output here after running)_

```
AUDIT DATA FLOW TEST RESULTS
════════════════════════════
Step 1 - Prerequisites:
Step 2 - Case Creation + Milestones:
Step 3 - Milestone Recording:
Step 4 - Stats Pipeline:
Step 5 - Materialized Views:
Step 6 - Analytics Queries:
Step 7 - Cleanup:

ISSUES FOUND:
- (none yet)
```

## Key Findings

### Cases Table Has No Soft-Delete

The `cases` table does **not** have `is_active` or `deleted_at` columns. Unlike 20+ other tables that use `sync_soft_delete_columns()`, cases use cancellation:
- `cancelled_at` timestamp
- `cancelled_by` user_id
- `cancellation_reason_id` FK

For the test cleanup, we:
1. Set `data_validated = false` → triggers hard delete of stats
2. Hard-delete milestones and the case itself

### Template Cascade

The script verifies the 3-tier milestone template cascade:
1. **Surgeon override:** `surgeon_template_overrides(surgeon_id, procedure_type_id, facility_id)`
2. **Procedure type:** `procedure_types.milestone_template_id`
3. **Facility default:** `milestone_templates(facility_id, is_default=true, is_active=true)`

### Stats Pipeline Prerequisites

`record_case_stats()` requires ALL of:
- `data_validated = true`
- `is_excluded_from_metrics != true`
- `patient_in` and `patient_out` milestone timestamps (for `total_duration_minutes`)
- If `total_duration_minutes` is NULL, the function returns early with no stats row

### case_completion_stats Columns (41 total)

| Column | Expected | Notes |
|--------|----------|-------|
| id, case_id, case_number | Always populated | Core identifiers |
| facility_id, surgeon_id, procedure_type_id | From case | May be NULL if case has NULLs |
| payer_id, or_room_id | Nullable | Depends on case data |
| case_date, scheduled_start_time | From case | Always populated |
| actual_start_time | Nullable | Derived from first milestone |
| total_duration_minutes | From patient_in→patient_out | Required for row to exist |
| surgical_duration_minutes | From incision→closing | May be NULL |
| anesthesia_duration_minutes | From anes_start→anes_end | May be NULL |
| call_to_patient_in_minutes | From call_time→patient_in | Requires call_time |
| schedule_variance_minutes | Actual vs scheduled start | |
| room_turnover_minutes | Previous case patient_out→this patient_in | NULL for first case |
| surgical_turnover_minutes | Previous surgeon case out→this in | NULL for first case |
| is_first_case_of_day_room/surgeon | Boolean | |
| surgeon_room_count, case sequences | Integer | Day-level sequencing |
| reimbursement, costs, profit | Financial | Depends on payer/cost data |
| total_debits, total_credits, net_cost | Financial | From case_costs table |
| or_time_cost, or_hourly_rate | Financial | From facility settings |
| is_excluded, excluded_at/by/reason | Exclusion | Should all be NULL/false |
| cost_source | Text | Where cost data came from |
| created_at, updated_at, data_validated | Metadata | |
