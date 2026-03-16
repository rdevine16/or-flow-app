# RBAC Audit — ORbit Web App

## Executive Summary

The current permission system has **30 permissions** across 7 categories with a template + facility-override architecture. This audit identifies **gaps between current state and desired behavior** based on user interviews.

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

## Critical Gaps Found

### Gap 1: Admin Bypass (HIGH PRIORITY)
**Current:** `facility_admin` and `global_admin` bypass ALL permission checks — hardcoded in `usePermissions` hook and `get_user_permissions()` RPC.
**Desired:** No hardcoded bypasses. All permissions configurable through the permissions page. Admins get all permissions granted by default via templates, but facilities can customize.
**Files affected:**
- `lib/hooks/usePermissions.ts` — remove bypass logic
- `get_user_permissions()` RPC — remove bypass, return actual permission values
- `permission_templates` seed data — ensure admin levels have all permissions granted

### Gap 2: User Can Create Cases (MEDIUM)
**Current:** `cases.create` is granted to `user` by default.
**Desired:** Users can only view and edit existing cases, not create new ones.
**Fix:** Update `permission_templates` default for `user` + `cases.create` to `false`.

### Gap 3: Coordinator Has Financial Access (MEDIUM)
**Current:** `financials.view` and `tab.case_financials` are granted to `coordinator`.
**Desired:** Coordinators cannot view financials by default.
**Fix:** Update `permission_templates` defaults for coordinator on `financials.view` and `tab.case_financials` to `false`.

### Gap 4: Missing Page-Level Permissions (HIGH)
**Current:** Several pages use hardcoded role checks (`isAdmin`) instead of permissions.
**Desired:** Every page gated by a permission key, configurable per facility.

New permissions needed:
| Key | Label | Category | Default: user | Default: coord | Default: admin |
|---|---|---|---|---|---|
| `rooms.view` | View Rooms | Rooms | true | true | true |
| `rooms.manage` | Manage Rooms | Rooms | false | true | true |
| `spd.view` | View SPD | SPD | false | false | true |
| `spd.manage` | Manage SPD | SPD | false | false | true |
| `data_quality.view` | View Data Quality | Data Quality | false | false | true |
| `staff_management.view` | View Staff Mgmt | Staff Management | false | false | true |
| `staff_management.manage` | Manage Staff | Staff Management | false | false | true |
| `integrations.view` | View Integrations | Integrations | false | false | true |
| `integrations.manage` | Manage Integrations | Integrations | false | false | true |
| `flags.financial` | View Financial Flags | Case Operations | false | false | true |

### Gap 5: Granular Settings Permissions (HIGH)
**Current:** Two broad permissions: `settings.view` and `settings.manage`.
**Desired:** Each settings sub-page has its own permission.

New settings permissions:
| Key | Label | Default: user | Default: coord | Default: admin |
|---|---|---|---|---|
| `settings.general` | Manage General Settings | false | false | true |
| `settings.rooms` | Manage Room Settings | false | true | true |
| `settings.procedures` | Manage Procedures | false | true | true |
| `settings.milestones` | Manage Milestones | false | true | true |
| `settings.flags` | Manage Flag Rules | false | true | true |
| `settings.delays` | Manage Delay Types | false | true | true |
| `settings.complexities` | Manage Complexities | false | false | true |
| `settings.implant_companies` | Manage Implant Companies | false | false | true |
| `settings.cancellation_reasons` | Manage Cancellation Reasons | false | true | true |
| `settings.closures` | Manage Closures | false | true | true |
| `settings.checklist` | Manage Checklists | false | true | true |
| `settings.surgeon_preferences` | Manage Surgeon Prefs | false | true | true |
| `settings.voice_commands` | Manage Voice Commands | false | false | true |
| `settings.notifications` | Manage Notifications | false | true | true |
| `settings.device_reps` | Manage Device Reps | false | false | true |
| `settings.analytics` | Manage Analytics Settings | false | false | true |
| `settings.permissions` | Manage Permissions | false | false | true |
| `settings.subscription` | Manage Subscription | false | false | true |
| `settings.financials.cost_categories` | Manage Cost Categories | false | false | true |
| `settings.financials.payers` | Manage Payers | false | false | true |
| `settings.financials.procedure_pricing` | Manage Procedure Pricing | false | false | true |
| `settings.financials.surgeon_variance` | Manage Surgeon Variance | false | false | true |
| `settings.financials.targets` | Manage Financial Targets | false | false | true |

### Gap 6: Mixed Gating Systems (MEDIUM)
**Current:** Navigation uses both `allowedRoles` arrays and `permission` keys. Some pages check `isAdmin`, some check `can()`, some check neither.
**Desired:** Unified system — everything uses `can()` permission checks. Remove all `allowedRoles` from nav config. Remove all `isAdmin` checks from page guards.

