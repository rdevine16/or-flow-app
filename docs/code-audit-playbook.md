# ORbit Complete Code Audit — Claude Code Playbook

**How to use this document:**

1. Drop this entire file into your project root as `docs/code-audit-playbook.md`
2. Start a Claude Code session
3. Run the prompts **in order** — each one is a separate session
4. After each session, Claude Code outputs a findings report — save it
5. The final prompt synthesizes everything into a prioritized fix plan

**Important:** Each prompt is designed for one Claude Code session. Don't combine them — you'll burn context. Run one, save the output, start fresh, run the next.

**Agent strategy:** For Domains 1–6, tell Claude Code to use **explorer agents** in parallel where noted. The main session coordinates; agents do the file reading.

---

## Pre-Audit Setup (Run First)

Give Claude Code this before anything else:

```
Read docs/code-audit-playbook.md — this is our audit plan.
Also read CLAUDE.md and docs/architecture.md to understand the system.

For this audit work:
- Do NOT make any code changes. Read-only.
- Output findings as markdown files in docs/audit-findings/
- Create that directory if it doesn't exist.
- Be specific: file paths, line numbers, exact column/field names.
- If you're unsure about something, say so — don't guess.
```

---

## PHASE 1: Page-by-Page Data Lifecycle Audits (Domains 1–6)

Each domain traces data from UI entry → database storage → downstream display. For every page in the domain, Claude Code reads the actual file and documents what it finds.

---

### Domain 1: Case Lifecycle

**Why first:** Cases are the core entity. Everything else depends on them.

```
AUDIT DOMAIN 1: Complete Case Lifecycle — UI to DB and back.
Save findings to docs/audit-findings/domain-1-cases.md

You are auditing the full data lifecycle for surgical cases. Trace every
page that touches case data, what fields are collected, how they're
stored, and how they're displayed downstream.

## METHOD
For each page below, READ the actual source file and document:
1. What data does this page DISPLAY? (list every field shown to the user)
2. Where does that data come FROM? (which table, column, hook, query)
3. What data does this page WRITE? (every insert, update, delete, RPC)
4. Where does that data GO next? (triggers, stats pipeline, other pages that read it)
5. What VALIDATION exists? (Zod schema, form-level check, DB constraint, or nothing)
6. What's MISSING? (fields with no validation, DB columns with no UI, UI fields
   with no DB column, form fields that don't match DB types)

## PAGES TO TRACE

### A. Case Creation
Find the case creation flow — likely in app/cases/ or a CaseForm component.
- List every form field collected from the user
- Compare EVERY form field against the `cases` table columns in the baseline migration
- Are there `cases` table columns that have no UI input? List them and note whether
  they SHOULD have UI input or are correctly system-generated
- What happens on form submit? Trace the exact Supabase insert call
- What triggers fire on INSERT? Cross-reference with the baseline migration
  (architecture.md says 8 triggers on cases — verify you can find all 8)
- Are case_milestones auto-created? Find the trigger or function that does this
- Does procedure_milestone_config get consulted? Trace exactly how milestone rows
  are determined for a new case
- What status is the case created with? Where do statuses come from?

### B. Case Detail Page: app/cases/[id]/page.tsx
- This is a 1,685-line file. What data is fetched on load? List every Supabase query
- What can be EDITED from this page? List every editable field
- Milestone recording flow: What happens when a user records a milestone?
  Trace: UI interaction → component → Supabase update → any triggers →
  does case_completion_stats get updated?
- What is the data_validated flow? When does it flip to true?
  What triggers record_case_stats()? What are the preconditions?
- Surgeon left_at tracking: How is this recorded? Is it editable?
- Case flags: How are they displayed? Can they be dismissed? What happens in the DB?
- Delays: How are delays added? What table do they write to?
- What real-time subscriptions exist on this page?

### C. Cases List Page: app/cases/page.tsx
- What query populates the table?
- What columns are shown?
- Are filters applied correctly? (facility_id, date range, status, surgeon)
- Does the list read from `cases` directly or from a joined/denormalized source?
- Pagination: is it offset-based or cursor-based? Is it efficient for large datasets?
- Search: how does case search work? Full text? LIKE? Client-side filter?
- Bulk operations: does this page support any?

### D. Case Cancellation: app/cases/[id]/cancel/ (if it exists)
- What data is collected for cancellation?
- What DB updates happen?
- Is the case soft-deleted or status-changed?
- Are related records (milestones, flags, stats) handled?

### E. Bulk Case Creation: app/cases/bulk-create/ (if it exists)
- How does this differ from single case creation?
- Same validation? Same trigger chain?

### F. Completed Case View: components/cases/CompletedCaseView.tsx
- What additional data appears for completed cases?
- Is this reading from cases or case_completion_stats?
- Financial data: where does it come from on this view?

### G. Downstream Consumers — trace where case data flows TO:
Read these pages and document which case fields they display and which
tables they query:
- app/analytics/page.tsx
- app/analytics/surgeons/page.tsx
- app/analytics/kpi/page.tsx
- app/data-quality/ pages
- app/dashboard/page.tsx
- components/dashboard/ components (RoomGridView, CaseListView, etc.)
- app/checkin/page.tsx

For each: Does the query match what record_case_stats() actually writes?
Are there any fields displayed that could be stale or missing?

## DB ARCHITECTURE REVIEW FOR THIS DOMAIN
For every table involved (cases, case_milestones, case_completion_stats,
case_delays, case_flags, case_staff, case_complexities, case_implants,
case_device_activity, case_device_companies, case_statuses):

1. Are column types appropriate?
   - Is scheduled_start_time a timestamptz? Is case_date a date?
   - Are financial columns numeric(10,2) or float? (float = rounding bugs)
   - Are duration columns integer (minutes) or interval?
2. Are there missing NOT NULL constraints on fields the UI treats as required?
3. Are there missing foreign keys?
4. Are there DB columns never written by any UI page? (potential dead columns)
5. Is the soft-delete pattern correctly applied?
6. For case_completion_stats: do all 41 columns match what the UI actually displays?
   Are any columns written but never read anywhere?

## OUTPUT FORMAT
Structure your findings file as:

# Domain 1: Case Lifecycle Audit

## Page: [name]
**File:** path/to/file.tsx
**Lines:** X
**Displays:** field (source: table.column), ...
**Writes:** table.column = formField (validation: zod|inline|constraint|none)
**Triggers fired:** trigger_name → effect
**Downstream:** pages/views that consume this data
**Real-time:** subscriptions active (yes/no, channel name)

### Issues Found
- 🔴 CRITICAL: [description with file:line reference]
- 🟡 HIGH: [description]
- 🟠 MEDIUM: [description]
- 🟢 LOW: [description]

## DB Architecture Issues
- [table.column]: [issue description]
```

