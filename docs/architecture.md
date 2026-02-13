# ORbit Architecture Reference

> This document is the deep reference for ORbit's database, analytics pipeline,
> and system architecture. Claude reads this on-demand when working on DB-related
> features, analytics, or trigger-dependent logic. It should NOT be loaded into
> every session.

---

## 1. Database Overview

**~70+ tables, 85 functions, 25 triggers, 3 materialized views**

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `facilities` | Multi-tenant facility definitions | id, name, city, state, timezone |
| `users` | All platform users | id, email, first_name, last_name, facility_id, access_level |
| `cases` | Surgical cases | id, facility_id, surgeon_id, procedure_type_id, or_room_id, case_date, status, scheduled_start_time |
| `case_milestones` | One row per expected milestone per case | id, case_id, facility_milestone_id, recorded_at, sequence_number |
| `case_completion_stats` | Denormalized stats cache (41 columns) | case_id, facility_id, surgeon_id, timing columns, financial columns, sequencing columns |
| `or_rooms` | Operating rooms per facility | id, facility_id, name, is_active |
| `procedure_types` | Procedure catalog | id, name, category, expected_duration |
| `payers` | Insurance/payer info | id, name, type |
| `surgeons` (via users) | Surgeons are users with surgeon role | Referenced via user_roles or access_level |

### Milestone System Tables

| Table | Purpose | Relationships |
|-------|---------|---------------|
| `milestone_types` | Global templates (read-only reference) | Source of truth for milestone definitions |
| `facility_milestones` | Per-facility milestone definitions | FK → milestone_types via `source_milestone_type_id` |
| `procedure_milestone_config` | Which milestones appear per procedure per facility | FK → facility_milestones, procedure_types |
| `case_milestones` | Actual milestone instances per case | FK → cases, facility_milestones (NOT milestone_types) |

**Critical:** `milestone_type_id` was DROPPED from `case_milestones`. All code must use `facility_milestone_id`. To get global type info, JOIN: `case_milestones → facility_milestones → milestone_types` via `source_milestone_type_id`.

### Analytics & Scoring Tables

| Table | Purpose |
|-------|---------|
| `case_completion_stats` | Denormalized per-case stats (timing + financial + sequencing) |
| `surgeon_scorecards` | Cached ORbit Score results (refreshed nightly by Edge Function) |
| `flag_rules` | Configurable flag detection rules per facility |
| `case_flags` | Flag instances detected on cases |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `user_roles` | Role assignments (surgeon, facility_admin, global_admin) |
| `block_schedules` | OR block time allocations |
| `delay_types` | Categorized delay reasons |
| `cancellation_reasons` | Case cancellation categories |
| `body_regions` | Anatomical regions for procedures |
| `complexities` | Case complexity levels |
| `cost_categories` | Cost categorization for financials |
| `implant_companies` | Implant vendor catalog |
| `preop_checklist_fields` | Pre-op checklist definitions |
| `audit_log` | System audit trail (singular, not plural) |
| `user_sessions` | Session tracking for security |
| `error_logs` | Error tracking with facility_id |
| `login_attempts` | Rate limiting for auth |

---

## 2. Trigger System

### Triggers on `cases` (8 triggers — most of any table)
Be extremely cautious when modifying case INSERT/UPDATE logic.

| Trigger | Event | What It Does |
|---------|-------|-------------|
| `record_case_stats` | After UPDATE (when `data_validated` = true) | Populates `case_completion_stats` with denormalized timing, financial, and sequencing data |
| `sync_soft_delete_columns` | Before UPDATE | Keeps `is_active` and `deleted_at` in sync |
| Various milestone triggers | After INSERT on cases | Pre-creates `case_milestones` rows with `recorded_at = NULL` based on `procedure_milestone_config` |

### Soft Delete Trigger
Applied to 20 tables. The `sync_soft_delete_columns()` function enforces:
- `deleted_at` set → `is_active = false`
- `deleted_at` cleared → `is_active = true`
- `is_active = false` → `deleted_at = NOW()`
- `is_active = true` → `deleted_at = NULL`

**Tables with soft-delete:** body_regions, cancellation_reasons, complexities, cost_categories, delay_types, facility_milestones, implant_companies, milestone_types, or_rooms, patients, payers, preop_checklist_fields, procedure_categories, procedure_types, users, and more.

---

## 3. Stats Pipeline

### case_completion_stats (41 columns)

Written by `record_case_stats()` when a case has `data_validated = true`. One row per completed, validated case.

| Category | Columns | Count |
|----------|---------|-------|
| Identity/FK | case_id, case_number, facility_id, surgeon_id, procedure_type_id, payer_id, or_room_id, case_date | 9 |
| Timing | scheduled_start_time, actual_start_time, total_duration_minutes, surgical_duration_minutes, anesthesia_duration_minutes, call_to_patient_in_minutes, schedule_variance_minutes, room_turnover_minutes, surgical_turnover_minutes | 9 |
| Sequencing | is_first_case_of_day_room, is_first_case_of_day_surgeon, surgeon_room_count, surgeon_case_sequence, room_case_sequence | 5 |
| Financial | reimbursement, soft_goods_cost, hard_goods_cost, or_cost, profit, or_hourly_rate, total_debits, total_credits, net_cost, or_time_cost, cost_source | 11 |
| Workflow | created_at, updated_at, data_validated, is_excluded, excluded_at, excluded_by, exclusion_reason | 7 |

**Decision:** NOT splitting this table. All 3 materialized views and 2 analytics pages read timing + financial data together.

### Materialized Views

| View | Aggregation Level | Refreshed By |
|------|------------------|-------------|
| `surgeon_procedure_stats` | Per surgeon, per procedure type | Refresh after case_completion_stats update |
| `facility_procedure_stats` | Per facility, per procedure type | Refresh after case_completion_stats update |
| `surgeon_overall_stats` | Per surgeon (all procedures) | Refresh after case_completion_stats update |

