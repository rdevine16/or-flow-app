# Cross-Cutting Audit: Data Entry Architecture — DB ↔ UI Alignment

**Date:** 2026-02-24
**Scope:** All forms, write operations, lookups, cascades, and concurrency across Domains 1–6
**Inputs:** Domain audit findings (`domain-1-cases.md` through `domain-6-settings.md`) + source code analysis

---

## Executive Summary

| Check | Critical | High | Medium | Low | Total |
|-------|----------|------|--------|-----|-------|
| 1. Form ↔ Schema | 3 | 4 | 5 | 2 | 14 |
| 2. Validation Gaps | 8 | 18 | 25 | 13 | 64 |
| 3. Lookup Consistency | 3 | 3 | 4 | 2 | 12 |
| 4. Referential Integrity | 1 | 2 | 5 | 2 | 10 |
| 5. Concurrent Edits | 1 | 2 | 3 | 1 | 7 |
| **TOTAL** | **16** | **29** | **42** | **20** | **107** |

**Top 5 Findings:**
1. **Facility hard delete cascades to 30+ tables** — total data destruction, no soft delete option (CHECK 4, CRITICAL)
2. **Template builder delete-all-then-insert pattern** — two admins editing simultaneously = data loss (CHECK 5, CRITICAL)
3. **Zero API route validation** — all `/api/` routes accept any payload if authenticated (CHECK 2, CRITICAL)
4. **12 dropdowns missing soft-delete filters** — archived surgeons/rooms/companies appear in creation forms (CHECK 3, CRITICAL)
5. **37 analytics threshold fields with no validation** — silent `parseFloat()` fallback accepts garbage input (CHECK 2, HIGH)

---

## CHECK 1: Form ↔ Schema Alignment

### Master Table — All Forms Writing Data

#### Domain 1: Cases

| Page | Form Field | Input Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------------|----------|-----------|---------|--------|------------|
| **CaseForm** | case_number | text | cases | case_number | text | ✅ | Zod min 1, max 50 + UNIQUE |
| | scheduled_date | date | cases | scheduled_date | date | ✅ | Zod YYYY-MM-DD regex |
| | start_time | time | cases | start_time | time without tz | ⚠️ | Zod HH:MM regex — **loses timezone** |
| | surgeon_id | select (UUID) | cases | surgeon_id | uuid FK | ✅ | Zod UUID |
| | procedure_type_id | select (UUID) | cases | procedure_type_id | uuid FK | ✅ | Zod UUID |
| | or_room_id | select (UUID) | cases | or_room_id | uuid FK | ✅ | Zod UUID |
| | status_id | select (UUID) | cases | status_id | uuid FK | ✅ | Zod UUID |
| | operative_side | select (enum) | cases | operative_side | text + CHECK | ✅ | Zod enum |
| | payer_id | select (UUID) | cases | payer_id | uuid FK | ✅ | Zod UUID (optional) |
| | notes | textarea | cases | notes | text | ✅ | Zod max 1000 — **no DB max** |
| | repRequiredOverride | boolean/null | cases | rep_required_override | boolean | ✅ | None |
| **CaseDetail** | milestone recorded_at | auto (NOW) | case_milestones | recorded_at | timestamptz | ✅ | Inline NOW() |
| | cancellation_reason_id | select | cases | cancellation_reason_id | uuid FK | ✅ | Inline check |
| | cancellation_notes | textarea | cases | cancellation_notes | text | ✅ | None — **unlimited** |

#### Domain 2: Milestones & Templates

| Page | Form Field | Input Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------------|----------|-----------|---------|--------|------------|
| **Admin Milestones** | display_name | text | facility_milestones | display_name | text NOT NULL | ✅ | Inline .trim() |
| | display_order | number | facility_milestones | display_order | integer | ✅ | HTML number — **negative allowed** |
| | pair_with_id | select | facility_milestones | pair_with_id | uuid FK | ✅ | Inline select |
| **Template Builder** | template name | text | milestone_templates | name | text NOT NULL | ✅ | Inline .trim() |
| | item display_order | drag-drop | milestone_template_items | display_order | integer | ⚠️ | DnD auto — **no UNIQUE constraint** |
| | item milestone_id | select | milestone_template_items | facility_milestone_id | uuid FK | ✅ | Inline select |
| | item phase_id | select | milestone_template_items | facility_phase_id | uuid FK | ✅ | Inline select |

#### Domain 3: Financials