---

### Domain 2: Milestone & Phase System

**Why second:** Milestones drive the entire case workflow and stats pipeline. The dual-ID migration (milestone_type_id → facility_milestone_id) is the biggest recent architectural change and the most likely source of bugs.

```
AUDIT DOMAIN 2: Milestone & Phase System — Configuration to Recording to Analytics.
Save findings to docs/audit-findings/domain-2-milestones.md

Trace the entire milestone system from template configuration through
case recording to analytics consumption.

## PAGES TO TRACE

### A. Admin Milestone Configuration
Read: app/admin/settings/milestones/page.tsx (1,002 lines — document structure)
Read: components/settings/milestones/TemplateBuilder.tsx
Read: hooks/useAdminTemplateBuilder.ts
Read: components/settings/milestones/AdminPhaseLibrary.tsx
Read: components/settings/milestones/AdminProcedureTypeAssignment.tsx

Trace the admin flow:
- How are global milestone_types created/edited?
- How are phase_definitions managed?
- How are milestone templates assigned to procedure types?
- What tables are written? (milestone_types, milestone_template_type_items,
  procedure_type_templates, phase_definitions)
- What happens when a milestone_type is archived? Does it cascade?
- What validation exists on milestone ordering/sequencing?

### B. Facility Milestone Configuration
Read: app/settings/milestones/page.tsx
Read: hooks/useTemplateBuilder.ts
Read: components/settings/milestones/PhaseLibrary.tsx
Read: components/settings/milestones/ProcedureTemplateAssignment.tsx
Read: components/settings/milestones/SurgeonOverridePanel.tsx

Trace the facility-level flow:
- How do global templates become facility_milestones?
- What is the copy/seed mechanism?
- Can a facility admin create milestones that don't exist globally?
- How does procedure_milestone_config get populated?
- How do surgeon overrides work? (surgeon_milestone_config table)
- What happens when a facility deactivates a milestone?
  Does it affect in-progress cases?

### C. Critical Path: milestone_type_id → facility_milestone_id Migration
CLAUDE.md says milestone_type_id was DROPPED from case_milestones.
VERIFY this is true by:
1. Reading the relevant migration files
2. Checking that NO code still references case_milestones.milestone_type_id
3. Checking that ALL joins go case_milestones → facility_milestones
   → milestone_types (via source_milestone_type_id)
4. Search the ENTIRE codebase for "milestone_type_id" and flag any references
   that might be using the old column

### D. Case Milestone Recording (already partially in Domain 1, go deeper)
Read: lib/hooks/useMilestoneRealtime.ts
Read: components/cases/MilestoneCard.tsx
Read: components/cases/MilestoneButton.tsx
Read: components/cases/MilestoneTable.tsx
Read: components/cases/MilestoneTimelineV2.tsx

- What happens when recorded_at is set on a case_milestone?
- Is sequence_number enforced? Can milestones be recorded out of order?
- What UI feedback exists for out-of-order recording?
- Does the real-time subscription handle updates from other users
  (e.g., two nurses recording milestones simultaneously)?

### E. Milestone Analytics
Read: lib/hooks/useMilestoneComparison.ts
Read: lib/milestone-phase-config.ts
Read: lib/milestone-order.ts
Read: lib/pace-utils.ts
Read: lib/dal/phase-resolver.ts
Read: relevant RPC functions (get_milestone_interval_medians, get_phase_medians)

- How are milestone medians calculated?
- Do the analytics queries correctly use facility_milestone_id (not milestone_type_id)?
- How does the phase system group milestones for display?
- Are phase durations computed correctly?

### F. Milestone Data Quality
Read: lib/dataQuality.ts
Read: lib/stale-case-detection.ts
Read: components/data-quality/ components

- What milestone issues does data quality detect?
- How are "stale" cases (missing milestones) identified?
- Is the detection logic aligned with how milestones are actually recorded?

## DB ARCHITECTURE REVIEW
Tables: milestone_types, facility_milestones, procedure_milestone_config,
case_milestones, case_milestone_stats, phase_definitions, facility_phases,
milestone_template_type_items, procedure_type_templates,
surgeon_milestone_config

For each:
- Is the FK chain correct? (no dangling references)
- Are soft deletes handled at every level?
- Are there orphan risks? (e.g., deleting a facility_milestone that has
  case_milestones referencing it)
- Is sequence_number unique per case or globally? Should it be?
- Are there indexes supporting the common query patterns?

## SPECIFIC QUESTIONS TO ANSWER
1. If I create a new milestone type globally, does it automatically appear
   in existing facilities? Or only new ones? Trace the code path.
2. If I archive a facility_milestone, what happens to:
   - Future cases? (should it stop appearing)
   - In-progress cases? (should existing rows remain)
   - Historical analytics? (should still show in past data)
3. Is there any scenario where case_milestones could reference a
   facility_milestone_id that no longer exists?
```