### Gap 7: Dashboard Role Views (LOW)
**Current:** Dashboard shows different content based on access level.
**Desired:** Role-specific dashboard views. Financial widgets hidden based on `financials.view` permission.

### Gap 8: No Middleware-Level Enforcement (LOW)
**Current:** All permission checks are client-side only. Middleware only checks auth.
**Desired:** Consider adding server-side permission checks for sensitive routes (financials, admin).

---

## Complete Target Permission Matrix

### Existing Permissions (with corrected defaults)

| # | Key | Category | User | Coord | Fac Admin | Global Admin |
|---|---|---|---|---|---|---|
| 1 | `cases.view` | Cases | ✅ | ✅ | ✅ | ✅ |
| 2 | `cases.create` | Cases | **❌** | ✅ | ✅ | ✅ |
| 3 | `cases.edit` | Cases | ✅ | ✅ | ✅ | ✅ |
| 4 | `cases.delete` | Cases | ❌ | ✅ | ✅ | ✅ |
| 5 | `milestones.view` | Case Ops | ✅ | ✅ | ✅ | ✅ |
| 6 | `milestones.manage` | Case Ops | ✅ | ✅ | ✅ | ✅ |
| 7 | `flags.view` | Case Ops | ✅ | ✅ | ✅ | ✅ |
| 8 | `flags.create` | Case Ops | ✅ | ✅ | ✅ | ✅ |
| 9 | `flags.delete` | Case Ops | ❌ | ✅ | ✅ | ✅ |
| 10 | `staff.view` | Case Ops | ✅ | ✅ | ✅ | ✅ |
| 11 | `staff.create` | Case Ops | ❌ | ✅ | ✅ | ✅ |
| 12 | `staff.delete` | Case Ops | ❌ | ✅ | ✅ | ✅ |
| 13 | `implants.view` | Case Ops | ✅ | ✅ | ✅ | ✅ |
| 14 | `implants.edit` | Case Ops | ❌ | ✅ | ✅ | ✅ |
| 15 | `tab.case_financials` | Case Tabs | ❌ | **❌** | ✅ | ✅ |
| 16 | `tab.case_milestones` | Case Tabs | ✅ | ✅ | ✅ | ✅ |
| 17 | `tab.case_flags` | Case Tabs | ✅ | ✅ | ✅ | ✅ |
| 18 | `tab.case_validation` | Case Tabs | ✅ | ✅ | ✅ | ✅ |
| 19 | `financials.view` | Financials | ❌ | **❌** | ✅ | ✅ |
| 20 | `analytics.view` | Analytics | ❌ | **❌** | ✅ | ✅ |
| 21 | `scores.view` | Analytics | ❌ | **❌** | ✅ | ✅ |
| 22 | `scheduling.view` | Scheduling | ❌ | ✅ | ✅ | ✅ |
| 23 | `scheduling.create` | Scheduling | ❌ | ✅ | ✅ | ✅ |
| 24 | `scheduling.edit` | Scheduling | ❌ | ✅ | ✅ | ✅ |
| 25 | `scheduling.delete` | Scheduling | ❌ | ✅ | ✅ | ✅ |
| 26 | `settings.view` | Settings | ❌ | ✅ | ✅ | ✅ |
| 27 | `settings.manage` | Settings | ❌ | ❌ | ✅ | ✅ |
| 28 | `users.view` | Settings | ❌ | ✅ | ✅ | ✅ |
| 29 | `users.manage` | Settings | ❌ | ❌ | ✅ | ✅ |
| 30 | `audit.view` | Admin | ❌ | ❌ | ✅ | ✅ |

**Bold** = changed from current default.

### New Permissions to Add (33 new)