| Page | Form Field | Input Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------------|----------|-----------|---------|--------|------------|
| **Procedure Pricing** | reimbursement | number | procedure_reimbursements | reimbursement | numeric | ✅ | HTML min="0" — **no DB CHECK** |
| | effective_date | date | procedure_reimbursements | effective_date | date | ✅ | None |
| | cost amount | number | procedure_cost_items | amount | numeric | ✅ | HTML min="0" — **no DB CHECK** |
| **Facility General** | or_hourly_rate | number | facilities | or_hourly_rate | numeric(10,2) | ✅ | Inline isNaN — **no DB CHECK ≥ 0** |
| **Financial Targets** | profit_target | number | financial_targets | profit_target | numeric | ✅ | HTML min — **no max, no DB CHECK** |
| | year | number | financial_targets | year | integer | ✅ | HTML number — **year 9999 allowed** |
| | month | number | financial_targets | month | integer | ✅ | HTML 1-12 — **no DB CHECK** |

#### Domain 4: Flags & Data Quality

| Page | Form Field | Input Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------------|----------|-----------|---------|--------|------------|
| **Flag Rules** | name | text | flag_rules | name | text NOT NULL | ✅ | None |
| | metric | select | flag_rules | metric | text NOT NULL | ✅ | None |
| | threshold_value | number | flag_rules | threshold_value | numeric | ✅ | HTML step — **percentile > 100 allowed** |
| | threshold_value_max | number | flag_rules | threshold_value_max | numeric | ✅ | HTML number — **can be < min** |
| | severity | select (cycle) | flag_rules | severity | text CHECK | ✅ | SeverityPill cycle |
| | operator | select | flag_rules | operator | text CHECK | ✅ | None |
| | comparison_scope | select | flag_rules | comparison_scope | text | ✅ | None — **no CHECK** |

#### Domain 5: Users & Auth

| Page | Form Field | Input Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------------|----------|-----------|---------|--------|------------|
| **User Invite** | email | text | user_invites | email | text | ❌ | **None — no format validation** |
| | first_name | text | user_invites | first_name | text | ✅ | None |
| | last_name | text | user_invites | last_name | text | ✅ | None |
| | role_id | select | user_invites | role_id | uuid FK | ✅ | None |
| | access_level | select | user_invites | access_level | text | ✅ | None — **no CHECK** |
| **Device Rep Signup** | email | text | facility_device_reps | email | text | ❌ | **None — no format validation** |
| | implant_company_id | select | facility_device_reps | implant_company_id | — | ❌ | **COLUMN DOES NOT EXIST** |

#### Domain 6: Settings

| Page | Form Field | Input Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------------|----------|-----------|---------|--------|------------|
| **Analytics Settings** | fcots_delay_threshold | number | facility_analytics_settings | fcots_delay_threshold_minutes | integer | ⚠️ | **parseFloat() || default — silent coercion** |
| | turnover_target | number | facility_analytics_settings | turnover_target_minutes | integer | ⚠️ | **parseFloat() || default** |
| | *(35 more thresholds)* | number | facility_analytics_settings | *(various)* | int/numeric | ⚠️ | **All unvalidated** |
| **Surgeon Prefs** | closing_handoff_min | number | users | closing_handoff_minutes | integer | ⚠️ | HTML number — **-999 or 99999 allowed** |
| **Closures** | closure_date | date | facility_closures | closure_date | date | ✅ | Inline ≥ today — **no UNIQUE** |
| | reason | text | facility_closures | reason | text | ✅ | None |
| **Holidays** | month | number | facility_holidays | month | integer | ⚠️ | Inline 1-12 — **no DB CHECK** |
| | day | number | facility_holidays | day | integer | ⚠️ | Inline 1-31 — **no DB CHECK** |

### Flagged Mismatches Summary

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | `start_time` uses `time without time zone` — loses TZ context | **HIGH** | CaseForm → cases.start_time |
| 2 | Device rep `implant_company_id` column does not exist | **CRITICAL** | `/api/create-device-rep` → facility_device_reps |
| 3 | Email fields (3 locations) have zero format validation | **CRITICAL** | User invite, device rep signup, facility invite |
| 4 | 37 analytics thresholds use `parseFloat() \|\| default` — silent coercion | **HIGH** | settings/analytics → facility_analytics_settings |
| 5 | `notes` field: Zod limits 1000 chars but DB TEXT has no limit | **MEDIUM** | CaseForm → cases.notes |
| 6 | `template_item.display_order` has no UNIQUE constraint | **HIGH** | Template builder → milestone_template_items |
| 7 | `financial_targets.month` has no CHECK (1-12) | **HIGH** | Financial targets → financial_targets.month |
| 8 | `or_hourly_rate` allows negative (no CHECK ≥ 0) | **CRITICAL** | Facility general → facilities.or_hourly_rate |
| 9 | `threshold_value_max` can be less than `threshold_value` | **MEDIUM** | Flag rules → flag_rules.threshold_value_max |
| 10 | `closing_handoff_minutes` allows -999 or 99999 | **MEDIUM** | Surgeon prefs → users.closing_handoff_minutes |
| 11 | `facility_closures` allows duplicate dates | **MEDIUM** | Closures page → facility_closures |
| 12 | Holiday month/day have no DB constraints | **MEDIUM** | Holidays → facility_holidays |
| 13 | `cancellation_notes` unlimited text | **LOW** | Case detail → cases.cancellation_notes |
| 14 | `display_order` allows negative values | **LOW** | Multiple settings pages |

