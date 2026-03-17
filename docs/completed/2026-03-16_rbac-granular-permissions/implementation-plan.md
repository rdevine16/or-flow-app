# Implementation Plan: RBAC Overhaul — Granular Permissions & Financial Gating

## Summary
Overhaul the permission system to add 33 new granular permissions (63 total), fix incorrect defaults, replace all `allowedRoles`/`isAdmin` checks with `can()` permission calls, hide financial data for non-financial roles, and redesign the permissions settings page with a two-column layout. Admin bypass is **kept** for `facility_admin` and `global_admin`. Only `user` and `coordinator` permissions are configurable.

## Interview Notes
- **Admin bypass stays** — `global_admin` and `facility_admin` always have all permissions (both in hook and RPC)
- **Admin panel** (`/admin/*`) — kept as `access_level === 'global_admin'` check (exception to "no hardcoded" rule)
- **`device_rep`** — iOS only, no web permissions needed
- **`settings.manage`** — DELETE entirely, replaced by 23 granular `settings.*` keys
- **Dashboard** — keep separate views per role, don't restructure. Just ensure financial widgets respect permissions.
- **Financial flags** — categorization approach TBD during implementation (Phase 8)
- **Permissions UI** — two-column: tabs (User/Coordinator) at top, category list left, toggles right
- **Coordinator defaults** — no financials, no analytics, no scores. Has scheduling and operational settings.
- **User defaults** — no case creation, no settings, no scheduling. Can view/edit cases and manage milestones.
- **DB constraint** — add `coordinator` to `valid_access_level` CHECK constraint
- **Phase count** — 8-12 standard phases

---

## Phase 1: Database Migration — New Permissions + Constraint Fix
**Complexity: Large**

**What it does:**
- Add `coordinator` to the `valid_access_level` CHECK constraint on `users` table
- Insert 33 new permissions into the `permissions` table
- Delete `settings.manage` permission (cascade deletes from templates + facility_permissions)
- Insert `permission_templates` rows for `user` and `coordinator` for all new permissions
- Fix incorrect defaults: revoke `cases.create` from `user`, revoke `financials.view`/`tab.case_financials`/`analytics.view`/`scores.view` from `coordinator`
- Update `copy_permission_template_to_facility()` to handle new permissions
- Backfill `facility_permissions` for all existing facilities with new permission keys

**Files touched:**
- `supabase/migrations/YYYYMMDDHHMMSS_rbac_overhaul.sql` (new)

**Commit message:** `feat(rbac): phase 1 - add 33 permissions, fix defaults, add coordinator constraint`

**3-stage test gate:**
1. **Unit:** Verify migration applies cleanly, all 63 permissions exist, templates correct
2. **Integration:** Call `get_user_permissions()` for each access level, verify correct grants
3. **Workflow:** Create a test user with `coordinator` access level, verify constraint accepts it

---

## Phase 2: Remove `settings.manage` References + Add Permission Type Safety
**Complexity: Medium**

**What it does:**
- Search all codebase references to `settings.manage` and replace with appropriate granular `settings.*` keys
- Update `settings-nav-config.ts` — replace `settings.manage` permission on each settings item with its corresponding granular key
- Update `PermissionMatrix` component to handle new categories and the expanded permission set
- Add a `PERMISSION_KEYS` constant object (not enum) for IDE autocomplete and typo prevention

**Files touched:**
- `lib/settings-nav-config.ts` — update permission keys on all settings nav items
- `components/permissions/PermissionMatrix.tsx` — handle new categories
- `lib/permissions.ts` (new) — `PERMISSION_KEYS` constant
- Any page/component referencing `settings.manage`

**Commit message:** `feat(rbac): phase 2 - replace settings.manage with granular keys, add PERMISSION_KEYS`

**3-stage test gate:**
1. **Unit:** PERMISSION_KEYS constant covers all 63 keys
2. **Integration:** Settings nav filtering returns correct items for coordinator vs user
3. **Workflow:** Coordinator with `settings.rooms` granted sees Rooms settings but not General settings

---

## Phase 3: Navigation Config — Replace `allowedRoles` with Permission Keys
**Complexity: Medium**

