# Implementation Plan: Audit Remediation

**Source:** `docs/audit-findings/FINAL-AUDIT-REPORT.md`
**Total issues:** 137+ (23 critical, 31 high, 48 medium, 35+ low)
**Phases:** 15 (each completable in one Claude Code session unless noted)

---

## Phase 1: Security Emergency

**Fixes:** C5, C9, C18, C19, C20, C21, H22

### What to do
1. Add `isGlobalAdmin` redirect guard to `app/admin/global-security/page.tsx` (same pattern as other admin pages)
2. Migration: add `USING (false)` deny policies for UPDATE and DELETE on `audit_log`
3. Add `can('settings.manage')` guards to mutation functions on 4 unprotected settings pages: `settings/notifications`, `settings/closures`, `settings/subscription`, `settings/device-reps`
4. Add permission check to analytics settings `handleSave()` in `app/settings/analytics/page.tsx`
5. Migration: `ALTER TABLE facilities ADD CONSTRAINT chk_or_hourly_rate_non_negative CHECK (or_hourly_rate >= 0)`
6. Add Zod email validation to 3 invite forms: `app/settings/users/page.tsx`, `app/api/create-device-rep/route.ts`, `app/admin/facilities/[id]/page.tsx`
7. Migration: add RLS policies to `login_attempts` table (restrict to admin-only)

### Files involved
- `app/admin/global-security/page.tsx`
- `app/settings/notifications/page.tsx`
- `app/settings/closures/page.tsx`
- `app/settings/subscription/page.tsx`
- `app/settings/device-reps/page.tsx`
- `app/settings/analytics/page.tsx`
- `app/settings/users/page.tsx`
- `app/api/create-device-rep/route.ts`
- `app/admin/facilities/[id]/page.tsx`
- `supabase/migrations/` (new migration)

### Acceptance criteria
- [ ] Global security page redirects non-global-admins
- [ ] `audit_log` rejects UPDATE and DELETE via RLS
- [ ] 4 settings pages check permissions before mutations
- [ ] Analytics settings save requires permission
- [ ] Negative `or_hourly_rate` rejected at DB level
- [ ] Invalid emails rejected on all 3 invite forms
- [ ] `login_attempts` has RLS policies
- [ ] All tests pass (`npm run typecheck && npm run test`)

---

## Phase 2: Auth & Session Fixes

**Fixes:** C1, C2, C6, C8, C10, H13

