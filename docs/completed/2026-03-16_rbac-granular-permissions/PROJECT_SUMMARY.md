# Project: RBAC Overhaul — Granular Permissions & Financial Gating
**Completed:** 2026-03-16
**Branch:** feature/rbac-granular-permissions
**Duration:** 2026-03-16 → 2026-03-16
**Total Phases:** 10 (+ 2 refinement commits)

## What Was Built
A comprehensive overhaul of the role-based access control system, expanding from 30 permissions to 63 granular permissions. The project replaced all hardcoded `allowedRoles` and `isAdmin` checks with a unified `can()` permission system, added financial data gating across all surfaces (case drawer, dashboard, analytics, flags), and redesigned both the facility-level and global admin permissions pages with a two-column category/toggle layout.

The system now supports four web access levels (user, coordinator, facility_admin, global_admin) with configurable permissions per facility. Admin bypass is maintained for facility_admin and global_admin via permission templates that grant all permissions, rather than hardcoded checks. Financial data (dollar amounts, revenue, costs, margins, financial flags) is hidden for users without the `financials.view` permission.

## Phases Completed
| Phase | Description | Commit |
|-------|-------------|--------|
| 1 | Database migration — 33 new permissions, coordinator constraint, template fixes | `24921ba` |
| 2 | Remove settings.manage, add PERMISSION_KEYS constant | `6d9cfa0` |
| 3 | Replace allowedRoles with permission keys in navigation | `17ab1f1` |
| 4 | Page guards for cases, rooms, block schedule | `47f5770` |
| 5 | Page guards for analytics, SPD, data quality, staff management | `ac9eaeb` |
| 6 | Granular permission guards for all 20+ settings pages | `57b87dd` |
| 7 | Financial data gating in case drawer, dashboard, components | `726ad1f` |
| 8 | Financial flag gating with flags.financial permission | `d69f156` |
| 9 | Two-column permissions page redesign (facility + admin) | `2065e0f` |
| 10 | Cleanup, remove legacy role checks, final verification | `be313d2` |
| Post | View vs manage permission separation | `102097c` |
| Post | Consolidate redundant permissions, add descriptions to matrix | `0c6e659` |

## Key Files Created/Modified
- `lib/permissions.ts` (new) — PERMISSION_KEYS constant for type-safe permission references
- `lib/hooks/usePermissions.ts` — updated can() logic
- `components/layouts/navigation-config.tsx` — all nav items use permission keys
- `components/layouts/Sidebar.tsx` — permission-based filtering
- `lib/settings-nav-config.ts` — granular settings.* permission keys
- `components/permissions/PermissionMatrix.tsx` — expanded for 63 permissions, category grouping
- `app/settings/permissions/PageClient.tsx` — two-column redesign (facility-level)
- `app/admin/permission-templates/PageClient.tsx` — two-column redesign (global templates)
- `components/FeatureGate.tsx` — added permission prop support
- 50+ PageClient.tsx files — permission guards added
- 15+ test files — permission guard tests

## Architecture Decisions
- **Admin bypass via templates, not code:** facility_admin and global_admin get all permissions granted in `permission_templates`, rather than hardcoded `if (isAdmin) return true`. This means admins are configurable in theory, though in practice they should always have all permissions.
- **Exception: /admin/* routes** still use `access_level === 'global_admin'` check, as these are platform-level admin pages that should never be permission-gated.
- **AccessDenied pattern over redirects:** Pages show an `<AccessDenied />` component rather than redirecting, so users understand why they can't access a page.
- **View vs Manage separation:** Added separate view/manage permissions for rooms, SPD, data quality, staff management, and integrations to allow read-only access.
- **Financial flags:** Used `is_financial` boolean on `flag_rules` table to categorize flags, gated by `flags.financial` permission.
- **No middleware enforcement:** Permission checks are client-side only. RLS provides server-side protection. Middleware-level permission enforcement was explicitly out of scope.

## Database Changes
- Migration: `20260316025543_rbac_overhaul.sql` — 33 new permissions, coordinator constraint, template fixes
- Migration: `20260316040419_rbac_backfill_facility_permissions.sql` — backfill existing facilities
- Migration: `20260316050128_rbac_fix_settings_manage.sql` — remove settings.manage references
- Migration: `20260316063355_financial_flag_category.sql` — add is_financial to flag_rules
- Migration: `20260316083751_rbac_fix_permission_templates.sql` — fix template grants
- Migration: `20260316090909_rbac_add_view_manage_permissions.sql` — view/manage separation
- Migration: `20260316091907_rbac_consolidate_permissions.sql` — remove redundant view permissions
- Migration: `20260316092215_rbac_add_permission_descriptions.sql` — add descriptions column

## Known Limitations / Future Work
- 3 PermissionMatrix test failures (category rendering/filtering) — need investigation
- 6 lint warnings for `any` types in permission test files
- No middleware-level permission enforcement (client-side + RLS only)
- iOS app needs to adopt the new permission keys (uses same Supabase RPC)
- No workflow tests for multi-surface financial gating
- Permission composition (multiple permissions on same component) lacks integration tests
- `device_rep` access level is iOS-only, no web permissions