**What it does:**
- Replace all `allowedRoles` arrays in `navigation-config.tsx` with `permission` keys
- Update `getFilteredNavigation()` to only use `can()` — remove `allowedRoles` fallback logic
- Add permission keys to nav items that currently lack them: Rooms (`rooms.view`), SPD (`spd.view`), Data Quality (`data_quality.view`), Staff Management (`staff_management.view`)
- Remove the `allowedRoles` property from the `NavItem` type
- Update Sidebar component if needed

**Files touched:**
- `components/layouts/navigation-config.tsx` — all nav items
- `components/layouts/Sidebar.tsx` — update filtering if needed
- Types file for `NavItem` type

**Commit message:** `feat(rbac): phase 3 - replace allowedRoles with permission keys in navigation`

**3-stage test gate:**
1. **Unit:** Every nav item has a `permission` key (no `allowedRoles` remain)
2. **Integration:** `getFilteredNavigation()` returns correct items for each access level
3. **Workflow:** User sees only Dashboard, Rooms, Cases in sidebar. Coordinator sees Dashboard, Rooms, Block Schedule, Cases, Settings.

---

## Phase 4: Page Guards — Cases, Rooms, Block Schedule
**Complexity: Medium**

**What it does:**
- Add/update permission guards on all case-related pages:
  - `/cases` list — `can('cases.view')`
  - `/cases/new` — `can('cases.create')` with AccessDenied
  - `/cases/bulk-create` — `can('cases.create')` with AccessDenied
  - `/cases/[id]` — `can('cases.view')`
  - `/cases/[id]/edit` — `can('cases.edit')` with AccessDenied
  - `/cases/[id]/cancel` — `can('cases.delete')` with AccessDenied
- Add permission guards on rooms page: `can('rooms.view')`
- Add permission guards on block schedule: `can('scheduling.view')`
- Hide "New Case" / "Bulk Create" buttons when `!can('cases.create')`
- Use consistent `<AccessDenied />` pattern (not redirects)

**Files touched:**
- `app/cases/PageClient.tsx`
- `app/cases/new/PageClient.tsx`
- `app/cases/bulk-create/PageClient.tsx`
- `app/cases/[id]/PageClient.tsx`
- `app/cases/[id]/edit/PageClient.tsx`
- `app/cases/[id]/cancel/PageClient.tsx`
- `app/rooms/PageClient.tsx`
- `app/block-schedule/PageClient.tsx`

**Commit message:** `feat(rbac): phase 4 - add permission guards to cases, rooms, block schedule pages`

**3-stage test gate:**
1. **Unit:** Each page checks the correct permission key
2. **Integration:** User without `cases.create` sees AccessDenied on /cases/new
3. **Workflow:** User logs in → sees cases list → cannot create → can edit existing case → cannot cancel

---

## Phase 5: Page Guards — Analytics, SPD, Data Quality, Staff Management
**Complexity: Medium**

**What it does:**
- Replace `isAdmin` checks with `can()` on:
  - `/analytics` and sub-pages — `can('analytics.view')`
  - `/analytics/financials` — `can('analytics.view') && can('financials.view')`
  - `/spd` — `can('spd.view')`
  - `/data-quality` — `can('data_quality.view')`
  - `/staff-management` — `can('staff_management.view')`
- Ensure financial analytics sub-pages additionally check `can('financials.view')`
- Use consistent `<AccessDenied />` pattern

**Files touched:**
- `app/analytics/PageClient.tsx`
- `app/analytics/financials/PageClient.tsx`
- `app/analytics/financials/procedures/[id]/PageClient.tsx`
- `app/analytics/financials/surgeons/[id]/PageClient.tsx`
- `app/analytics/kpi/PageClient.tsx`
- `app/analytics/orbit-score/PageClient.tsx`
- `app/analytics/flags/PageClient.tsx`
- `app/analytics/surgeons/PageClient.tsx`
- `app/analytics/block-utilization/PageClient.tsx`
- `app/spd/PageClient.tsx`
- `app/data-quality/PageClient.tsx`
- `app/staff-management/PageClient.tsx`

**Commit message:** `feat(rbac): phase 5 - add permission guards to analytics, SPD, data quality, staff management`