---

## CHECK 2: Validation Layer Gaps

### Coverage Statistics

| Metric | Count |
|--------|-------|
| Total write operations audited | 245+ |
| Operations with Zod validation (Layer 1) | 5 |
| Operations with API route validation (Layer 2) | 0 |
| Operations with only DB constraints (Layer 3) | ~60 |
| Operations with ZERO validation at any layer | 18 |

### High-Risk Gaps (No Validation at ANY Layer)

| Write Operation | Field | Layer 1 | Layer 2 | Layer 3 | Risk |
|----------------|-------|---------|---------|---------|------|
| `facility_analytics_settings` upsert | fcots_delay_threshold | HTML min/max | ❌ | ❌ | **HIGH** — -9999 accepted |
| `financial_targets` insert | profit_target | HTML min | ❌ | ❌ | **HIGH** — negative targets |
| `flag_rules` update | threshold_value | HTML step | ❌ | ❌ | **HIGH** — percentile > 100 |
| `flag_rules` update | threshold_value_max | HTML only | ❌ | ❌ | **HIGH** — can be < min |
| `users` update (3 invite forms) | email | ❌ | ❌ | ❌ | **CRITICAL** — no format check |
| `surgeon_cost_items` insert | amount | HTML min | ❌ | ❌ (numeric) | **MEDIUM** — negative costs |
| `procedure_reimbursements` insert | reimbursement | HTML min | ❌ | ❌ | **MEDIUM** — $0 reimbursement |
| `facility_holidays` insert | month | inline 1-12 | ❌ | ❌ | **MEDIUM** — month 13 possible |
| `facility_holidays` insert | day | inline 1-31 | ❌ | ❌ | **MEDIUM** — day 32 possible |
| `delay_types` update | display_order | HTML number | ❌ | ❌ | **LOW** — negative |
| `cancellation_reasons` insert | display_name | inline .trim() | ❌ | ❌ | **LOW** — duplicates |
| `notification_settings` update | channels | ❌ | ❌ | ❌ | **MEDIUM** — invalid array |
| `device_rep_invites` insert | email | ❌ | ❌ | ❌ | **CRITICAL** — no format check |
| `surgeon_preferences` update | closing_handoff_min | HTML number | ❌ | ❌ | **MEDIUM** — 99999 possible |
| `facility_closures` insert | closure_date | inline past check | ❌ | ❌ | **MEDIUM** — duplicates |
| `case_flags` insert | (case_id, flag_rule_id) | none | ❌ | ❌ | **CRITICAL** — no UNIQUE, duplicates |
| `facilities` update | or_hourly_rate | inline isNaN | ❌ | numeric(10,2) | **CRITICAL** — negative rate corrupts profit |
| `preop_checklist_fields` insert | field_type | inline enum | ❌ | ❌ | **MEDIUM** — invalid type |

### Validation Chain by Domain

**Domain 1 — Cases (BEST VALIDATED):**
- CaseForm uses Zod schema (`lib/validation/schemas.ts`) ✅
- `create_case_with_milestones` RPC adds server-side validation ✅
- DB constraints: operative_side CHECK, case_number UNIQUE ✅
- **Gap:** `notes` field has client max (1000) but no DB limit

**Domain 2 — Milestones (MODERATE):**
- Inline .trim() checks on names ✅
- Required field lock mechanism for templates ✅
- **Gap:** Template item display_order has no UNIQUE constraint
- **Gap:** No server validation for drag-and-drop reorder operations

**Domain 3 — Financials (POOR):**
- HTML5 min/max attributes only
- **Gap:** No CHECK constraints on amounts, rates, or targets
- **Gap:** `parseFloat()` silent coercion on all threshold fields
- **Gap:** OR hourly rate can be negative — corrupts profit calculations

**Domain 4 — Flags (MODERATE):**
- Severity and operator have DB CHECK constraints ✅
- **Gap:** threshold_value allows percentile > 100
- **Gap:** threshold_value_max can be < threshold_value
- **Gap:** case_flags has no UNIQUE constraint → flag detection duplicates

**Domain 5 — Users (POOR):**
- No Zod validation on any invite form
- No email format validation at any layer
- **Gap:** `implant_company_id` column doesn't exist → insert silently fails
- **Gap:** access_level has no CHECK constraint

