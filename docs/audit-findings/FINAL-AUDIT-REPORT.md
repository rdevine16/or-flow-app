# ORbit Platform — Final Audit Report

**Date:** 2026-02-24
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Full-stack audit — 6 domain audits + 3 cross-cutting analyses
**Files reviewed:** 200+ source files, 64 migrations, 89 DB tables, 338 RLS policies
**Source findings:** 9 audit documents totaling ~3,500 lines

---

## Executive Summary

### Total Issues by Severity (Deduplicated)

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 23 | Security holes, broken features, data corruption risks |
| **HIGH** | 31 | Data integrity gaps, missing enforcement, broken workflows |
| **MEDIUM** | 48 | Validation gaps, missing audit logs, code quality |
| **LOW** | 35+ | Polish, tech debt, nice-to-have improvements |
| **Total** | **137+** | |

### Top 5 Most Urgent Fixes

| # | Issue | Domain | Why Urgent | Effort |
|---|-------|--------|------------|--------|
| 1 | **User invite creation is broken** — API references non-existent `invites` table (should be `user_invites`) | Auth | No new users can be invited to any facility | 15 min |
| 2 | **Flag detection never runs in production** — `evaluateCasesBatch()` only called from demo generator | Flags | Zero threshold flags generated for real cases | 2-4 hrs |
| 3 | **Global Security page has NO access control** — any logged-in user can view error logs, failed logins, IPs across all facilities | Security | Active information disclosure vulnerability | 15 min |
| 4 | **Rate limiter is broken** — in-memory Map resets on cold start; IP tracking uses hardcoded `'web-client'` string | Auth | Login brute-force protection non-functional | 1-2 hrs |
| 5 | **Permission enforcement is UI-only** — `user_has_permission()` exists but is used by zero RLS policies | Security | Users can bypass all UI permission checks via Supabase client | 4-8 hrs |

### Effort Estimates by Priority Tier

| Tier | Issues | Estimated Effort | Sessions |
|------|--------|-----------------|----------|
| Critical (P0) | 23 | ~6-10 days | 8-12 sessions |
| High (P1) | 31 | ~8-12 days | 10-15 sessions |
| Medium (P2) | 48 | ~10-15 days | 12-18 sessions |
| Low (P3) | 35+ | ~5-8 days | 6-10 sessions |

---

## Critical Issues (Fix Before Any Release)

### C1. User Invite System is Broken
**What:** `/api/admin/invite` and `/api/resend-invite` INSERT into non-existent `invites` table. DB only has `user_invites`.
**Where:** [app/api/admin/invite/route.ts:60-71](app/api/admin/invite/route.ts), [app/api/resend-invite/route.ts:20-24](app/api/resend-invite/route.ts)
**Why it matters:** No new users can be invited to any facility. Core onboarding is completely broken.
**How to fix:** Change `from('invites')` to `from('user_invites')` in both API routes. Verify column names match.
**Effort:** 15 minutes

### C2. Device Rep Signup is Broken (3 Bugs)
**What:** (a) API inserts `implant_company_id` into `facility_device_reps` — column doesn't exist. (b) Two tables serve same purpose (`device_rep_facility_access` vs `facility_device_reps`) — never synced. (c) Cases RLS references wrong table.
**Where:** [app/api/create-device-rep/route.ts:81-89](app/api/create-device-rep/route.ts), baseline.sql:4943-4948, baseline.sql:9533-9537
**Why it matters:** Device rep signup always fails. Even if fixed, reps can't see cases due to RLS referencing wrong table.
**How to fix:** Consolidate to ONE table (recommend `device_rep_facility_access`), fix API column reference, fix RLS policy.
**Effort:** 2-3 hours (migration + API fix + RLS fix)

### C3. Flag Detection Never Runs in Production
**What:** `evaluateCasesBatch()` is only called from `demo-data-generator.ts`. No trigger, no cron job, no API endpoint for production flag detection.
**Where:** [lib/flagEngine.ts](lib/flagEngine.ts) (794 lines), [lib/demo-data-generator.ts:987](lib/demo-data-generator.ts)
**Why it matters:** Production cases never get auto-flagged. All threshold flags in production come from demo data only. The entire flag analytics dashboard is empty for real facilities.
**How to fix:** Add flag detection trigger on case validation (`data_validated = true`), or add cron-based batch detection via edge function.
**Effort:** 4-8 hours (requires baseline precomputation strategy)

### C4. Missing `issue_types` Rows for Stale Detection
**What:** Stale case detection queries `issue_types` for `stale_in_progress`, `abandoned_scheduled`, `no_activity` — no migration creates these rows. Code silently returns empty.
**Where:** [lib/dataQuality.ts:524-535](lib/dataQuality.ts), edge function:424-429
**Why it matters:** Stale case detection has **never run** in any environment. Edge function logs "0 stale cases detected" nightly.
**How to fix:** Migration to INSERT the 3 issue type rows.
**Effort:** 15 minutes

### C5. Global Security Page Has NO Access Control
**What:** `app/admin/global-security/page.tsx` has no `isGlobalAdmin` check, no `useUser` check, no redirect. Any logged-in user can access.
**Where:** [app/admin/global-security/page.tsx](app/admin/global-security/page.tsx)
**Why it matters:** Exposes sensitive data: error logs, failed logins, session details, IP addresses across ALL facilities.
**How to fix:** Add `isGlobalAdmin` redirect guard (same pattern as other admin pages).
**Effort:** 15 minutes

### C6. Rate Limiter is Non-Functional
**What:** (a) Uses in-memory `Map` — resets on every Vercel cold start, doesn't work across serverless instances. (b) Login page passes hardcoded `'web-client'` instead of real IP — all users share one bucket.
**Where:** [lib/rate-limiter.ts:28-29](lib/rate-limiter.ts), [app/login/page.tsx:71](app/login/page.tsx)
**Why it matters:** Login brute-force protection is completely non-functional. DB-based functions exist (`checkRateLimitDB`) but are unused.
**How to fix:** Switch to `checkRateLimitDB()`. Pass real client IP from request headers.
**Effort:** 1-2 hours

### C7. Permission Enforcement is UI-Only
**What:** `user_has_permission()` SQL function exists but is used by ZERO RLS policies. All 338 policies use role-based checks only. `PermissionGuard` component exists but is used on ZERO pages.
**Where:** [20260215000000_permissions_system.sql:358-383](supabase/migrations/20260215000000_permissions_system.sql), all RLS policies
**Why it matters:** Users can bypass all UI permission checks by querying Supabase directly from browser console. The entire permission system (41 keys, 7 categories, template→facility architecture) is decorative.
**How to fix:** Add `user_has_permission()` checks to RLS policies on sensitive tables. Add server-side checks to API routes.
**Effort:** 4-8 hours (incremental — start with financial tables)

### C8. No Session Revocation on User Deactivation
**What:** Deactivating a user sets `is_active = false` but does NOT call `supabase.auth.admin.signOut(userId)`. Deactivated users remain logged in.
**Where:** [app/settings/users/page.tsx:391-419](app/settings/users/page.tsx)
**Why it matters:** Terminated employees retain access until their session naturally expires (could be hours/days).
**How to fix:** Add `supabase.auth.admin.signOut(userId)` call after deactivation.
**Effort:** 30 minutes