---

### Domain 3: Financial Data Flow

```
AUDIT DOMAIN 3: Financial Data — Pricing Setup to Case Costs to Analytics.
Save findings to docs/audit-findings/domain-3-financials.md

Trace how money flows through the system: from configuration to per-case
recording to analytics and reporting.

## PAGES TO TRACE

### A. Financial Configuration
Read: app/settings/financials/page.tsx (overview/landing)
Read: app/settings/financials/procedure-pricing/page.tsx
Read: app/settings/financials/cost-categories/page.tsx
Read: app/settings/financials/payers/page.tsx
Read: app/settings/financials/surgeon-variance/page.tsx
Read: app/settings/financials/targets/page.tsx (if exists)

For each:
- What tables are written? (procedure_reimbursements, procedure_cost_items,
  cost_categories, payers, etc.)
- How is pricing structured? Per-procedure? Per-payer? Per-surgeon?
- What happens when pricing changes? Does it affect historical cases?
- Is there versioning of pricing data or just overwrites?

### B. Case-Level Financial Data Entry
Read: components/cases/CaseForm.tsx — find the financial fields
Read: components/cases/CompletedCaseView.tsx — financial editing

- What financial fields are entered per case?
- Are costs auto-calculated from procedure pricing, or manually entered?
- What is `cost_source`? How does it get set?
- Trace: How does the case get its reimbursement amount? Its cost amounts?
- Are financial fields editable after case completion?

### C. Stats Pipeline — Financial Columns
Read: The record_case_stats trigger/function in migrations
Read: lib/financials.ts

- Which of the 11 financial columns in case_completion_stats are:
  - Pulled from configuration tables (procedure pricing)?
  - Pulled from per-case input?
  - Calculated by the trigger?
- Is the profit calculation correct? (revenue - costs)
- Is or_hourly_rate calculated correctly? (financial / duration)
- What happens if financial data is missing? Are columns NULL or 0?

### D. Financial Analytics Display
Read: app/analytics/financials/ (all pages)
Read: components/analytics/financials/SurgeonDetail.tsx (1,305 lines)
Read: components/analytics/financials/ProcedureDetail.tsx (1,197 lines)
Read: components/analytics/financials/WaterfallChart.tsx
Read: lib/utils/financialAnalytics.ts

- What financial metrics are displayed?
- Are they reading from case_completion_stats or recalculating?
- Do the calculations match what the trigger produces?
- Are median vs. average calculations used correctly?
- Are there any rounding issues? (floating point vs decimal)

### E. ORbit Score — Profitability Pillar
Read: lib/orbitScoreEngine.ts — specifically the profitability section

- How does the Profitability pillar calculate margin per minute?
- Is it reading from case_completion_stats.profit and
  case_completion_stats.surgical_duration_minutes?
- What happens for cases with $0 financial data?

## DB ARCHITECTURE REVIEW
Tables: procedure_reimbursements, procedure_cost_items, cost_categories,
payers, case_completion_stats (financial columns), facility_analytics_settings

- Are financial columns using appropriate precision? (numeric(10,2) not float)
- Is there an audit trail for pricing changes?
- Can pricing be set retroactively and affect already-validated cases?
- Are there any financial columns in case_completion_stats that no UI
  page ever writes to or reads from?
```