**Domain 6 — Settings (POOR):**
- 37 analytics thresholds use `parseFloat() || default`
- Most settings pages have inline-only validation
- **Gap:** Holiday month/day have no DB constraints
- **Gap:** 5 pages use hard delete instead of soft delete

### Exploitability Analysis

**Attack Vector 1 — Direct Supabase Client:**
```javascript
// Authenticated user bypasses UI from browser console
await supabase.from('facility_analytics_settings').update({
  fcots_delay_threshold_minutes: -999
}).eq('facility_id', 'my-facility-id')
// Result: Accepted — no CHECK constraint. Analytics calculations break.
```
Blocked by: RLS (facility scoping) ✅ | API validation ❌ | DB constraints ❌

**Attack Vector 2 — API Route Bypass:**
```javascript
fetch('/api/admin/invite', {
  method: 'POST',
  body: JSON.stringify({ email: 'notanemail', role_id: 'valid-uuid', access_level: 'super_admin' })
})
// Result: Invalid email + invalid access_level accepted
```
Blocked by: Client UI ❌ | API validation ❌ | DB constraints ⚠️ (FK only)

**Attack Vector 3 — Silent Coercion:**
```
User types "abc" in threshold field → parseFloat("abc") → NaN → NaN || 15 → 15
User thinks they disabled the check. DB saved default value 15. Misleading.
```
Blocked by: Nothing — this is current behavior.

---

## CHECK 3: Lookup Table Consistency

### Dropdown Audit — Master Table

| Page | Dropdown | Source | Facility Filtered? | Active Filtered? | Issue |
|------|----------|--------|-------------------|-----------------|-------|
| **CaseForm** | Surgeons | Direct query | ✅ | ❌ **MISSING** | Archived surgeons appear |
| **CaseForm** | OR Rooms | Direct query | ✅ | ❌ **MISSING** | Archived rooms appear |
| **CaseForm** | Implant Companies | Direct query | ✅ (or null) | ❌ **MISSING** | Archived companies appear |
| **CaseForm** | Procedure Types | DAL lookups | ✅ | ✅ | OK |
| **CaseForm** | Payers | Direct query | ✅ (or null) | ✅ deleted_at | OK |
| **CaseForm** | Status | DAL lookups | ✅ | ✅ | OK |
| **StaffMultiSelect** | Staff by Role | Direct query | ✅ | ✅ is_active | OK |
| **Settings/Complexities** | Procedure Categories | Direct query | N/A | ❌ **MISSING** | Archived categories appear |
| **Settings/Device Reps** | Implant Companies | Direct query | ✅ | ❌ **MISSING** | Archived companies appear |
| **Settings/Surgeon Prefs** | Implant Companies | Direct query | ✅ | ❌ **MISSING** | Archived companies appear |
| **Settings/General** | Users | Direct query | ✅ | ✅ is_active | OK (inconsistent with rooms) |
| **Settings/General** | Rooms | Direct query | ✅ | ✅ deleted_at | OK (inconsistent with users) |
| **Analytics Filters** | Surgeons | DAL | ✅ | ✅ | OK |
| **Analytics Filters** | Procedures | DAL | ✅ | ✅ | OK |
| **Template Builder** | Milestones | DAL | ✅ | ✅ | OK |
| **Template Builder** | Phases | DAL | ✅ | ✅ | OK |

### DAL vs. Direct Query Usage

| Pattern | Count | Issue |
|---------|-------|-------|
| Uses DAL (lib/dal/lookups.ts) | ~60% of pages | Properly filtered |
| Direct Supabase query | ~40% of pages | **Often missing filters** |
| DAL bug: implantCompanies() | 1 function | Missing `deleted_at IS NULL` |

**Root cause:** No enforcement mechanism. Pages that bypass the DAL often omit filters.

### Hardcoded Arrays That Should Be DB-Driven

| Array | Location | Values | Recommendation |
|-------|----------|--------|----------------|
| `OPERATIVE_SIDE_OPTIONS` | CaseForm.tsx:81-86 | left, right, bilateral, n/a | Low priority — matches DB CHECK, stable enum |
| `ROLE_SECTIONS` | StaffMultiSelect.tsx:30-34 | nurse, tech, anesthesiologist | Medium — `user_roles` table exists but UI groups hardcoded |
| Cancellation categories | Multiple settings pages | patient, scheduling, clinical, external | Medium — could grow |
| Implant categories | Multiple pages | hip, knee, shoulder, spine | Medium — could grow |
| Cost category types | Financial settings | credit, debit | Low — binary, unlikely to change |
| Flag rule categories | Flag settings | timing, efficiency, financial, quality | Medium — new metrics could add categories |

### Soft-Delete Handling Issues

