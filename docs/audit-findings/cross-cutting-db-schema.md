# Cross-Cutting Audit: Database Schema Deep Review

**Auditor:** Claude Code (Opus 4.6)
**Date:** 2026-02-24
**Scope:** Baseline migration + 63 subsequent migrations, 2 edge functions, 5 materialized views
**Baseline:** `20260101000000_baseline.sql`

---

## Table of Contents

1. [CHECK 1: RLS Policy Completeness](#check-1-rls-policy-completeness)
2. [CHECK 2: Trigger Inventory](#check-2-trigger-inventory)
3. [CHECK 3: Index Coverage](#check-3-index-coverage)
4. [CHECK 4: Migration Safety](#check-4-migration-safety)
5. [CHECK 5: Materialized View Freshness](#check-5-materialized-view-freshness)
6. [CHECK 6: Edge Function Dependencies](#check-6-edge-function-dependencies)

---

## CHECK 1: RLS Policy Completeness

### Summary
- **89 tables** in the schema
- **80+ tables** have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- **200+ policies** defined in baseline + 150+ added/rewritten in subsequent migrations
- **No tables found with RLS enabled but zero policies** (all have at least SELECT)

### Policy Pattern

The standard 4-operation pattern (applied consistently after migration `20260224211526_remote_commit.sql`):

| Operation | Policy Name Pattern | Rule |
|-----------|-------------------|------|
| SELECT | `{table}_select` | `facility_id = (SELECT get_my_facility_id())` OR global admin |
| INSERT | `{table}_insert` | Same facility scoping + role check |
| UPDATE | `{table}_update` | Same facility scoping + role check |
| DELETE | `{table}_delete` | Admin-only or restricted |

### RLS Findings

#### FINDING 1.1: `always-true` policies replaced but verify completeness
**Severity:** MEDIUM
**Detail:** Migration `20260222200004` replaced 24 always-true RLS policies (using bare `true`) with `(select auth.role()) = 'authenticated'`. The final remote commit migration (`20260224211526`) then dropped and recreated ALL policies. Verify that every table's policies were correctly recreated.

#### FINDING 1.2: Infinite recursion fix on `case_implant_companies`
**Severity:** HIGH (fixed)
**Detail:** Migration `20260222200005` fixed an infinite recursion between `cases` and `case_implant_companies` RLS policies. The fix introduced a `get_case_facility_id()` SECURITY DEFINER helper to break the cycle. **This is fixed but fragile** — any new policy on `case_implant_companies` that joins back to `cases` will reintroduce the recursion.

#### FINDING 1.3: Template tables have overly permissive SELECT
**Severity:** LOW
**Detail:** Global template tables (`milestone_types`, `procedure_type_templates`, `cost_category_templates`, etc.) are readable by all authenticated users. This is intentional (templates are shared configuration) but means any authenticated user can enumerate all global templates across all facilities.

#### FINDING 1.4: `run-data-quality-detection` edge function has no auth check
**Severity:** MEDIUM
**Detail:** The data quality detection edge function uses `service_role` key but does NOT validate the caller's identity. Anyone with the function URL can trigger a detection run. Impact is low (writes are idempotent) but violates principle of least privilege.

#### FINDING 1.5: Tables with RLS enabled in later migrations
**Severity:** INFO
**Detail:** 6 tables had RLS enabled retroactively in migration `20260222200003`:
- `case_implant_companies`
- `device_rep_invites`
- `facility_device_reps`
- `implant_companies`
- `surgeon_preference_companies`
- `surgeon_preferences`

These tables had **no RLS** from baseline until this migration. If any data was inserted between baseline and this migration, it was accessible without facility scoping.

### RLS Coverage Matrix (Post-Final Migration)

| Table Category | SELECT | INSERT | UPDATE | DELETE | Notes |
|---------------|--------|--------|--------|--------|-------|
| Core operations (cases, milestones, staff) | Facility-scoped | Facility-scoped | Facility-scoped | Admin-only | Standard pattern |
| Lookup tables (statuses, types, roles) | All authenticated | Admin/system only | Admin/system only | Restricted | Read-only for users |
| Template tables (global) | All authenticated | Global admin | Global admin | Global admin | Shared config |
| Financial tables | Facility-scoped | Facility admin | Facility admin | Admin-only | Restricted writes |
| Audit/logging | Admin-only | System/triggers | N/A | N/A | Read-only for admins |
| Device rep tables | Scoped to company | Limited | Limited | Admin-only | Special access path |
| Materialized views | Revoked from anon | N/A | N/A | N/A | Refresh via functions |

---

## CHECK 2: Trigger Inventory

### Complete Trigger List (Post-Migration State)

#### Cases Table Triggers (8 total)

| # | Trigger Name | Event | Timing | Function | Purpose |
|---|-------------|-------|--------|----------|---------|
| 1 | `set_cases_updated_at` | UPDATE | BEFORE | `update_updated_at_column()` | Auto-update `updated_at` timestamp |
| 2 | `on_case_completed` | UPDATE (status change) | AFTER | `trigger_recalculate_averages()` | Recalculate surgeon averages on completion |
| 3 | `on_case_status_change_detect_issues` | UPDATE (status change) | AFTER | `trigger_issue_detection_on_case_update()` | Detect data quality issues |
| 4 | `trg_record_stats_on_validation` | UPDATE OF `data_validated` | AFTER | `trigger_record_stats_on_validation()` | Record stats when case validated |
| 5 | `trg_refresh_stats_on_completion` | UPDATE (status change) | AFTER | `trigger_refresh_stats_on_completion()` | Refresh materialized views |
| 6 | `trg_remove_stats_on_invalidation` | UPDATE OF `data_validated` | AFTER | `trigger_remove_stats_on_invalidation()` | Remove stats when invalidated |
| 7 | `trg_sync_exclusion_to_stats` | UPDATE OF `is_excluded_from_metrics` | AFTER | `trigger_sync_exclusion_to_stats()` | Sync exclusion flag to stats |
| 8 | `trigger_auto_create_patient_checkin` | INSERT/UPDATE | AFTER | `auto_create_patient_checkin()` | Create patient checkin record |

#### Ordering Dependencies (CRITICAL)

PostgreSQL fires triggers alphabetically within the same timing/event group. The actual execution order for cases:

**BEFORE UPDATE:**
1. `set_cases_updated_at` — Updates timestamp (must run before AFTER triggers read it)

**AFTER UPDATE (status change):**
2. `on_case_completed` — Recalculates averages (reads `case_completion_stats`)
3. `on_case_status_change_detect_issues` — Detects issues (reads milestones)
4. `trg_record_stats_on_validation` — Records stats (writes to `case_completion_stats`)
5. `trg_refresh_stats_on_completion` — Refreshes MVs (reads `case_completion_stats`)
6. `trg_remove_stats_on_invalidation` — Removes stats (deletes from `case_completion_stats`)
7. `trg_sync_exclusion_to_stats` — Updates exclusion (writes to `case_completion_stats`)
8. `trigger_auto_create_patient_checkin` — Creates checkin (independent)

#### FINDING 2.1: Trigger ordering dependency on `case_completion_stats`
**Severity:** HIGH
**Detail:** Triggers #2, #4, #5, #6, and #7 all read or write `case_completion_stats`. The alphabetical firing order means:
- `on_case_completed` (#2) fires BEFORE `trg_record_stats_on_validation` (#4)
- If a case is completed AND validated in the same UPDATE, `on_case_completed` reads stats that haven't been written yet by #4
- `trg_refresh_stats_on_completion` (#5) refreshes MVs BEFORE `trg_sync_exclusion_to_stats` (#7) updates exclusion flags
**Impact:** In practice, this is mitigated because status changes and validation are separate UPDATE operations. But a single UPDATE that changes both could produce stale stats.
**Recommendation:** Add explicit ordering via trigger naming (e.g., prefix with `t01_`, `t02_`) or consolidate into a single trigger dispatcher.

#### FINDING 2.2: Trigger dropped — `on_facility_created_copy_milestones`
**Severity:** INFO
**Detail:** Migration `20260222210000` dropped this trigger. New facility provisioning now goes through `seed_facility_with_templates()` RPC only. The trigger `on_facility_created_seed_templates` was also dropped in `20260222200000`. **New facilities MUST call `seed_facility_with_templates()` manually** — there is no automatic seeding on INSERT.

#### FINDING 2.3: Demo trigger disable/enable functions
**Severity:** LOW
**Detail:** Functions `disable_demo_triggers()` and `enable_demo_triggers()` disable 7 AFTER triggers on the cases table during demo data generation. If the enable function fails to run (crash, timeout), triggers remain disabled until manually re-enabled.

#### All Other Triggers

| Trigger | Table | Event | Function | Purpose |
|---------|-------|-------|----------|---------|
| `on_milestone_recorded_detect_issues` | `case_milestones` | AFTER INSERT | `trigger_issue_detection_on_milestone()` | Detect data quality issues |
| `trg_record_case_stats` | `case_milestones` | AFTER INSERT | `trigger_record_case_stats()` | Record milestone stats |
| `trg_update_case_stats` | `case_milestones` | AFTER UPDATE | `trigger_update_case_stats()` | Update milestone stats |
| `trigger_update_patient_status_from_milestone` | `case_milestones` | AFTER INSERT | `update_patient_status_from_milestone()` | Sync patient status |
| `audit_case_device_companies_trigger` | `case_device_companies` | AFTER I/U/D | `audit_case_device_companies_changes()` | Audit trail |
| `audit_case_implants_trigger` | `case_implants` | AFTER I/U/D | `audit_case_implants_changes()` | Audit trail |
| `page_registry_updated_at` | `page_registry` | BEFORE UPDATE | `update_page_registry_timestamp()` | Timestamp |
| `set_category_updated_at` | `page_registry_categories` | BEFORE UPDATE | `update_updated_at_column()` | Timestamp |
| `set_complexity_templates_updated_at` | `complexity_templates` | BEFORE UPDATE | `update_default_complexities_updated_at()` | Timestamp |
| `update_facility_analytics_settings_timestamp` | `facility_analytics_settings` | BEFORE UPDATE | `update_analytics_settings_timestamp()` | Timestamp |
| `trg_flag_rules_updated_at` | `flag_rules` | BEFORE UPDATE | `update_flag_rules_updated_at()` | Timestamp |
| `trigger_set_room_display_order` | `or_rooms` | BEFORE INSERT | `set_room_display_order()` | Auto-assign display order |

#### Soft-Delete Triggers (20 tables)

All call `sync_soft_delete_columns()` on BEFORE UPDATE:

`body_regions`, `cancellation_reason_templates`, `cancellation_reasons`, `complexities`, `complexity_templates`, `cost_categories`, `cost_category_templates`, `delay_types`, `facility_milestones`, `flag_rules`, `implant_companies`, `milestone_types`, `or_rooms`, `patients`, `payers`, `preop_checklist_field_templates`, `preop_checklist_fields`, `procedure_categories`, `procedure_type_templates`, `procedure_types`, `users`

Plus newer tables: `phase_definitions` (dropped), `surgeon_procedure_duration`, `milestone_templates`, `milestone_template_types`

---

## CHECK 3: Index Coverage

### Summary
- **250+ indexes** in baseline
- **109 FK indexes** added in migration `20260222200004`
- **100+ indexes** added in remote commit migration `20260224211526`
- **48+ indexes** dropped across cleanup migrations as unused (0 scans)
- **Current estimated total: ~350-400 indexes**

### Index Coverage by Query Pattern

#### Case Queries (Domain 1)
| Query Pattern | Supporting Index | Status |
|--------------|-----------------|--------|
| Cases by facility + date | `idx_cases_facility_date (facility_id, scheduled_date)` | COVERED |
| Cases by facility + status + date | `idx_cases_facility_status_date (facility_id, status_id, scheduled_date)` | COVERED |
| Cases by surgeon + date | `idx_cases_surgeon_date (surgeon_id, scheduled_date)` | COVERED |
| Cases by room + date | `idx_cases_room_date (room_id, scheduled_date)` | COVERED |
| Validated cases only | `idx_cases_data_validated WHERE data_validated = true` | COVERED (partial) |
| Draft cases | None specific | MISSING — consider partial index on `is_draft = true` |

#### Milestone Queries (Domain 2)
| Query Pattern | Supporting Index | Status |
|--------------|-----------------|--------|
| Milestones by case | `case_milestones_case_id_facility_milestone_id_key` (unique) | COVERED |
| Milestones by facility_milestone_id | FK index added in `20260222200004` | COVERED |
| Milestone stats by surgeon+procedure | `idx_cms_surgeon_procedure_milestone` | COVERED |

#### Financial Queries (Domain 3)
| Query Pattern | Supporting Index | Status |
|--------------|-----------------|--------|
| Completion stats by facility+surgeon+procedure | `idx_ccs_facility_surgeon_procedure` | COVERED |
| Non-excluded stats | `idx_ccs_not_excluded WHERE is_excluded = false OR is_excluded IS NULL` | COVERED (partial) |
| Financial targets by facility+year+month | Composite index added | COVERED |

#### Flag/Quality Queries (Domain 4)
| Query Pattern | Supporting Index | Status |
|--------------|-----------------|--------|
| Flags by case | FK index on `case_id` | COVERED |
| Flags by facility_milestone_id | Partial index added in `20260216100000` | COVERED |
| Metric issues by case | FK index on `case_id` | COVERED |
| Metric issues by facility + unresolved | None composite | POTENTIALLY MISSING |

#### Settings/Config Queries (Domain 6)
| Query Pattern | Supporting Index | Status |
|--------------|-----------------|--------|
| Facility milestones by facility | `idx_facility_milestones_facility` + unique on `(facility_id, name)` | COVERED |
| Procedure types by facility | `idx_procedure_types_facility` | COVERED |
| Template items by template | FK indexes added | COVERED |

### Index Findings

#### FINDING 3.1: Missing composite index on `metric_issues` for unresolved facility queries
**Severity:** MEDIUM
**Detail:** The data quality page queries `metric_issues` filtered by `facility_id` and `resolved_at IS NULL`. There's no composite index covering `(facility_id) WHERE resolved_at IS NULL`. This forces sequential scan on potentially large issue tables.
**Recommendation:** `CREATE INDEX idx_metric_issues_facility_unresolved ON metric_issues (facility_id) WHERE resolved_at IS NULL`

#### FINDING 3.2: Missing partial index on `cases.is_draft`
**Severity:** LOW
**Detail:** Draft case queries (case entry flow) filter `is_draft = true`. There's no supporting index.
**Recommendation:** `CREATE INDEX idx_cases_draft ON cases (facility_id) WHERE is_draft = true` (if draft case count is significant)

#### FINDING 3.3: Aggressive index cleanup based on scan statistics
**Severity:** MEDIUM
**Detail:** Migrations `20260222200002` and `20260222200003` dropped indexes with 0 scans from `pg_stat_user_indexes`. This approach is risky because:
- Stats reset on server restart
- Newly created indexes have 0 scans
- Indexes for infrequent but critical queries (monthly reports, backfills) may show 0 scans
**Recommendation:** Before dropping indexes, ensure stats have been accumulated over at least 30 days. Consider adding a `WHERE idx_scan > 0 OR indexrelid::regclass::text LIKE 'idx_%'` safeguard.

#### FINDING 3.4: 109 FK indexes added in one migration
**Severity:** INFO
**Detail:** Migration `20260222200004` added 109 indexes for unindexed FK columns. This is correct practice (prevents sequential scans on FK lookups during CASCADE operations) but the migration is slow to apply on large databases.

#### FINDING 3.5: Materialized view unique indexes present
**Severity:** INFO (GOOD)
**Detail:** All 5 materialized views have unique indexes, enabling `REFRESH MATERIALIZED VIEW CONCURRENTLY`. This is correct and allows non-blocking refreshes.

---

## CHECK 4: Migration Safety

### Summary
- **64 total migrations** (baseline + 63 subsequent)
- **Non-idempotent:** 12 migrations
- **Destructive (irreversible):** 8 migrations
- **Mixed data+schema:** 9 migrations
- **Known bugs deployed then fixed:** 3 instances

### Migration Safety Matrix

| Migration | Idempotent | Destructive | Data+Schema Mix | Known Bugs |
|-----------|-----------|-------------|-----------------|------------|
| `20260101000000` baseline | N/A | No | N/A | No |
| `20260211000000` create_case_with_milestones | Yes | No | No | No |
| `20260212000000` phase2_draft_cases | Yes | No | No | No |
| `20260212000002` coordinator_role | Yes | No | No | No |
| `20260212000003` staff_and_conflicts | No | No | No | No JSONB validation |
| `20260212000004` fix_milestone_type_id_triggers | Yes | No | No | No |
| `20260212000005` operative_side_config | Yes | No | No | No |
| `20260214000000` seed_milestone_types | Yes | No | Data only | Unguarded UPDATEs |
| `20260215000000` permissions_system | Partial | No | Mixed | SECURITY DEFINER |
| `20260215000001` permissions_cleanup | Partial | **Yes** | Data only | Deletes 12 perms |
| `20260215000002` add_phase_group | Yes | No | Mixed | No |
| `20260215000003` get_milestone_interval_medians | Yes | No | No | **BUG: c.is_active** |
| `20260215000004` get_full_day_financials | Yes | No | No | **BUG: c.is_active** |
| `20260216000000` fix_medians_is_active | Yes | No | No | Bug fix |
| `20260216000001` fix_financials_is_active | Yes | No | No | Bug fix |
| `20260216000002` simplify_full_day_financials | Yes | No | No | Breaking change |
| `20260216100000` add_facility_milestone_id | Yes | No | No | No |
| `20260219000001` phase_definitions | **No** | No | No | No |
| `20260219000002` surgeon_milestone_config | **No** | No | No | No |
| `20260219000003` seed_facility_phases | Partial | No | Mixed | Not idempotent seeds |
| `20260219000004` phase_defs_soft_delete | Yes | No | No | Duplicate of #1 |
| `20260219000005` update_create_case | Partial | **Yes** | No | Drops overloads |
| `20260219000006` get_phase_medians | Yes | No | No | No |
| `20260219000007` add_parent_phase_id | **No** | No | No | No |
| `20260219000008` add_kpi_target_columns | Yes | No | Mixed | Backfill risk |
| `20260219000009` milestone_medians_lead | Yes | No | No | Breaking semantic change |
| `20260219000010` add_financial_benchmark | **No** | No | No | No |
| `20260219000011` procedure_duration_config | Partial | No | No | No |
| `20260219000012` drop_scheduled_duration | Yes | **Yes** | Implicit data loss | Column drop |
| `20260219000013` behind_schedule_grace | Yes | No | No | No |
| `20260219000014` surgeon_scorecards | Yes | No | No | No |
| `20260219000015` surgeon_readiness_flag | **No** | No | Data only | Not idempotent INSERT |
| `20260219000016` get_flag_analytics | Yes | No | No | Complex 581-line RPC |
| `20260219000017` flag_analytics_surgeon | Yes | No | No | No |
| `20260219000018` flag_analytics_room_id | Yes | No | No | No |
| `20260219100000` flag_rules_soft_delete | Yes | No | No | No |
| `20260220100000` financial_targets | Yes | No | No | No |
| `20260220200000` skip_validated_detection | Yes | No | No | No |
| `20260221000000` fix_surgeon_averages | Yes | No | No | No |
| `20260221000001` fix_surgeon_overall_stats | Partial | No | Mixed | Blocks during refresh |
| `20260221100000` admin_settings_templates | Partial | No | Mixed | Seeds without conflict handling |
| `20260221200000` min_case_threshold | Yes | No | No | No |
| `20260222000000` unify_anesthesia | Partial | **Yes** | Mixed | Column drop, one-way |
| `20260222100000` fix_supabase_advisor | Partial | No | No | **Breaks functions** |
| `20260222100001` fix_search_path_public | Yes | No | No | Fixes previous |
| `20260222100002` fix_empty_search_path | Yes | No | No | Redundant with above |
| `20260222100003` fix_permissive_indexes | Partial | No | No | No |
| `20260222200000` extend_seed_templates | Yes | No | No | Drops 2 triggers |
| `20260222200001` fix_lint_remaining | Yes | No | No | No |
| `20260222200002` drop_unused_indexes | Yes | **Yes** | No | Stats-dependent |
| `20260222200003` enable_rls_drop_indexes | Yes | **Yes** | No | Stats-dependent |
| `20260222200004` fix_all_advisor_issues | Partial | No | No | FK re-pointing |
| `20260222200005` fix_cases_rls_recursion | Partial | No | No | Critical fix |
| `20260222200006` fix_function_lint | Yes | **Yes** | No | Drops audit indexes |
| `20260222210000` drop_legacy_trigger | Yes | No | No | No |
| `20260223000001` milestone_template_tables | **No** | No | No | No transaction wrapper |
| `20260223000002` template_data_migration | Partial | No | Data only | Not fully idempotent |
| `20260223000003` template_rpc_rewrites | Yes | No | No | No |
| `20260223100000` analytics_rpc_cascade | Yes | No | No | **BUG: missing surgeon override** |
| `20260223100001` drop_legacy_tables | Yes | **Yes** | No | 3 tables dropped CASCADE |
| `20260223200000` template_block_order | **No** | No | No | No |
| `20260223200001` template_sub_phase_map | **No** | No | No | No |
| `20260223300000` template_phase_resolver | Mixed | No | No | Breaking RPC signature |
| `20260223400000` drop_phase_definitions | Yes | **Yes** | No | 2 tables dropped CASCADE |
| `20260224000000` fix_interval_medians | Yes | No | No | Bug fix |
| `20260224211526` remote_commit | Mixed | No | No | RLS gap during drop/recreate |

### Critical Migration Findings

#### FINDING 4.1: Bugs deployed then fixed in subsequent migrations
**Severity:** HIGH (process concern)
**Detail:** Three separate instances of bugs being deployed and fixed in the next migration:
1. `20260215000003` introduced `c.is_active` bug → fixed in `20260216000000`
2. `20260215000004` same `c.is_active` bug → fixed in `20260216000001`
3. `20260222100000` set `search_path = ''` breaking all functions → fixed in `20260222100001` and `20260222100002`
4. `20260223100000` missing surgeon override in cascade → fixed in `20260224000000`
**Recommendation:** Add CI/CD testing that validates functions after migration. Consider squashing bug+fix migrations before production deployment.

#### FINDING 4.2: No migrations have explicit rollback scripts
**Severity:** MEDIUM
**Detail:** None of the 64 migrations include `DOWN` migration scripts. Every change is forward-only. For destructive migrations (table drops, column drops), this means no automated rollback path exists.
**Recommendation:** For critical migrations that drop tables/columns, create paired rollback scripts. At minimum, back up dropped data before applying.

#### FINDING 4.3: 9 migrations mix data and schema changes
**Severity:** MEDIUM
**Detail:** Mixing data modifications (INSERT/UPDATE/DELETE) with schema changes (CREATE TABLE/ALTER TABLE) in a single migration makes rollback harder and increases failure risk. If the schema change succeeds but the data migration fails, the database is in an inconsistent state.
**Migrations:** `20260215000000`, `20260215000002`, `20260219000003`, `20260219000008`, `20260221000001`, `20260221100000`, `20260222000000`, `20260223000002`
**Recommendation:** Split data migrations into separate files that run after schema changes.

#### FINDING 4.4: Remote commit migration is monolithic (1667 lines)
**Severity:** MEDIUM
**Detail:** Migration `20260224211526_remote_commit.sql` drops all existing RLS policies, recreates 156+ new policies, creates 100+ indexes, and enables extensions. This single migration:
- Creates a brief window with no RLS protection during policy drop/recreate
- Takes significant time to apply (lock contention)
- Is NOT idempotent (CREATE POLICY fails if policy exists)
- Cannot be partially rolled back
**Recommendation:** Split into smaller migrations. Apply during maintenance window. Consider using `CREATE POLICY IF NOT EXISTS` pattern.

#### FINDING 4.5: Redundant migration pair
**Severity:** LOW
**Detail:** Migrations `20260222100001` and `20260222100002` do the same thing (fix `search_path` to `'public'`). The second is redundant.

---

## CHECK 5: Materialized View Freshness

### Materialized Views Inventory

| # | View Name | Source | Unique Index | Concurrent Refresh |
|---|-----------|--------|-------------|-------------------|
| 1 | `surgeon_procedure_stats` | `case_completion_stats` | `idx_surgeon_procedure_stats_pk` | Yes |
| 2 | `surgeon_milestone_stats` | `case_milestone_stats` | `idx_sms_lookup` | Yes |
| 3 | `surgeon_overall_stats` | `case_completion_stats` | `idx_sos_lookup` | Yes |
| 4 | `facility_procedure_stats` | `case_completion_stats` | `idx_facility_procedure_stats_pk` | Yes |
| 5 | `facility_milestone_stats` | `case_milestone_stats` | `idx_fms_lookup` | Yes |
| 6 | `mv_facility_health_scores` | `facilities`, `error_logs`, `audit_log` | `mv_facility_health_scores_facility_id` | Yes |

### Refresh Mechanisms

#### Trigger-Based Refresh
- `trg_refresh_stats_on_completion` on `cases` table calls `refresh_all_stats()` which refreshes views #1-#5
- Fires on case status change (e.g., marking case as completed)
- `refresh_facility_health_scores()` refreshes view #6

#### Manual Refresh
- `refresh_all_stats()` / `refresh_case_stats()` can be called manually
- Used during demo data generation (after bulk inserts)

### Freshness Findings

#### FINDING 5.1: No scheduled/cron refresh for materialized views
**Severity:** HIGH
**Detail:** `pg_cron` extension is enabled but **no `cron.schedule()` calls exist** in any migration. Materialized views are ONLY refreshed by:
1. Case completion triggers (reactive, per-case)
2. Manual calls to `refresh_all_stats()`

If a case is **edited** after completion (e.g., milestone timestamps corrected, exclusion flag toggled), the MV refresh trigger fires per-trigger but may not capture all state changes. There's no periodic "catch-up" refresh.

**Recommendation:** Add a nightly cron job:
```sql
SELECT cron.schedule(
  'nightly-stats-refresh',
  '0 3 * * *',
  'SELECT refresh_all_stats()'
);
```

#### FINDING 5.2: Refresh blocks during `REFRESH MATERIALIZED VIEW` (non-concurrent)
**Severity:** MEDIUM
**Detail:** Migration `20260221000001` rewrote `surgeon_overall_stats` and called `REFRESH MATERIALIZED VIEW surgeon_overall_stats` (non-concurrent). Non-concurrent refresh takes an ACCESS EXCLUSIVE lock, blocking all reads for the duration.

However, all runtime refreshes now use `REFRESH MATERIALIZED VIEW CONCURRENTLY` (verified in `refresh_all_stats()` function), which only takes an EXCLUSIVE lock on the unique index — reads continue during refresh.

**Status:** Fixed in runtime. Only migration-time refresh was blocking.

#### FINDING 5.3: Per-case trigger refresh is expensive
**Severity:** MEDIUM
**Detail:** Every case completion triggers `refresh_all_stats()`, which refreshes **5 materialized views**. On a busy day with 50+ completions, this means 250 MV refreshes. Each concurrent refresh must:
1. Materialize the full query result
2. Diff against existing data
3. Apply inserts/updates/deletes

**Impact:** Depends on table sizes. With thousands of cases, each refresh could take 1-5 seconds. 50 completions = 50-250 seconds of refresh work per day.

**Recommendation:** Consider debouncing: instead of refreshing per-case, refresh on a 5-minute interval using pg_cron. Or use a "dirty flag" pattern where the trigger marks the view as stale, and a cron job refreshes only stale views.

#### FINDING 5.4: `mv_facility_health_scores` has no automatic refresh trigger
**Severity:** LOW
**Detail:** This view computes health scores from `error_logs` and `audit_log` over the last 7 days. It's not connected to any trigger — it's only refreshed when manually called via `refresh_facility_health_scores()`. If never called, health scores become permanently stale.

#### FINDING 5.5: No monitoring for refresh failures
**Severity:** MEDIUM
**Detail:** If `refresh_all_stats()` fails (e.g., deadlock, timeout), the error is silently swallowed within the trigger function's `EXCEPTION` block. There's no alert mechanism, no `error_logs` entry, and no way to detect that views are stale.

**Recommendation:** Add error logging to the refresh function:
```sql
EXCEPTION WHEN OTHERS THEN
  INSERT INTO error_logs (facility_id, error_type, message, context)
  VALUES (NULL, 'mv_refresh_failure', SQLERRM, jsonb_build_object('function', 'refresh_all_stats'));
```

---

## CHECK 6: Edge Function Dependencies

### Function 1: `compute-surgeon-scorecard`

#### Tables Read
| Table | Purpose |
|-------|---------|
| `facilities` | Timezone lookup |
| `facility_analytics_settings` | Scoring configuration |
| `cases` (+ joins to `users`, `procedure_types`, `case_milestones`, `facility_milestones`, `case_statuses`) | Case data for scoring |
| `case_completion_stats` | Financial data (profit, reimbursement, OR time cost) |
| `case_flags` (+ joins to `delay_types`) | Flag/delay data |

#### Tables Written
None — read-only computation. Returns JSON response.

#### Service Role Key
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for cross-facility comparisons
- Validates caller JWT first using anon key (proper two-step auth)

#### Failure Handling
- Returns 401 for auth failures, 400 for missing params, 404 for insufficient data
- Generic 500 catch-all with error message
- **No retry mechanism** — caller must retry
- Batched queries (100 IDs per batch) — partial batch failure is silently skipped

#### `orbitScoreEngine.ts` Sync Status

**FINDING 6.1: Duplicated `orbitScoreEngine.ts`**
**Severity:** HIGH
**Detail:** The scoring engine exists in TWO locations:
1. `lib/orbitScoreEngine.ts` (web app, 1,379 lines)
2. `supabase/functions/compute-surgeon-scorecard/orbitScoreEngine.ts` (edge function, 1,379 lines)

Currently identical (both v2.2, same timestamp Feb 21). But any future change to `lib/orbitScoreEngine.ts` must be **manually copied** to the edge function. There's no build step, no symlink, no automated sync.

**Impact:** If scoring logic diverges, web app and iOS app (which calls the edge function) will compute different scores for the same surgeon.

**Recommendation:** Add a CI check that diffs the two files and fails if they differ. Or add a pre-deploy script that copies `lib/orbitScoreEngine.ts` to the edge function directory.

### Function 2: `run-data-quality-detection`

#### Tables Read
| Table | Purpose |
|-------|---------|
| `facilities` | All active facilities |
| `cases` (+ joins to `case_statuses`, `case_milestones`, `facility_milestones`) | Case data for analysis |
| `issue_types` | Issue type IDs |
| `resolution_types` | Resolution type for 'expired' |
| `facility_milestones` | Milestone lookup by name |
| `case_statuses` | Status lookup for stale detection |

#### Tables Written
| Table | Operation | Purpose |
|-------|-----------|---------|
| `metric_issues` | UPDATE | Expire old issues (> 30 days) |
| `metric_issues` | INSERT | Create new detected issues |
| `cases` | UPDATE | Set `data_validated = false` for stale cases |

#### Service Role Key
- Uses `SUPABASE_SERVICE_ROLE_KEY` to process all facilities
- **No authentication check** on the caller

#### FINDING 6.2: No authentication on data quality detection
**Severity:** MEDIUM
**Detail:** Unlike `compute-surgeon-scorecard` which validates the caller's JWT, `run-data-quality-detection` accepts requests from anyone with the function URL. While writes are idempotent, an attacker could trigger unnecessary database load.
**Recommendation:** Add bearer token validation or restrict to cron-only invocation.

#### FINDING 6.3: Non-atomic issue creation + case invalidation
**Severity:** LOW
**Detail:** When detecting stale cases, the function:
1. Inserts into `metric_issues` (line 468-479)
2. Updates `cases.data_validated = false` (line 486-489)

These are separate operations. If the function crashes between #1 and #2, the issue is created but the case remains validated. Next run will skip the issue (already exists) but the case stays validated.

**Impact:** Very low — analytics queries use the issues table as source of truth, not `data_validated` alone.

#### FINDING 6.4: No cron job scheduled for data quality detection
**Severity:** HIGH
**Detail:** `pg_cron` is enabled but no `cron.schedule()` call exists for the data quality detection function. This means:
- Nightly detection runs don't happen automatically
- Stale cases go undetected until someone manually triggers the function
- Old issues never expire

**Recommendation:** Add to a migration:
```sql
SELECT cron.schedule(
  'nightly-data-quality',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/run-data-quality-detection',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  )$$
);
```

#### FINDING 6.5: 4 detection categories
**Detail:** The function detects:
1. **Missing required milestones** — Completed cases missing patient_in, incision, closing, or patient_out
2. **Negative durations** — Milestone intervals that go backward in time
3. **Impossible values** — Durations exceeding 24 hours
4. **Stale cases** — Three subtypes:
   - In-progress > 24 hours
   - Scheduled but 2+ days past date
   - In-progress with no milestone in 4+ hours

---

## Summary of All Findings by Severity

### CRITICAL (0)
None — no data loss or security vulnerabilities in current state.

### HIGH (6)

| # | Finding | Area | Description |
|---|---------|------|-------------|
| 1 | 2.1 | Triggers | Cases table trigger ordering dependency on `case_completion_stats` |
| 2 | 4.1 | Migrations | 4 bugs deployed then fixed in subsequent migrations (process gap) |
| 3 | 5.1 | MVs | No scheduled cron refresh for materialized views |
| 4 | 6.1 | Edge Functions | Duplicated `orbitScoreEngine.ts` with no sync mechanism |
| 5 | 6.4 | Edge Functions | No cron job scheduled for data quality detection |
| 6 | 4.4 | Migrations | Remote commit migration is monolithic (1667 lines, drops all RLS) |

### MEDIUM (8)

| # | Finding | Area | Description |
|---|---------|------|-------------|
| 1 | 1.1 | RLS | Verify final RLS policy completeness after mass drop/recreate |
| 2 | 1.4 | RLS | Data quality edge function has no auth check |
| 3 | 3.1 | Indexes | Missing composite index on `metric_issues` for unresolved queries |
| 4 | 3.3 | Indexes | Aggressive index cleanup based on potentially incomplete scan stats |
| 5 | 4.2 | Migrations | No migrations have rollback scripts |
| 6 | 4.3 | Migrations | 9 migrations mix data and schema changes |
| 7 | 5.3 | MVs | Per-case trigger refresh is expensive (5 MVs per completion) |
| 8 | 5.5 | MVs | No monitoring for MV refresh failures |

### LOW (7)

| # | Finding | Area | Description |
|---|---------|------|-------------|
| 1 | 1.3 | RLS | Template tables readable by all authenticated users |
| 2 | 1.5 | RLS | 6 tables had retroactive RLS enablement |
| 3 | 2.3 | Triggers | Demo trigger disable/enable risk if enable fails |
| 4 | 3.2 | Indexes | Missing partial index on `cases.is_draft` |
| 5 | 4.5 | Migrations | Redundant migration pair (search_path fix) |
| 6 | 5.4 | MVs | `mv_facility_health_scores` has no auto-refresh |
| 7 | 6.3 | Edge Functions | Non-atomic issue creation + case invalidation |

### INFO (3)

| # | Finding | Area | Description |
|---|---------|------|-------------|
| 1 | 2.2 | Triggers | Facility seeding triggers removed, RPC-only now |
| 2 | 3.4 | Indexes | 109 FK indexes added in one migration (correct but slow) |
| 3 | 3.5 | Indexes | All MVs have unique indexes for concurrent refresh (good) |

---

## Recommended Fix Order

### Phase A: Quick Wins (1 session)
1. Add missing `metric_issues` composite index (Finding 3.1)
2. Add auth check to `run-data-quality-detection` edge function (Finding 1.4, 6.2)
3. Add MV refresh error logging (Finding 5.5)

### Phase B: Cron Jobs (1 session)
4. Schedule nightly MV refresh via pg_cron (Finding 5.1)
5. Schedule nightly data quality detection (Finding 6.4)
6. Schedule nightly `mv_facility_health_scores` refresh (Finding 5.4)

### Phase C: Sync & Process (1 session)
7. Add CI check for `orbitScoreEngine.ts` sync (Finding 6.1)
8. Add pre-deploy copy script for edge function assets (Finding 6.1)

### Phase D: Architecture (future sprints)
9. Debounce MV refresh: replace per-case trigger with periodic cron (Finding 5.3)
10. Add trigger ordering prefixes on cases table (Finding 2.1)
11. Establish rollback script convention for future migrations (Finding 4.2)
12. Establish migration testing gate in CI (Finding 4.1)
