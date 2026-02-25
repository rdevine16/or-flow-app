# AUDIT DOMAIN 6: Settings & Configuration — Every Settings Page Verified

**Audited:** 2026-02-24
**Pages reviewed:** 40+ settings/admin pages
**Total lines reviewed:** ~15,000+

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Pages audited | 40+ |
| CRITICAL issues | 8 |
| HIGH issues | 11 |
| MEDIUM issues | 25 |
| LOW issues | 20+ |
| Pages with NO access control | 3 (global-security, notifications, subscription) |
| Pages using hard delete | 5 (admin procedures, admin delay-types, complexities, surgeon-preferences, closures) |
| Pages with NO audit logging | 8 |
| Pages with Zod validation | 1 (facility creation wizard) |

### Top 5 Critical Findings

1. **Global Security page has NO access control** — any logged-in user can view sensitive security data (error logs, failed logins, sessions, IPs) across all facilities
2. **Facility hard delete with CASCADE** — DeleteFacilityModal permanently destroys all child records (cases, milestones, analytics)
3. **Analytics settings (facility) has no permission check on save** — any authenticated user can edit all 37 KPI thresholds
4. **Closures page has no access control** — any user can create/edit/delete facility closures and holidays
5. **Device reps page has no access control** — any user can invite device reps to their facility

---

## FACILITY-LEVEL SETTINGS PAGES

### app/settings/general/page.tsx
**Access control:** ⚠️ UI-only — `can('settings.manage')` guards buttons but NOT the `handleSave()` mutation
**Fields:** name, address, city, state, zip, phone, timezone
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`facilityAudit.updated()`)
**Tables written:** `facilities`
**Validation:** ⚠️ inline only (`!formData.name.trim()`)
**Issues:**
- **[CRITICAL]** No permission check on `handleSave()` — only UI-level protection
- **[MEDIUM]** No server-side validation
- **[LOW]** Inconsistent soft-delete filters: `users` uses `is_active = true`, `or_rooms` uses `deleted_at IS NULL`
- **[LOW]** "Delete Facility" button is a mock `alert()` — not implemented

---

### app/settings/rooms/page.tsx
**Access control:** ✅ facility-scoped (`can('settings.manage')`)
**Fields:** room name, weekly schedule (7 days × open/close times + isClosed toggle), available_hours
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`roomAudit`)
**Tables written:** `or_rooms`, `room_schedules`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes (`deleted_at` + `deleted_by`)
**Issues:**
- **[MEDIUM]** No server-side validation on room name
- **[LOW]** Archive warns about dependencies but doesn't block

---

### app/settings/procedures/page.tsx
**Access control:** ✅ facility-scoped (`can('settings.manage')`)
**Fields:** name, body_region_id, technique_id, procedure_category_id, implant_category, expected_duration_minutes
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`procedureAudit`)
**Tables written:** `procedure_types`, `surgeon_procedure_duration`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Dropdown filters:** ⚠️ Reference tables are global (no facility_id) — by design
**Issues:**
- **[MEDIUM]** No Zod validation
- **[LOW]** Archive doesn't check for dependent cases

---

### app/settings/milestones/page.tsx *(cross-reference Domain 2)*
**Access control:** ✅ facility-scoped
**Fields:** milestone CRUD, template builder, procedure assignments, surgeon overrides
**Save pattern:** mixed (immediate toggles + modal submits)
**Audit logging:** ✅ yes (comprehensive `milestoneTypeAudit`)
**Tables written:** `facility_milestones`, `milestone_templates`, `surgeon_template_overrides`, and more
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Issues:**
- **[LOW]** 847-line file — could benefit from decomposition

---