### C9. Audit Log is NOT Immutable
**What:** `audit_log` has RLS enabled but no UPDATE/DELETE deny policies. Authenticated users could potentially modify audit records.
**Where:** baseline.sql:11209, RLS policies section
**Why it matters:** Audit integrity is compromised. Users could cover tracks.
**How to fix:** Add explicit `USING (false)` policies for UPDATE and DELETE on `audit_log`.
**Effort:** 15 minutes (migration)

### C10. Impersonation Has No Write Restrictions
**What:** Global admins can make destructive changes (delete users, modify financials, purge data) while impersonating a facility. `verifyImpersonationSession()` exists but is never called.
**Where:** [lib/impersonation.ts](lib/impersonation.ts)
**Why it matters:** No guardrail against accidental destructive actions during admin browsing sessions.
**How to fix:** Wire `verifyImpersonationSession()` into API routes. Consider read-only mode or confirmation for destructive actions.
**Effort:** 2-4 hours

### C11. Delay Dual-Write Orphan Bug
**What:** Adding a delay writes to both `case_flags` and `case_delays`. Removing only deletes from `case_flags`. `case_delays` rows become orphaned.
**Where:** [app/cases/[id]/page.tsx:768-826](app/cases/[id]/page.tsx)
**Why it matters:** `case_delays` table accumulates orphan rows over time. Any analytics reading from `case_delays` shows deleted delays.
**How to fix:** Also delete from `case_delays` on removal, or stop dual-writing entirely.
**Effort:** 30 minutes

### C12. `case_implants.case_id` is Nullable
**What:** Foreign key allows NULL — implants without a case association are nonsensical.
**Where:** baseline.sql (case_implants table definition)
**Why it matters:** Data integrity gap — orphaned implant rows possible.
**How to fix:** Migration to add NOT NULL constraint after backfilling any NULL rows.
**Effort:** 30 minutes (migration)

### C13. `cases.start_time` Uses TIME WITHOUT TIME ZONE
**What:** All time-of-day fields (`start_time`, `scheduled_start_time`, `actual_start_time`) use `TIME WITHOUT TIME ZONE`, losing timezone context.
**Where:** baseline.sql (cases table, case_completion_stats table)
**Why it matters:** Timezone math requires manual composition with `scheduled_date`. Multi-timezone facilities will produce incorrect calculations.
**How to fix:** Migrate to `TIMESTAMPTZ` or document the intentional UTC convention with explicit timezone handling.
**Effort:** 2-4 hours (migration + app code updates)

### C14. No Unique Constraint on `case_flags(case_id, flag_rule_id)`
**What:** Running flag detection twice creates duplicate flags. Demo generator works around this by deleting all flags first.
**Where:** case_flags table, [lib/flagEngine.ts](lib/flagEngine.ts)
**Why it matters:** If flag detection is ever connected to production (C3), duplicates will accumulate.
**How to fix:** `CREATE UNIQUE INDEX ON case_flags(case_id, flag_rule_id) WHERE flag_rule_id IS NOT NULL`
**Effort:** 15 minutes (migration)

### C15. Facility Hard Delete Cascades to 30+ Tables
**What:** `DeleteFacilityModal` performs permanent hard delete with CASCADE — destroys all cases, milestones, analytics, financial data, users, rooms, templates.
**Where:** [components/modals/DeleteFacilityModal.tsx](components/modals/DeleteFacilityModal.tsx)
**Why it matters:** One click destroys all facility data permanently. No recovery possible.
**How to fix:** Add soft delete for facilities. Only allow hard delete for `is_demo = true` facilities.
**Effort:** 2-3 hours

### C16. Template Builder Delete-All-Then-Insert Race Condition
**What:** Both `useTemplateBuilder.ts` and `useAdminTemplateBuilder.ts` use DELETE-all-then-INSERT-all save pattern. Two admins editing simultaneously = data loss.
**Where:** [hooks/useTemplateBuilder.ts](hooks/useTemplateBuilder.ts) (899 lines), [hooks/useAdminTemplateBuilder.ts](hooks/useAdminTemplateBuilder.ts) (874 lines)
**Why it matters:** During initial facility setup (when multiple admins configure templates), simultaneous saves silently overwrite each other.
**How to fix:** Add optimistic locking (version field or `updated_at` check before write).
**Effort:** 2-4 hours

### C17. Zero API Route Validation
**What:** All `/api/` routes accept any payload if the user is authenticated. No Zod schemas, no input validation, no permission checks.
**Where:** All files in `app/api/`
**Why it matters:** Authenticated users can submit malformed or malicious data directly to API endpoints.
**How to fix:** Add Zod schemas to all API routes. Start with write endpoints.
**Effort:** 4-8 hours (incremental)

### C18. 4 Settings Pages Have NO Access Control
**What:** `settings/notifications`, `settings/closures`, `settings/subscription`, `settings/device-reps` have no permission checks at all.
**Where:** Listed page files
**Why it matters:** Any authenticated user can toggle facility notifications, create/delete closures, edit OR rate, invite device reps.
**How to fix:** Add `can('settings.manage')` guards to mutation functions (not just UI buttons).
**Effort:** 1-2 hours

### C19. Analytics Settings Has No Permission Check on Save
**What:** 37 configurable KPI thresholds (FCOTS, turnovers, utilization, etc.) — no validation, no permission check on `handleSave()`.
**Where:** [app/settings/analytics/page.tsx](app/settings/analytics/page.tsx)
**Why it matters:** Any authenticated user can edit analytics thresholds. `parseFloat() || default` silently coerces garbage input.
**How to fix:** Add permission guard on save handler. Replace `parseFloat()` coercion with Zod validation.
**Effort:** 1-2 hours

### C20. `or_hourly_rate` Allows Negative Values
**What:** No CHECK constraint on `facilities.or_hourly_rate`. Inline validation is `isNaN` only — negative rates accepted.
**Where:** facilities table, [app/settings/general/page.tsx](app/settings/general/page.tsx)
**Why it matters:** Negative OR rate corrupts all profit calculations for the facility.
**How to fix:** `ALTER TABLE facilities ADD CONSTRAINT or_hourly_rate_non_negative CHECK (or_hourly_rate >= 0)`
**Effort:** 15 minutes (migration)

### C21. Email Fields Have Zero Format Validation (3 Locations)
**What:** User invite, device rep signup, and facility admin invite — no email format validation at any layer.
**Where:** [app/settings/users/page.tsx](app/settings/users/page.tsx), [app/api/create-device-rep/route.ts](app/api/create-device-rep/route.ts), [app/admin/facilities/[id]/page.tsx](app/admin/facilities/[id]/page.tsx)
**Why it matters:** Invalid emails waste invite tokens and create broken user records.
**How to fix:** Add Zod email validation to invite schemas.
**Effort:** 30 minutes