| # | Key | Category | User | Coord | Fac Admin | Global Admin |
|---|---|---|---|---|---|---|
| 31 | `rooms.view` | Rooms | ✅ | ✅ | ✅ | ✅ |
| 32 | `rooms.manage` | Rooms | ❌ | ✅ | ✅ | ✅ |
| 33 | `spd.view` | SPD | ❌ | ❌ | ✅ | ✅ |
| 34 | `spd.manage` | SPD | ❌ | ❌ | ✅ | ✅ |
| 35 | `data_quality.view` | Data Quality | ❌ | ❌ | ✅ | ✅ |
| 36 | `staff_management.view` | Staff Mgmt | ❌ | ❌ | ✅ | ✅ |
| 37 | `staff_management.manage` | Staff Mgmt | ❌ | ❌ | ✅ | ✅ |
| 38 | `integrations.view` | Integrations | ❌ | ❌ | ✅ | ✅ |
| 39 | `integrations.manage` | Integrations | ❌ | ❌ | ✅ | ✅ |
| 40 | `flags.financial` | Case Ops | ❌ | ❌ | ✅ | ✅ |
| 41 | `settings.general` | Settings | ❌ | ❌ | ✅ | ✅ |
| 42 | `settings.rooms` | Settings | ❌ | ✅ | ✅ | ✅ |
| 43 | `settings.procedures` | Settings | ❌ | ✅ | ✅ | ✅ |
| 44 | `settings.milestones` | Settings | ❌ | ✅ | ✅ | ✅ |
| 45 | `settings.flags` | Settings | ❌ | ✅ | ✅ | ✅ |
| 46 | `settings.delays` | Settings | ❌ | ✅ | ✅ | ✅ |
| 47 | `settings.complexities` | Settings | ❌ | ❌ | ✅ | ✅ |
| 48 | `settings.implant_companies` | Settings | ❌ | ❌ | ✅ | ✅ |
| 49 | `settings.cancellation_reasons` | Settings | ❌ | ✅ | ✅ | ✅ |
| 50 | `settings.closures` | Settings | ❌ | ✅ | ✅ | ✅ |
| 51 | `settings.checklist` | Settings | ❌ | ✅ | ✅ | ✅ |
| 52 | `settings.surgeon_preferences` | Settings | ❌ | ✅ | ✅ | ✅ |
| 53 | `settings.voice_commands` | Settings | ❌ | ❌ | ✅ | ✅ |
| 54 | `settings.notifications` | Settings | ❌ | ✅ | ✅ | ✅ |
| 55 | `settings.device_reps` | Settings | ❌ | ❌ | ✅ | ✅ |
| 56 | `settings.analytics` | Settings | ❌ | ❌ | ✅ | ✅ |
| 57 | `settings.permissions` | Settings | ❌ | ❌ | ✅ | ✅ |
| 58 | `settings.subscription` | Settings | ❌ | ❌ | ✅ | ✅ |
| 59 | `settings.financials.cost_categories` | Financial Settings | ❌ | ❌ | ✅ | ✅ |
| 60 | `settings.financials.payers` | Financial Settings | ❌ | ❌ | ✅ | ✅ |
| 61 | `settings.financials.procedure_pricing` | Financial Settings | ❌ | ❌ | ✅ | ✅ |
| 62 | `settings.financials.surgeon_variance` | Financial Settings | ❌ | ❌ | ✅ | ✅ |
| 63 | `settings.financials.targets` | Financial Settings | ❌ | ❌ | ✅ | ✅ |

**Total: 63 permissions** (30 existing + 33 new)

---

## Page-by-Page Access Map

### Pages Accessible by Role (Default)

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

## UI Changes Needed

### 1. Permissions Settings Page → Two-Column Layout
Current permissions page needs redesign with:
- **Left panel:** Category list (Cases, Case Operations, Scheduling, Settings, Financials, etc.)
- **Right panel:** Permission toggles for the selected category, grouped by access level
- Follow the pattern from voice-commands settings page

### 2. Dashboard → Role-Specific Views
- Financial widgets gated by `financials.view`
- Scheduling widgets gated by `scheduling.view`
- Analytics summary gated by `analytics.view`

### 3. Navigation → Pure Permission-Based
- Remove all `allowedRoles` from navigation config
- Every nav item uses `permission` key
- Financial nav items/sub-items hidden when `financials.view` is false

### 4. Financial Flags → Category Permission
- Flag rules have categories; financial flags filtered by `flags.financial` permission
- Users without `flags.financial` never see financial-category flags in lists or analytics

---

## Deprecations

After this work is complete, the following can be removed:
- `allowedRoles` arrays in navigation config
- `isAdmin` / `isGlobalAdmin` checks in page guards (replace with `can()`)
- Admin bypass logic in `usePermissions` hook
- Admin bypass logic in `get_user_permissions()` RPC
- The broad `settings.manage` permission (replaced by granular settings.* keys)

**Note:** `settings.view` is kept as the gate for the Settings hub page itself. Individual settings pages use their own `settings.*` permission.

---

## Implementation Scope Estimate

- **Migration:** Add 33 new permissions, update 5 default grants, modify RPC
- **Navigation config:** Replace all `allowedRoles` with `permission` keys
- **Page guards:** ~40 page files need permission checks added/updated
- **Permissions UI:** Redesign with two-column layout
- **Dashboard:** Add permission-based widget filtering
- **Flag filtering:** Add `flags.financial` category gating
- **Testing:** Each page needs verification for each role