### app/settings/analytics/page.tsx
**Access control:** ⚠️ facility-scoped BUT **no permission check on save**
**Fields:** 37 configurable thresholds (FCOTS, turnovers, utilization, cancellations, idle time, tardiness, alerts, ORbit Score v2)
**Save pattern:** explicit-save
**Audit logging:** ❌ no
**Tables written:** `facility_analytics_settings` (upsert)
**Validation:** ❌ none — strings parsed with `parseFloat()`/`parseInt()`, falls back to defaults silently
**Issues:**
- **[CRITICAL]** No permission check on save — any authenticated user can edit analytics settings
- **[CRITICAL]** No validation — malformed input silently defaults
- **[MEDIUM]** No audit logging for threshold changes
- **[MEDIUM]** HTML min/max attributes only — no server enforcement

---

### app/settings/cancellation-reasons/page.tsx
**Access control:** ✅ facility-scoped (`can('settings.manage')`)
**Fields:** display_name, category (patient/scheduling/clinical/external)
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`cancellationReasonAudit`)
**Tables written:** `cancellation_reasons`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes (`is_active` + `deleted_at` + `deleted_by`)
**Issues:**
- **[MEDIUM]** No server-side validation
- **[LOW]** Archive doesn't check if reason is used by cancelled cases

---

### app/settings/delay-types/page.tsx
**Access control:** ✅ facility-scoped (`can('settings.manage')`)
**Fields:** display_name, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`delayTypeAudit`)
**Tables written:** `delay_types`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Issues:**
- **[MEDIUM]** No server-side validation
- **[LOW]** Manual display_order — no drag-and-drop

---

### app/settings/complexities/page.tsx
**Access control:** ⚠️ partial — `can('settings.manage')` for edit actions, but **no page-level protection**
**Fields:** display_name, description, procedure_category_ids (array)
**Save pattern:** explicit-save
**Audit logging:** ❌ no
**Tables written:** `complexities`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes (`deleted_at`)
**Dropdown filters:** ⚠️ procedure_categories query **missing `is_active` filter** — archived categories appear
**Issues:**
- **[HIGH]** No page-level access control
- **[HIGH]** Dropdown loads archived procedure categories
- **[MEDIUM]** No audit logging

---

### app/settings/implant-companies/page.tsx
**Access control:** ⚠️ partial — no explicit page-level check
**Fields:** name
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`implantCompanyAudit`)
**Tables written:** `implant_companies`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Issues:**
- **[MEDIUM]** No page-level access control
- **[LOW]** Restore action logged as "deleted (restored)" — misleading

---

### app/settings/checklist-builder/page.tsx
**Access control:** ✅ feature-gated (`PATIENT_CHECKIN`)
**Fields:** display_label, field_type, options (array), placeholder, is_required, show_on_escort_page
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`checkinAudit`)
**Tables written:** `preop_checklist_fields`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Issues:**
- **[MEDIUM]** No Zod validation for field types
- **[LOW]** Drag-and-drop UI shown (GripHorizontal icon) but not implemented

---

### app/settings/device-reps/page.tsx
**Access control:** ❌ MISSING — no access control at all
**Fields:** email, implant_company_id
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`deviceRepAudit`)
**Tables written:** `device_rep_invites`, `facility_device_reps`
**Validation:** ⚠️ inline only — **no email format validation**
**Soft delete:** ✅ (revoke sets `status = 'revoked'`)
**Dropdown filters:** ⚠️ implant_companies **doesn't filter `deleted_at`**
**Issues:**
- **[CRITICAL]** No access control — any user can invite device reps
- **[HIGH]** No email format validation
- **[HIGH]** Dropdown shows archived implant companies
- **[MEDIUM]** No duplicate invite prevention

---

### app/settings/closures/page.tsx (902 lines)
**Access control:** ❌ MISSING — only checks authentication, no facility admin check
**Entity:** Recurring holidays (annual) + one-off closures (specific dates)
**Fields:** Holidays: name, month, day, week_of_month, day_of_week, is_active. Closures: closure_date, reason
**Save pattern:** explicit-save
**Audit logging:** ❌ no
**Tables written:** `facility_holidays`, `facility_closures`
**Validation:** ⚠️ partial (closures prevent past dates)
**Soft delete:** ⚠️ mixed — holidays use `is_active` toggle, **closures use hard delete**
**Issues:**
- **[CRITICAL]** No access control — any user can create/edit/delete closures
- **[HIGH]** Closures use hard `.delete()` — violates soft delete pattern
- **[HIGH]** No duplicate closure prevention (same date)
- **[HIGH]** No conflict detection with existing scheduled cases
- **[MEDIUM]** No audit logging
- **[LOW]** Holiday toggle has no confirmation — accidental clicks