### C22. CaseForm Shows Archived Surgeons/Rooms/Companies in Dropdowns
**What:** Case creation form bypasses DAL and queries directly — missing `is_active`/`deleted_at` filters on surgeon, room, and implant company dropdowns.
**Where:** [components/cases/CaseForm.tsx](components/cases/CaseForm.tsx) (dropdown queries)
**Why it matters:** Users can create cases assigned to archived surgeons, rooms, or companies.
**How to fix:** Add `is_active = true` / `.is('deleted_at', null)` filters to 3 dropdown queries.
**Effort:** 30 minutes

### C23. Surgeon Preferences Uses Hard Delete
**What:** `surgeon_preferences` are hard-deleted (`.delete()`) instead of soft delete.
**Where:** [app/settings/surgeon-preferences/page.tsx](app/settings/surgeon-preferences/page.tsx)
**Why it matters:** Preference history lost. Violates platform soft-delete convention.
**How to fix:** Convert to `is_active = false` pattern.
**Effort:** 30 minutes

---

## High Issues (Fix Within Next Sprint)

### H1. Analytics vs Stats Drift
**What:** Analytics pages calculate durations live from milestones. `case_completion_stats` is the denormalized source of truth. If milestones are edited after validation, the two diverge.
**Where:** Analytics overview, surgeons, financials pages
**Why it matters:** Dashboard shows different numbers than analytics pages for the same case.
**How to fix:** Either always read from `case_completion_stats` for historical data, or re-trigger `record_case_stats()` when milestones change on validated cases.
**Effort:** 2-4 hours

### H2. No Real-Time Sync for Flags/Staff
**What:** Case detail subscribes to `case_milestones` only. Flag additions and staff changes don't sync between devices.
**Where:** [lib/hooks/useMilestoneRealtime.ts](lib/hooks/useMilestoneRealtime.ts)
**Why it matters:** Two users on same case see inconsistent flag/staff data until page refresh.
**How to fix:** Add Supabase Realtime subscriptions for `case_flags` and `case_staff`.
**Effort:** 2-3 hours

### H3. Search Only Matches `case_number` (No Index)
**What:** Cases list search uses `ILIKE '%term%'` on `case_number` only — no index, full table scan, can't search by surgeon/procedure/room.
**Where:** [lib/dal/cases.ts:368-406](lib/dal/cases.ts)
**Why it matters:** Search degrades linearly with dataset size. Users can't find cases by surgeon name.
**How to fix:** Add GIN trigram index on `case_number`. Consider full-text search across multiple fields.
**Effort:** 1-2 hours

### H4. `seed_facility_flag_rules()` Missing 3 Columns
**What:** Does NOT copy `threshold_value_max`, `cost_category_id`, or `is_active` when seeding new facilities.
**Where:** baseline.sql:3651-3680
**Why it matters:** New facilities get incomplete flag rules.
**How to fix:** Update INSERT statement in the seed function.
**Effort:** 30 minutes (migration)

### H5. Flag Summary Aggregation Bug
**What:** `severityRank[flag.flag_type]` — should be `flag.severity`. `flag_type` is `'threshold'`/`'delay'`, not a severity level.
**Where:** [lib/dal/cases.ts:530-532](lib/dal/cases.ts)
**Why it matters:** Cases table flag indicators show wrong max severity color.
**How to fix:** Change `flag.flag_type` to `flag.severity`.
**Effort:** 5 minutes

### H6. No Scheduled Cron Refresh for Materialized Views
**What:** `pg_cron` is enabled but zero `cron.schedule()` calls exist. MVs are ONLY refreshed by per-case triggers.
**Where:** DB schema (no migration)
**Why it matters:** Edited cases after completion may not appear in analytics until the next case completes. No catch-up mechanism.
**How to fix:** Add nightly cron: `SELECT cron.schedule('nightly-stats-refresh', '0 3 * * *', 'SELECT refresh_all_stats()')`
**Effort:** 30 minutes (migration)

### H7. No Cron Job for Data Quality Detection
**What:** Edge function `run-data-quality-detection` exists but is never scheduled. Nightly detection doesn't happen.
**Where:** `supabase/functions/run-data-quality-detection/index.ts`
**Why it matters:** Stale cases go undetected. Old issues never expire.
**How to fix:** Schedule via pg_cron or external scheduler.
**Effort:** 30 minutes

### H8. Duplicated `orbitScoreEngine.ts` (No Sync)
**What:** Scoring engine exists in 2 locations: `lib/orbitScoreEngine.ts` (web app) and `supabase/functions/compute-surgeon-scorecard/orbitScoreEngine.ts` (edge function). No automated sync.
**Where:** Both files (1,379 lines each)
**Why it matters:** If scoring logic diverges, web app and iOS app compute different scores.
**How to fix:** Add CI check that diffs the two files. Or add pre-deploy copy script.
**Effort:** 1 hour

### H9. Trigger Ordering Dependency on Cases Table
**What:** 5 AFTER triggers on `cases` all read/write `case_completion_stats`. PostgreSQL fires them alphabetically — `on_case_completed` fires BEFORE `trg_record_stats_on_validation`.
**Where:** cases table triggers (8 total)
**Why it matters:** If status change AND validation happen in same UPDATE, triggers read stale stats. Mitigated by separate operations in practice.
**How to fix:** Rename triggers with ordering prefix (`t01_`, `t02_`) or consolidate into single dispatcher.
**Effort:** 1-2 hours (migration)

### H10. 5 Pages Use Hard Delete Instead of Soft Delete
**What:** admin/procedures, admin/delay-types, admin/complexities, surgeon-preferences, closures all use `.delete()`.
**Where:** Listed page files
**Why it matters:** Data loss, violates platform soft-delete convention, no recovery.
**How to fix:** Convert to `is_active = false` pattern with soft-delete trigger.
**Effort:** 2-3 hours

### H11. Session Manager Code is Dead
**What:** `recordSession()`, `updateSessionActivity()`, `cleanupExpiredSessions()`, custom session duration logic — extensive code that is never called.
**Where:** [lib/session-manager.ts](lib/session-manager.ts)
**Why it matters:** `user_sessions` table exists but is never populated. Dead code creates confusion.
**How to fix:** Either integrate into login flow OR remove dead code.
**Effort:** 1-2 hours (cleanup) or 4-6 hours (integration)

### H12. CompletedCaseView Uses Average, Not Median
**What:** Compares actual vs `surgeon_procedure_averages.avg_total_minutes` but platform standard is median.
**Where:** [components/cases/CompletedCaseView.tsx](components/cases/CompletedCaseView.tsx)
**Why it matters:** Inconsistent with analytics pages. Users see different comparisons depending on context.
**How to fix:** Switch to `surgeon_procedure_stats.median_duration`.
**Effort:** 30 minutes

### H13. No Force-Expire Mechanism for Compromised Accounts
**What:** No function to revoke all sessions for a specific user.
**Where:** DB schema
**Why it matters:** If an account is compromised, there's no emergency kill switch.
**How to fix:** Create `force_expire_user_sessions(user_id UUID)` function.
**Effort:** 30 minutes (migration)

