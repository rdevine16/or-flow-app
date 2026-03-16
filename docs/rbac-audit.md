# RBAC Audit — ORbit Web App (Final State)

## Status: COMPLETE (Phases 1–10)

All 10 phases of the RBAC overhaul have been implemented. This document reflects the **final state** of the permission system.

---

## Access Levels (Web Only)

| Level | Description | Web Access |
|---|---|---|
| `user` | OR staff (nurses, circulators) | Yes |
| `coordinator` | OR coordinator, scheduler | Yes |
| `facility_admin` | Facility administrator | Yes |
| `global_admin` | Platform administrator | Yes |
| `device_rep` | Medical device representative | **No** (iOS only) |

---

## Architecture

### Permission Resolution
1. **Admin bypass**: `facility_admin` and `global_admin` always have ALL permissions (both in `usePermissions` hook and `get_user_permissions()` RPC)
2. **Configurable roles**: `user` and `coordinator` permissions are configurable per-facility via `facility_permissions`
3. **Templates**: `permission_templates` provide defaults that seed new facilities via `copy_permission_template_to_facility()`
4. **63 total permissions** across 14 categories

### Key Design Decisions
- Admin bypass is **intentional** — admins always have full access, simplifies management
- `/admin/*` pages use `isGlobalAdmin` access level check (exception to permission-based gating)
- `isGlobalAdmin` in non-admin pages is used for UX (facility selector, redirect when no facility selected) — not page guards
- `settings.manage` has been **deleted** — replaced by 23 granular `settings.*` keys
- `allowedRoles` has been **removed** from `NavItem` type — all navigation uses `permission` keys

---

## Complete Permission Matrix (63 Permissions)

### Cases (4)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `cases.view` | ✅ | ✅ | ✅ (bypass) | ✅ (bypass) |
| `cases.create` | ❌ | ✅ | ✅ | ✅ |
| `cases.edit` | ✅ | ✅ | ✅ | ✅ |
| `cases.delete` | ❌ | ✅ | ✅ | ✅ |

### Case Operations (8)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `milestones.view` | ✅ | ✅ | ✅ | ✅ |
| `milestones.manage` | ✅ | ✅ | ✅ | ✅ |
| `flags.view` | ✅ | ✅ | ✅ | ✅ |
| `flags.create` | ✅ | ✅ | ✅ | ✅ |
| `flags.delete` | ❌ | ✅ | ✅ | ✅ |
| `flags.financial` | ❌ | ❌ | ✅ | ✅ |
| `staff.view` | ✅ | ✅ | ✅ | ✅ |
| `staff.create` | ❌ | ✅ | ✅ | ✅ |
| `staff.delete` | ❌ | ✅ | ✅ | ✅ |
| `implants.view` | ✅ | ✅ | ✅ | ✅ |
| `implants.edit` | ❌ | ✅ | ✅ | ✅ |

### Case Tabs (4)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `tab.case_financials` | ❌ | ❌ | ✅ | ✅ |
| `tab.case_milestones` | ✅ | ✅ | ✅ | ✅ |
| `tab.case_flags` | ✅ | ✅ | ✅ | ✅ |
| `tab.case_validation` | ✅ | ✅ | ✅ | ✅ |

### Rooms (2)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `rooms.view` | ✅ | ✅ | ✅ | ✅ |
| `rooms.manage` | ❌ | ✅ | ✅ | ✅ |

### Scheduling (4)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `scheduling.view` | ❌ | ✅ | ✅ | ✅ |
| `scheduling.create` | ❌ | ✅ | ✅ | ✅ |
| `scheduling.edit` | ❌ | ✅ | ✅ | ✅ |
| `scheduling.delete` | ❌ | ✅ | ✅ | ✅ |

### Financials (1)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `financials.view` | ❌ | ❌ | ✅ | ✅ |

### Analytics (2)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `analytics.view` | ❌ | ❌ | ✅ | ✅ |
| `scores.view` | ❌ | ❌ | ✅ | ✅ |

### SPD (2)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `spd.view` | ❌ | ❌ | ✅ | ✅ |
| `spd.manage` | ❌ | ❌ | ✅ | ✅ |

### Data Quality (1)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `data_quality.view` | ❌ | ❌ | ✅ | ✅ |

### Staff Management (2)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `staff_management.view` | ❌ | ❌ | ✅ | ✅ |
| `staff_management.manage` | ❌ | ❌ | ✅ | ✅ |

### Integrations (2)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `integrations.view` | ❌ | ❌ | ✅ | ✅ |
| `integrations.manage` | ❌ | ❌ | ✅ | ✅ |

