# Project: Granular Permissions System
**Completed:** 2026-02-15
**Branch:** feat/permissions-system
**Duration:** 2026-02-14 → 2026-02-15
**Total Phases:** 6 (1, 2, 3, 4a, 4b, 5)

## What Was Built
A feature-level permissions system for ORbit's web application. The system uses a database-driven permission registry with per-facility customization. Global admins configure permission templates (defaults per access level), and when facilities are created they receive a copy. Facility admins can then customize permissions independently for their facility.

The architecture follows a Template → Facility → Resolution pattern. A single Supabase RPC function (`get_user_permissions`) resolves the final permission set for any user. The frontend consumes this via a `usePermissions` hook integrated into `UserContext`, exposing `can()`, `canAny()`, and `canAll()` helpers. Admin users (facility_admin, global_admin) always bypass the permission system with full access.

Two admin pages were built: a Global Admin "Permission Templates" page at `/admin/permission-templates` and a Facility Admin "Roles & Permissions" page at `/settings/permissions`. Both use a shared `PermissionMatrix` component with auto-save toggle switches. Permission gating was applied across all pages, navigation, action buttons, case drawer tabs, and component-level controls.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| docs  | Feature spec and implementation plan | 04c44ad |
| 1     | Database schema, seed data, RPC functions, backfill | 06b6e44 |
| 2     | usePermissions hook, UserContext integration, initial UI gating | 4383125 |
| 3     | Permission management admin pages with shared matrix component | c379c0b |
| 4a    | Navigation guards, route protection, deprecated property removal | 38a4691 |
| 4b    | Action button and component-level permission gating | f878be3 |
| 5     | Align permission keys with actual UI actions | 2f74a51 |

## Key Files Created/Modified

### New Files
- `lib/hooks/usePermissions.ts` — Permission resolution hook (calls RPC, exposes can/canAny/canAll)
- `components/permissions/PermissionMatrix.tsx` — Shared matrix component for both admin pages
- `components/permissions/PermissionGuard.tsx` — Route-level permission guard component
- `components/ui/AccessDenied.tsx` — "You don't have permission" in-page component
- `app/admin/permission-templates/page.tsx` — Global admin template editor
- `app/settings/permissions/page.tsx` — Facility admin permissions editor
- `supabase/migrations/20260215000000_permissions_system.sql` — Full schema migration
- `supabase/migrations/20260215000001_permissions_cleanup.sql` — Cleanup/alignment migration

### Modified Files
- `lib/UserContext.tsx` — Integrated usePermissions, removed deprecated properties (canCreateCases, isFacilityAdmin, isCoordinator)
- `components/layouts/navigation-config.tsx` — Added `permission` field to nav items, `getFilteredNavigation` accepts `can()`
- `components/layouts/DashboardLayout.tsx` — Passes `can()` to navigation filtering
- `components/settings/SettingsLayout.tsx` — Permission-gated settings navigation
- 27 page/component files — Added PermissionGuard wrapping and can() checks for action buttons

### Test Files
- `lib/hooks/__tests__/usePermissions.test.ts` — 10 tests (admin bypass, non-admin checks, canAny, canAll, errors)
- `lib/__tests__/UserContext.test.tsx` — 4 tests (role detection, admin bypass, can() integration)
- `components/permissions/__tests__/PermissionGuard.test.tsx` — 6 tests (grant, deny, custom fallback)
- `components/permissions/__tests__/PermissionMatrix.test.tsx` — 10 tests (rendering, toggles, bulk select)
- `components/layouts/__tests__/navigation-config.test.ts` — 19 tests (role filtering, permission gating, fallbacks)

## Architecture Decisions
- **Permission keys are plain strings** — No TypeScript enum. Maximum flexibility for adding new permissions without code changes.
- **Database is source of truth** — Permission definitions live in the `permissions` table. Adding a row there automatically surfaces it in both admin UIs.
- **Admin bypass at hook level** — `facility_admin` and `global_admin` always return `true` for all permissions, both in the RPC function and in the frontend hook.
- **Template push is new-facilities-only** — Editing templates doesn't retroactively change existing facilities. Facility independence is preserved.
- **Device reps excluded** — Device reps are separate entities (not in `users` table). Permission system only targets `user` and `coordinator` access levels.
- **Auto-save per toggle** — No "Save" button on admin pages. Each toggle immediately upserts. Brief toast confirmation.
- **Next page load only** — Permission changes take effect on next navigation/refresh. No real-time subscription needed.
- **RLS hardening deferred** — Permission-based RLS policies were deferred to a separate project. Current implementation is frontend-only gating with the database RPC as the resolution engine.

## Database Changes
- **Table: `permissions`** — Master registry of all 41 permission definitions (key, label, category, resource, action, sort_order)
- **Table: `permission_templates`** — Global admin blueprints (access_level × permission_key → granted)
- **Table: `facility_permissions`** — Per-facility permission overrides (facility_id × access_level × permission_key → granted)
- **Function: `get_user_permissions(p_user_id UUID)`** — RPC that resolves final permission set as JSONB
- **Function: `user_has_permission(p_key TEXT)`** — Helper for future RLS policies
- **Function: `copy_permission_template_to_facility(p_facility_id UUID)`** — Copies template defaults to a new facility
- **Migration: `20260215000000_permissions_system.sql`** — Full schema, seeds, functions, backfill
- **Migration: `20260215000001_permissions_cleanup.sql`** — Permission key alignment with actual UI actions
- **RLS policies** on all three new tables (authenticated read on permissions, admin management on templates, facility-scoped on facility_permissions)

## Known Limitations / Future Work
- **RLS hardening** — Permission-based RLS policies (e.g., `user_has_permission('financials.view')` on financial tables) deferred to separate project
- **Real-time updates** — Permission changes require page refresh to take effect
- **iOS parity** — iOS app needs to consume the `get_user_permissions` RPC (database layer is ready, client integration pending)
- **Integration tests** — Full end-to-end permission enforcement scenarios (e.g., restricted user blocked from page, admin grant enables feature) not yet automated
- **Pre-existing lint issues** — 710 lint problems (319 errors, 391 warnings) exist across the broader codebase, not introduced by this project