### What to do
1. Fix invite API: change `from('invites')` to `from('user_invites')` in `app/api/admin/invite/route.ts` and `app/api/resend-invite/route.ts`; verify column names match
2. Consolidate device rep tables: pick `device_rep_facility_access` as canonical, fix `app/api/create-device-rep/route.ts` column reference (`implant_company_id` doesn't exist), fix RLS policy to reference correct table
3. Switch rate limiter from in-memory `Map` to `checkRateLimitDB()` in `lib/rate-limiter.ts`; pass real client IP from request headers instead of hardcoded `'web-client'` in `app/login/page.tsx`
4. Add `supabase.auth.admin.signOut(userId)` call after user deactivation in `app/settings/users/page.tsx`
5. Wire `verifyImpersonationSession()` from `lib/impersonation.ts` into write API routes; consider read-only mode for impersonation
6. Migration: create `force_expire_user_sessions(user_id UUID)` function

### Files involved
- `app/api/admin/invite/route.ts`
- `app/api/resend-invite/route.ts`
- `app/api/create-device-rep/route.ts`
- `lib/rate-limiter.ts`
- `app/login/page.tsx`
- `app/settings/users/page.tsx`
- `lib/impersonation.ts`
- API route files (write endpoints)
- `supabase/migrations/` (new migration for device rep consolidation + force expire function)

### Acceptance criteria
- [ ] User invites create rows in `user_invites` (not `invites`)
- [ ] Device rep signup succeeds end-to-end
- [ ] Rate limiter persists across cold starts (DB-backed)
- [ ] Login uses real client IP for rate limiting
- [ ] Deactivated users are signed out immediately
- [ ] Impersonation sessions block write operations (or require confirmation)
- [ ] `force_expire_user_sessions()` function exists and works
- [ ] All tests pass

---

## Phase 3: DB Constraints & Integrity

**Fixes:** C11, C12, C14, H4, H23, H28, H29, M2, M38, M42, M43, M44, M45, M46

### What to do
1. Fix delay dual-write orphan: also delete from `case_delays` when removing a delay flag in `app/cases/[id]/page.tsx`
2. Migration (single file, all constraints):
   - `case_implants.case_id` SET NOT NULL (backfill any NULLs first)
   - `case_milestones.facility_milestone_id` SET NOT NULL (backfill any NULLs first)
   - UNIQUE INDEX on `case_flags(case_id, flag_rule_id) WHERE flag_rule_id IS NOT NULL`
   - Update `seed_facility_flag_rules()` to copy `threshold_value_max`, `cost_category_id`, `is_active`
   - CHECK on `financial_targets.month BETWEEN 1 AND 12`
   - CHECK on `facility_holidays.month BETWEEN 1 AND 12` and `day BETWEEN 1 AND 31`
   - CHECK on `flag_rules.threshold_value_max >= threshold_value` (when not null)
   - CHECK on `flag_rules` percentile range (0-100 when threshold_type = 'percentile')
   - CHECK on `closing_handoff_minutes BETWEEN 0 AND 120` (on users table)
   - CHECK on `display_order >= 0` on applicable tables
   - UNIQUE INDEX on `milestone_template_items(template_id, display_order)`
   - UNIQUE INDEX on `facility_closures(facility_id, closure_date)`
   - Non-negative CHECK on `procedure_reimbursements.reimbursement`, `procedure_cost_items.amount`, `surgeon_cost_items.amount`
   - Partial index on `metric_issues(facility_id) WHERE resolved_at IS NULL`

### Files involved
- `app/cases/[id]/page.tsx` (delay removal logic)
- `supabase/migrations/` (new migration)

### Acceptance criteria
- [ ] Delay removal deletes from both `case_flags` and `case_delays`
- [ ] All NOT NULL constraints applied (no NULL rows remain)
- [ ] Duplicate flag detection prevented at DB level
- [ ] `seed_facility_flag_rules()` copies all columns
- [ ] All CHECK constraints active and verified
- [ ] All UNIQUE indexes created
- [ ] Migration applies cleanly with `supabase db push`
- [ ] All tests pass

---

## Phase 4: Flag & Data Quality Activation

**Fixes:** C3, C4, H5, H7, H18, H30, M9, M15

### What to do
1. Migration: INSERT missing `issue_types` rows (`stale_in_progress`, `abandoned_scheduled`, `no_activity`)
2. Fix flag summary bug: change `flag.flag_type` to `flag.severity` in `lib/dal/cases.ts:530-532`
3. Fix hardcoded milestone name: replace `.eq('name', 'patient_in')` with `source_milestone_type_id` lookup in `lib/dataQuality.ts:621`
4. Add per-case try/catch in `supabase/functions/run-data-quality-detection/index.ts`
5. Add `is_active` filter to data quality queries in `lib/dataQuality.ts:137`
6. Delete unused `lib/stale-case-detection.ts`
7. Schedule nightly data quality cron job via pg_cron (migration)
8. Integrate flag detection into case validation workflow: add trigger or API call when `data_validated = true` that calls `evaluateCasesBatch()` for the validated case

### Files involved
- `lib/dal/cases.ts`
- `lib/dataQuality.ts`
- `lib/flagEngine.ts`
- `lib/stale-case-detection.ts` (delete)
- `supabase/functions/run-data-quality-detection/index.ts`
- `supabase/migrations/` (new migration for issue_types + cron + flag trigger)

### Acceptance criteria
- [ ] `issue_types` has all 3 stale detection rows
- [ ] Flag severity indicators show correct colors on cases table
- [ ] Stale detection works regardless of milestone naming
- [ ] One bad case doesn't crash facility-wide data quality detection
- [ ] Data quality queries filter `is_active`
- [ ] `lib/stale-case-detection.ts` deleted
- [ ] Data quality detection runs nightly via cron
- [ ] Flag detection runs automatically when cases are validated
- [ ] All tests pass

---

## Phase 5: Cron Jobs & MV Management

**Fixes:** H6, H25, H26

### What to do
1. Migration: schedule nightly MV refresh via pg_cron (`0 3 * * *`)
2. Migration: schedule nightly health score refresh (`0 4 * * *`)
3. Migration: schedule weekly session/login cleanup (`0 5 * * 0`)
4. Add error logging to `refresh_all_stats()` EXCEPTION block (migration)
5. Consider replacing per-case MV trigger with debounced approach (flag per-case trigger, let cron catch up — or switch trigger to mark "needs refresh" flag and have cron do the actual refresh)

### Files involved
- `supabase/migrations/` (new migration)
- Trigger definitions on `cases` table (if debouncing per-case refresh)

### Acceptance criteria
- [ ] `cron.schedule()` entries exist for nightly stats, health scores, weekly cleanup
- [ ] MV refresh errors are logged (not silently swallowed)
- [ ] Per-case MV refresh strategy documented (debounce vs keep)
- [ ] Migration applies cleanly
- [ ] All tests pass

---

## Phase 6: Permission System Integration

**Fixes:** C7, M21

### What to do
1. Add `user_has_permission()` checks to RLS policies on financial tables: `case_completion_stats`, `procedure_reimbursements`, `procedure_cost_items`, `surgeon_cost_items`
2. Add `user_has_permission()` to RLS on `facility_analytics_settings`
3. Add middleware-level `/admin/*` route protection in `middleware.ts` (role check for admin routes)
4. Add server-side permission checks to write API routes: demo data, admin operations, invite creation

### Files involved
- `supabase/migrations/` (new migration for RLS policy updates)
- `middleware.ts`
- `app/api/` routes (write endpoints)

### Acceptance criteria
- [ ] Financial table RLS policies enforce permissions (not just roles)
- [ ] Analytics settings RLS enforces permissions
- [ ] `/admin/*` routes blocked at middleware for non-admin users
- [ ] API routes verify permissions server-side
- [ ] Existing functionality unbroken for authorized users
- [ ] All tests pass

---

## Phase 7: Hard Delete to Soft Delete Conversion

**Fixes:** C15, C23, H10, H14, M47

### What to do
1. Add soft delete for facilities: block hard delete for non-demo facilities, only allow for `is_demo = true`
2. Convert `surgeon_preferences` from `.delete()` to `is_active = false` pattern
3. Convert admin pages to soft delete: `admin/procedures`, `admin/delay-types`, `admin/complexities`
4. Convert closures to soft delete + add duplicate date prevention
5. Migration: change `milestone_template_items.facility_milestone_id` FK from CASCADE to SET NULL

### Files involved
- `components/modals/DeleteFacilityModal.tsx`
- `app/settings/surgeon-preferences/page.tsx`
- `app/admin/settings/procedures/page.tsx`
- `app/admin/settings/delay-types/page.tsx` (or equivalent)
- `app/admin/settings/complexities/page.tsx` (or equivalent)
- `app/settings/closures/page.tsx`
- `supabase/migrations/` (new migration for FK change + any soft delete columns)

### Acceptance criteria
- [ ] Production facilities cannot be hard-deleted (only soft delete)
- [ ] Demo facilities (`is_demo = true`) can still be hard-deleted
- [ ] Surgeon preferences use soft delete
- [ ] Admin procedures/delay-types/complexities use soft delete
- [ ] Closures use soft delete + duplicate dates prevented
- [ ] Archiving a milestone sets template item FK to NULL (not cascade delete)
- [ ] All tests pass

---

## Phase 8: Dropdown & Lookup Fixes

**Fixes:** C22, H12, H15, M41

### What to do
1. Add `is_active = true` / `.is('deleted_at', null)` filters to CaseForm dropdown queries (surgeon, room, implant company)
2. Fix DAL `implantCompanies()` function: add missing `deleted_at` filter
3. Fix `settings/complexities` showing archived `procedure_categories`
4. Fix `settings/device-reps` and `settings/surgeon-preferences` showing deleted `implant_companies`
5. Switch `CompletedCaseView.tsx` from `surgeon_procedure_averages.avg_total_minutes` to `surgeon_procedure_stats.median_duration`
6. Consider creating a centralized `lib/dal/dropdowns.ts` module that auto-filters inactive/deleted records

### Files involved
- `components/cases/CaseForm.tsx`
- `lib/dal/lookups.ts` (or wherever `implantCompanies()` lives)
- `app/settings/complexities/page.tsx`
- `app/settings/device-reps/page.tsx`
- `app/settings/surgeon-preferences/page.tsx`
- `components/cases/CompletedCaseView.tsx`
- `lib/dal/dropdowns.ts` (new, if created)

### Acceptance criteria
- [ ] CaseForm dropdowns only show active surgeons, rooms, companies
- [ ] DAL `implantCompanies()` filters deleted records
- [ ] Settings pages only show active records in dropdowns
- [ ] CompletedCaseView uses median (not average) for comparison
- [ ] All tests pass

---

## Phase 9: Validation Layer

**Fixes:** C17, C19, M39

### What to do
1. Create Zod schemas in `lib/validation/`:
   - `inviteSchema` — email format, role_id UUID, access_level enum
   - `analyticsSettingsSchema` — all 37 threshold fields with min/max/type
   - `flagRuleSchema` — threshold type/value, percentile range, max >= min
   - `financialConfigSchema` — OR rate non-negative, reimbursement positive
2. Add Zod validation to all `/api/` routes (parse request body with schema, return 400 on failure)
3. Replace `parseFloat() || default` coercions in analytics settings with explicit Zod validation + error feedback to user

### Files involved
- `lib/validation/schemas.ts` (extend existing)
- `app/api/admin/invite/route.ts`
- `app/api/create-device-rep/route.ts`
- `app/api/resend-invite/route.ts`
- All other `app/api/` route files
- `app/settings/analytics/page.tsx`

### Acceptance criteria
- [ ] All 4 Zod schemas created and exported
- [ ] All API routes validate input with Zod and return 400 on invalid data
- [ ] Analytics settings shows validation errors (not silent coercion)
- [ ] All tests pass

---

## Phase 10: Audit Logging Gap Fill

**Fixes:** H16, H17, H31

### What to do
1. Add `genericAuditLog` calls to save/mutation handlers on these pages:
   - `app/settings/analytics/page.tsx`
   - `app/settings/complexities/page.tsx` (or equivalent)
   - `app/settings/closures/page.tsx`
   - `app/settings/notifications/page.tsx`
   - `app/settings/surgeon-preferences/page.tsx`
   - `app/admin/settings/analytics/page.tsx`
   - `app/admin/settings/complexities/page.tsx` (or equivalent)
   - `app/admin/checklist-templates/page.tsx` (or equivalent)
   - `app/admin/permission-templates/page.tsx` (or equivalent)
2. Fix admin docs page auto-role logic that grants all 3 role levels when uncertain

### Files involved
- 9 page files listed above
- `app/admin/docs/page.tsx` (auto-role fix)
- `lib/dal/` (audit logging utility, if not already centralized)

### Acceptance criteria
- [ ] All 9 settings/admin pages log changes to `audit_log`
- [ ] Admin docs page role auto-assignment fixed
- [ ] Audit log entries include who, what, when, old value, new value
- [ ] All tests pass

---

## Phase 11: Template Builder Safety

**Fixes:** C16, H27

### What to do
1. Add optimistic locking to `useTemplateBuilder.ts`: add `updated_at` field to template, check before save, reject if stale
2. Add optimistic locking to `useAdminTemplateBuilder.ts`: same pattern
3. Add `updated_at` conflict detection to auto-save settings pages (flag rules 500ms debounce, notifications immediate, permission templates immediate)
4. Consider adding real-time subscription for template editing (show "User X is editing" presence indicator)

### Files involved
- `hooks/useTemplateBuilder.ts`
- `hooks/useAdminTemplateBuilder.ts`
- Settings pages with auto-save
- `supabase/migrations/` (if `updated_at` columns needed)

### Acceptance criteria
- [ ] Simultaneous template edits detected and handled (not silently overwritten)
- [ ] User sees conflict notification when save is rejected
- [ ] Auto-save settings pages check `updated_at` before write
- [ ] All tests pass

---

## Phase 12: Analytics Consistency

**Fixes:** H1, H2, H9, M12, M13, M14

### What to do
1. Fix analytics vs stats drift: re-trigger `record_case_stats()` when milestones change on already-validated cases
2. Add Supabase Realtime subscriptions for `case_flags` and `case_staff` in `useMilestoneRealtime.ts`
3. Rename case triggers with ordering prefix (`t01_`, `t02_`, etc.) to control execution order (migration)
4. Deduplicate triple template resolution in `useMilestoneComparison.ts`: resolve template once, pass to all 3 queries
5. Unify confidence threshold: apply `n >= 5` to both interval and phase medians in analytics RPCs
6. Remove legacy `calculateTimeAllocation()` hardcoded fallback in `milestoneAnalytics.ts`

### Files involved
- `lib/hooks/useMilestoneRealtime.ts`
- `lib/hooks/useMilestoneComparison.ts`
- `lib/milestoneAnalytics.ts`
- `supabase/migrations/` (trigger rename + stats re-trigger logic)

### Acceptance criteria
- [ ] Editing milestones on validated cases updates `case_completion_stats`
- [ ] Flag and staff changes sync in real-time across devices
- [ ] Trigger execution order is deterministic
- [ ] Template resolved once per comparison (not 3x)
- [ ] Confidence threshold consistent across all analytics
- [ ] All tests pass

---

## Phase 13: Dead Code Cleanup

**Fixes:** H8, H11, L10

### What to do
1. Delete unused `lib/stale-case-detection.ts` (if not already deleted in Phase 4)
2. Decide: integrate `lib/session-manager.ts` into login flow OR delete it + drop `user_sessions` table
3. Add CI check (or pre-deploy script) that diffs `lib/orbitScoreEngine.ts` vs `supabase/functions/compute-surgeon-scorecard/orbitScoreEngine.ts`
4. Remove unused `PermissionGuard` component (or integrate into Phase 6 pages)
5. Remove dead `signInWithSession()` custom duration logic

### Files involved
- `lib/stale-case-detection.ts` (delete)
- `lib/session-manager.ts` (integrate or delete)
- `lib/orbitScoreEngine.ts`
- `supabase/functions/compute-surgeon-scorecard/orbitScoreEngine.ts`
- Components using `PermissionGuard` (if any)
- CI config (for sync check)

### Acceptance criteria
- [ ] No dead code files remain
- [ ] Session manager either works or is removed
- [ ] Score engine sync verified (CI or script)
- [ ] All tests pass

---

## Phase 14: Code Quality & Decomposition (2-3 sessions)

**Fixes:** L22, L23, L24, L25, M16

### What to do
1. Decompose `app/admin/docs/page.tsx` (3,195 lines) into: PageRegistryTable, PageScanner, CategoryManager, PageDetailDrawer
2. Decompose `app/admin/facilities/[id]/page.tsx` (1,656 lines) into: FacilityOverview, FacilityUsers, FacilityRooms, FacilityProcedures, FacilitySubscription, FacilityAudit
3. Decompose `app/settings/closures/page.tsx` (902 lines) into: HolidayManager, ClosureManager, ClosureCalendar
4. Migration: drop legacy ghost columns from `case_completion_stats` (`soft_goods_cost`, `hard_goods_cost`, `or_cost`)
5. Add unit tests for `orbitScoreEngine.ts`
6. Standardize soft-delete column pattern across all tables (pick `is_active` + `deleted_at` for all)

### Files involved
- `app/admin/docs/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/settings/closures/page.tsx`
- `supabase/migrations/` (ghost columns + soft delete standardization)
- `lib/orbitScoreEngine.ts` (tests)

### Acceptance criteria
- [ ] No page file exceeds ~500 lines
- [ ] All decomposed components work identically to monolithic versions
- [ ] Ghost columns dropped
- [ ] Orbit score engine has unit test coverage
- [ ] All tests pass

---

## Phase 15: Future Improvements (as needed)

**Fixes:** Remaining L-tier and M-tier nice-to-haves

### Backlog items (pick per session)
- M1: Bulk case creation batch RPC (replace 20 individual calls)
- M5: Cursor-based pagination on cases list
- H3: Full-text search across multiple case fields (surgeon, procedure, room)
- M17: Manual recalculation function `recalculate_case_stats(case_id)`
- M18: Pricing audit trail (`pricing_history` table)
- M19: Procedure pricing effective dating (replace delete-then-insert)
- M33: Periodic user revalidation in UserContext (check `is_active` every 5 min)
- M34: Server-side impersonation verification (not just localStorage)
- M35: Auto-expire abandoned impersonation sessions after 4 hrs
- M36: Session revocation on password change
- L8: Real-time subscription reconnection with exponential backoff
- L9: Milestone audit trail
- L11: Flag acknowledgment/dismissal feature
- L14: Error boundary coverage (root → page → widget)
- L27: HIPAA 6-year retention policy enforcement
- C13: Migrate TIME WITHOUT TIME ZONE to TIMESTAMPTZ (cases + stats)

### Acceptance criteria
- [ ] Each item completed as a standalone commit
- [ ] All tests pass after each item