**Correct pattern (creation → exclude archived, display → include archived):**
- Case detail page: Shows surgeon even if now inactive ✅
- Analytics: Includes cases with archived procedures ✅
- DAL `listSurgeons()`: Filters `is_active = true` for dropdowns ✅

**Incorrect patterns found:**
- CaseForm bypasses DAL → shows archived surgeons in creation dropdown ❌
- Edit forms sometimes show archived options (should show currently-assigned + active only)
- Case duplication uses same queries as creation → copies archived surgeon IDs ❌

**Soft-delete column inconsistency:**
- Some tables use `is_active` boolean (users, payers, procedure_types, milestones, flag_rules)
- Some tables use `deleted_at` timestamp (or_rooms, implant_companies, cost_categories)
- Some tables use both
- **No universal pattern** — causes developer confusion

---

## CHECK 4: Referential Integrity at the UI Level

### Entity-by-Entity Analysis

| Entity | Can Archive? | UI Warning? | DB Cascade Behavior | Orphan Risk | Severity |
|--------|-------------|-------------|---------------------|-------------|----------|
| **Surgeon** | Yes (soft) | ❌ No | cases: NO ACTION | Cases keep FK to archived surgeon | **HIGH** |
| **Procedure Type** | Yes (soft) | ❌ No | cases: NO ACTION | Cases + pricing orphaned | **MEDIUM** |
| **OR Room** | Yes (soft) | ✅ Yes (count) | cases: NO ACTION, stats: SET NULL | Handled correctly — best practice | **LOW** |
| **Milestone** | Yes (soft) | ⚠️ Count only | case_milestones: NO ACTION, template_items: CASCADE | Templates lose items! | **MEDIUM** |
| **Cost Category** | Yes (soft) | ✅ Cascade dialog | procedure_cost_items: CASCADE | Pricing deleted if hard-delete | **MEDIUM** |
| **Template** | Yes (soft) | ❌ No | cases: SET NULL, overrides/items: CASCADE | Cases lose template link | **MEDIUM** |
| **Phase** | N/A | N/A | SET NULL on items | Config-only | **LOW** |
| **Facility** | **HARD DELETE** | ✅ Type-to-confirm | **30+ tables CASCADE** | **Total data destruction** | **CRITICAL** |

### Detailed Entity Analysis

#### A. Surgeon Archive
- **UI:** `settings/users/page.tsx:391-419` — sets `is_active = false`
- **Warning:** 2-click confirmation, but **no dependency count shown**
- **DB:** `cases.surgeon_id → users.id` has NO ON DELETE clause (defaults to NO ACTION)
- **Impact:** Cases keep reference. Analytics queries may not filter `is_active = true`.
- **Fix needed:** Add warning: "This surgeon has X active cases and Y historical cases"

#### B. Procedure Type Archive
- **UI:** `settings/procedures/page.tsx` — soft delete
- **Warning:** None
- **DB:** `cases.procedure_type_id → procedure_types.id` NO ON DELETE (NO ACTION)
- **Impact:** Historical cases and pricing data remain but reference archived entity
- **Fix needed:** Add dependency count warning

#### C. OR Room Archive (BEST PRACTICE)
- **UI:** `settings/rooms/page.tsx:616-649` — soft delete
- **Warning:** Shows count of dependent cases AND block schedules ✅
- **DB:** `cases.or_room_id → or_rooms.id` NO ACTION, `case_completion_stats.or_room_id → SET NULL`
- **Impact:** Well-handled — archive message: "Existing data will be preserved"

#### D. Milestone Archive
- **UI:** `settings/milestones/page.tsx` — soft delete
- **Warning:** Shows usage count but does NOT block
- **DB:** `milestone_template_items.facility_milestone_id → ON DELETE CASCADE`
- **Impact:** **Templates lose items when milestone archived!** This is wrong — should use soft delete or SET NULL.
- **Fix needed:** Change FK to ON DELETE SET NULL or add is_active to template items

#### E. Cost Category Archive
- **UI:** `settings/financials/cost-categories/page.tsx` — soft delete with cascade dialog
- **Warning:** ✅ Cascade confirmation dialog (per memory)
- **DB:** `procedure_cost_items.cost_category_id → ON DELETE CASCADE`
- **Impact:** Pricing deleted if hard-delete occurs. Soft delete (current) is correct.
- **Known bug:** Cascade assumes template ID = facility category ID (Domain 3 audit)

#### F. Facility Delete — **CRITICAL**
- **UI:** `components/modals/DeleteFacilityModal.tsx` — **HARD DELETE**
- **Warning:** Type-to-confirm with explicit message about data destruction
- **DB:** 30+ tables CASCADE on `facility_id`
- **Impact:** ALL cases, milestones, analytics, financial data, users, rooms, templates = GONE
- **Fix needed:** Soft delete for facilities, block hard delete in production, only allow for `is_demo = true`