### H14. Closures Page Uses Hard Delete + No Duplicate Prevention
**What:** `facility_closures` hard deleted. No unique constraint on `(facility_id, closure_date)`. No conflict detection with scheduled cases.
**Where:** [app/settings/closures/page.tsx](app/settings/closures/page.tsx)
**Why it matters:** Closure history lost. Duplicate dates possible. Cases scheduled on closure dates not warned.
**How to fix:** Add soft delete + unique constraint + case conflict detection.
**Effort:** 1-2 hours

### H15. Dropdowns Show Archived Records (4+ Pages)
**What:** settings/complexities shows archived procedure_categories. settings/device-reps and settings/surgeon-preferences show deleted implant_companies. DAL `implantCompanies()` missing `deleted_at` filter.
**Where:** Multiple settings pages
**Why it matters:** Users select archived entities in creation forms.
**How to fix:** Add `is_active`/`deleted_at` filters. Fix DAL function.
**Effort:** 1 hour

### H16. Admin Analytics Template — No Audit Logging
**What:** Changes to analytics defaults for all new facilities are untracked.
**Where:** [app/admin/settings/analytics/page.tsx](app/admin/settings/analytics/page.tsx)
**Why it matters:** No visibility into who changed scoring thresholds.
**How to fix:** Add `genericAuditLog` calls.
**Effort:** 30 minutes

### H17. Admin Page Registry — No Audit Logging
**What:** Page registry changes are untracked. Scanner auto-populates roles as all 3 levels when uncertain.
**Where:** [app/admin/docs/page.tsx](app/admin/docs/page.tsx) (3,195 lines)
**Why it matters:** Over-granted roles, no change history.
**How to fix:** Add audit logging + fix auto-role logic.
**Effort:** 1 hour

### H18. No Per-Case Error Handling in Edge Function
**What:** Data quality edge function has no per-case try/catch. One malformed case crashes entire facility processing.
**Where:** `supabase/functions/run-data-quality-detection/index.ts`
**Why it matters:** One bad case blocks quality detection for all other cases in the facility.
**How to fix:** Add per-case try/catch.
**Effort:** 30 minutes

### H19. `record_case_stats()` Requires Both Milestones
**What:** Function returns early with NO stats row if `patient_in` OR `patient_out` milestone is missing.
**Where:** Migration 20260222200006 (line 379)
**Why it matters:** Cases with only partial milestones have no completion stats. Analytics silently excludes them.
**How to fix:** Document as intentional or add partial stats creation.
**Effort:** Decision + documentation

### H20. Admin Procedures Page Uses Hard Delete
**What:** `procedure_type_templates` hard deleted instead of soft delete.
**Where:** [app/admin/settings/procedures/page.tsx](app/admin/settings/procedures/page.tsx)
**Why it matters:** Template data loss. Facilities that reference the template lose data.
**How to fix:** Convert to soft delete pattern.
**Effort:** 30 minutes

### H21. `case_completion_stats` TIME WITHOUT TIMEZONE Columns
**What:** `scheduled_start_time` and `actual_start_time` use `TIME WITHOUT TIME ZONE`, inheriting timezone issue from `cases.start_time`.
**Where:** case_completion_stats table
**Why it matters:** Same timezone issue as C13, propagated to analytics.
**How to fix:** Fix with C13.
**Effort:** Included in C13

### H22. RLS Policy on `login_attempts` Missing
**What:** No RLS policies on `login_attempts` table.
**Where:** DB schema
**Why it matters:** Information disclosure — login attempt data may be accessible.
**How to fix:** Add RLS policies restricting to admin-only.
**Effort:** 15 minutes (migration)

### H23. No Validation on `closing_handoff_minutes`
**What:** Surgeon preferences page allows -999 or 99999 for handoff minutes.
**Where:** [app/settings/surgeon-preferences/page.tsx](app/settings/surgeon-preferences/page.tsx)
**Why it matters:** Corrupts auto-record `surgeon_left_at` calculation.
**How to fix:** Add CHECK constraint: `BETWEEN 0 AND 120`.
**Effort:** 15 minutes

### H24. Surgeon Procedure Stats — No Data Quality Edge Function Auth
**What:** `run-data-quality-detection` edge function accepts requests from anyone with the function URL. No JWT validation.
**Where:** `supabase/functions/run-data-quality-detection/index.ts`
**Why it matters:** Anyone can trigger unnecessary database load.
**How to fix:** Add bearer token validation.
**Effort:** 30 minutes

### H25. Per-Case MV Refresh is Expensive
**What:** Every case completion triggers `refresh_all_stats()` — refreshes 5 materialized views. 50 completions/day = 250 MV refreshes.
**Where:** `trg_refresh_stats_on_completion` trigger
**Why it matters:** Performance degradation as case volume grows.
**How to fix:** Debounce: replace per-case trigger with periodic cron refresh (every 5 min).
**Effort:** 2-3 hours

### H26. No MV Refresh Failure Monitoring
**What:** If `refresh_all_stats()` fails (deadlock, timeout), error is silently swallowed in EXCEPTION block.
**Where:** refresh_all_stats() function
**Why it matters:** Views become stale with no alert mechanism.
**How to fix:** Add error logging to the refresh function's EXCEPTION block.
**Effort:** 30 minutes (migration)

### H27. Auto-Save Settings Pages Have No Conflict Detection
**What:** Flag rules (500ms debounce), notifications (immediate), permission templates (immediate) — no optimistic locking, no `updated_at` check.
**Where:** Multiple settings pages
**Why it matters:** Two admins editing same rule = last write wins silently.
**How to fix:** Implement `updated_at` checks in DAL write functions.
**Effort:** 2-3 hours

### H28. `financial_targets.month` Has No CHECK Constraint
**What:** Month field accepts any integer — month 13, month 0, negative values.
**Where:** financial_targets table
**Why it matters:** Invalid financial target records.
**How to fix:** `ALTER TABLE financial_targets ADD CONSTRAINT month_range CHECK (month BETWEEN 1 AND 12)`
**Effort:** 15 minutes (migration)

### H29. `milestone_template_items.display_order` Has No UNIQUE Constraint
**What:** Multiple items can have the same display_order within a template. Phase boundary resolution uses MIN/MAX of display_order — duplicates create non-deterministic boundaries.
**Where:** milestone_template_items table
**Why it matters:** Non-deterministic phase boundaries in analytics.
**How to fix:** `CREATE UNIQUE INDEX ON milestone_template_items(template_id, display_order)`
**Effort:** 15 minutes (migration)

### H30. Hardcoded Milestone Name in Stale Detection
**What:** Code uses `.eq('name', 'patient_in')` — fragile if facility renames milestone.
**Where:** [lib/dataQuality.ts:621](lib/dataQuality.ts)
**Why it matters:** Stale detection breaks for any facility that customizes milestone names.
**How to fix:** Use `source_milestone_type_id` lookup instead.
**Effort:** 30 minutes