---

### app/settings/flags/page.tsx *(cross-reference Domain 4)*
**Access control:** ✅ facility-scoped
**Fields:** flag rule toggles, severity cycling pill, threshold type/value/operator, scope, archive/restore
**Save pattern:** auto-save (debounced numbers, immediate toggles)
**Audit logging:** ✅ yes (`flagRuleAudit`)
**Tables written:** `facility_flag_rules`
**Validation:** ❌ none in UI (DAL may validate)
**Soft delete:** ✅ yes (`is_active`)
**Issues:**
- **[MEDIUM]** No client-side Zod validation

---

### app/settings/notifications/page.tsx
**Access control:** ❌ MISSING — no checks at all
**Fields:** is_enabled (toggle), channels (push, in_app, email checkboxes)
**Save pattern:** auto-save (onChange)
**Audit logging:** ❌ no
**Tables written:** `facility_notification_settings`
**Validation:** ❌ none
**Issues:**
- **[CRITICAL]** No access control — any user can toggle facility notifications
- **[HIGH]** No validation on channels array
- **[MEDIUM]** No audit logging

---

### app/settings/surgeon-preferences/page.tsx
**Access control:** ✅ facility-scoped (implicit via `effectiveFacilityId`)
**Fields:** closing_workflow (radio), handoff_minutes (number), procedure preferences (procedure_type_id, company_ids)
**Save pattern:** explicit-save
**Audit logging:** ❌ no
**Tables written:** `users`, `surgeon_preferences`, `surgeon_preference_companies`
**Soft delete:** ❌ **hard delete** on `surgeon_preferences` (`.delete()`)
**Dropdown filters:** ⚠️ implantCompanies **doesn't filter `deleted_at`**
**Issues:**
- **[CRITICAL]** Hard delete on surgeon_preferences
- **[HIGH]** No validation on `closing_handoff_minutes` (negative/huge numbers accepted)
- **[HIGH]** Dropdown shows archived implant companies
- **[MEDIUM]** No audit logging

---

### app/settings/checkin/page.tsx
**Access control:** ✅ feature-gated (`PATIENT_CHECKIN`)
**Fields:** default_arrival_lead_time_minutes, per-procedure arrival overrides
**Save pattern:** explicit-save
**Audit logging:** ✅ partial (default save only, not procedure overrides)
**Tables written:** `facilities`, `procedure_types`
**Validation:** ⚠️ inline only (min/max constraints)
**Dropdown filters:** ✅ `facility_id` + `is_active` + `deleted_at IS NULL`
**Issues:**
- **[LOW]** Audit logging only on default save, not procedure overrides

---

### app/settings/audit-log/page.tsx
**Access control:** ✅ facility-scoped
**Fields:** N/A (read-only)
**Save pattern:** read-only
**Issues:**
- **[LOW]** Client-side search — could be slow with large datasets

---

### app/settings/subscription/page.tsx
**Access control:** ❌ MISSING — no checks
**Fields:** or_hourly_rate (number input, inline editable)
**Save pattern:** explicit-save (for OR rate)
**Audit logging:** ⚠️ partial (OR rate only via `genericAuditLog`)
**Tables written:** `facilities` (or_hourly_rate)
**Validation:** ⚠️ inline only (`isNaN` + negative check)
**Issues:**
- **[CRITICAL]** No access control — any user can view usage stats and edit OR rate
- **[MEDIUM]** Hardcoded plan data instead of DB-driven
- **[LOW]** OR rate editing duplicated on financials page

---

### app/settings/financials/* *(cross-reference Domain 3)*
**Access control:** ✅ facility-scoped
**Hub page** with OR rate editor + navigation to sub-pages
**Issues:**
- **[LOW]** OR rate editing logic duplicated with subscription page