#### G. Template Archive
- **UI:** `settings/milestones/page.tsx` — soft delete
- **Warning:** None
- **DB:** `cases.milestone_template_id → SET NULL`, `surgeon_template_overrides → CASCADE`, `template_items → CASCADE`
- **Impact:** Historical cases lose template link. Surgeon overrides and items cascade-deleted.
- **Fix needed:** Add warning: "X cases reference this template"

### Hard Delete Violations (Should Be Soft Delete)

| Page | Table | Operation | Risk |
|------|-------|-----------|------|
| `admin/settings/procedures/page.tsx` | procedure_type_templates | `.delete()` | Data loss |
| `admin/settings/delay-types/page.tsx` | delay_types | `.delete()` | Data loss |
| `settings/surgeon-preferences/page.tsx` | surgeon_preferences | `.delete()` | Data loss |
| `settings/closures/page.tsx` | facility_closures | `.delete()` | Data loss |
| `admin/complexities/page.tsx` | complexity_templates | `.delete()` | Data loss |

### FK Cascade Gaps

| FK Relationship | Current Behavior | Expected | Gap |
|----------------|-----------------|----------|-----|
| cases.surgeon_id → users.id | NO ACTION | Should warn on archive | No UI warning |
| cases.procedure_type_id → procedure_types.id | NO ACTION | Should warn | No UI warning |
| milestone_template_items.milestone_id → facility_milestones.id | CASCADE | Should be SET NULL | Items destroyed on archive |
| case_flags.flag_rule_id → flag_rules.id | SET NULL | OK, but no cleanup | Orphaned flags without rule context |
| cases.milestone_template_id → milestone_templates.id | SET NULL | OK, but should warn | Silent template unlink |

---

## CHECK 5: Concurrent Edit Safety

### Auto-Save Pages Identified

| Page | What's Saved | Mechanism | Locking? | Race Risk |
|------|-------------|-----------|----------|-----------|
| `settings/flags` | Threshold values | 500ms debounce | ❌ None | **HIGH** — two admins editing same rule |
| `settings/notifications` | Toggle states | Immediate onChange | ❌ None | **MEDIUM** — toggle conflicts |
| `admin/permission-templates` | Permission toggles | Immediate onChange | ❌ None | **MEDIUM** — cross-facility conflicts |
| Case detail ImplantSection | Device data | 1000ms debounce | ❌ None | **LOW** — rare same-field edit |

### Case Milestone Recording (The Good Example)

The milestone recording system is the **only robust concurrent edit implementation**:

- **Unique constraint:** `UNIQUE(case_id, facility_milestone_id)` prevents duplicate DB records ✅
- **Real-time subscription:** `useMilestoneRealtime.ts` pushes changes to all connected devices ✅
- **Conflict resolution:** `mergeInsert()` keeps earliest `recorded_at` timestamp ✅
- **Pattern:** This should be replicated across other collaborative data entry points

### Template Builder — CRITICAL Corruption Risk

Both `useTemplateBuilder.ts` (899 lines) and `useAdminTemplateBuilder.ts` (874 lines) use a **delete-all-then-insert** save pattern:

```
Save flow: DELETE WHERE template_id = X → INSERT all items fresh
```

**Race condition scenario:**
1. Admin A opens template, sees items [1, 2, 3]
2. Admin B opens same template, sees items [1, 2, 3]
3. Admin A adds item 4, saves → DELETE all → INSERT [1, 2, 3, 4]
4. Admin B removes item 2, saves → DELETE all → INSERT [1, 3]
5. Result: Items [1, 3] — Admin A's item 4 is lost with no warning

**Severity:** CRITICAL — high likelihood during facility setup when multiple admins configure templates.

### Optimistic Locking Analysis

| Aspect | Status |
|--------|--------|
| Tables with `updated_at` column | 20+ |
| Tables with auto-update trigger | 20+ (via `sync_soft_delete_columns()`) |
| Application reads `updated_at` before write | **NEVER — 0 instances** |
| `WHERE updated_at = ?` in UPDATE statements | **0 instances** |
| Realtime subscriptions for change detection | 2 only (milestones, dashboard flip room) |

**Conclusion:** `updated_at` columns exist everywhere but are **never used for conflict detection**. The infrastructure is in place but unused.

### Other Concurrent Edit Scenarios

| Scenario | Locking? | Worst Case | Likelihood |
|----------|----------|------------|------------|
| Two admins editing same template | ❌ | Data loss (delete-then-insert) | **HIGH** during setup |
| Two admins editing same flag rule | ❌ | Last write wins | Medium |
| Two admins editing same pricing | ❌ | Last write wins | Medium |
| Two admins editing same user role | ❌ | Last write wins | Low |
| Two users editing same case | ❌ | Last write wins (explicit save) | Low |
| Two users recording same milestone | ✅ | Earliest timestamp wins | N/A — handled |