### H31. 8 Settings Pages Have No Audit Logging
**What:** analytics, complexities, closures, notifications, surgeon-preferences, admin analytics template, admin complexities, admin checklist-templates, admin permission-templates — all untracked.
**Where:** Listed page files
**Why it matters:** No visibility into configuration changes. Compliance gap.
**How to fix:** Add `genericAuditLog` calls to save handlers.
**Effort:** 2-3 hours

---

## Medium Issues (Planned Refactoring)

| # | Issue | Location | Fix | Effort |
|---|-------|----------|-----|--------|
| M1 | Bulk case creation has no batch RPC (20 individual calls) | bulk-create/page.tsx | Create batch RPC | 2-4 hrs |
| M2 | `case_milestones.facility_milestone_id` nullable (should be NOT NULL) | DB schema | Migration + backfill | 30 min |
| M3 | Financial columns use unbounded NUMERIC (no precision) | case_completion_stats | Migrate to NUMERIC(10,2) | 1 hr |
| M4 | `case_delays.duration_minutes` nullable | DB schema | Add NOT NULL DEFAULT 0 | 15 min |
| M5 | Offset-based pagination on cases list degrades at scale | cases list | Switch to cursor-based | 2-4 hrs |
| M6 | Cancellation metadata parallel to status system | cases table | Document as intentional | 15 min |
| M7 | Optimistic UI collision (milestone recording) | case detail | Improve merge logic | 1 hr |
| M8 | `surgeon_left_at` uses stale cached preference | case detail | Re-fetch on recording | 30 min |
| M9 | 574 lines of duplicated stale detection code | 3 files | Delete unused file, extract shared module | 1-2 hrs |
| M10 | No server-side validation for flag rule thresholds | flag_rules table | Add CHECK constraints | 30 min |
| M11 | Flag rule `source_rule_id` FK has no ON DELETE behavior | flag_rules | Add ON DELETE SET NULL | 15 min |
| M12 | Triple template resolution in `useMilestoneComparison` | useMilestoneComparison.ts | Resolve once, pass to all 3 queries | 1 hr |
| M13 | Inconsistent confidence threshold (interval vs phase medians) | Analytics RPCs | Apply n >= 5 to both | 30 min |
| M14 | Legacy `calculateTimeAllocation()` hardcoded fallback | milestoneAnalytics.ts | Enforce template requirement | 30 min |
| M15 | Missing `is_active` filter in some DQ queries | dataQuality.ts:137 | Add filter | 15 min |
| M16 | 3 legacy ghost columns in case_completion_stats | DB schema | Drop `soft_goods_cost`, `hard_goods_cost`, `or_cost` | 30 min |
| M17 | No manual recalculation function for financial stats | DB | Create `recalculate_case_stats(case_id)` | 1-2 hrs |
| M18 | No pricing audit trail (who changed what, when) | DB | Create `pricing_history` table | 2-4 hrs |
| M19 | Procedure pricing uses delete-then-insert despite effective dating columns | procedure-pricing page | Switch to effective dating | 1-2 hrs |
| M20 | Cost category cascade assumes template ID = facility category ID | admin cost-categories | Fix ID mapping | 1 hr |
| M21 | No middleware-level `/admin/*` route protection | middleware.ts | Add role check for admin routes | 1 hr |
| M22 | No validation that facility wizard selects at least 1 template | facility wizard | Add check | 15 min |
| M23 | Facility creation RPC failure may orphan facility record | facility wizard | Add rollback mechanism | 1-2 hrs |
| M24 | Admin invite failure during facility creation silently swallowed | facility wizard | Make failure throw | 30 min |
| M25 | Demo generator purge has no confirmation dialog | admin/demo page | Add ConfirmDialog | 30 min |
| M26 | Demo generator has no max case limit | admin/demo page | Add configurable limit | 30 min |
| M27 | Subscription status change has no confirmation dialog | admin/facilities | Add ConfirmDialog | 30 min |
| M28 | `window.confirm` used instead of ConfirmDialog (admin checklist templates) | admin checklist page | Replace with component | 15 min |
| M29 | Native `alert()` used for 8+ messages in facility detail | admin/facilities/[id] | Replace with toast system | 1 hr |
| M30 | Self-demotion prevented by UI only — no DB constraint | users page | Add RPC with validation | 1 hr |
| M31 | Facility admins can promote to `facility_admin` with no confirmation | users page | Add confirmation dialog | 30 min |
| M32 | Deactivated surgeons not filtered in some analytics queries | analytics RPCs | Add `is_active = true` filter | 1 hr |
| M33 | No periodic user revalidation in UserContext | UserContext.tsx | Check `is_active` every 5 min | 1 hr |
| M34 | Impersonation state relies solely on localStorage | impersonation.ts | Add server-side verification | 2 hrs |
| M35 | Abandoned impersonation sessions remain active forever | admin_sessions | Add auto-expire after 4 hrs | 1 hr |
| M36 | No session revocation on password change | auth | Add signOut call | 1 hr |
| M37 | Severity naming inconsistency (`critical` vs `error`) | case_flags vs issue_types | Unify to `critical` | 30 min |
| M38 | Missing composite index on `metric_issues` for unresolved facility queries | DB schema | Add partial index | 15 min |
| M39 | No Zod validation on most settings pages (only 1 of 40+ uses Zod) | Multiple pages | Add schemas incrementally | 4-8 hrs |
| M40 | Soft-delete column pattern inconsistency (`is_active` vs `deleted_at` vs both) | Multiple tables | Standardize pattern | 4-8 hrs |
| M41 | 40% of pages bypass DAL with direct queries | Multiple pages | Create shared dropdown hook | 2-4 hrs |
| M42 | Holiday month/day have no DB constraints | facility_holidays | Add CHECK constraints | 15 min |
| M43 | `facility_closures` allows duplicate dates | DB schema | Add UNIQUE constraint | 15 min |
| M44 | Flag rule threshold_value_max can be < threshold_value | DB schema | Add CHECK constraint | 15 min |
| M45 | Flag rule percentile > 100 allowed | DB schema | Add conditional CHECK | 15 min |
| M46 | `display_order` allows negative values on multiple tables | Multiple tables | Add CHECK >= 0 | 15 min |
| M47 | Milestone archive CASCADE-deletes template items | DB FK | Change to ON DELETE SET NULL | 30 min |
| M48 | Remote commit migration (1667 lines) creates RLS gap during drop/recreate | Migration process | Split into smaller migrations for future | Process |

---