---

### app/settings/users/page.tsx *(cross-reference Domain 5)*
**Access control:** ✅ `can('users.view')` + `can('users.manage')`
**Fields:** first_name, last_name, email, role_id, access_level, facility_id
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (comprehensive `userAudit`)
**Soft delete:** ✅ yes (`is_active`, `deleted_at`, `deleted_by`)
**Issues:**
- **[HIGH]** No email format validation
- **[MEDIUM]** Global admin can change user's facility without cascade check

---

## ADMIN-LEVEL SETTINGS PAGES

### app/admin/settings/procedures/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name, body_region_id, procedure_category_id, implant_category, is_active
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`adminAudit`)
**Tables written:** `procedure_type_templates`
**Validation:** ⚠️ inline only
**Template pattern:** ✅ template→facility
**Soft delete:** ❌ **HARD DELETE** (`.delete()`)
**Issues:**
- **[HIGH]** Hard delete — should use soft delete
- **[MEDIUM]** No Zod validation

---

### app/admin/settings/body-regions/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name (read-only in edit), display_name, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes
**Tables written:** `body_regions`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Issues:**
- **[MEDIUM]** `generateName()` could produce collisions

---

### app/admin/settings/analytics/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** 14 template defaults (FCOTS, turnover, utilization, cancellation, ORbit Score v2)
**Save pattern:** explicit-save
**Audit logging:** ❌ **NO AUDIT LOGGING** — changes to defaults for all new facilities are untracked
**Tables written:** `analytics_settings_template`
**Validation:** ✅ client-side range checks (`validate()`)
**Template pattern:** ✅ template→facility (`copy_analytics_settings_to_facility()`)
**Issues:**
- **[HIGH]** No audit logging for analytics template changes
- **[MEDIUM]** Client-side validation only

---

### app/admin/settings/notifications/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** notification_type, category, display_label, description, default_enabled, default_channels[], display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`genericAuditLog`)
**Tables written:** `notification_settings_template`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Template pattern:** ✅ template→facility
**Issues:**
- **[MEDIUM]** No Zod validation
- **[LOW]** No validation that channel values are valid

---

### app/admin/settings/payers/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes
**Tables written:** `payer_templates`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Template pattern:** ✅ template→facility
**Issues:**
- **[LOW]** No uniqueness check before insert

---

### app/admin/settings/cost-categories/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name, type (credit/debit), description, is_active, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`costCategoryAudit`)
**Tables written:** `cost_category_templates`, `cost_categories` (cascade archive)
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes (cascade archive on both tables)
**Template pattern:** ✅ template→facility
**Issues:**
- **[MEDIUM]** Cascade archive assumes template ID = facility category ID — **potential bug if IDs don't match**

---

### app/admin/settings/delay-types/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name, display_name, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes
**Tables written:** `delay_types` (facility_id IS NULL)
**Validation:** ⚠️ inline only
**Soft delete:** ❌ **HARD DELETE** (`.delete()`)
**Template pattern:** ✅ template→facility
**Issues:**
- **[HIGH]** Hard delete
- **[MEDIUM]** Auto-generated name could collide

---

### app/admin/settings/implant-companies/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name
**Save pattern:** explicit-save
**Audit logging:** ✅ yes
**Tables written:** `implant_companies` (facility_id IS NULL)
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Issues:**
- **[LOW]** No uniqueness check before insert

---

### app/admin/settings/procedure-categories/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** name, display_name, body_region_id, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes
**Tables written:** `procedure_categories` (**NOT a template — shared global table**)
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Template pattern:** ❌ NOT a template — writes directly to shared table
**Issues:**
- **[MEDIUM]** Not a template table — inconsistent with other admin pages
- **[LOW]** No uniqueness check on generated name

---