### Missing Realtime Sync

Only 2 components use Supabase Realtime subscriptions:
1. `useMilestoneRealtime.ts` — case milestones
2. `useFlipRoom.ts` — dashboard case updates

**Missing realtime for:**
- case_flags (two users reviewing same case)
- case_staff (two users assigning staff)
- case implants (two users entering device data)
- All settings pages (any shared configuration)

---

## Consolidated Recommendations

### P0 — Critical / Production Blockers

| # | Issue | Check | Fix |
|---|-------|-------|-----|
| 1 | Facility hard delete cascades 30+ tables | CHECK 4 | Add soft delete for facilities; block hard delete in production |
| 2 | Template builder delete-all-then-insert corruption | CHECK 5 | Add optimistic locking (version field or `updated_at` check) |
| 3 | Zero API route validation | CHECK 2 | Add Zod schemas to all `/api/` routes |
| 4 | Email fields (3 places) have no format validation | CHECK 1, 2 | Extend `schemas.ts` with invite/signup schemas |
| 5 | Device rep `implant_company_id` column doesn't exist | CHECK 1 | Fix column reference or add migration |
| 6 | OR hourly rate allows negative — corrupts profit calc | CHECK 2 | Add `CHECK (or_hourly_rate >= 0)` constraint |
| 7 | case_flags has no UNIQUE constraint → duplicates | CHECK 2 | Add `UNIQUE(case_id, flag_rule_id) WHERE flag_rule_id IS NOT NULL` |
| 8 | CaseForm shows archived surgeons/rooms/companies | CHECK 3 | Add `is_active`/`deleted_at` filters to 3 dropdown queries |

### P1 — High Priority

| # | Issue | Check | Fix |
|---|-------|-------|-----|
| 9 | 37 analytics thresholds use silent `parseFloat() \|\| default` | CHECK 2 | Replace with explicit validation + error feedback |
| 10 | `start_time` loses timezone (time without tz) | CHECK 1 | Migrate to timestamptz or document intentional UTC assumption |
| 11 | Surgeon archive has no dependency warning | CHECK 4 | Add case count warning (follow OR room example) |
| 12 | Milestone archive CASCADE-deletes template items | CHECK 4 | Change FK to `ON DELETE SET NULL` |
| 13 | `financial_targets.month` has no CHECK (1-12) | CHECK 2 | Add DB constraint |
| 14 | `flag_rules.threshold_value` allows percentile > 100 | CHECK 2 | Add conditional CHECK constraint |
| 15 | `threshold_value_max` can be < `threshold_value` | CHECK 2 | Add CHECK `value_max >= value` |
| 16 | Template item `display_order` has no UNIQUE constraint | CHECK 1 | Add UNIQUE on `(template_id, display_order)` |
| 17 | Auto-save settings pages have no conflict detection | CHECK 5 | Implement `updated_at` checks in DAL write functions |
| 18 | DAL `implantCompanies()` missing `deleted_at` filter | CHECK 3 | Add `.is('deleted_at', null)` |
| 19 | 5 pages use hard delete instead of soft delete | CHECK 4 | Convert to `is_active = false` pattern |
| 20 | Holiday month/day have no DB constraints | CHECK 2 | Add CHECK constraints |

### P2 — Medium Priority

| # | Issue | Check | Fix |
|---|-------|-------|-----|
| 21 | `notes`/`cancellation_notes` unlimited in DB | CHECK 1 | Add `CHECK (length(notes) <= 1000)` |
| 22 | Procedure archive has no dependency warning | CHECK 4 | Add case count + pricing count warning |
| 23 | Template archive has no dependency warning | CHECK 4 | Add case count warning |
| 24 | 6 hardcoded arrays should be DB-driven | CHECK 3 | Create reference tables for growing enums |
| 25 | Soft-delete pattern inconsistency (is_active vs deleted_at) | CHECK 3 | Standardize to one pattern |
| 26 | ~40% of pages bypass DAL with direct queries | CHECK 3 | Create lint rule or shared dropdown hook |
| 27 | No realtime sync for case_flags, case_staff | CHECK 5 | Copy `useMilestoneRealtime` pattern |
| 28 | `facility_closures` allows duplicate dates | CHECK 2 | Add UNIQUE on `(facility_id, closure_date)` |
| 29 | Flag rule orphans (SET NULL but no cleanup) | CHECK 4 | Add `flag_rule_snapshot` JSONB column |
| 30 | `surgeon_handoff_minutes` allows -999 or 99999 | CHECK 2 | Add CHECK `BETWEEN 0 AND 120` |

### P3 — Low Priority / Polish

