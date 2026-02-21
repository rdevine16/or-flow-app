# Feature: Global Admin Settings Templates

## Goal
Create global admin pages for all facility settings that currently lack admin-level template management. When a global admin configures a setting, it becomes the default template for all newly created facilities. Facilities can then customize their own copy without affecting other facilities or the global defaults. This ensures consistent onboarding defaults while preserving per-facility autonomy.

## Requirements

### Flag Rules Admin Page (DB ready, UI only)
1. Create admin page at `/admin/settings/flag-rules` that manages flag rule templates (`flag_rules` where `facility_id IS NULL`)
2. Mirror the existing facility flag rules page (`/settings/flags/page.tsx`) layout and interactions
3. Admin can create, edit, archive, and restore template flag rules
4. Template rules use the existing hybrid pattern: `facility_id IS NULL` rows in the `flag_rules` table
5. New template rules are NOT auto-pushed to existing facilities (only seeded to new ones via `seed_facility_flag_rules()`)
6. Admin page must show an info banner: "Changes apply to new facilities only. Existing facilities manage their own flag rules."
7. Use existing `source_rule_id` column for template tracking
8. Global admin RLS already allows managing `facility_id IS NULL` rows

### Analytics Settings Admin Page (needs DB migration + UI)
9. Create `analytics_settings_template` table mirroring `facility_analytics_settings` columns (single-row, no `facility_id`)
10. Columns: `fcots_milestone`, `fcots_grace_minutes`, `fcots_target_percent`, `turnover_target_same_surgeon`, `turnover_target_flip_room`, `utilization_target_percent`, `cancellation_target_percent`, `start_time_milestone`, `start_time_grace_minutes`, `start_time_floor_minutes`, `waiting_on_surgeon_minutes`, `waiting_on_surgeon_floor_minutes`, `min_procedure_cases`
11. Carry over all CHECK constraints from `facility_analytics_settings`
12. Seed with current column defaults (e.g., `fcots_grace_minutes = 2`, `fcots_target_percent = 85`)
13. Create `copy_analytics_settings_to_facility(p_facility_id)` function that reads from `analytics_settings_template` and inserts into `facility_analytics_settings`
14. Update `seed_facility_with_templates()` or the facility creation trigger chain to call the new copy function
15. Create admin page at `/admin/settings/analytics` mirroring the facility analytics page (`/settings/analytics/page.tsx`)
16. RLS: all users can SELECT, only `global_admin` can UPDATE

### Phase Templates Admin Page (DB ready, UI only)
17. `phase_definition_templates` table already exists with columns: `name`, `display_name`, `display_order`, `start_milestone_type_id`, `end_milestone_type_id`, `color_key`, `is_active`
18. `seed_facility_phases()` already reads from `phase_definition_templates` — no DB changes needed
19. Create admin page at `/admin/settings/phases` to manage phase templates
20. Admin can create, edit, reorder, archive, and restore phase templates
21. Phase templates reference `milestone_types` (not `facility_milestones`) for start/end boundaries
22. Page should show milestone type names for the start/end boundary dropdowns
23. Info banner: "Changes apply to new facilities only."