### Settings (18)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `settings.view` | ❌ | ✅ | ✅ | ✅ |
| `settings.general` | ❌ | ❌ | ✅ | ✅ |
| `settings.rooms` | ❌ | ✅ | ✅ | ✅ |
| `settings.procedures` | ❌ | ✅ | ✅ | ✅ |
| `settings.milestones` | ❌ | ✅ | ✅ | ✅ |
| `settings.flags` | ❌ | ✅ | ✅ | ✅ |
| `settings.delays` | ❌ | ✅ | ✅ | ✅ |
| `settings.complexities` | ❌ | ❌ | ✅ | ✅ |
| `settings.implant_companies` | ❌ | ❌ | ✅ | ✅ |
| `settings.cancellation_reasons` | ❌ | ✅ | ✅ | ✅ |
| `settings.closures` | ❌ | ✅ | ✅ | ✅ |
| `settings.checklist` | ❌ | ✅ | ✅ | ✅ |
| `settings.surgeon_preferences` | ❌ | ✅ | ✅ | ✅ |
| `settings.voice_commands` | ❌ | ❌ | ✅ | ✅ |
| `settings.notifications` | ❌ | ✅ | ✅ | ✅ |
| `settings.device_reps` | ❌ | ❌ | ✅ | ✅ |
| `settings.analytics` | ❌ | ❌ | ✅ | ✅ |
| `settings.permissions` | ❌ | ❌ | ✅ | ✅ |
| `settings.subscription` | ❌ | ❌ | ✅ | ✅ |
| `users.view` | ❌ | ✅ | ✅ | ✅ |
| `users.manage` | ❌ | ❌ | ✅ | ✅ |
| `audit.view` | ❌ | ❌ | ✅ | ✅ |

### Financial Settings (5)
| Key | User | Coordinator | Facility Admin | Global Admin |
|---|---|---|---|---|
| `settings.financials.cost_categories` | ❌ | ❌ | ✅ | ✅ |
| `settings.financials.payers` | ❌ | ❌ | ✅ | ✅ |
| `settings.financials.procedure_pricing` | ❌ | ❌ | ✅ | ✅ |
| `settings.financials.surgeon_variance` | ❌ | ❌ | ✅ | ✅ |
| `settings.financials.targets` | ❌ | ❌ | ✅ | ✅ |

---

## Page-by-Page Access Map

| Page | Permission Gate | User | Coord | Fac Admin | Global Admin |
|---|---|---|---|---|---|
| **Dashboard** | (always visible, widgets filtered) | ✅ | ✅ | ✅ | ✅ |
| **Rooms** | `rooms.view` | ✅ | ✅ | ✅ | ✅ |
| **Block Schedule** | `scheduling.view` | ❌ | ✅ | ✅ | ✅ |
| **Cases (list)** | `cases.view` | ✅ | ✅ | ✅ | ✅ |
| **Cases (create)** | `cases.create` | ❌ | ✅ | ✅ | ✅ |
| **Cases (edit)** | `cases.edit` | ✅ | ✅ | ✅ | ✅ |
| **Cases (delete)** | `cases.delete` | ❌ | ✅ | ✅ | ✅ |
| **Case Detail** | `cases.view` | ✅ | ✅ | ✅ | ✅ |
| **Case Financials Tab** | `tab.case_financials` | ❌ | ❌ | ✅ | ✅ |
| **SPD** | `spd.view` | ❌ | ❌ | ✅ | ✅ |
| **Analytics** | `analytics.view` | ❌ | ❌ | ✅ | ✅ |
| **Analytics > Financials** | `analytics.view` + `financials.view` | ❌ | ❌ | ✅ | ✅ |
| **Data Quality** | `data_quality.view` | ❌ | ❌ | ✅ | ✅ |
| **Staff Management** | `staff_management.view` | ❌ | ❌ | ✅ | ✅ |
| **Settings (hub)** | `settings.view` | ❌ | ✅ | ✅ | ✅ |
| **Settings > General** | `settings.general` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Rooms** | `settings.rooms` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Procedures** | `settings.procedures` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Milestones** | `settings.milestones` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Flags** | `settings.flags` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Delays** | `settings.delays` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Complexities** | `settings.complexities` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Implant Cos** | `settings.implant_companies` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Cancel Reasons** | `settings.cancellation_reasons` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Closures** | `settings.closures` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Checklists** | `settings.checklist` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Surgeon Prefs** | `settings.surgeon_preferences` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Voice Cmds** | `settings.voice_commands` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Notifications** | `settings.notifications` | ❌ | ✅ | ✅ | ✅ |
| **Settings > Device Reps** | `settings.device_reps` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Analytics** | `settings.analytics` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Permissions** | `settings.permissions` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Subscription** | `settings.subscription` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Audit Log** | `audit.view` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Financials Hub** | `financials.view` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Cost Categories** | `settings.financials.cost_categories` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Payers** | `settings.financials.payers` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Procedure Pricing** | `settings.financials.procedure_pricing` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Surgeon Variance** | `settings.financials.surgeon_variance` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Financial Targets** | `settings.financials.targets` | ❌ | ❌ | ✅ | ✅ |
| **Settings > Integrations** | `integrations.view` | ❌ | ❌ | ✅ | ✅ |
| **Admin Panel** | `global_admin` access level (not permission) | ❌ | ❌ | ❌ | ✅ |