| # | Issue | Check | Fix |
|---|-------|-------|-----|
| 31 | `display_order` allows negative values | CHECK 1 | Add CHECK `>= 0` |
| 32 | Add staleness indicators to forms | CHECK 5 | "Last modified by X, Y minutes ago" |
| 33 | 8 forms have no audit logging | CHECK 2 | Add audit trail for settings changes |
| 34 | Add presence tracking for shared editing | CHECK 5 | "User X is editing this" |
| 35 | Standardize HTML5 validation attributes | CHECK 2 | Consistent min/max/step/pattern |
| 36 | Create `useDropdownData` hook with auto-filtering | CHECK 3 | Centralize dropdown data fetching |
| 37 | Add integration tests for validation bypass | CHECK 2 | Call Supabase directly in tests |

---

## Migration Suggestions

### DB Constraints to Add (single migration)

```sql
-- P0: Financial integrity
ALTER TABLE facilities ADD CONSTRAINT or_hourly_rate_non_negative
  CHECK (or_hourly_rate >= 0);

-- P0: Flag uniqueness
CREATE UNIQUE INDEX idx_case_flags_unique_rule
  ON case_flags(case_id, flag_rule_id)
  WHERE flag_rule_id IS NOT NULL;

-- P1: Bounded fields
ALTER TABLE financial_targets ADD CONSTRAINT month_range
  CHECK (month BETWEEN 1 AND 12);

ALTER TABLE facility_holidays ADD CONSTRAINT holiday_month_range
  CHECK (month BETWEEN 1 AND 12);

ALTER TABLE facility_holidays ADD CONSTRAINT holiday_day_range
  CHECK (day BETWEEN 1 AND 31);

ALTER TABLE flag_rules ADD CONSTRAINT threshold_max_gte_min
  CHECK (threshold_value_max IS NULL OR threshold_value_max >= threshold_value);

ALTER TABLE flag_rules ADD CONSTRAINT percentile_range
  CHECK (threshold_type != 'percentile' OR (threshold_value >= 0 AND threshold_value <= 100));

-- P1: Template item ordering
CREATE UNIQUE INDEX idx_template_items_order
  ON milestone_template_items(template_id, display_order);

-- P1: Closure uniqueness
CREATE UNIQUE INDEX idx_facility_closures_unique_date
  ON facility_closures(facility_id, closure_date);

-- P2: Text length limits
ALTER TABLE cases ADD CONSTRAINT notes_max_length
  CHECK (notes IS NULL OR length(notes) <= 2000);

-- P2: Surgeon handoff bounds
ALTER TABLE users ADD CONSTRAINT handoff_minutes_range
  CHECK (closing_handoff_minutes IS NULL OR closing_handoff_minutes BETWEEN 0 AND 120);

-- P1: Financial amounts non-negative
ALTER TABLE procedure_reimbursements ADD CONSTRAINT reimbursement_positive
  CHECK (reimbursement >= 0);

ALTER TABLE procedure_cost_items ADD CONSTRAINT amount_non_negative
  CHECK (amount >= 0);

ALTER TABLE surgeon_cost_items ADD CONSTRAINT surgeon_amount_non_negative
  CHECK (amount >= 0);
```

### FK Changes (separate migration, requires careful testing)

```sql
-- Change milestone_template_items FK from CASCADE to SET NULL
ALTER TABLE milestone_template_items
  DROP CONSTRAINT milestone_template_items_facility_milestone_id_fkey,
  ADD CONSTRAINT milestone_template_items_facility_milestone_id_fkey
    FOREIGN KEY (facility_milestone_id) REFERENCES facility_milestones(id)
    ON DELETE SET NULL;
```

---

## Cross-References to Domain Audits

| Finding | Domain Source | Cross-Cutting Check |
|---------|-------------|-------------------|
| CaseForm start_time timezone loss | Domain 1 | CHECK 1 |
| Device rep implant_company_id bug | Domain 5 | CHECK 1 |
| Email validation missing (3 places) | Domain 5 | CHECK 1, 2 |
| Analytics silent parseFloat coercion | Domain 6 | CHECK 1, 2 |
| Facility hard delete CASCADE | Domain 6 | CHECK 4 |
| case_flags no UNIQUE constraint | Domain 4 | CHECK 2 |
| 5 pages hard delete instead of soft | Domain 6 | CHECK 4 |
| No session revocation on user deactivation | Domain 5 | CHECK 5 |
| Cost category cascade ID mismatch bug | Domain 3, 6 | CHECK 4 |
| Settings pages no audit logging (8 pages) | Domain 6 | CHECK 2 |
| Flag rule orphaned flags after archive | Domain 4 | CHECK 4 |
| Missing is_active filter in multiple queries | Domain 1, 6 | CHECK 3 |