**3-stage test gate:**
1. **Unit:** Each page checks the correct permission key(s)
2. **Integration:** Coordinator without `analytics.view` sees AccessDenied on /analytics
3. **Workflow:** Facility admin sees all pages. Coordinator sees only what's granted.

---

## Phase 6: Page Guards — Settings Sub-Pages
**Complexity: Large**

**What it does:**
- Add granular permission guards to every settings sub-page:
  - `/settings` hub — `can('settings.view')` (keep existing)
  - `/settings/general` — `can('settings.general')`
  - `/settings/rooms` — `can('settings.rooms')`
  - `/settings/procedures` — `can('settings.procedures')`
  - `/settings/milestones` — `can('settings.milestones')`
  - `/settings/flags` — `can('settings.flags')`
  - `/settings/delay-types` — `can('settings.delays')`
  - `/settings/complexities` — `can('settings.complexities')`
  - `/settings/implant-companies` — `can('settings.implant_companies')`
  - `/settings/cancellation-reasons` — `can('settings.cancellation_reasons')`
  - `/settings/closures` — `can('settings.closures')`
  - `/settings/checklist-builder` — `can('settings.checklist')`
  - `/settings/surgeon-preferences` — `can('settings.surgeon_preferences')`
  - `/settings/voice-commands` — `can('settings.voice_commands')`
  - `/settings/notifications` — `can('settings.notifications')`
  - `/settings/device-reps` — `can('settings.device_reps')`
  - `/settings/analytics` — `can('settings.analytics')`
  - `/settings/permissions` — `can('settings.permissions')`
  - `/settings/subscription` — `can('settings.subscription')`
  - `/settings/audit-log` — `can('audit.view')`
  - `/settings/financials/*` — `can('financials.view')` + specific `settings.financials.*` key
  - `/settings/integrations/*` — `can('integrations.view')` + `can('integrations.manage')`
- Update settings hub to filter visible cards based on permissions

**Files touched:**
- All 20+ settings PageClient.tsx files
- `app/settings/PageClient.tsx` (hub page)

**Commit message:** `feat(rbac): phase 6 - add granular permission guards to all settings pages`

**3-stage test gate:**
1. **Unit:** Each settings page checks its specific `settings.*` permission
2. **Integration:** Coordinator with `settings.rooms` can access rooms settings, denied on general settings
3. **Workflow:** User sees no settings nav item. Coordinator sees settings → only granted sub-pages visible.

---

## Phase 7: Financial Data Gating — Case Drawer, Dashboard, Components
**Complexity: Medium**

**What it does:**
- Gate financial data in case detail/drawer with `can('tab.case_financials')` and `can('financials.view')`
- Hide financial tab in case drawer when permission is false
- Hide financial KPI widgets on dashboard based on `can('financials.view')`
- Hide financial columns in any case list tables (if applicable)
- Ensure `<FeatureGate>` component respects permissions in addition to tiers
- Review all components that display dollar amounts and ensure they're behind permission checks

**Files touched:**
- `app/cases/[id]/PageClient.tsx` — financial tab gating
- Case drawer component(s)
- `app/dashboard/PageClient.tsx` — financial widget gating
- `components/FeatureGate.tsx` — add permission prop support (optional)
- Any component rendering `$`, `revenue`, `cost`, `profit`, `margin`

**Commit message:** `feat(rbac): phase 7 - gate financial data in case drawer, dashboard, and components`

**3-stage test gate:**
1. **Unit:** Case drawer hides financials tab when `tab.case_financials` is false
2. **Integration:** User without `financials.view` sees no dollar amounts anywhere
3. **Workflow:** Coordinator logs in → opens case → no financial tab → goes to dashboard → no financial widgets

---

## Phase 8: Financial Flag Gating
**Complexity: Medium**

**What it does:**
- Investigate current flag categorization (flag_rules table structure)
- Add `is_financial` boolean to flag_rules if no suitable category exists (or use existing category)
- Filter financial flags from case views when `can('flags.financial')` is false
- Filter financial flags from analytics/flag pages
- Update flag creation UI to mark flags as financial (admin-only setting)
- Add migration if schema change needed