### Payer Templates (needs DB migration + UI)
24. Create `payer_templates` table: `id`, `name`, `display_order`, `is_active`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`
25. Add RLS: all users can SELECT, only `global_admin` can INSERT/UPDATE/DELETE
26. Add soft delete trigger (`sync_soft_delete_columns()`)
27. Create `copy_payer_templates_to_facility(p_facility_id)` function
28. Add `source_template_id` column to `payers` table (nullable UUID FK to `payer_templates`)
29. Update facility creation trigger chain to call the payer copy function
30. Create admin page at `/admin/settings/payers` mirroring facility payers page (`/settings/financials/payers/page.tsx`)
31. Seed `payer_templates` with common defaults (e.g., "Medicare", "Medicaid", "Private Insurance", "Workers Comp", "Self-Pay")

### Notification Settings (needs DB migration + UI)
32. Create `notification_settings_template` table with default preferences per notification type
33. Columns: `id`, `notification_type` (text, e.g. 'case_started', 'delay_recorded'), `category` (text, e.g. 'case_alerts', 'schedule_alerts'), `display_label`, `default_enabled` (boolean), `default_channels` (text[] — push/in_app/email), `display_order`, `is_active`, `created_at`, `updated_at`, `deleted_at`, `deleted_by`
34. Create `facility_notification_settings` table: same columns + `facility_id`, `is_enabled`, `channels`
35. Create `copy_notification_settings_to_facility(p_facility_id)` function
36. Add to facility creation trigger chain
37. RLS: template table — all can SELECT, only global_admin can manage; facility table — scoped to own facility
38. Create admin page at `/admin/settings/notifications` to manage which notification types exist and their defaults
39. Update existing facility notifications page (`/settings/notifications/page.tsx`) to read from `facility_notification_settings` instead of hardcoded preview data
40. Remove the "Coming Soon" banner and enable the UI controls on the facility page

### Navigation Updates
41. Add all 5 new admin pages to `adminNavGroups` in `components/layouts/navigation-config.tsx` under the "Configuration" group
42. Use appropriate icons from the existing `navIcons` object (flags, analytics, milestones/phases, costCategories/payers, bell/notifications)
43. All new nav items use `allowedRoles: ['global_admin']`

## Database Context

### Existing Tables (no changes needed)
- `flag_rules` — hybrid table, `facility_id IS NULL` = template. Has `source_rule_id` for tracking.
- `phase_definition_templates` — dedicated template table, already seeded, already read by `seed_facility_phases()`
- `facility_analytics_settings` — facility KPI targets, 13+ configurable columns with CHECK constraints
- `payers` — facility-only table, `facility_id NOT NULL`, soft-delete columns exist

### New Tables
- `analytics_settings_template` — single-row defaults for analytics KPIs
- `payer_templates` — global payer name defaults
- `notification_settings_template` — global notification type definitions
- `facility_notification_settings` — per-facility notification preferences

### New Functions
- `copy_analytics_settings_to_facility(p_facility_id)` — reads template, inserts into `facility_analytics_settings`
- `copy_payer_templates_to_facility(p_facility_id)` — reads `payer_templates`, inserts into `payers`
- `copy_notification_settings_to_facility(p_facility_id)` — reads notification template, inserts into facility table

### Schema Changes to Existing Tables
- `payers` — add `source_template_id UUID REFERENCES payer_templates(id)`

### Trigger Updates
- Update facility creation trigger chain to call the 3 new copy functions

## UI/UX

### New Routes
- `/admin/settings/flag-rules` — Flag rule template management
- `/admin/settings/analytics` — Analytics KPI default management
- `/admin/settings/phases` — Phase template management
- `/admin/settings/payers` — Payer template management
- `/admin/settings/notifications` — Notification type/default management

### Pattern
All admin pages follow the same pattern as existing admin settings pages:
- `<DashboardLayout>` wrapper
- `isGlobalAdmin` check with redirect to `/dashboard` if unauthorized
- Info banner explaining template scope
- CRUD table with add/edit modal, archive/restore, search
- Soft delete via `is_active = false` / `deleted_at`

### Existing Pages to Update
- `/settings/notifications/page.tsx` — remove "Coming Soon", wire to `facility_notification_settings`

## Files Likely Involved

### Create
- `app/admin/settings/flag-rules/page.tsx` — admin flag rules page
- `app/admin/settings/analytics/page.tsx` — admin analytics defaults page
- `app/admin/settings/phases/page.tsx` — admin phase templates page
- `app/admin/settings/payers/page.tsx` — admin payer templates page
- `app/admin/settings/notifications/page.tsx` — admin notification templates page
- `supabase/migrations/YYYYMMDD_global_admin_settings_templates.sql` — all DB changes in one migration

### Modify
- `components/layouts/navigation-config.tsx` — add 5 nav items to `adminNavGroups` Configuration group
- `app/settings/notifications/page.tsx` — enable UI, wire to DB

### Reference (read-only, pattern guides)
- `app/admin/settings/delay-types/page.tsx` — example admin template page (hybrid pattern)
- `app/admin/settings/milestones/page.tsx` — example admin template page (separate table)
- `app/admin/settings/cost-categories/page.tsx` — example admin template page (dedicated template table)
- `app/settings/flags/page.tsx` — facility flag rules page to mirror
- `app/settings/analytics/page.tsx` — facility analytics page to mirror
- `app/settings/phases/page.tsx` — facility phases page to mirror
- `app/settings/financials/payers/page.tsx` — facility payers page to mirror
- `lib/dal/flag-rules.ts` — existing flag rules DAL
- `lib/dal/lookups.ts` — existing lookups DAL (payers, phases, milestones)

## iOS Parity
- [ ] iOS equivalent needed (iOS doesn't have admin settings — web only)
- [x] iOS can wait

## Known Issues / Constraints
- Template changes do NOT retroactively update existing facilities — by design
- `seed_facility_flag_rules()` only copies `is_built_in = true` templates — custom admin rules won't auto-seed unless we update this
- The notification system is currently preview-only — this feature enables it for real
- `payers` table has a `payer_type` column referenced in DAL interface but missing from DB schema — may need to add during migration or clean up the interface

## Out of Scope
- Syncing template changes to existing facilities (push updates)
- Default pricing templates (too variable by region)
- Per-user notification preferences (this feature is per-facility)
- Notification delivery infrastructure (push notifications, email sending)
- OR Rooms templates (inherently facility-specific)
- Surgeon preference templates (surgeon-specific)

## Acceptance Criteria
- [ ] Global admin can manage flag rule templates at `/admin/settings/flag-rules`
- [ ] Global admin can set default analytics KPI targets at `/admin/settings/analytics`
- [ ] Global admin can manage phase templates at `/admin/settings/phases`
- [ ] Global admin can manage payer templates at `/admin/settings/payers`
- [ ] Global admin can manage notification type defaults at `/admin/settings/notifications`
- [ ] New facilities receive copies of all template settings on creation
- [ ] Facility-level changes don't affect templates or other facilities
- [ ] Template changes don't affect existing facilities
- [ ] All 5 admin pages appear in admin sidebar under Configuration
- [ ] Facility notifications page is functional (no longer "Coming Soon")
- [ ] All new tables have proper RLS policies
- [ ] All new tables use soft delete pattern
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
