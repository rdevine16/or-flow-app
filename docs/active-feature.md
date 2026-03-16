# Feature: RBAC Overhaul — Granular Permissions & Financial Gating

## Goal
Overhaul the role-based access control system to eliminate hardcoded admin bypasses, add 33 new granular permissions (especially for settings sub-pages and financial data), enforce permission-based gating on every page/nav item, and redesign the permissions settings page with a two-column layout. Every permission must be configurable per facility through the permissions UI — no hardcoded role checks.

## Requirements
1. Remove admin bypass from `usePermissions` hook and `get_user_permissions()` RPC
2. Add 33 new permissions (rooms, SPD, data quality, staff management, integrations, financial flags, 23 granular settings)
3. Fix 5 incorrect default grants (user+cases.create, coordinator+financials/analytics)
4. Replace all `allowedRoles` in navigation config with `permission` keys
5. Replace all `isAdmin`/`isGlobalAdmin` page guards with `can()` permission checks
6. Hide financial data (pages, tabs, widgets, flags) based on `financials.view` and `flags.financial` permissions
7. Redesign permissions settings page with two-column layout (categories left, toggles right)
8. Role-specific dashboard views with permission-gated widgets
9. Users have no settings access; coordinators get granular settings permissions
10. device_rep is iOS only — no web access level needed

## Database Context
- Table: `permissions` — master permission registry (key, label, description, category, resource, action)
- Table: `permission_templates` — global defaults per access_level+permission_key
- Table: `facility_permissions` — per-facility overrides (facility_id, access_level, permission_key, granted)
- RPC: `get_user_permissions()` — resolves final permission set for current user
- RPC: `copy_permission_template_to_facility()` — seeds new facilities

## UI/UX
- Route: /settings/permissions — two-column layout (category list left, permission toggles right)
- Dashboard: financial widgets hidden based on financials.view
- Navigation: items hidden (not locked) when permission is false
- Case detail: financial tab hidden based on tab.case_financials
- Financial flags: filtered by flags.financial permission
- Settings sub-pages: each gated by its own settings.* permission

## Files Likely Involved
- `lib/hooks/usePermissions.ts` — remove admin bypass
- `lib/UserContext.tsx` — ensure can() uses resolved permissions only
- `components/layouts/navigation-config.tsx` — replace allowedRoles with permission keys
- `components/layouts/Sidebar.tsx` — update filtering logic
- `app/settings/permissions/PageClient.tsx` — redesign with two-column layout
- `app/admin/permission-templates/PageClient.tsx` — update for new permissions
- ~40 page files — add/update permission guards
- `supabase/migrations/` — new migration for permissions + template updates
- `get_user_permissions()` RPC — remove bypass logic

## iOS Parity
- [ ] iOS equivalent needed (iOS uses same Supabase RPC, will inherit permission changes)
- [x] iOS can wait (web-first, iOS adapts later)

## Known Issues / Constraints
- Pre-existing typecheck errors in test files (mock types) — not blocking
- Admin bypass removal is breaking — must ensure admin templates grant all permissions first
- Existing `facility_permissions` rows for live facilities need migration to add new permission keys
- `settings.manage` will be kept alongside granular settings.* keys for backward compat during transition

## Out of Scope
- device_rep web access (iOS only)
- Middleware-level permission enforcement (client-side only for now)
- Subscription tier changes (separate system, unchanged)
- Admin panel (/admin/*) permission changes (stays global_admin-only by access_level check)

## Acceptance Criteria
- [ ] No hardcoded admin bypasses — all permissions resolved from DB
- [ ] 63 total permissions exist in permissions table
- [ ] Default templates correct for all 4 web access levels
- [ ] Every facility nav page gated by a permission key via can()
- [ ] No allowedRoles arrays remain in navigation config
- [ ] No isAdmin/isGlobalAdmin checks in page guards (except /admin/* which checks access_level)
- [ ] Financial data hidden for users without financials.view
- [ ] Financial flags hidden for users without flags.financial
- [ ] Permissions page uses two-column layout
- [ ] Dashboard hides financial widgets based on permissions
- [ ] All tests pass (`npm run typecheck && npm run lint && npm run test`)
- [ ] No TypeScript `any` types introduced