## Low Issues (Nice-to-Have / Tech Debt)

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| L1 | 14 parallel queries on case detail load | case detail page | Consolidate into fewer queries or RPC |
| L2 | `case_statuses.display_order` nullable | DB schema | Add default |
| L3 | Implant sizes stored as TEXT (prevents numeric comparison) | case_implants | Consider structured types |
| L4 | `anesthesiologist_id` in baseline DDL but dropped | baseline.sql | Cleanup dead DDL |
| L5 | `case_completion_stats` potential dead columns (4) | DB schema | Verify usage, drop unused |
| L6 | Duration display inconsistency (completed vs in-progress) | cases list | Smooth transition |
| L7 | No room conflict detection in bulk create mode | bulk-create page | Add validation |
| L8 | No real-time subscription reconnection logic | useMilestoneRealtime.ts | Add exponential backoff |
| L9 | No audit trail for milestone corrections | case_milestones | Consider `milestone_audit_log` |
| L10 | Duplicate stale detection file (unused) | lib/stale-case-detection.ts | Delete file |
| L11 | No flag acknowledgment/dismissal feature | case_flags | Add `is_dismissed` column |
| L12 | No analytics CSV export on flag dashboard | flags analytics | Add export |
| L13 | No rule versioning / flag snapshot | flag_rules | Add version tracking |
| L14 | Orbit score engine has zero tests | orbitScoreEngine.ts | Add unit tests |
| L15 | Procedure pricing versioning inconsistency | procedure_cost_items | Align with surgeon variance page |
| L16 | Missing CHECK constraint on effective dates | procedure_cost_items | Add `effective_to >= effective_from` |
| L17 | Materialized views use `double precision` for aggregates | MVs | Acceptable for stats |
| L18 | No exclusion constraint for overlapping effective date ranges | pricing tables | Add exclusion |
| L19 | Template tables readable by all authenticated users | RLS | Intentional but document |
| L20 | Demo trigger disable/enable risk if enable fails | demo triggers | Add safety mechanism |
| L21 | No drag-and-drop where UI hints exist (checklist, cancellation reasons) | Settings pages | Implement |
| L22 | Admin docs page is 3,195 lines — monolithic | admin/docs | Decompose |
| L23 | Admin facility detail is 1,656 lines | admin/facilities/[id] | Decompose |
| L24 | Closures page is 902 lines | settings/closures | Decompose |
| L25 | Milestones settings page is 847 lines | settings/milestones | Decompose |
| L26 | Audit log CSV export capped at 10,000 rows | admin/audit-log | Increase or add streaming |
| L27 | HIPAA 6-year retention mentioned but not enforced | admin/audit-log | Add retention policy |
| L28 | No pagination on audit log (limit 50) | admin/facilities/[id] | Add pagination |
| L29 | Redundant migration pair (search_path fix) | Migrations | Squash in future |
| L30 | Category dropdown hardcoded (4 values) in cancellation reasons | admin/cancellation-reasons | Move to DB |
| L31 | `window.confirm` used in checklist templates admin | admin/checklist-templates | Replace with ConfirmDialog |
| L32 | No uniqueness check before insert on payer/implant company templates | admin pages | Add ON CONFLICT check |
| L33 | `generateName()` could produce collisions on body regions/delay types | admin pages | Add retry logic |
| L34 | No invite token rotation on resend | invite flow | Generate new token |
| L35 | Check-in page depends on auto-create trigger (silent failure risk) | checkin page | Add fallback |

---

## Architecture Recommendations

### 1. DAL Expansion Plan

Currently ~60% of pages use the DAL, ~40% bypass it with direct Supabase queries. Pages that bypass often omit filters.

**Recommended expansion order:**
1. **`lib/dal/dropdowns.ts`** — Centralized dropdown data fetcher with auto-filtering for `is_active`/`deleted_at`. This fixes 12+ dropdown bugs in one module.
2. **`lib/dal/settings.ts`** — All settings write operations with permission checks, validation, and audit logging baked in.
3. **`lib/dal/admin.ts`** — Admin template CRUD with template→facility propagation patterns.
4. **`lib/dal/invites.ts`** — Invitation lifecycle (create, resend, accept, expire) with proper table references.
5. **`lib/dal/analytics-queries.ts`** — RPC wrappers with parameter validation and error handling.

### 2. Validation Schema Completion

**Current state:** 5 Zod schemas exist in `lib/validation/schemas.ts` (case creation only).

**Recommended additions (priority order):**
1. **`inviteSchema`** — Email format, role_id UUID, access_level enum. Fixes C21.
2. **`analyticsSettingsSchema`** — All 37 threshold fields with min/max/type validation. Fixes C19.
3. **`flagRuleSchema`** — Threshold type/value validation, percentile range, max >= min. Fixes M10, M44, M45.
4. **`financialConfigSchema`** — OR rate non-negative, reimbursement positive, cost non-negative. Fixes C20.
5. **`facilitySettingsSchema`** — General settings, closures, holidays. Fixes M42, M43.
6. **`userManagementSchema`** — User edit, access_level validation, email format.
7. **`apiRouteSchemas/`** — One schema per API route. Fixes C17.

### 3. Mega-File Decomposition

| File | Lines | Recommended Split |
|------|-------|-------------------|
| `admin/docs/page.tsx` | 3,195 | PageRegistryTable, PageScanner, CategoryManager, PageDetailDrawer |
| `admin/facilities/[id]/page.tsx` | 1,656 | FacilityOverview, FacilityUsers, FacilityRooms, FacilityProcedures, FacilitySubscription, FacilityAudit |
| `components/cases/CaseForm.tsx` | 1,114 | CaseFormFields, CaseFormValidation, CaseFormStaff, CaseFormImplants, useCase FormState |
| `settings/closures/page.tsx` | 902 | HolidayManager, ClosureManager, ClosureCalendar |
| `settings/milestones/page.tsx` | 847 | MilestoneTab, PhaseTab, TemplateTab, ProcedureTab, SurgeonTab (already partially decomposed) |
| `lib/flagEngine.ts` | 794 | MetricExtractor, BaselineCalculator, ThresholdResolver, FlagEvaluator |

### 4. Type Consolidation

| Duplicate Area | Files | Recommendation |
|---------------|-------|----------------|
| `cost_source` enum values | `financialAnalytics.ts` (references `actual`, `projected`, `none`) vs trigger (sets `procedure_default`, `surgeon_override`) | Align to trigger values, remove unused enum members |
| Flag severity | `case_flags` (`critical`) vs `issue_types` (`error`) | Unify to `critical` everywhere |
| Soft delete patterns | `is_active` boolean vs `deleted_at` timestamp vs both | Pick ONE pattern — recommend `is_active` + `deleted_at` for all |
| Permission keys | Plain strings in `usePermissions.ts` | Generate TypeScript const enum from DB `permissions` table |
| MilestoneWithDetails | 3+ variations across hooks | Create single canonical type in `types/milestones.ts` |

### 5. Error Boundary Coverage Plan

**Current state:** No `ErrorBoundary` components found in the codebase.

**Recommended rollout:**
1. **Root layout** — Catch unhandled errors with friendly fallback + error reporting
2. **Page-level** — Each major page (cases, analytics, settings) wraps content in error boundary
3. **Widget-level** — Individual dashboard widgets, charts, and complex forms
4. **API routes** — Consistent error response format with error codes

---

## Database Recommendations

### 1. Missing Constraints to Add (Single Migration)

