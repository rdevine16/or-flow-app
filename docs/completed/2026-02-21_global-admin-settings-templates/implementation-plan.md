# Implementation Plan: Global Admin Settings Templates

## Summary
Create 5 new admin pages for managing global default templates: flag rules, phases, analytics settings, payers, and notifications. When a global admin configures these templates, they become the defaults seeded to newly created facilities. Each facility can then customize their own copy independently. This also enables the currently-disabled facility notifications page.

## Interview Notes
- **Flag rules admin page:** Full mirror of facility flag rules page (inline editing, category filters, debounced saves, custom rule builder drawer)
- **Phase templates admin page:** Full drag-and-drop reorder with @dnd-kit (mirror facility phases page)
- **Analytics admin page:** Full mirror of all 9+ sections from facility analytics settings
- **Notifications model:** Global admin defines notification type catalog; facilities toggle on/off + choose channels (push/in-app/email). Quiet hours and role-based recipients deferred.
- **Trigger chain fix:** Add `seed_facility_flag_rules()` + 3 new copy functions to `seed_facility_with_templates()` so all templates auto-seed on facility creation
- **payer_type cleanup:** Remove `payer_type` from DAL interface and query (column doesn't exist in DB)
- **Priority order:** Flag Rules > Phases > Analytics > Payers > Notifications

---

## Phase 1: Database Migration — New Tables, Functions, Trigger Chain
**Complexity:** Large
**What it does:**
- Create `analytics_settings_template` table (single-row, mirrors `facility_analytics_settings` columns + CHECK constraints)
- Create `payer_templates` table (id, name, display_order, is_active, soft-delete columns)
- Create `notification_settings_template` table (notification type catalog)
- Create `facility_notification_settings` table (per-facility enable/disable + channels)
- Add `source_template_id` column to `payers` table (nullable FK to `payer_templates`)
- Create `copy_analytics_settings_to_facility(p_facility_id)` function
- Create `copy_payer_templates_to_facility(p_facility_id)` function
- Create `copy_notification_settings_to_facility(p_facility_id)` function
- Update `seed_facility_with_templates()` to call `seed_facility_flag_rules()` + 3 new copy functions
- Add RLS policies: all can SELECT templates, only `global_admin` can manage
- Add soft-delete triggers to new tables
- Seed `analytics_settings_template` with current column defaults
- Seed `payer_templates` with common defaults (Medicare, Medicaid, Private Insurance, Workers Comp, Self-Pay)
- Seed `notification_settings_template` with notification types from the preview page
- Clean up `payer_type` from DAL interface and query

**Files touched:**
- `supabase/migrations/20260221000000_global_admin_settings_templates.sql` (create)
- `lib/dal/lookups.ts` (edit — remove payer_type from interface + select)

**Commit message:** `feat(admin-settings): phase 1 — database migration for templates, copy functions, trigger chain`

**3-stage test gate:**
1. **Unit:** Verify migration applies cleanly via `supabase db push`
2. **Integration:** Query new tables via REST API to confirm RLS + CHECK constraints work
3. **Workflow:** Verify `seed_facility_with_templates()` calls all copy functions (check function definition)

---

## Phase 2: Flag Rules Admin Page
**Complexity:** Large
**What it does:**
- Create admin page at `/admin/settings/flag-rules` mirroring the facility flag rules page
- Full mirror: inline editing, category filter tabs, debounced saves, custom rule builder drawer
- Queries `flag_rules WHERE facility_id IS NULL` (global templates)
- Info banner: "Changes apply to new facilities only. Existing facilities manage their own flag rules."
- Archive/restore for custom template rules
- Built-in rules are read-only (same as facility page)
- isGlobalAdmin gate with redirect

**Files touched:**
- `app/admin/settings/flag-rules/page.tsx` (create)

**Commit message:** `feat(admin-settings): phase 2 — flag rules admin page with full CRUD`

**3-stage test gate:**
1. **Unit:** Page renders with mock flag rules data, category filter works
2. **Integration:** CRUD operations (create/update/archive/restore) call correct Supabase queries with `facility_id IS NULL`
3. **Workflow:** Admin creates a custom template rule → rule appears in template list → archive it → view archived → restore it

---

## Phase 3: Phase Templates Admin Page
**Complexity:** Large
**What it does:**
- Create admin page at `/admin/settings/phases` mirroring the facility phases page
- Full drag-and-drop reorder with @dnd-kit (nesting, 3-zone detection)
- Queries `phase_definition_templates` table
- Dropdowns reference `milestone_types` (not `facility_milestones`) for start/end boundaries
- Create, edit (display name, boundaries, color, parent), archive, restore
- Info banner: "Changes apply to new facilities only."
- isGlobalAdmin gate

**Files touched:**
- `app/admin/settings/phases/page.tsx` (create)

**Commit message:** `feat(admin-settings): phase 3 — phase templates admin page with drag-and-drop`

**3-stage test gate:**
1. **Unit:** Page renders with mock phase templates, drag overlay shows
2. **Integration:** Reorder updates display_order in batch, create/edit/archive call correct table
3. **Workflow:** Admin creates phase template → reorders via drag → archives → views archived → restores

---

## Phase 4: Analytics Settings Template Admin Page
**Complexity:** Medium
**What it does:**
- Create admin page at `/admin/settings/analytics` mirroring the facility analytics settings page
- All 9+ collapsible sections with full field set
- Queries `analytics_settings_template` (single-row upsert pattern)
- Reset to Defaults restores original seed values
- Save validates against CHECK constraints client-side
- Info banner: "These defaults are applied to newly created facilities."
- isGlobalAdmin gate

**Files touched:**
- `app/admin/settings/analytics/page.tsx` (create)

**Commit message:** `feat(admin-settings): phase 4 — analytics settings template admin page`

**3-stage test gate:**
1. **Unit:** Page renders all 9 sections with correct default values
2. **Integration:** Save upserts to `analytics_settings_template`, validation rejects out-of-range values
3. **Workflow:** Admin changes FCOTS grace minutes → saves → refreshes → value persists → resets to defaults → saves

---

## Phase 5: Payer Templates Admin Page
**Complexity:** Small
**What it does:**
- Create admin page at `/admin/settings/payers` mirroring the facility payers page
- Standard CRUD table with add/edit modal, archive/restore
- Queries `payer_templates` table
- Info banner: "Changes apply to new facilities only."
- isGlobalAdmin gate

**Files touched:**
- `app/admin/settings/payers/page.tsx` (create)

**Commit message:** `feat(admin-settings): phase 5 — payer templates admin page`

**3-stage test gate:**
1. **Unit:** Page renders seeded payer templates, empty state when none
2. **Integration:** Create/edit/archive/restore call correct Supabase queries on `payer_templates`
3. **Workflow:** Admin adds "Blue Cross" payer template → edits name → archives → views archived → restores

---

## Phase 6: Notification Templates Admin Page + Facility Notifications Enable
**Complexity:** Large
**What it does:**
- Create admin page at `/admin/settings/notifications` for managing the notification type catalog
- Admin can create/edit/archive notification types, set default enabled state and default channels
- Grouped by category (case_alerts, schedule_alerts, etc.)
- Rewire facility `/settings/notifications/page.tsx` from static preview to live data:
  - Remove "Coming Soon" banner
  - Query `facility_notification_settings` for the facility
  - Enable toggle switches (on/off per notification type)
  - Enable channel selection (push/in-app/email checkboxes per notification type)
  - Remove quiet hours and role-based recipients sections (deferred)
- isGlobalAdmin gate on admin page

**Files touched:**
- `app/admin/settings/notifications/page.tsx` (create)
- `app/settings/notifications/page.tsx` (edit — enable UI, wire to DB)

**Commit message:** `feat(admin-settings): phase 6 — notification templates admin + facility notifications enabled`

**3-stage test gate:**
1. **Unit:** Admin page renders notification types grouped by category; facility page renders live toggles
2. **Integration:** Admin CRUD on `notification_settings_template`; facility toggles update `facility_notification_settings`
3. **Workflow:** Admin creates notification type → facility page shows it (disabled by default) → facility admin enables it → refreshes → persists

---

## Phase 7: Navigation Updates + Polish + Testing
**Complexity:** Medium
**What it does:**
- Add all 5 new admin pages to `adminNavGroups` in `navigation-config.tsx` under "Configuration" group
- Icons: flags (Flag), analytics (BarChart3), phases (Layers), payers (CreditCard), notifications (Bell)
- All nav items use `allowedRoles: ['global_admin']`
- Run full test suite: `npm run typecheck && npm run lint && npm run test`
- Fix any TypeScript errors, lint issues, or test failures
- Write tests for key pages (at minimum: flag rules admin, notification facility page)
- Final polish pass on all 5 admin pages for consistency

**Files touched:**
- `components/layouts/navigation-config.tsx` (edit)
- `app/admin/settings/flag-rules/__tests__/page.test.tsx` (create)
- `app/settings/notifications/__tests__/page.test.tsx` (create)

**Commit message:** `feat(admin-settings): phase 7 — navigation, tests, and polish`

**3-stage test gate:**
1. **Unit:** Nav config renders 5 new items for global admin, hidden for non-admin
2. **Integration:** All admin pages accessible from sidebar navigation
3. **Workflow:** `npm run typecheck && npm run lint && npm run test` all pass