### app/admin/settings/flag-rules/page.tsx *(cross-reference Domain 4)*
**Access control:** ✅ isGlobalAdmin
**Fields:** name, metric, category, threshold_type/value/operator, severity, comparison_scope, is_enabled, cost_category_id
**Save pattern:** mixed (auto-save debounced for thresholds, explicit for custom builder)
**Audit logging:** ✅ yes (`flagRuleAudit`)
**Tables written:** `flag_rule_templates` (via DAL)
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes (`is_active`)
**Template pattern:** ✅ template→facility
**Issues:**
- **[LOW]** No Zod validation

---

### app/admin/settings/milestones/page.tsx *(cross-reference Domain 2)*
**Access control:** ✅ isGlobalAdmin
**Fields:** name, display_name, display_order, pair_with_id, pair_position, is_active (4-tab layout)
**Save pattern:** explicit-save
**Audit logging:** ✅ yes (`milestoneTypeAudit`)
**Tables written:** `milestone_types`, `facility_milestones` (propagates to all facilities)
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Template pattern:** ✅ template→facility (propagates via direct INSERT to all facilities)
**Issues:**
- **[LOW]** No DB constraint for reciprocal pair_with_id
- **[LOW]** propagateToFacilities uses direct INSERTs — could fail partially

---

### app/admin/cancellation-reasons/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** display_name, category, display_order
**Save pattern:** explicit-save
**Audit logging:** ✅ yes
**Tables written:** `cancellation_reason_templates`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Template pattern:** ✅ template→facility
**Issues:**
- **[LOW]** Category dropdown hardcoded (4 values)

---

### app/admin/complexities/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** display_name, description, procedure_category_ids (array), is_active
**Save pattern:** explicit-save + inline toggles
**Audit logging:** ❌ no
**Tables written:** `complexity_templates`
**Validation:** ⚠️ inline only
**Soft delete:** ❌ **HARD DELETE** (`.delete()`)
**Template pattern:** ✅ template→facility
**Issues:**
- **[MEDIUM]** Hard delete instead of soft delete
- **[MEDIUM]** No audit logging

---

### app/admin/checklist-templates/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** display_label, field_type, options, default_value, placeholder, is_required, show_on_escort_page, display_order
**Save pattern:** explicit-save
**Audit logging:** ❌ no
**Tables written:** `preop_checklist_field_templates`
**Validation:** ⚠️ inline only
**Soft delete:** ✅ yes
**Template pattern:** ✅ template→facility
**Issues:**
- **[MEDIUM]** No audit logging
- **[LOW]** Uses `window.confirm` instead of ConfirmDialog component

---

### app/admin/permission-templates/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** permission_key, granted (toggle per access level)
**Save pattern:** auto-save (onChange toggle → upsert)
**Audit logging:** ❌ no
**Tables written:** `permission_templates`
**Validation:** ❌ none (toggle-based)
**Template pattern:** ✅ template→facility (`copy_permission_template_to_facility` RPC)
**Issues:**
- **[MEDIUM]** No audit logging for permission template changes

---

## ADMIN FACILITY MANAGEMENT PAGES

### app/admin/facilities/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** search, status filter
**Save pattern:** read-only (list view + impersonation)
**Audit logging:** ✅ yes (impersonation logged)
**Tables written:** `admin_sessions`
**Issues:**
- **[MEDIUM]** Facility deletion is HARD DELETE (via DeleteFacilityModal)
- **[MEDIUM]** No reason/duration required for impersonation

---

### app/admin/facilities/[id]/page.tsx (1,656 lines)
**Access control:** ✅ isGlobalAdmin
**Fields:** Overview (name, address, status, trial, logo), Users (invite + toggle), Rooms (add/delete), Procedures (add/delete), Subscription (status, trial, is_demo), Audit (read-only)
**Save pattern:** explicit-save (per-section)
**Audit logging:** ✅ yes (multiple audit types)
**Tables written:** `facilities`, `users`, `or_rooms`, `procedure_types`
**Validation:** ⚠️ inline only — **no email format validation on user invites**
**Soft delete:** ⚠️ mixed — rooms/procedures use `deleted_at`, users use `is_active`
**Issues:**
- **[CRITICAL]** Facility deletion is **permanent CASCADE** — destroys all child records
- **[HIGH]** No email format validation on user invites
- **[HIGH]** Uses native `alert()` for 8+ success/error messages instead of toast
- **[MEDIUM]** Subscription status change has no confirmation dialog
- **[MEDIUM]** Impersonation has no duration limit or auto-expire
- **[LOW]** No pagination on audit log (limit 50)

