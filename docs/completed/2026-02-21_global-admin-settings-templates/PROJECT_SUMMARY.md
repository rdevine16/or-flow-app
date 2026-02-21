# Project: Global Admin Settings Templates
**Completed:** 2026-02-21
**Branch:** feature/global-admin-settings-templates
**Duration:** 2026-02-21 (single day)
**Total Phases:** 7

## What Was Built
Created 5 new admin pages for managing global default templates: flag rules, phases, analytics settings, payers, and notifications. When a global admin configures these templates, they become the defaults seeded to newly created facilities. Each facility can then customize their own copy independently.

This also enabled the previously-disabled facility notifications page — replacing the "Coming Soon" banner with live toggle switches and channel selection wired to the new `facility_notification_settings` table. The facility creation trigger chain (`seed_facility_with_templates`) was extended with 3 new copy functions to ensure all templates auto-seed on facility creation.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Database migration — new tables, copy functions, trigger chain | `236873f` |
| 2 | Flag rules admin page with full CRUD | `956bdba` |
| 3 | Phase templates admin page with drag-and-drop | `a011627` |
| 4 | Analytics settings template admin page | `50c601c` |
| 5 | Payer templates admin page | `2c857fe` |
| 6 | Notification templates admin + facility notifications enabled | `755ae47` |
| 7 | Navigation updates, tests, and polish | `2caad5d` |

## Key Files Created/Modified

### New Pages (created)
- `app/admin/settings/flag-rules/page.tsx` — Admin flag rule template management (inline editing, category filters, custom rule builder drawer)
- `app/admin/settings/phases/page.tsx` — Admin phase templates with drag-and-drop reorder (@dnd-kit)
- `app/admin/settings/analytics/page.tsx` — Admin analytics KPI defaults (single-row upsert, 5 collapsible sections, Reset to Defaults)
- `app/admin/settings/payers/page.tsx` — Admin payer templates (CRUD with add/edit modal, archive/restore)
- `app/admin/settings/notifications/page.tsx` — Admin notification type catalog (grouped by category, CRUD with modal, channel selection)

### New Test Files (created)
- `app/admin/settings/flag-rules/__tests__/page-integration.test.tsx` — 23 tests
- `app/admin/settings/analytics/__tests__/page.test.tsx` — 27 tests
- `app/admin/settings/payers/__tests__/page.test.tsx` — 15 tests
- `app/admin/settings/notifications/__tests__/page.test.tsx` — 27 tests
- `app/settings/notifications/__tests__/page.test.tsx` — 15 tests
- 180 total new tests across 8 test files

### Modified Files
- `components/layouts/navigation-config.tsx` — Added 5 nav items to Configuration group + icons (Flag, Layers, BarChart3, CreditCard, Bell)
- `app/settings/notifications/page.tsx` — Rewired from static "Coming Soon" to live DB toggles
- `lib/dal/lookups.ts` — Removed non-existent `payer_type` from interface and query

### Database Migration
- `supabase/migrations/20260221000000_global_admin_settings_templates.sql`

## Architecture Decisions
- **Template-to-facility copy pattern:** Each template table has a corresponding `copy_*_to_facility(p_facility_id)` function called by `seed_facility_with_templates()`. Templates are copied once at facility creation; subsequent template changes do NOT retroactively update existing facilities.
- **Flag rules hybrid pattern:** Flag rule templates live in the same `flag_rules` table with `facility_id IS NULL`. This reuses the existing `source_rule_id` tracking column.
- **Notifications two-table pattern:** `notification_settings_template` defines the catalog of notification types (global admin manages). `facility_notification_settings` stores per-facility enable/disable and channel preferences.
- **Analytics single-row upsert:** `analytics_settings_template` is a single-row table with CHECK constraints mirroring `facility_analytics_settings`. Client-side validation mirrors DB constraints.
- **Payer templates with source tracking:** `payers` table gained `source_template_id` FK to `payer_templates` for lineage tracking.
- **No retroactive sync:** Template changes only affect NEW facilities. Existing facilities are unaffected by design.

## Database Changes

### New Tables
- `analytics_settings_template` — Single-row analytics KPI defaults (13 configurable columns + CHECK constraints)
- `payer_templates` — Global payer name defaults (name, display_order, soft-delete)
- `notification_settings_template` — Global notification type catalog (type, category, display_label, default_enabled, default_channels)
- `facility_notification_settings` — Per-facility notification preferences (facility_id, notification_type, is_enabled, channels)

### New Columns
- `payers.source_template_id` — Nullable FK to `payer_templates(id)`

### New Functions
- `copy_analytics_settings_to_facility(p_facility_id)` — Reads template, inserts into `facility_analytics_settings`
- `copy_payer_templates_to_facility(p_facility_id)` — Reads `payer_templates`, inserts into `payers`
- `copy_notification_settings_to_facility(p_facility_id)` — Reads notification template, inserts into `facility_notification_settings`

### Updated Functions
- `seed_facility_with_templates(p_facility_id)` — Now calls `seed_facility_flag_rules()` + 3 new copy functions

### RLS Policies
- All template tables: all users can SELECT, only `global_admin` can INSERT/UPDATE/DELETE
- `facility_notification_settings`: scoped to own facility via `facility_id`

### Seed Data
- `analytics_settings_template`: 1 row with production defaults
- `payer_templates`: 5 rows (Medicare, Medicaid, Private Insurance, Workers Compensation, Self-Pay)
- `notification_settings_template`: 13 notification types across 4 categories

### Migration File
- `supabase/migrations/20260221000000_global_admin_settings_templates.sql`

## Known Limitations / Future Work
- Template changes do NOT retroactively update existing facilities (by design, but a "push to all" feature could be added later)
- `seed_facility_flag_rules()` only copies `is_built_in = true` templates — custom admin rules won't auto-seed unless updated
- Notification delivery infrastructure not built (no actual push/email sending)
- Per-user notification preferences deferred (current system is per-facility)
- Quiet hours and role-based notification recipients deferred