---

### Domain 4: Flag & Data Quality System

```
AUDIT DOMAIN 4: Flag System & Data Quality — Rules to Detection to Display.
Save findings to docs/audit-findings/domain-4-flags-quality.md

Trace the flag system from rule configuration through detection to
analytics display, plus the data quality detection pipeline.

## PAGES TO TRACE

### A. Flag Rule Configuration
Read: app/settings/flags/page.tsx
Read: app/admin/settings/flag-rules/page.tsx
Read: components/settings/flags/ (all components)
Read: lib/dal/flag-rules.ts

- How are flag rules configured per facility?
- How do admin template rules become facility rules?
- What fields define a rule? (metric, operator, threshold, severity, scope)
- What validation exists on rule thresholds?
- What happens when a rule is deactivated? Do existing flags remain?

### B. Flag Detection Engine
Read: lib/flagEngine.ts (full file)
Read: lib/flag-detection.ts
Read: lib/flagPatternDetection.ts

- When does flag detection run? (on case save? on validation? on schedule?)
- What data does it need to evaluate a case?
- Does it read from `cases` or `case_completion_stats`?
- What writes to the `case_flags` table?
- Is detection idempotent? (running twice on the same case = same flags?)
- Are false positives possible based on the detection logic?

### C. Flag Display
Read: app/analytics/flags/page.tsx
Read: components/analytics/flags/ (all components)
Read: Case detail page — flag section

- How are flags displayed on individual cases?
- How are flags aggregated in analytics?
- Can flags be manually dismissed? What happens in the DB?
- Do dismissed flags still count in analytics?

### D. Data Quality Detection
Read: components/data-quality/DataQualityPage.tsx (1,460 lines)
Read: lib/dataQuality.ts
Read: lib/stale-case-detection.ts
Read: supabase/functions/run-data-quality-detection/index.ts

- What quality issues are detected?
- How does the nightly Edge Function differ from real-time detection?
- What tables store quality issues? (data_quality_notifications?)
- How are issues resolved? Manual dismissal? Auto-resolution?
- Is the stale case detection accurate?

### E. Nightly Detection Edge Function
Read: supabase/functions/run-data-quality-detection/index.ts (full file)

- What facilities does it process?
- What checks does it run per facility?
- What does it write to the DB?
- Error handling: what happens if one facility fails?
- Is there a timeout risk for large facilities?

## DB ARCHITECTURE REVIEW
Tables: flag_rules, flag_rule_templates, case_flags,
data_quality_notifications (if exists)

- Is flag_rules properly scoped by facility_id?
- Can the same case have duplicate flags for the same rule?
- Is there an index on case_flags(case_id) for efficient lookups?
- How is flag severity stored? Enum? String? Integer?
```

---

### Domain 5: User, Permissions & Auth System

