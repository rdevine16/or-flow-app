# Audit Domain 2: Milestone & Phase System

**Date:** 2026-02-24
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Template configuration → Case recording → Analytics consumption
**Verdict:** Production-ready with 3 critical DB issues to address

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [A. Admin Milestone Configuration](#a-admin-milestone-configuration)
3. [B. Facility Milestone Configuration](#b-facility-milestone-configuration)
4. [C. milestone_type_id Migration Verification](#c-milestone_type_id-migration-verification)
5. [D. Case Milestone Recording](#d-case-milestone-recording)
6. [E. Milestone Analytics](#e-milestone-analytics)
7. [F. Data Quality](#f-data-quality)
8. [DB Architecture Review](#db-architecture-review)
9. [Specific Questions Answered](#specific-questions-answered)
10. [Issues & Recommendations](#issues--recommendations)

---

## Executive Summary

The milestone system spans **~8,000 lines of TypeScript** and **~2,000 lines of SQL** across 40+ files. The architecture is well-designed with clean separation between:

- **Admin layer** (global milestone_types, phase_templates, milestone_template_types)
- **Facility layer** (facility_milestones, facility_phases, milestone_templates)
- **Case layer** (case_milestones with real-time recording)
- **Analytics layer** (SQL RPCs with median aggregation, template-aware phase resolution)

### Key Findings

| Category | Status | Notes |
|----------|--------|-------|
| milestone_type_id migration | **CLEAN** | Zero bugs across 53 files |
| Template cascade (4-tier) | **CORRECT** | Surgeon override → procedure → facility default |
| Median calculations | **CORRECT** | SQL PERCENTILE_CONT, LEAD window functions |
| Real-time recording | **ROBUST** | Optimistic UI, conflict resolution, undo support |
| Data quality detection | **FUNCTIONAL** | 7 issue types, inline editing, resolution actions |
| DB FK constraints | **3 ISSUES** | Missing constraints on case_milestones, missing indexes |
| Required milestones | **ENFORCED** | 4 phases + 8 milestones, grandfather logic for legacy |

---

## A. Admin Milestone Configuration

### Files & Line Counts

| File | Lines | Purpose |
|------|-------|---------|
| `app/admin/settings/milestones/page.tsx` | 1,002 | 4-tab admin page shell |
| `components/settings/milestones/TemplateBuilder.tsx` | 1,360 | Shared 3-column drag-and-drop builder |
| `hooks/useAdminTemplateBuilder.ts` | 874 | Admin template state management |
| `components/settings/milestones/AdminPhaseLibrary.tsx` | 587 | Global phase CRUD |
| `components/settings/milestones/AdminProcedureTypeAssignment.tsx` | 507 | Template → procedure assignment |
| **Total** | **4,330** | |

### Tab Structure (4 tabs)

1. **Milestones** — CRUD on `milestone_types` table. Create/edit/archive/pair milestones. Propagates new milestones to all existing facilities.
2. **Phases** — CRUD on `phase_templates` table. Color picker, parent-child relationships.
3. **Templates** — 3-column @dnd-kit builder. Creates `milestone_template_types` with `milestone_template_type_items`.
4. **Procedure Types** — 2-column assignment. Links `milestone_template_type_id` to `procedure_type_templates`.

### How Global milestone_types Are Created/Edited

**Created:** `page.tsx:278-308`
- Insert into `milestone_types` with auto-generated internal name
- `propagateToFacilities()` inserts into `facility_milestones` for ALL existing facilities

**Edited:** `page.tsx:332-358`
- Updates `display_name` only (internal name immutable)
- Cascades update to all `facility_milestones` where `source_milestone_type_id` matches

### Tables Written

| Tab | Tables |
|-----|--------|
| Milestones | `milestone_types` (INSERT, UPDATE, DELETE), `facility_milestones` (INSERT on create, UPDATE on edit) |
| Phases | `phase_templates` (INSERT, UPDATE) |
| Templates | `milestone_template_types` (INSERT, UPDATE), `milestone_template_type_items` (INSERT, DELETE, UPDATE) |
| Procedures | `procedure_type_templates` (UPDATE) |

### Cascade Behavior When milestone_type Is Archived

**Does happen:**
- Sets `deleted_at` and `deleted_by` on `milestone_types`
- If paired, clears partner's `pair_with_id`

**Does NOT happen:**
- No cascade to `facility_milestones` (existing facilities keep it)
- No cascade to `milestone_template_type_items` (admin templates keep it)
- No database CASCADE constraint

### Validation on Milestone Ordering

**Visual warnings only — no blocking:**
- Pair order issues detected (START after END) via `detectPairOrderIssues()`
- Shows `<AlertTriangle>` icon in FlowNode
- Does NOT block saving

**Required milestones (new templates):**
- Auto-populated with 4 phases + 8 milestones from `lib/template-defaults.ts`
- Lock icons prevent deletion of required items
- Legacy templates grandfathered (only enforced on templates with full structure)

---

## B. Facility Milestone Configuration

### Files & Line Counts

| File | Lines | Purpose |
|------|-------|---------|
| `app/settings/milestones/page.tsx` | 846 | 5-tab facility page |
| `hooks/useTemplateBuilder.ts` | 899 | Facility template state management |
| `components/settings/milestones/PhaseLibrary.tsx` | 511 | Facility phase CRUD |
| `components/settings/milestones/ProcedureTemplateAssignment.tsx` | 472 | Template → procedure assignment |
| `components/settings/milestones/SurgeonOverridePanel.tsx` | 695 | Surgeon-specific overrides |
| `components/settings/milestones/TemplateBuilder.tsx` | 1,360 | Shared (same as admin) |
| **Total** | **5,047** | (including shared TemplateBuilder) |

### Tab Structure (5 tabs)

1. **Milestones** — Facility milestone library (add custom, edit, pair, archive)
2. **Phases** — Facility phase library (colors, parent-child)
3. **Templates** — 3-column drag-and-drop builder (same shared component)
4. **Procedures** — 2-column template assignment
5. **Surgeons** — 3-column surgeon override panel

### How Global Templates Become Facility Templates

**Milestones and phases are copied; templates are created locally.**

1. `seed_facility_with_templates(target_facility_id, template_config)` RPC copies 14 categories
2. For milestones: iterates `milestone_types`, inserts into `facility_milestones`, sets `source_milestone_type_id`
3. Global templates (`milestone_template_types`) are NOT copied — facility admins create templates locally
4. New templates auto-populate with 4 required phases + 8 required milestones

### Can Facility Admins Create Custom Milestones?

**YES.** Custom milestones have `source_milestone_type_id = NULL` and can be archived. Global-origin milestones show lock icon.

### Surgeon Override System (3-Tier Cascade)

| Priority | Source | Table |
|----------|--------|-------|
| 1 (highest) | Surgeon override | `surgeon_template_overrides` |
| 2 | Procedure default | `procedure_types.milestone_template_id` |
| 3 (lowest) | Facility default | `milestone_templates.is_default = true` |

**UI:** 3-column layout (surgeons | procedures | template picker + preview). Orange "Override" badge when active, gray "Inherited" when using default.

### What Happens When a Facility Deactivates a Milestone

**Does NOT affect in-progress cases.** Archive sets `is_active = false` + `deleted_at`, but does NOT cascade to `case_milestones`. Historical data fully preserved. Milestone moves to "Archived" section in UI (can be restored).

---

## C. milestone_type_id Migration Verification

### Verdict: COMPLETE AND CLEAN

**Migration file:** `20260212000004_fix_milestone_type_id_triggers.sql`
- Fixed `trigger_record_case_stats()` to remove fallback code referencing `NEW.milestone_type_id`
- Comment: "milestone_type_id was DROPPED from case_milestones in v2.0"

**Current `case_milestones` schema (confirmed):**
```sql
CREATE TABLE public.case_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    recorded_at timestamp with time zone,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    facility_milestone_id uuid,  -- ONLY milestone FK
    updated_at timestamp with time zone DEFAULT now()
);
```

### Reference Inventory (53 files searched)

| Reference Type | Count | Status |
|---------------|-------|--------|
| case_milestones table | 0 | **CLEAN** — column dropped |
| Analytics tables (case_milestone_stats) | 4 | **SAFE** — milestone_type_id is correct here |
| Template system tables | 4 | **SAFE** — references global milestone_types |
| TypeScript types | 3 | **SAFE** — map to analytics views |
| Application code | 15 | **SAFE** — query analytics views correctly |
| RPC functions | 10+ | **SAFE** — all use proper mapping |
| Tests | 40+ | **SAFE** — validate migration |
| Documentation | 5 | **SAFE** — accurate descriptions |
| **BUGS FOUND** | **0** | |

### Correct Join Pattern (Verified Everywhere)

```
case_milestones.facility_milestone_id
  → facility_milestones.id
    → facility_milestones.source_milestone_type_id
      → milestone_types.id
```

All 15 INSERT statements into `case_milestones` use `facility_milestone_id`. Zero direct joins to `milestone_types`.

---

## D. Case Milestone Recording

### Files & Line Counts

| File | Lines | Purpose |
|------|-------|---------|
| `lib/hooks/useMilestoneRealtime.ts` | 188 | Supabase real-time subscription |
| `components/cases/MilestoneCard.tsx` | 199 | Card-based recorder |
| `components/ui/MilestoneButton.tsx` | 209 | Compact button recorder |
| `components/cases/MilestoneTimelineV2.tsx` | 495 | Primary vertical timeline |
| `components/cases/MilestoneDetailRow.tsx` | 549 | Phase-grouped data table |
| `components/cases/CaseDrawerMilestones.tsx` | 199 | Drawer orchestrator |
| **Total** | **1,839** | |

### Recording Flow

1. User clicks "Record" → `checkMilestoneOrder()` checks for skipped milestones
2. If out-of-order → confirmation dialog ("Record anyway?" / "Cancel")
3. Optimistic UI update with `optimistic-{id}` prefix
4. DB write: UPDATE existing row or INSERT new row
5. Auto-status updates: `patient_in` → "in_progress", `patient_out` → "completed"
6. Real-time subscription pushes change to other devices

### What Happens When `recorded_at` Is Set

**Database triggers fire:**
1. `set_case_milestones_updated_at` → Updates `updated_at`
2. `trg_update_case_stats` → If patient_out, recalculates analytics
3. `on_milestone_recorded_detect_issues` → Runs data quality checks
4. `trigger_update_patient_status_from_milestone` → Updates patient checklist

**App-level side effects:**
- `patient_in` → case status → "in_progress"
- `closing` → auto-record `surgeon_left_at`
- `patient_out` → case status → "completed"

### Sequence Enforcement

**No `sequence_number` column exists.** Ordering is by `facility_milestones.display_order`.

- **UI level:** Soft warning dialog if skipped milestones detected
- **DB level:** No constraint — milestones can be recorded in any order
- **Data quality:** Flags out-of-order recording post-completion

### Real-Time Multi-User Handling

**Conflict resolution in `useMilestoneRealtime.ts`:**
- Two nurses record same milestone → earlier `recorded_at` timestamp wins
- Optimistic entries replaced with canonical DB rows
- Both devices converge to same state

### Undo Mechanism

**Soft undo:** Sets `recorded_at = null` (row stays in DB).

Cascade effects:
- `patient_in` undo → case status → "scheduled"
- `closing` undo → clears `surgeon_left_at`
- `patient_out` undo → case status → "in_progress"

### UI Surfaces for Milestone Recording

| Component | Recording? | Display | Phase Grouping |
|-----------|-----------|---------|----------------|
| MilestoneTimelineV2 | Inline (primary) | Vertical timeline | No (flat) |
| MilestoneDetailRow | Read-only | 6-column grid | Yes (collapsible) |
| MilestoneCard | Card-based | Card grid | No |
| MilestoneButton | Button-based | Inline buttons | No |
| PiPMilestonePanel | Carousel | Compact floating window | No |

---

## E. Milestone Analytics

### Files & Line Counts

| File | Lines | Purpose |
|------|-------|---------|
| `lib/hooks/useMilestoneComparison.ts` | 282 | Main analytics hook |
| `lib/utils/milestoneAnalytics.ts` | 579 | Pure analytics functions |
| `lib/dal/phase-resolver.ts` | 301 | Template cascade resolution |
| `lib/milestone-phase-config.ts` | 207 | Phase display config |
| `lib/pace-utils.ts` | 241 | Real-time pace calculations |
| `lib/milestone-order.ts` | 56 | Out-of-order detection |
| **Total** | **1,666** | |

### SQL RPCs

#### `get_milestone_interval_medians(p_surgeon_id, p_procedure_type_id, p_facility_id)`

**Current version:** `20260224000000_fix_interval_medians_surgeon_override.sql`

1. Resolves milestone template via 3-tier cascade (surgeon override → procedure → facility default)
2. Builds milestone order from `milestone_template_items` → `facility_milestones`
3. Fetches completed + validated case milestones
4. Computes intervals using **LEAD window function** (duration at milestone, not time to reach)
5. Aggregates with **PERCENTILE_CONT(0.5)** — separate surgeon/facility medians

#### `get_phase_medians(p_facility_id, p_procedure_type_id, p_surgeon_id, p_milestone_template_id)`

**Current version:** `20260223300000_template_phase_resolver.sql`

1. Calls `resolve_template_phase_boundaries(p_milestone_template_id)` for boundaries
2. Computes `phase_duration = end_milestone.recorded_at - start_milestone.recorded_at`
3. Aggregates with PERCENTILE_CONT(0.5)
4. **Nulls facility median when n < 5** (low-confidence threshold)

#### `resolve_template_phase_boundaries(p_template_id)`

- Groups template items by `facility_phase_id`
- MIN(display_order) → start milestone, MAX(display_order) → end milestone
- Returns flat rows with expanded start/end milestone columns

### Template Cascade in Analytics (4-tier)

| Priority | Source | When Used |
|----------|--------|-----------|
| 1 | `cases.milestone_template_id` (stamped) | Preserves historical accuracy |
| 2 | `surgeon_template_overrides` | Surgeon-specific preferences |
| 3 | `procedure_types.milestone_template_id` | Procedure default |
| 4 | Facility default (`is_default = true`) | Final fallback |

### Correctness Verified

- **facility_milestone_id** used everywhere (not milestone_type_id)
- **Median-based** (not average) — platform principle
- **LEAD semantics** match TypeScript interval calculation
- **SECURITY INVOKER** on all RPCs (RLS applies)
- **Phase medians ≠ sum of interval medians** (statistically correct)

### Analytics Issues Found

1. **Triple template resolution:** `useMilestoneComparison` calls `resolveTemplateForCase()` 3 times (could deduplicate)
2. **`get_milestone_interval_medians` lacks template ID parameter:** Doesn't accept `p_milestone_template_id`, falls back to live cascade. Historical cases may use wrong template if assignments changed.
3. **Inconsistent confidence threshold:** Phase medians nulled when n < 5, but interval medians always returned (even with n=1)
4. **Legacy fallback:** `calculateTimeAllocation()` uses hardcoded phase_group values when `phaseDefinitions.length === 0`

---

## F. Data Quality

### Issue Types Detected (7)

**Milestone-Level (SQL RPC `detect_case_issues()`):**
1. `missing` — Required milestones not recorded on completed cases
2. `timeout` — Gap/duration exceeds `max_minutes` threshold
3. `too_fast` — Gap/duration below `min_minutes` threshold
4. `impossible` — Negative time gap

**Case-Level (TypeScript `lib/dataQuality.ts`):**
5. `stale_in_progress` — Case in "in_progress" for 24+ hours
6. `abandoned_scheduled` — Scheduled case 2+ days past date
7. `no_activity` — In-progress case, no milestone updates for 4+ hours

### Stale Case Detection

- Filters: skips `data_validated = true` and `is_excluded_from_metrics = true`
- Deduplicates: won't create issue if one already exists for case+type
- Invalidation: marks case `data_validated = false` for re-scanning

### Resolution Actions

- **Approve** — Data is correct as recorded
- **Exclude** — Remove case from analytics (`is_excluded_from_metrics = true`)
- **Stale** — Issue expired without resolution (auto-set by `expire_old_issues()`)

### Data Quality Issues Found

1. **Hardcoded milestone name in stale detection:**
   ```typescript
   .eq('name', 'patient_in')  // Fragile if facility renames milestone
   ```
   Should use `source_milestone_type_id` lookup instead.

2. **Missing `is_active` filter** in some DQ queries (line 137 of dataQuality.ts)

---

## DB Architecture Review

### Table Schema Summary

| Table | Soft Delete? | Key FKs | ON DELETE |
|-------|-------------|---------|----------|
| `milestone_types` | Yes (is_active, deleted_at) | pair_with_id (self) | No constraint |
| `facility_milestones` | Yes (is_active, deleted_at) | source_milestone_type_id → milestone_types | No constraint |
| `case_milestones` | No | facility_milestone_id → facility_milestones | NO ACTION (default) |
| `facility_phases` | Yes (is_active, deleted_at) | parent_phase_id (self) | SET NULL |
| `milestone_templates` | Yes (is_active, deleted_at) | facility_id → facilities | — |
| `milestone_template_items` | No (CASCADE) | template_id → milestone_templates | CASCADE |
| `milestone_template_items` | — | facility_milestone_id → facility_milestones | CASCADE |
| `milestone_template_items` | — | facility_phase_id → facility_phases | SET NULL |
| `surgeon_template_overrides` | No (hard delete) | milestone_template_id → milestone_templates | CASCADE |
| `milestone_template_types` | No (is_active flag) | — | — |
| `milestone_template_type_items` | No (CASCADE) | template_type_id → milestone_template_types | CASCADE |
| `milestone_template_type_items` | — | milestone_type_id → milestone_types | CASCADE |

### Index Coverage

**Existing indexes:**
- `case_milestones(case_id)` — Find milestones per case
- `case_milestones(recorded_at)` — Filter by timestamp
- `case_milestone_stats(facility_id, procedure_type_id, milestone_type_id)` — Analytics
- `case_milestone_stats(surgeon_id, procedure_type_id, milestone_type_id)` — Surgeon analytics
- `milestone_template_items(template_id)` — Find items in template
- `milestone_template_items(facility_milestone_id)` — Reverse lookup

**Missing indexes (performance impact):**
- `case_milestones(facility_milestone_id)` — Stale detection filters
- `facility_milestones(facility_id, name)` — Lookup by name
- `facility_milestones(facility_id, display_order)` — Ordered timeline queries
- `milestone_template_items(template_id, display_order)` — Phase boundary resolution

### Triggers on `case_milestones` (5)

| Trigger | Event | Purpose |
|---------|-------|---------|
| `set_case_milestones_updated_at` | BEFORE UPDATE | Timestamp management |
| `trg_record_case_stats` | AFTER INSERT | Analytics on patient_out |
| `trg_update_case_stats` | AFTER UPDATE | Analytics on undo |
| `on_milestone_recorded_detect_issues` | AFTER INSERT | Data quality detection |
| `trigger_update_patient_status_from_milestone` | AFTER INSERT | Patient checklist |

---

## Specific Questions Answered

### 1. If I create a new milestone type globally, does it automatically appear in existing facilities?

**YES.** `page.tsx:310-330` (`propagateToFacilities`):
- After inserting into `milestone_types`, iterates all facilities
- Inserts into `facility_milestones` with `source_milestone_type_id` set
- Uses `ON CONFLICT (facility_id, name) DO UPDATE` to handle re-runs
- New milestone appears immediately in facility milestone libraries

**Only new ones?** No — both existing and new facilities get it. New facilities via `seed_facility_with_templates()`, existing facilities via `propagateToFacilities()`.

### 2. If I archive a facility_milestone, what happens to:

**Future cases:** Milestone stops appearing in template library panel (filtered by `is_active = true`). Cannot be added to new template positions. If already in a template, **existing items are NOT removed**.

**In-progress cases:** `case_milestones` rows are **unchanged**. No FK cascade, no data loss. Milestone still displays in case detail views because queries don't filter by `is_active` on the join.

**Historical analytics:** Still shows in past data. Analytics queries (`get_milestone_interval_medians`, `get_phase_medians`) join to `facility_milestones` without filtering `is_active`. The materialized views (`surgeon_milestone_stats`, `facility_milestone_stats`) use `milestone_type_id` from `case_milestone_stats`, which is independent of facility_milestone status.

### 3. Is there any scenario where case_milestones could reference a facility_milestone_id that no longer exists?

**Soft delete scenario (current behavior):** No — soft delete sets `is_active = false` but doesn't remove the row. The FK remains valid.

**Hard delete scenario (if someone bypasses soft delete):** PostgreSQL's default `ON DELETE NO ACTION` would **block** the delete if any `case_milestones` reference it. So the answer is **no**, the FK prevents it.

**However:** The constraint lacks an explicit `ON DELETE RESTRICT` clause, relying on default behavior. Adding an explicit `ON DELETE RESTRICT` would make the intent clearer and prevent accidental configuration changes.

**Edge case:** If someone uses `DELETE FROM facility_milestones WHERE ...` with `ON DELETE CASCADE` added in the future, it would cascade-delete case_milestones. The current system is safe because: (a) soft deletes are used, (b) the FK defaults to NO ACTION.

---

## Issues & Recommendations

### Critical (P0)

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 1 | **Missing composite index on `case_milestones(facility_milestone_id)`** | DB schema | Stale detection does full table scan | `CREATE INDEX idx_case_milestones_facility_milestone ON case_milestones(facility_milestone_id)` |
| 2 | **Hardcoded milestone name in stale detection** | `lib/dataQuality.ts:621` | Breaks if facility customizes milestone names | Use `source_milestone_type_id` lookup instead |
| 3 | **No uniqueness constraint on `milestone_template_items.display_order`** | DB schema | Non-deterministic phase boundaries | `CREATE UNIQUE INDEX ON milestone_template_items(template_id, display_order)` |

### Important (P1)

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 4 | **`get_milestone_interval_medians` lacks template ID param** | SQL RPC | Historical cases may use wrong template | Add 4th param `p_milestone_template_id UUID DEFAULT NULL` |
| 5 | **Triple template resolution in `useMilestoneComparison`** | `lib/hooks/useMilestoneComparison.ts` | 9 extra DB queries | Resolve once, pass to all 3 queries |
| 6 | **Missing `is_active` filter in some DQ queries** | `lib/dataQuality.ts:137` | May process archived milestones | Add `.eq('is_active', true)` |
| 7 | **Inconsistent confidence threshold** | Interval medians vs phase medians | Interval medians shown with n=1 | Apply n >= 5 threshold to interval medians display |

### Nice-to-Have (P2)

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| 8 | Missing indexes on `facility_milestones(facility_id, name)` | DB schema | Slower lookups | Add filtered index |
| 9 | Missing indexes on `milestone_template_items(template_id, display_order)` | DB schema | Slower phase resolution | Add composite index |
| 10 | Duplicate stale detection code | `lib/stale-case-detection.ts` | Maintenance burden | Delete legacy file, keep `lib/dataQuality.ts` |
| 11 | No real-time subscription reconnection logic | `useMilestoneRealtime.ts` | Silent disconnect | Add exponential backoff reconnection |
| 12 | No audit trail for milestone corrections | case_milestones | No history of undos | Consider `milestone_audit_log` table |
| 13 | Legacy `calculateTimeAllocation` fallback | `milestoneAnalytics.ts` | Hardcoded phase_group values | Enforce template requirement or improve fallback |

### Architecture Strengths

- Clean separation: SQL computes medians, TypeScript transforms for display
- Template cascade preserves historical accuracy via `cases.milestone_template_id` stamp
- Shared `TemplateBuilder.tsx` component works with both admin and facility hooks (polymorphic)
- Required milestone enforcement with grandfather logic for legacy templates
- Real-time conflict resolution keeps earliest timestamp
- Soft undo preserves row for audit trail and constraint enforcement
- All RPCs use SECURITY INVOKER (RLS applies)
- Median-based statistics throughout (platform principle)

---

*End of Domain 2 Audit Report*
