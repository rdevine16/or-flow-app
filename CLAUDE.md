# CLAUDE.md — ORbit Surgical Analytics Platform

## What This Project Is

ORbit is a surgical analytics platform for ambulatory surgery centers (ASCs). It tracks OR efficiency through real-time case management, performance scorecards, block scheduling, and financial analytics. The platform serves surgeons, OR coordinators, facility administrators, and global admins across multiple locations.

**Live product URL:** Deployed on Vercel
**Database:** Supabase (PostgreSQL) — ~70+ tables, 85 functions, 25 triggers

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** Supabase (PostgreSQL with RLS)
- **Auth:** Supabase Auth
- **Hosting:** Vercel
- **Styling:** Tailwind CSS
- **Icons:** Heroicons
- **iOS companion app:** SwiftUI (separate repo)

---

## Critical Architecture Patterns

### Facility Scoping
Everything is scoped by `facility_id`. All queries MUST filter by the user's facility. RLS policies enforce this at the database level. Never query without facility context.

### Milestone System (v2.0 — Current)
- `milestone_types` — global templates (read-only reference)
- `facility_milestones` — per-facility definitions, linked back via `source_milestone_type_id`
- `procedure_milestone_config` — controls which milestones appear for each procedure at each facility
- `case_milestones` — one row per expected milestone per case, pre-created with `recorded_at = NULL`
- **IMPORTANT:** `milestone_type_id` was DROPPED from `case_milestones`. All operations use `facility_milestone_id` exclusively. When global type info is needed for analytics, JOIN through `facility_milestones.source_milestone_type_id`.

### Case Lifecycle
1. Case created → status = "scheduled", milestones pre-created with `recorded_at = NULL`
2. Milestones recorded → `recorded_at` updated, status may transition to "in_progress"
3. Case completed → status = "completed"
4. Data validated → `data_validated = true` → trigger fires `record_case_stats()` → populates `case_completion_stats`
5. Analytics engine reads from `case_completion_stats` and materialized views

### Scoring System (ORbit Score v2.2)
Four pillars: Profitability, Consistency, Schedule Adherence, Availability
- Uses MAD (Median Absolute Deviation) — "median-over-average" philosophy
- 3 MAD scoring bands (widened from 2 MAD to prevent sensitivity in small cohorts)
- Minimum MAD floors to prevent extreme scores
- Volume-weighted scoring
- Flip room vs. same-room logic for contextual recommendations
- Graduated decay for time-weighting
- Engine file: `orbitScoreEngine.ts` (or `analyticsV2.ts`)

### Triggers on `cases` Table
There are 8 triggers on the `cases` table — the most of any table. Be cautious when modifying case INSERT/UPDATE logic. Always verify trigger behavior after changes.

### Key Database Function Pipeline
```
case validated → record_case_stats() → calculate_case_stats() → case_completion_stats
                                                                → surgeon_milestone_averages (via RPC)
                                                                → surgeon_procedure_averages (via RPC)
```

---

## Naming Conventions

### Database
- Tables: snake_case plural (`cases`, `case_milestones`, `or_rooms`)
- Columns: snake_case (`facility_id`, `recorded_at`, `surgeon_id`)
- Functions: snake_case (`record_case_stats`, `calculate_case_stats`)
- Triggers: prefixed with `trg_` or `trigger_` or descriptive (`on_milestone_recorded_detect_issues`)

### Frontend
- Components: PascalCase (`CaseForm.tsx`, `DateRangeSelector.tsx`)
- Pages: Next.js App Router conventions (`app/cases/page.tsx`, `app/cases/[id]/page.tsx`)
- Hooks: camelCase with `use` prefix (`useToast`)
- Utils/Services: camelCase (`analyticsV2.ts`, `orbitScoreEngine.ts`)

---

## Key Tables Quick Reference

| Table | Purpose | Row Count (approx) |
|-------|---------|-------------------|
| `cases` | Central case table, 8 triggers | 3,000+ |
| `case_milestones` | Milestone timestamps per case | 27,000+ |
| `case_completion_stats` | Denormalized analytics data | 2,700+ |
| `case_staff` | Staff-to-case assignments with roles | 9,900+ |
| `case_statuses` | Lookup: scheduled, in_progress, completed, cancelled, on_hold | 5 |
| `facility_milestones` | Per-facility milestone definitions | varies |
| `procedure_milestone_config` | Which milestones for which procedure | varies |
| `procedure_types` | Procedure definitions per facility | varies |
| `or_rooms` | OR rooms with available_hours | varies |
| `users` | All users with role_id and facility_id | varies |
| `block_schedules` | Surgeon block time allocations | varies |
| `payers` | Insurance payers per facility | varies |
| `surgeon_milestone_averages` | Computed milestone timing averages | varies |
| `surgeon_procedure_averages` | Computed procedure averages | varies |

---

## User Roles & Access Levels

| Access Level | Can Do |
|-------------|--------|
| `global_admin` | Everything across all facilities |
| `facility_admin` | Full access within their facility |
| `staff` | Record milestones, view cases, limited config |
| `read_only` | View only |

RLS policies enforce these at the database level. App code should also check roles for UI visibility.

---

## Common Pitfalls

1. **Always filter by `facility_id`** — queries without it return cross-facility data or hit RLS errors
2. **Milestones use `facility_milestone_id` only** — the old `milestone_type_id` column is gone from `case_milestones`
3. **`case_completion_stats` is populated by a trigger** — it's not written to directly. Modify `record_case_stats()` if the schema changes
4. **Timezone handling** — milestones use `timestamptz`. Be careful with date comparisons and ensure consistent timezone handling
5. **Custom milestones** have `source_milestone_type_id = NULL` — don't assume every facility_milestone maps to a global type
6. **Demo facility ID:** `a1111111-1111-1111-1111-111111111111` — don't modify production data when testing

---

## Current Development Context

- Analytics engine has been through v2.0 → v2.1 → v2.2 iterations
- Milestone dual-ID cleanup is COMPLETE — all code uses facility_milestone_id
- DateRangeSelector is a shared component used across analytics pages
- Transitioning from custom toast implementations to centralized `useToast` provider
- Flags and delays system is being integrated
- Improvement plans feature connects low scores to actionable recommendations

---

## When Making Changes

1. **Check triggers** — especially on `cases` and `case_milestones`. There are cascading effects.
2. **Test with demo facility** — use facility ID `a1111111-1111-1111-1111-111111111111`
3. **Run on a feature branch** — never commit directly to main
4. **Verify RLS** — any new table or query must respect facility scoping
5. **Check downstream** — changes to case data can affect `case_completion_stats`, materialized views, and the scoring engine
6. **Maintain backward compatibility** — existing data must not break during migrations

---

## Feature Audit Briefs

When conducting feature audits, read the corresponding brief in `docs/feature-audits/` before reviewing code. These briefs contain:
- Complete table/file mappings
- Known issues and technical debt
- "Fully baked" checklists
- Edge cases to test
- Interview questions to ask the developer

Always complete the audit and interview BEFORE making code changes.