```
AUDIT DOMAIN 5: Users, Permissions & Authentication — Invite to Access to Enforcement.
Save findings to docs/audit-findings/domain-5-users-auth.md

Trace user lifecycle from invitation through account creation,
role assignment, permission enforcement, and session management.

## PAGES TO TRACE

### A. User Invitation Flow
Read: components/InviteUserModal.tsx
Read: app/api/admin/invite/route.ts
Read: app/invite/user/[token]/page.tsx
Read: app/api/invite/accept/route.ts
Read: lib/email.ts

- How is an invite created? What data is stored? What table?
- How is the invite email sent?
- What happens when the user clicks the invite link?
- How is the account created? (Supabase Auth + users table)
- What role/access_level is assigned? Where does it come from?
- What happens if the invite expires?
- Can an invite be resent? What happens to the old token?
- Is there rate limiting on invite creation?

### B. Device Rep Signup (different flow)
Read: app/auth/rep-signup/page.tsx
Read: app/api/create-device-rep/route.ts
Read: app/invite/accept/[token]/page.tsx (device rep variant)

- How does device rep signup differ from regular user invite?
- What permissions do device reps get?
- How is facility access controlled for reps? (device_rep_facility_access)
- Can a rep access multiple facilities?

### C. User Management
Read: app/settings/users/page.tsx (910 lines)
Read: app/admin/facilities/[id]/page.tsx — user management section

- What user operations are available? (edit role, deactivate, remove)
- When a user is deactivated, what happens to their:
  - Active sessions?
  - Assigned cases?
  - Surgeon scorecards?
- Can a facility_admin promote another user to facility_admin?
- Can a facility_admin demote themselves? (dangerous)

### D. Permission System
Read: components/permissions/PermissionGuard.tsx
Read: components/permissions/PermissionMatrix.tsx
Read: lib/hooks/usePermissions.ts
Read: app/admin/permission-templates/page.tsx

- How are permissions defined? (permission_keys table? hardcoded?)
- How are permissions assigned per role/user?
- How does PermissionGuard enforce permissions at the UI level?
- Are permissions also enforced at the RLS level in the DB?
- Is there a gap between UI enforcement and DB enforcement?
  (i.e., can a user bypass the UI guard and hit Supabase directly?)

### E. Authentication & Session Management
Read: middleware.ts (already reviewed — verify deeper)
Read: lib/session-manager.ts
Read: lib/auth-helpers.ts
Read: lib/UserContext.tsx
Read: app/login/page.tsx
Read: app/auth/ (all pages)
Read: lib/rate-limiter.ts
Read: lib/passwords.ts

- How is the session refreshed?
- What is the session expiry?
- Is there session hijacking protection?
- How does "remember me" work?
- Is the rate limiter on login_attempts effective?
- Does the password reset flow have proper token expiry?
- Impersonation: how does it work? Is it properly audited?

### F. Impersonation System
Read: lib/impersonation.ts

- Who can impersonate whom?
- Is impersonation logged to the audit trail?
- Can an impersonated session make destructive changes?
- How does the user know they're being impersonated?

## DB ARCHITECTURE REVIEW
Tables: users, user_roles, user_sessions, login_attempts,
device_rep_facility_access, device_rep_invites, permissions,
permission_templates, audit_log

- Are sessions properly indexed for cleanup queries?
- Is there a mechanism to force-expire all sessions for a user?
- Are login_attempts cleaned up after the window expires?
- Is the audit_log immutable? (no UPDATE/DELETE RLS policy?)
- Can a user exist without a facility_id? What happens if they do?
- Is there a unique constraint on users.email?
```

---

### Domain 6: Settings, Configuration & Admin