---

## 4. ORbit Scoring System (v2.2)

### Four Pillars

| Pillar | Weight | What It Measures |
|--------|--------|-----------------|
| Profitability | 30% | Margin per minute vs peers in same procedure cohort |
| Consistency | 25% | CV (coefficient of variation) of case duration per procedure type |
| Schedule Adherence | 25% | Actual vs booked case duration — did the day go as planned? |
| Availability | 20% | Prep-to-incision gap + surgeon delay rate |

### Scoring Methodology
- **MAD (Median Absolute Deviation)** — not standard deviation
- **3 MAD scoring bands** (widened from 2 MAD to prevent sensitivity in small cohorts)
- **Minimum MAD floors** to prevent extreme scores with low-variability data
- **Volume-weighted** aggregation across procedure cohorts
- **Graduated linear decay** for Schedule Adherence and Availability (time-weighting)
- **Solo-surgeon fallbacks** when there are no peers for comparison
- **Grade thresholds:** A+, A, B+, B, C, D, F

### Data Flow
1. `case_completion_stats` → raw per-case data
2. `orbitScoreEngine.ts` → runs scoring calculation (currently client-side)
3. `surgeon_scorecards` table → cached results (refreshed nightly via Edge Function + pg_cron)
4. Both web and iOS read from `surgeon_scorecards` for summary display

### Key Business Logic
- **Flip room:** Patient goes to a different OR than the previous patient (callback optimization applies)
- **Same room:** Sequential cases in the same OR (turnover optimization applies)
- Profitability is compared WITHIN procedure cohort — Mako THA surgeons vs other Mako THA surgeons, not vs standard THA
- Core equation: saved minutes → recovered OR capacity → additional cases → revenue

---

## 5. Flag System

Replaced the legacy "Outlier" system with configurable facility-level flag rules.

### Tables
- `flag_rules` — Rule definitions per facility (e.g., "flag if turnover > 45 min")
- `case_flags` — Individual flag instances on cases

### Key Architecture
- Rules are seeded as global templates, then copied to each facility via `seed_facility_flag_rules(facility_id)`
- Facility admins can customize thresholds
- Settings page: auto-save toggle pattern (no save button)

---

## 6. Auth & Access Control

### Access Levels
| Level | Can See | Typical User |
|-------|---------|-------------|
| `global_admin` | All facilities, all data | Platform owner |
| `facility_admin` | Own facility only | OR manager, facility director |
| `surgeon` | Own cases + facility scorecards | Surgeon |
| `device_rep` | Assigned cases only | Implant sales rep |

### Auth Flow
- Supabase Auth handles sign-in/sign-up
- `app/auth/callback/route.ts` handles OAuth callback
- `middleware.ts` enforces auth on protected routes
- RLS policies on every table enforce facility scoping
- iOS uses Supabase token stored in Keychain (migrated from UserDefaults)

---

## 7. iOS App Architecture

### Current State
- SwiftUI app with MVVM architecture (partially migrated)
- `SurgeonHomeView` has a proper ViewModel; `CasesView`, `RoomsView`, `CaseDetailView` are being migrated
- Repository layer: `CaseRepository`, `RoomRepository`, etc.
- Theme system: `Theme.swift` with consistent design tokens

### iOS File Structure
```
ORbit/
├── Features/
│   ├── Cases/          → CasesView, CaseDetailView, CaseDetailModels
│   ├── Rooms/          → RoomsView, RoomComponents
│   ├── SurgeonHome/    → SurgeonHomeView, SurgeonHomeViewModel
│   ├── Profile/        → ProfileView
│   └── DeviceRep/      → RepCasesView, DeviceRepTray
├── Models/             → SurgicalCase, SurgeonDay, RepCase, etc.
├── Repositories/       → CaseRepository, RoomRepository (new)
├── ViewModels/         → CasesViewModel, RoomsViewModel (new)
├── Core/
│   ├── Error/          → ORbitError.swift
│   ├── Auth/           → AuthManager, KeychainHelper
│   └── Network/        → SupabaseClient
├── Theme.swift         → Design tokens, colors, spacing
└── ContentView.swift   → Root navigation
```

### iOS Gaps vs Web
- No analytics views
- No ORbit Score (planned: scorecard card on Surgeon Home, reading from `surgeon_scorecards` table)
- No block scheduling
- No admin features
- No utilization reports
- Face ID auth: planned but not yet implemented

---

## 8. RPC Functions (Commonly Used)

| Function | Purpose |
|----------|---------|
| `get_surgeon_median_times` | Returns median case times per surgeon per procedure |
| `record_case_stats()` | Trigger function that populates case_completion_stats |
| `seed_facility_flag_rules(facility_id)` | Copies global flag rule templates to a facility |
| Introspection functions | `introspect_columns()`, `introspect_triggers()`, `introspect_foreign_keys()` for admin docs page |

---

## 9. Known Issues & Gotchas

1. **Milestone ordering:** Some facilities have duplicate sequence numbers — sort by sequence_number, then by facility_milestone_id as tiebreaker
2. **Timezone display:** ALWAYS use `facility.timezone` for display, never UTC. The `date-utils.ts` helper handles this.
3. **case_milestones NULL pattern:** Rows are pre-created with `recorded_at = NULL`. Check `recorded_at IS NOT NULL` to determine if recorded. Low-ROI to change.
4. **8 triggers on cases table:** Any modification to case INSERT/UPDATE must be tested against all triggers
5. **audit_log is singular:** The table is `audit_log`, not `audit_logs`
6. **iOS PostgREST imports:** After MVVM migration, only Repositories should import PostgREST, never Views