```sql
-- P0: Financial integrity
ALTER TABLE facilities ADD CONSTRAINT chk_or_hourly_rate_non_negative
  CHECK (or_hourly_rate >= 0);

-- P0: Flag uniqueness
CREATE UNIQUE INDEX idx_case_flags_unique_rule
  ON case_flags(case_id, flag_rule_id) WHERE flag_rule_id IS NOT NULL;

-- P0: Implant integrity
ALTER TABLE case_implants ALTER COLUMN case_id SET NOT NULL;

-- P1: Bounded fields
ALTER TABLE financial_targets ADD CONSTRAINT chk_month_range
  CHECK (month BETWEEN 1 AND 12);
ALTER TABLE facility_holidays ADD CONSTRAINT chk_holiday_month_range
  CHECK (month BETWEEN 1 AND 12);
ALTER TABLE facility_holidays ADD CONSTRAINT chk_holiday_day_range
  CHECK (day BETWEEN 1 AND 31);
ALTER TABLE flag_rules ADD CONSTRAINT chk_threshold_max_gte_min
  CHECK (threshold_value_max IS NULL OR threshold_value_max >= threshold_value);
ALTER TABLE flag_rules ADD CONSTRAINT chk_percentile_range
  CHECK (threshold_type != 'percentile' OR (threshold_value >= 0 AND threshold_value <= 100));
ALTER TABLE users ADD CONSTRAINT chk_handoff_minutes_range
  CHECK (closing_handoff_minutes IS NULL OR closing_handoff_minutes BETWEEN 0 AND 120);

-- P1: Template item ordering
CREATE UNIQUE INDEX idx_template_items_order
  ON milestone_template_items(template_id, display_order);

-- P1: Closure uniqueness
CREATE UNIQUE INDEX idx_facility_closures_unique_date
  ON facility_closures(facility_id, closure_date);

-- P1: Financial amounts non-negative
ALTER TABLE procedure_reimbursements ADD CONSTRAINT chk_reimbursement_positive
  CHECK (reimbursement >= 0);
ALTER TABLE procedure_cost_items ADD CONSTRAINT chk_amount_non_negative
  CHECK (amount >= 0);
ALTER TABLE surgeon_cost_items ADD CONSTRAINT chk_surgeon_amount_non_negative
  CHECK (amount >= 0);

-- P2: Text length limits
ALTER TABLE cases ADD CONSTRAINT chk_notes_max_length
  CHECK (notes IS NULL OR length(notes) <= 2000);

-- P2: Audit log immutability
CREATE POLICY audit_log_no_update ON audit_log FOR UPDATE USING (false);
CREATE POLICY audit_log_no_delete ON audit_log FOR DELETE USING (false);
```

### 2. Indexes to Add

```sql
-- Missing for data quality queries
CREATE INDEX idx_metric_issues_facility_unresolved
  ON metric_issues (facility_id) WHERE resolved_at IS NULL;

-- Missing for stale detection
CREATE INDEX idx_case_milestones_facility_milestone
  ON case_milestones(facility_milestone_id);

-- Missing for draft case queries
CREATE INDEX idx_cases_draft ON cases (facility_id) WHERE is_draft = true;

-- Missing for search (requires pg_trgm extension)
CREATE INDEX idx_cases_case_number_trgm
  ON cases USING gin (case_number gin_trgm_ops);
```

### 3. Indexes to Review for Removal
- Verify scan stats on the 109 FK indexes added in migration `20260222200004` after 30+ days of production data
- The aggressive cleanup in `20260222200002` and `20260222200003` may have dropped useful indexes prematurely

### 4. RLS Policy Adjustments

1. **Add `user_has_permission()` to RLS on sensitive tables:** `case_completion_stats` (financial), `facility_analytics_settings`, `procedure_reimbursements`, `procedure_cost_items`
2. **Add deny policies on `audit_log`** for UPDATE and DELETE
3. **Add RLS to `login_attempts`** table (currently no policies)
4. **Fix device rep RLS** — reference `device_rep_facility_access` consistently (or consolidate tables)
5. **Add auth check to `run-data-quality-detection`** edge function

### 5. FK Changes

```sql
-- Milestone archive should NOT cascade-delete template items
ALTER TABLE milestone_template_items
  DROP CONSTRAINT milestone_template_items_facility_milestone_id_fkey,
  ADD CONSTRAINT milestone_template_items_facility_milestone_id_fkey
    FOREIGN KEY (facility_milestone_id) REFERENCES facility_milestones(id)
    ON DELETE SET NULL;

-- Flag rules source tracking
ALTER TABLE flag_rules
  DROP CONSTRAINT IF EXISTS flag_rules_source_rule_id_fkey,
  ADD CONSTRAINT flag_rules_source_rule_id_fkey
    FOREIGN KEY (source_rule_id) REFERENCES flag_rules(id)
    ON DELETE SET NULL;
```

### 6. Cron Jobs to Schedule

```sql
-- Nightly MV refresh
SELECT cron.schedule('nightly-stats-refresh', '0 3 * * *',
  'SELECT refresh_all_stats()');

-- Nightly data quality detection (via edge function)
SELECT cron.schedule('nightly-data-quality', '0 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/run-data-quality-detection',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  )$$);

-- Nightly health score refresh
SELECT cron.schedule('nightly-health-scores', '0 4 * * *',
  'SELECT refresh_facility_health_scores()');

-- Weekly cleanup
SELECT cron.schedule('weekly-session-cleanup', '0 5 * * 0',
  'SELECT cleanup_expired_sessions(); SELECT cleanup_old_login_attempts();');
```

### 7. Migration Cleanup Opportunities
- Squash redundant migration pair (`20260222100001` + `20260222100002`)
- Squash bug+fix pairs (`20260215000003`+`20260216000000`, `20260215000004`+`20260216000001`)
- Consider rolling baseline update to absorb first ~30 migrations
- Establish rollback script convention for future destructive migrations
- Split future data+schema migrations into separate files

---

## Implementation Order

Fixes are grouped into phases that can each be completed in one Claude Code session. Dependencies flow downward — each phase can be done independently within its tier but tiers should be done in order.

### Phase 1: Security Emergency (1 session)
**Fixes:** C5, C9, C18, C19, C20, C21, H22
1. Add `isGlobalAdmin` check to global-security page
2. Add audit_log UPDATE/DELETE deny policies (migration)
3. Add `can('settings.manage')` guards to 4 unprotected settings pages
4. Add permission check to analytics settings save handler
5. Add `CHECK (or_hourly_rate >= 0)` constraint (migration)
6. Add email format validation to 3 invite forms
7. Add RLS policies to `login_attempts` table

### Phase 2: Auth & Session Fixes (1 session)
**Fixes:** C1, C2, C6, C8, C10, H13
1. Fix invite API table references (`invites` → `user_invites`)
2. Fix resend invite API table reference
3. Consolidate device rep tables + fix API + fix RLS
4. Switch rate limiter to DB-based (`checkRateLimitDB`)
5. Fix IP tracking (real client IP, not hardcoded string)
6. Add `supabase.auth.admin.signOut(userId)` to user deactivation
7. Wire `verifyImpersonationSession()` into write API routes
8. Create `force_expire_user_sessions()` function