---

## What Was Completed (Phases 1–10)

### Phase 1: Database Migration
- Added `coordinator` to `valid_access_level` CHECK constraint
- Inserted 33 new permissions (63 total)
- Deleted `settings.manage` permission with cascade
- Fixed incorrect defaults for `user` and `coordinator`
- Backfilled `facility_permissions` for all existing facilities

### Phase 2: Type Safety + settings.manage Removal
- Created `PERMISSION_KEYS` constant in `lib/permissions.ts` for IDE autocomplete
- Replaced all code references to `settings.manage` with granular `settings.*` keys
- Updated `PermissionMatrix` component for expanded permission set

### Phase 3: Navigation Config
- Replaced all `allowedRoles` arrays with `permission` keys in `navigation-config.tsx`
- Removed `allowedRoles` from `NavItem` type definition
- Updated `getFilteredNavigation()` to use only `can()`

### Phase 4: Page Guards — Cases, Rooms, Block Schedule
- Added `can()` permission guards to all case pages, rooms, and block schedule
- Used consistent `<AccessDenied />` pattern

### Phase 5: Page Guards — Analytics, SPD, Data Quality, Staff
- Replaced `isAdmin` page guards with `can()` on analytics, SPD, data quality, staff management
- Financial analytics pages additionally check `financials.view`

### Phase 6: Page Guards — Settings Sub-Pages
- Added granular `settings.*` permission guards to all 20+ settings pages
- Updated settings hub to filter visible cards by permissions

### Phase 7: Financial Data Gating
- Gated financial tab in case drawer with `tab.case_financials`
- Hidden financial KPI widgets on dashboard for users without `financials.view`
- Gated financial columns in case list tables

### Phase 8: Financial Flag Gating
- Added `is_financial` boolean to `flag_rules` table
- Filtered financial flags from case views when `flags.financial` is false
- Updated flag creation UI with financial flag toggle (admin only)

### Phase 9: Permissions Settings Page Redesign
- Two-column layout for `/settings/permissions` (facility-level) and `/admin/permission-templates` (global)
- Tabs for User | Coordinator, searchable category list, toggle panel
- Category counts and search filtering

### Phase 10: Cleanup + Final Verification
- Replaced remaining `isAdmin` role checks in rooms page with `can()` permission calls
- Removed commented-out `settings.manage` code from settings nav config
- Verified: no `allowedRoles` remain in nav config
- Verified: no RBAC-related TODOs remain
- Updated this audit document to final state

---

## Remaining `isGlobalAdmin`/`isAdmin` Usage (Intentional)

These uses are **correct and should remain**:

### `/admin/*` pages
All admin pages use `isGlobalAdmin` — this is the intended access pattern for the admin panel.

### Non-admin pages — Facility Selection UX
- `app/analytics/*/PageClient.tsx` — Show "Select a Facility" when global admin has no facility
- `app/cases/PageClient.tsx` — Show `<NoFacilitySelected />` for global admin
- `app/rooms/PageClient.tsx` — Redirect global admin to admin page
- `app/spd/PageClient.tsx` — Show facility selection prompt
- `app/staff-management/PageClient.tsx` — Show facility selector dropdown

### `app/settings/general/PageClient.tsx`
- "Danger Zone" (Delete Facility) is `isGlobalAdmin`-only — inherently a platform-level action

### `app/settings/permissions/PageClient.tsx`
- `isAdmin` used for query `enabled` flags (RLS requires admin-level access to `facility_permissions`)
- Page guard itself uses `can('settings.permissions')`

### `app/invite/user/[token]/PageClient.tsx`
- `isAdmin` checks `invite?.accessLevel`, not the current user — display logic only