**Files touched:**
- `supabase/migrations/YYYYMMDDHHMMSS_financial_flag_category.sql` (if needed)
- Flag-related components (flag list, flag creation, flag analytics)
- `app/analytics/flags/PageClient.tsx`
- Case drawer flag tab components

**Commit message:** `feat(rbac): phase 8 - gate financial flags with flags.financial permission`

**3-stage test gate:**
1. **Unit:** Financial flags filtered when `flags.financial` is false
2. **Integration:** Flag list for user shows only non-financial flags
3. **Workflow:** Admin creates financial flag → user views case → flag not visible → admin views → flag visible

---

## Phase 9: Permissions Settings Page Redesign (Two-Column Layout)
**Complexity: Large**

**What it does:**
- Redesign **two pages** with the same two-column layout:
  1. **`/settings/permissions`** (Facility Admin) — configures `facility_permissions` for this facility only
  2. **`/admin/permission-templates`** (Global Admin) — configures `permission_templates` that seed NEW facilities only (does not alter existing facilities)
- Layout for both:
  - **Top:** Tabs for `User` | `Coordinator`
  - **Left panel (280px):** Searchable category list (Cases, Case Operations, Case Tabs, Rooms, Scheduling, Financials, Analytics, SPD, Data Quality, Staff Management, Integrations, Settings, Financial Settings, Admin)
  - **Right panel:** Permission toggles for selected category, using the existing `PermissionMatrix` pattern
- Update the `PermissionMatrix` component to handle the expanded 63-permission set
- Add category counts (e.g., "Cases (4)", "Settings (18)")
- Follow the voice-commands settings page pattern for layout
- Global admin page shows a clear note: "These defaults apply to newly created facilities. Existing facilities manage their own permissions."
- Keep existing "Push Defaults" / sync functionality on the admin page (optional manual push)

**Files touched:**
- `app/settings/permissions/PageClient.tsx` — full redesign (facility-level)
- `app/admin/permission-templates/PageClient.tsx` — full redesign (global templates)
- `components/permissions/PermissionMatrix.tsx` — update for new categories

**Commit message:** `feat(rbac): phase 9 - redesign permissions pages with two-column layout`

**3-stage test gate:**
1. **Unit:** All 63 permissions render correctly grouped by category on both pages
2. **Integration:** Facility page toggles update `facility_permissions`. Admin page toggles update `permission_templates`.
3. **Workflow:** Global admin sets template defaults → creates new facility → new facility inherits templates. Facility admin customizes their permissions → changes don't affect other facilities.

---

## Phase 10: Cleanup + Final Verification
**Complexity: Medium**

**What it does:**
- Remove any remaining `isAdmin`/`isGlobalAdmin` checks in page guards (except `/admin/*`)
- Remove `allowedRoles` from NavItem type definition
- Remove `settings.manage` from any remaining references
- Run full typecheck, lint, and test suite
- Verify every page for each role (user, coordinator, facility_admin, global_admin)
- Update `rbac-audit.md` with final state
- Clean up any TODO comments added during implementation

**Files touched:**
- Various cleanup across all modified files
- `docs/rbac-audit.md` — update with final state
- Type definitions

**Commit message:** `feat(rbac): phase 10 - cleanup, remove legacy role checks, final verification`

**3-stage test gate:**
1. **Unit:** `npm run typecheck && npm run lint` pass with zero errors
2. **Integration:** No `allowedRoles` or `isAdmin` page guards remain (grep verification)
3. **Workflow:** Full walkthrough as each role: user, coordinator, facility_admin, global_admin — verify correct access everywhere

---

## Phase Dependencies

```
Phase 1 (DB migration)
  ↓
Phase 2 (settings.manage removal + type safety)
  ↓
Phase 3 (navigation config)     ← can run parallel with Phase 4-6
  ↓
Phase 4 (page guards: cases/rooms/schedule)
  ↓
Phase 5 (page guards: analytics/SPD/DQ/staff)
  ↓
Phase 6 (page guards: settings)
  ↓
Phase 7 (financial data gating)  ← depends on Phase 4-6
  ↓
Phase 8 (financial flag gating)  ← depends on Phase 7
  ↓
Phase 9 (permissions UI redesign) ← depends on Phase 1-2
  ↓
Phase 10 (cleanup + verification) ← depends on all
```