---

### app/admin/facilities/new/page.tsx (multi-step wizard)
**Access control:** ✅ isGlobalAdmin
**Fields:** Step 1: name, address, status, trial days. Step 2: admin user details. Steps 3-4: 13 template category toggles. Step 5: review.
**Save pattern:** explicit-save (final button on step 5)
**Audit logging:** ✅ yes (`facilityAudit.created`)
**Tables written:** `facilities` (via `seed_facility_with_templates()` RPC)
**Validation:** ✅ Zod (step1/step2 via types.ts)

**Templates copied (13 categories):**
1. milestones (milestone_types)
2. procedures (procedure_type_templates)
3. delay_types
4. cancellation_reasons
5. complexities
6. preop_checklist_fields
7. cost_categories
8. implant_companies
9. payers
10. analytics_settings
11. flag_rules
12. notification_settings
13. milestone_template_type_items

**Atomic copy:** ✅ yes — `seed_facility_with_templates()` is a single DB transaction
**Required templates check:** ❌ no — allows 0 templates selected

**Issues:**
- **[MEDIUM]** No validation that at least one template category is selected
- **[MEDIUM]** If RPC fails, facility record may be orphaned (created but not seeded)
- **[MEDIUM]** Admin invite failure is swallowed as warning — facility created but admin may not receive invite
- **[LOW]** No "Save Draft" functionality

---

### app/admin/audit-log/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** date range, facility filter, action filter, success filter, search query
**Save pattern:** read-only
**Issues:**
- **[LOW]** CSV export capped at 10,000 rows
- **[LOW]** Client-side search only
- **[LOW]** HIPAA 6-year retention mentioned but no enforcement

---

### app/admin/global-security/page.tsx
**Access control:** ❌ **MISSING** — NO isGlobalAdmin check, NO useUser check, NO redirect
**Fields:** time range, facility filter, view mode (read-only dashboard)
**Save pattern:** read-only
**Issues:**
- **[CRITICAL]** **NO ACCESS CONTROL** — any logged-in user can access
- **[CRITICAL]** Exposes sensitive security data: error logs, failed logins, session details, IP addresses
- **[CRITICAL]** Error logs query does NOT filter by facility_id — shows ALL facility errors
- **[HIGH]** Auto-refreshes every 30 seconds without user control

---

### app/admin/demo/page.tsx
**Access control:** ✅ isGlobalAdmin
**Fields:** 6-step wizard: facility, surgeon profiles, room schedules, outlier config, review, running
**Save pattern:** explicit-save (final button)
**Audit logging:** ⚠️ likely in API endpoint (not visible in page)
**Validation:** ✅ step validators
**Issues:**
- **[MEDIUM]** Purge operation has no confirmation dialog
- **[MEDIUM]** No cancel button during generation
- **[MEDIUM]** No max case limit — could accidentally generate millions of cases

---

### app/admin/docs/page.tsx (3,195 lines)
**Access control:** ✅ isGlobalAdmin
**Fields:** page name, route, description, category, roles, reads/writes arrays, notes
**Save pattern:** explicit-save
**Audit logging:** ❌ no
**Tables written:** `page_registry`, `page_registry_categories`
**Issues:**
- **[HIGH]** No audit logging for page registry changes
- **[MEDIUM]** Scanner auto-populates roles as all 3 levels when uncertain — could over-grant
- **[LOW]** 3,195 lines — monolithic, should be decomposed

---

## CROSS-CUTTING ISSUES

### 1. Access Control Gap
**All admin pages use client-side `isGlobalAdmin` checks with redirect — no middleware enforcement for `/admin/*` routes.** If RLS is properly configured this is low risk, but middleware-level enforcement would be defense-in-depth.