```
AUDIT DOMAIN 6: Settings & Configuration — Every Settings Page Verified.
Save findings to docs/audit-findings/domain-6-settings.md

For every page under app/settings/ and app/admin/, verify form ↔ DB
alignment and proper configuration patterns.

## METHOD
For EACH settings page listed below:
1. Read the file
2. List every configurable field shown to the user
3. Identify the target table and column
4. Check: Does the form field type match the DB column type?
5. Check: Is validation present? (client + server + DB constraint)
6. Check: Is auto-save or explicit-save used? Is it consistent?
7. Check: Is there audit logging for the change?
8. Check: Is the page properly access-controlled?

## FACILITY-LEVEL SETTINGS PAGES
Read each and document findings:
- app/settings/general/page.tsx — facility name, timezone, etc.
- app/settings/rooms/page.tsx — OR room management
- app/settings/procedures/page.tsx — procedure type management
- app/settings/milestones/page.tsx — (covered in Domain 2, cross-reference)
- app/settings/analytics/page.tsx — KPI targets, analytics config
- app/settings/cancellation-reasons/page.tsx
- app/settings/delay-types/page.tsx (if exists at facility level)
- app/settings/complexities/page.tsx
- app/settings/implant-companies/page.tsx
- app/settings/checklist-builder/page.tsx
- app/settings/device-reps/page.tsx
- app/settings/flags/page.tsx — (covered in Domain 4, cross-reference)
- app/settings/financials/* — (covered in Domain 3, cross-reference)
- app/settings/users/page.tsx — (covered in Domain 5, cross-reference)
- app/settings/closures/page.tsx (902 lines)
- app/settings/notifications/page.tsx
- app/settings/surgeon-preferences/page.tsx
- app/settings/checkin/page.tsx
- app/settings/audit-log/page.tsx
- app/settings/subscription/page.tsx

## ADMIN-LEVEL SETTINGS PAGES
- app/admin/settings/procedures/page.tsx
- app/admin/settings/body-regions/page.tsx
- app/admin/settings/milestones/page.tsx — (Domain 2)
- app/admin/settings/analytics/page.tsx
- app/admin/settings/notifications/page.tsx
- app/admin/settings/payers/page.tsx
- app/admin/settings/cost-categories/page.tsx
- app/admin/settings/delay-types/page.tsx
- app/admin/settings/implant-companies/page.tsx
- app/admin/settings/flag-rules/page.tsx — (Domain 4)
- app/admin/settings/procedure-categories/page.tsx
- app/admin/cancellation-reasons/page.tsx
- app/admin/complexities/page.tsx
- app/admin/checklist-templates/page.tsx
- app/admin/permission-templates/page.tsx
- app/admin/facilities/page.tsx
- app/admin/facilities/[id]/page.tsx (1,656 lines)
- app/admin/facilities/new/page.tsx (multi-step wizard)
- app/admin/audit-log/page.tsx
- app/admin/global-security/page.tsx
- app/admin/demo/page.tsx
- app/admin/docs/page.tsx

## SPECIFIC CHECKS
1. For every "archive" or "delete" action on a settings page:
   - Is it a soft delete (is_active = false)?
   - Does it check for dependent data before allowing?
   - Does it warn the user about consequences?

2. For every dropdown/select that loads from the DB:
   - Is it filtering by facility_id?
   - Is it excluding soft-deleted records?
   - Is it ordering consistently?

3. For the facility creation wizard (app/admin/facilities/new/):
   - What templates are copied? (list every template table)
   - Is the copy atomic? (what happens if step 3 of 5 fails?)
   - Are all required templates present before creation?

4. For settings with the auto-save pattern:
   - Is debouncing used?
   - What happens on network error? Is the user notified?
   - Can two admins conflict?

## OUTPUT FORMAT
For each page:

### [page path]
**Access control:** ✅ isGlobalAdmin | ✅ facility-scoped | ❌ MISSING
**Save pattern:** auto-save | explicit-save | mixed
**Audit logging:** ✅ yes | ❌ no
**Tables written:** table1, table2
**Validation:** ✅ Zod | ⚠️ inline only | ❌ none
**Issues:**
- [severity] description
```

---

## PHASE 2: Cross-Cutting Architecture Audits

These run after the domain audits and check system-wide patterns.

---

### Prompt 7: Data Entry Architecture Review

```
AUDIT: Data Entry Architecture — DB ↔ UI Alignment.
Save findings to docs/audit-findings/cross-cutting-data-entry.md

Using the domain audit findings from docs/audit-findings/domain-*.md,
plus your own analysis, perform these cross-cutting checks.

## CHECK 1: Form ↔ Schema Alignment
For EVERY form in the app that writes data (you've already cataloged
these in Domains 1–6), compile a master table:

| Page | Form Field | Type | DB Table | DB Column | DB Type | Match? | Validation |
|------|-----------|------|----------|-----------|---------|--------|------------|

FLAG mismatches:
- Text input writing to an integer column
- Date picker without timezone writing to timestamptz
- Select options that don't match FK values
- Number inputs with no min/max writing to constrained columns
- Required UI fields mapping to nullable DB columns
- Nullable UI fields mapping to NOT NULL DB columns

## CHECK 2: Validation Layer Gaps
For every write operation across all domains, trace the validation chain:
- Layer 1: Client-side (Zod schema, form validation, inline check)
- Layer 2: API route validation (if going through /api/)
- Layer 3: DB constraints (NOT NULL, CHECK, FK, unique, trigger)

Find every "gap" where bad data can reach the DB — meaning no validation
exists at ANY layer for a particular field.

## CHECK 3: Lookup Table Consistency
For every dropdown/select across all pages:
- What populates the options?
- If DB-driven: filtered by facility_id? Filtered by is_active?
- Are soft-deleted items excluded from creation forms but visible
  in historical display? (this is the correct pattern)
- Any hardcoded arrays that should be DB-driven?

## CHECK 4: Referential Integrity at the UI Level
When a user archives/deletes:
- A surgeon → What happens to their cases? Scorecards? Block schedules?
- A procedure type → Historical cases? Pricing? Milestone configs?
- An OR room → Existing cases? Block schedules?
- A milestone → In-progress case_milestones? Analytics?
- A facility → Everything?

For each: Does the UI warn? Does the DB cascade? Is there an orphan risk?

## CHECK 5: Concurrent Edit Safety
- Identify ALL auto-save settings pages. What happens if two admins
  toggle the same setting simultaneously? Is there optimistic locking?
- Case detail page: Can two users record the same milestone at the
  same time? What happens in the DB?
- Any table using updated_at for conflict detection?
```