### Phase 3: DB Constraints & Integrity (1 session)
**Fixes:** C11, C12, C14, H4, H28, H29, M2, M38, M42, M43, M44, M45, M46, H23
1. Fix delay dual-write (delete from case_delays on removal)
2. Add NOT NULL to `case_implants.case_id`
3. Add UNIQUE on `case_flags(case_id, flag_rule_id)`
4. Update `seed_facility_flag_rules()` with missing columns
5. Add all CHECK constraints (month, holidays, threshold, handoff, display_order)
6. Add UNIQUE on `milestone_template_items(template_id, display_order)`
7. Add UNIQUE on `facility_closures(facility_id, closure_date)`
8. Add NOT NULL to `case_milestones.facility_milestone_id`
9. Add missing indexes (metric_issues, case_milestones, cases draft)
10. Add non-negative CHECK on financial amounts

### Phase 4: Flag & Data Quality Activation (1-2 sessions)
**Fixes:** C3, C4, H5, H7, H18, H30, M9, M15
1. INSERT missing `issue_types` rows for stale detection
2. Fix flag summary aggregation bug (`flag_type` → `severity`)
3. Fix hardcoded milestone name in stale detection
4. Add per-case try/catch in edge function
5. Add `is_active` filter to DQ queries
6. Delete unused `lib/stale-case-detection.ts`
7. Schedule nightly data quality cron job
8. Integrate flag detection into case validation workflow (biggest item)

### Phase 5: Cron Jobs & MV Management (1 session)
**Fixes:** H6, H7, H25, H26
1. Schedule nightly MV refresh via pg_cron
2. Schedule nightly data quality detection
3. Schedule nightly health score refresh
4. Schedule weekly session/login cleanup
5. Add MV refresh error logging
6. Consider debouncing per-case MV refresh

### Phase 6: Permission System Integration (1-2 sessions)
**Fixes:** C7, M21
1. Add `user_has_permission()` to RLS policies on financial tables
2. Add `user_has_permission()` to RLS policies on analytics settings
3. Add middleware-level `/admin/*` route protection
4. Add server-side permission checks to API routes (demo data, admin operations)

### Phase 7: Hard Delete → Soft Delete Conversion (1 session)
**Fixes:** C15, C23, H10, H14, M47
1. Add soft delete for facilities (block hard delete in production)
2. Convert surgeon_preferences to soft delete
3. Convert admin/procedures, admin/delay-types, admin/complexities to soft delete
4. Convert closures to soft delete + add duplicate prevention
5. Change milestone template_items FK from CASCADE to SET NULL

### Phase 8: Dropdown & Lookup Fixes (1 session)
**Fixes:** C22, H12, H15, M41
1. Add `is_active`/`deleted_at` filters to CaseForm dropdown queries
2. Fix DAL `implantCompanies()` missing `deleted_at` filter
3. Fix settings/complexities showing archived procedure_categories
4. Fix settings/device-reps and surgeon-preferences showing deleted companies
5. Switch CompletedCaseView from average to median

### Phase 9: Validation Layer (1-2 sessions)
**Fixes:** C17, C19, M39
1. Create `inviteSchema` (Zod)
2. Create `analyticsSettingsSchema` (Zod)
3. Create `flagRuleSchema` (Zod)
4. Create `financialConfigSchema` (Zod)
5. Add Zod validation to all `/api/` routes
6. Replace `parseFloat() || default` with explicit validation + error feedback

### Phase 10: Audit Logging Gap Fill (1 session)
**Fixes:** H16, H17, H31
1. Add audit logging to analytics settings page
2. Add audit logging to complexities page
3. Add audit logging to closures page
4. Add audit logging to notifications page
5. Add audit logging to surgeon-preferences page
6. Add audit logging to admin analytics template
7. Add audit logging to admin complexities
8. Add audit logging to admin checklist-templates
9. Add audit logging to admin permission-templates

### Phase 11: Template Builder Safety (1 session)
**Fixes:** C16, H27
1. Add optimistic locking to `useTemplateBuilder.ts` (version field or `updated_at` check)
2. Add optimistic locking to `useAdminTemplateBuilder.ts`
3. Add `updated_at` conflict detection to auto-save settings pages
4. Add real-time subscription for template editing (presence indicator)

### Phase 12: Analytics Consistency (1 session)
**Fixes:** H1, H2, H9, M12, M13, M14
1. Fix analytics vs stats drift (re-trigger stats when milestones change on validated cases)
2. Add real-time subscriptions for `case_flags` and `case_staff`
3. Rename case triggers with ordering prefix
4. Deduplicate triple template resolution in `useMilestoneComparison`
5. Unify confidence threshold (n >= 5 for both interval and phase medians)

### Phase 13: Dead Code Cleanup (1 session)
**Fixes:** H8, H11, L10
1. Delete unused `lib/stale-case-detection.ts`
2. Integrate session-manager.ts into login flow OR remove dead code
3. Add CI check for `orbitScoreEngine.ts` sync between web app and edge function
4. Remove or integrate `PermissionGuard` component
5. Remove dead `signInWithSession()` custom duration logic

### Phase 14: Code Quality & Decomposition (2-3 sessions)
**Fixes:** L22, L23, L24, L25, M16
1. Decompose `admin/docs/page.tsx` (3,195 lines)
2. Decompose `admin/facilities/[id]/page.tsx` (1,656 lines)
3. Decompose `settings/closures/page.tsx` (902 lines)
4. Drop legacy ghost columns from `case_completion_stats`
5. Add orbit score engine tests
6. Standardize soft-delete pattern across all tables

### Phase 15: Future Improvements (as needed)
**Fixes:** L-tier items, M-tier nice-to-haves
- Bulk case creation batch RPC
- Cursor-based pagination
- Full-text search across multiple fields
- MFA/TOTP support
- Password history prevention
- Real-time subscription reconnection logic
- Milestone audit trail
- Flag acknowledgment/dismissal feature
- Error boundary coverage
- HIPAA retention policy enforcement

---

## Source Audit Documents

| File | Domain | Issues Found |
|------|--------|-------------|
| `domain-1-cases.md` | Case lifecycle | 3 critical, 4 high, 8 medium, 6 low |
| `domain-2-milestones.md` | Milestones & phases | 3 critical, 4 high, 6 medium |
| `domain-3-financials.md` | Financial pipeline | 0 critical, 0 high, 3 medium, 4 low |
| `domain-4-flags-quality.md` | Flags & data quality | 3 critical, 2 high, 4 medium, 6 low |
| `domain-5-users-auth.md` | Users, permissions, auth | 8 critical, 9 high, 7 medium, 6 low |
| `domain-6-settings.md` | Settings & configuration | 8 critical, 11 high, 25 medium, 20+ low |
| `cross-cutting-data-entry.md` | Form ↔ schema alignment | 16 critical, 20 high, 30 medium, 7 low |
| `cross-cutting-db-schema.md` | DB architecture | 0 critical, 6 high, 8 medium, 7 low |
| `data-flow-test-results.md` | E2E data flow verification | Test script ready (not yet executed) |

*Note: Many issues appear in multiple domain audits. The counts above include duplicates within each document. The deduplicated counts in this report's Executive Summary are the authoritative totals.*

---

*Report generated 2026-02-24 by Claude Code (Opus 4.6)*