3 facility-level pages have NO access control at all:
- `app/settings/notifications/page.tsx`
- `app/settings/closures/page.tsx`
- `app/settings/subscription/page.tsx`

1 admin page has NO access control:
- `app/admin/global-security/page.tsx`

### 2. Validation Gap
**Only 1 of 40+ pages uses Zod validation** (facility creation wizard). All others rely on:
- Inline `.trim()` checks
- HTML5 `required` / `min` / `max` attributes
- DB constraints as last resort

### 3. Soft Delete Violations
5 pages use hard delete instead of soft delete:
| Page | Table | Delete Pattern |
|------|-------|---------------|
| admin/settings/procedures | procedure_type_templates | `.delete()` |
| admin/settings/delay-types | delay_types | `.delete()` |
| admin/complexities | complexity_templates | `.delete()` |
| settings/surgeon-preferences | surgeon_preferences | `.delete()` |
| settings/closures | facility_closures | `.delete()` |

### 4. Audit Logging Gaps
8 pages have NO audit logging:
| Page | Impact |
|------|--------|
| settings/analytics | 37 KPI thresholds untracked |
| settings/complexities | Complexity CRUD untracked |
| settings/closures | Holiday/closure changes untracked |
| settings/notifications | Notification toggle changes untracked |
| settings/surgeon-preferences | Preference changes untracked |
| admin/settings/analytics | Template defaults untracked |
| admin/complexities | Template CRUD untracked |
| admin/checklist-templates | Template CRUD untracked |
| admin/permission-templates | Permission changes untracked |
| admin/docs | Page registry changes untracked |

### 5. Dropdown Filter Issues
4 pages load dropdowns that include archived/deleted records:
| Page | Dropdown | Missing Filter |
|------|----------|---------------|
| settings/complexities | procedure_categories | `is_active` / `deleted_at` |
| settings/device-reps | implant_companies | `deleted_at` |
| settings/surgeon-preferences | implant_companies | `deleted_at` |
| admin/facilities/[id] | N/A | email format validation |

### 6. Save Pattern Inconsistency
| Pattern | Pages |
|---------|-------|
| Explicit-save (modal/button) | ~30 pages |
| Auto-save (onChange) | notifications, permission-templates |
| Mixed (debounced auto + explicit) | flag-rules, milestones |

---

## RECOMMENDED ACTIONS

### Immediate — Security (Critical)
1. Add `isGlobalAdmin` check to `app/admin/global-security/page.tsx`
2. Add `can('settings.manage')` guard to mutation functions (not just UI) in `settings/general`, `settings/analytics`
3. Add access control to `settings/notifications`, `settings/closures`, `settings/subscription`, `settings/device-reps`
4. Add middleware-level `/admin/*` route protection as defense-in-depth

### High Priority — Data Integrity
5. Convert 5 hard-delete operations to soft delete
6. Add `deleted_at` / `is_active` filters to all dropdown queries
7. Add email format validation to user invite forms (settings/users, admin/facilities/[id])
8. Add Zod validation to analytics settings page (37 thresholds)

### High Priority — Compliance
9. Add audit logging to the 8+ pages missing it (analytics, complexities, closures, notifications, surgeon-preferences, admin analytics template, admin complexities, admin checklist-templates, admin permission-templates)

### Medium Priority — Robustness
10. Add facility creation wizard rollback mechanism if RPC fails
11. Add confirmation dialogs for subscription status changes and demo purge
12. Fix cost-categories cascade archive ID mismatch bug
13. Replace native `alert()` calls with toast system in facility detail page
14. Add conflict detection for closures vs existing scheduled cases
15. Add duplicate prevention (same closure date, same invite email)

### Low Priority — Polish
16. Add drag-and-drop reordering where UI hints exist (checklist-builder, cancellation-reasons)
17. Decompose monolithic files (docs: 3,195 lines, facility detail: 1,656 lines, closures: 902 lines)
18. Standardize save patterns (explicit vs auto-save) across all settings pages
19. Add "Save Draft" to facility creation wizard
20. Implement HIPAA retention policy enforcement in audit log