---

### Prompt 8: Database Schema Integrity Audit

```
AUDIT: Database Schema Deep Review.
Save findings to docs/audit-findings/cross-cutting-db-schema.md

Read the baseline migration (supabase/migrations/20260101000000_baseline.sql)
and ALL subsequent migrations. Compile a comprehensive DB review.

## CHECK 1: RLS Policy Completeness
For every table with RLS enabled:
- Does it have SELECT, INSERT, UPDATE, DELETE policies?
- Are the policies correct? (facility_id scoping, role checks)
- Any table with RLS enabled but NO policies defined?
  (This means NO ONE can access the data — it's effectively locked)
- Any table where the policy allows broader access than intended?

## CHECK 2: Trigger Inventory
List every trigger in the system:
| Trigger | Table | Event | Function | What It Does |
Document the order triggers fire on the `cases` table (8 triggers).
Are there ordering dependencies? Could one trigger's output affect another?

## CHECK 3: Index Coverage
For every query pattern found in Domains 1–6:
- Is there a supporting index?
- Are there indexes that exist but no query uses them? (bloat)
- Are composite indexes in the right column order?

## CHECK 4: Migration Safety
Review all 64 migrations for:
- Any migration that could fail on existing data?
- Any migration without a rollback path?
- Are migrations idempotent? (safe to run twice?)
- Any data migrations mixed with schema changes? (risky in production)

## CHECK 5: Materialized View Freshness
- When are the 3 materialized views refreshed?
- Could stale views cause incorrect analytics?
- Is there a monitoring mechanism for refresh failures?
- What's the refresh cost? (table sizes, lock duration)

## CHECK 6: Edge Function Dependencies
Read: supabase/functions/compute-surgeon-scorecard/index.ts
Read: supabase/functions/run-data-quality-detection/index.ts

- What tables do they read/write?
- Are they using service_role key correctly?
- What happens if they fail midway? Is there a retry?
- Is the orbitScoreEngine copy in sync with lib/ version?
```

---

### Prompt 9: Simulated Data Flow Test

```
AUDIT: Data Pipeline Verification Script.
Save the script to scripts/audit-data-flow-test.ts
Save findings to docs/audit-findings/data-flow-test-results.md

Write a TypeScript script that uses the Supabase client to simulate
the full case lifecycle and verify data integrity at each step.
This is a READ + WRITE test for a development database.

NOTE: This script should be REVIEWED before running. Do NOT auto-execute.
Output it as a file for me to review and run manually.

## The script should:

### Step 1: Verify Prerequisites
- Connect to Supabase using env vars
- Pick a test facility (or use the first one found)
- Pick a test surgeon (or use the first one in the facility)
- Pick a procedure type that has milestone configs
- Log all selections

### Step 2: Create a Test Case
- INSERT into cases with all required fields (mimic what CaseForm does)
- Log the case_id
- VERIFY: Query case_milestones for this case_id
  - How many rows created? (compare to procedure_milestone_config count)
  - All have recorded_at = NULL?
  - All have correct facility_milestone_id?
  - Sequence numbers are correct?
- LOG: "Step 2 PASS/FAIL: Expected X milestones, found Y"

### Step 3: Record Milestones
- For each case_milestone (in sequence order):
  - UPDATE recorded_at = NOW()
  - VERIFY the row updated correctly
- LOG: "Step 3 PASS/FAIL: All milestones recorded"

### Step 4: Validate the Case
- UPDATE cases SET data_validated = true
- Wait 1 second (for triggers)
- VERIFY: Query case_completion_stats for this case_id
  - Does a row exist?
  - Which of the 41 columns are populated vs NULL?
  - Log each column and its value
- LOG: "Step 4 PASS/FAIL: Stats row exists with X/41 columns populated"

### Step 5: Verify Downstream
- Query materialized views for this surgeon
  - Does surgeon_procedure_stats include this case?
  - Does surgeon_overall_stats include this case?
  (Note: May need REFRESH MATERIALIZED VIEW first)
- LOG: "Step 5 PASS/FAIL: Materialized views updated"

### Step 6: Verify Analytics Queries
- Run the same queries that app/analytics/page.tsx runs
- Confirm the test case appears in results
- LOG: "Step 6 PASS/FAIL: Analytics queries include test case"

### Step 7: Cleanup
- Soft-delete the test case (is_active = false)
- Verify case_completion_stats row is handled
- Verify materialized views (after refresh) exclude the deleted case
- LOG: "Step 7 PASS/FAIL: Cleanup complete"

### Output
Print a summary:
AUDIT DATA FLOW TEST RESULTS
========================
Step 1 - Prerequisites: PASS
Step 2 - Case Creation + Milestones: PASS (8/8 milestones created)
Step 3 - Milestone Recording: PASS
Step 4 - Stats Pipeline: PASS (38/41 columns populated, 3 NULL: [list])
Step 5 - Materialized Views: PASS
Step 6 - Analytics Queries: PASS
Step 7 - Cleanup: PASS

ISSUES FOUND:
- case_completion_stats.column_x was NULL (expected value from ...)
- ...
```

