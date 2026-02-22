# Project: Facility Creation Wizard Redesign
**Completed:** 2026-02-21
**Branch:** feature/facility-creation-wizard-redesign
**Duration:** 2026-02-21 → 2026-02-21
**Total Phases:** 8

## What Was Built
Complete overhaul of the facility creation wizard at `/admin/facilities/new`. The previous implementation was a 1,555-line monolithic page that manually copied 9 template types inline while missing 4+ additional template categories (analytics, payers, notifications, flag rules).

The redesign consolidated all template seeding into a single extended `seed_facility_with_templates()` RPC with a JSONB config parameter, supporting conditional seeding of 13+ template categories in one atomic transaction. The frontend was decomposed into a clean 5-step wizard architecture: WizardShell parent managing state + 5 individual step components, all built with shadcn/ui.

Phase 8 added a vertical sidebar navigation layout with step icons, a live provision summary widget, template row patterns with emoji icons, and a success screen with "Create Another" / "View Facility" options.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1     | Extend `seed_facility_with_templates` RPC with JSONB config + missing template categories | `978dd47` |
| 2     | Scaffold 5-step wizard: WizardShell, types, step stubs | `26cbc17` |
| 3     | Implement Facility Details + Administrator steps with shadcn/ui | `aa083e1` |
| 4     | Implement Clinical + Operational template selection steps | `e6acf93` |
| 5     | Implement Review step + RPC-based submission flow | `574fbf6` |
| 6     | Add comprehensive test coverage (215 tests across 8 files) | `c943443` |
| 7     | Cleanup old facility creation code, verify trigger behavior | `83be45a` |
| 8     | Adopt vertical sidebar layout with success screen | `5f8b7ec` |

## Key Files Created/Modified
- `app/admin/facilities/new/page.tsx` — WizardShell with sidebar nav, step management, success screen
- `app/admin/facilities/new/types.ts` — Shared interfaces, validation helpers, defaults
- `app/admin/facilities/new/FacilityStep.tsx` — Facility name, type, address, timezone, subscription
- `app/admin/facilities/new/AdminStep.tsx` — Administrator name, email, role, welcome email toggle
- `app/admin/facilities/new/ClinicalTemplatesStep.tsx` — Milestones, procedures, delay types, etc.
- `app/admin/facilities/new/OperationalTemplatesStep.tsx` — Cost categories, payers, flag rules, etc.
- `app/admin/facilities/new/ReviewStep.tsx` — Summary cards, template chips, edit-step navigation
- `app/admin/facilities/new/actions.ts` — `createFacilityWithTemplates()` submission logic
- `app/admin/facilities/new/__tests__/` — 8 test files, 215 total tests

## Architecture Decisions
- **Single RPC pattern**: All template seeding happens server-side in one atomic `seed_facility_with_templates(facility_id, template_config)` call. Frontend never copies templates directly.
- **JSONB config**: Each template category is a boolean key in the config. Defaults to `true` if omitted, so existing callers (triggers) still work without changes.
- **Conditional seeding**: Each section wrapped in `IF COALESCE((template_config->>'key')::boolean, true) THEN ... END IF`.
- **No OR rooms in wizard**: Deferred to a "get started" section on the facility dashboard.
- **Vertical sidebar layout**: Sticky 264px sidebar with step icons, descriptions, and a provision summary widget. Replaces the horizontal progress bar from the initial design.
- **Success screen**: Post-creation screen with "Create Another" (resets wizard) and "View Facility" (navigates to facility page) options.

## Database Changes
- `supabase/migrations/20260221_extend_seed_facility_templates.sql` — Extended `seed_facility_with_templates()` RPC:
  - Added `template_config JSONB DEFAULT '{}'` parameter
  - Added missing template categories: delay types, cost categories, implant companies, complexities, cancellation reasons, pre-op checklist fields, analytics settings, payer templates, notification settings
  - Each section conditionally gated by config key
  - Phase definitions seeding included as conditional section

## Known Limitations / Future Work
- Integration tests for downstream consumption (verify facility appears in list, detail page loads) are flagged but not yet written
- RPC template seeding verification tests (query each template table after creation) not yet written
- Empty template count edge case (all categories have 0 items) not explicitly tested
- OR room creation deferred to a separate "get started" dashboard flow