---

## PHASE 3: Synthesis & Prioritization

Run this LAST after all domain audits and cross-cutting audits are complete.

```
AUDIT SYNTHESIS: Read ALL findings files in docs/audit-findings/ and create
a prioritized fix plan.

Save to docs/audit-findings/FINAL-AUDIT-REPORT.md

## Structure:

### Executive Summary
- Total issues found by severity
- Top 5 most urgent fixes
- Estimated effort for each priority tier

### Critical Issues (fix before any release)
For each: What, Where (file:line), Why it matters, How to fix, Effort estimate

### High Issues (fix within next sprint)
Same format

### Medium Issues (planned refactoring)
Same format

### Low Issues (nice-to-have / tech debt)
Same format

### Architecture Recommendations
Based on the full audit, recommend:
1. DAL expansion plan — which modules to add and in what order
2. Validation schema completion — which Zod schemas to add
3. Mega-file decomposition — recommended splits for the 6 largest files
4. Type consolidation — which duplicate types to merge and where
5. Error boundary coverage plan

### Database Recommendations
1. Missing constraints to add
2. Indexes to add or remove
3. RLS policy adjustments
4. Migration cleanup opportunities

### Implementation Order
Numbered list of fixes in the order they should be executed,
grouped into phases that can each be completed in one Claude Code session.
```

---

## Quick Reference: Session Order

| Session | Prompt | Est. Time | Output |
|---------|--------|-----------|--------|
| 0 | Pre-Audit Setup | 2 min | Directory created |
| 1 | Domain 1: Cases | 30–45 min | domain-1-cases.md |
| 2 | Domain 2: Milestones | 30–45 min | domain-2-milestones.md |
| 3 | Domain 3: Financials | 20–30 min | domain-3-financials.md |
| 4 | Domain 4: Flags & Quality | 20–30 min | domain-4-flags-quality.md |
| 5 | Domain 5: Users & Auth | 20–30 min | domain-5-users-auth.md |
| 6 | Domain 6: Settings & Config | 30–45 min | domain-6-settings.md |
| 7 | Data Entry Architecture | 20–30 min | cross-cutting-data-entry.md |
| 8 | Database Schema Audit | 20–30 min | cross-cutting-db-schema.md |
| 9 | Data Flow Test Script | 15–20 min | scripts/audit-data-flow-test.ts |
| 10 | Final Synthesis | 15–20 min | FINAL-AUDIT-REPORT.md |

**Total estimated time: 4–6 hours across 11 sessions**

---

## Tips for Best Results

1. **One session per prompt.** Don't combine — you'll lose context quality.

2. **Use explorer agents for domains.** At the start of each domain session, tell Claude Code: "Use explorer agents to read the files in parallel where there are no dependencies between the reads."

3. **If context gets heavy mid-session** (Claude Code warns about 60%+), tell it: "Wrap up findings for pages covered so far. I'll start a new session for the remaining pages." Then paste the remaining pages list in the new session.

4. **Save every output.** The synthesis prompt in Session 10 reads all previous outputs.

5. **Review the test script (Session 9) before running it.** Don't let it auto-execute against your DB.

6. **After the full audit:** Use the FINAL-AUDIT-REPORT.md as your implementation plan. Each fix grouping is designed to be one Claude Code session.
