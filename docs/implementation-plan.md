# ORbit Permissions System — Implementation Plan

## Overview

This document is the complete specification for implementing a granular, feature-level permissions system in ORbit's web application. It covers database schema, RLS policy updates, a Supabase RPC for permission resolution, frontend integration (Next.js), and two admin UI pages (global admin template + facility admin permissions).

> **Note:** iOS parity will be implemented separately. The database RPC function (`get_user_permissions`) built here will serve as the single source of truth for both platforms. iOS implementation requires only consuming this existing RPC.

**Architecture summary:** Template → Facility → Resolution

- **Global Admin** configures permission templates (defaults per `access_level`)
- When a facility is created, it receives a **copy** of the current template
- **Facility Admins** customize their facility's permissions independently
- A single **Supabase RPC function** resolves the final permission set for any user
- **Next.js** consumes this function and gates UI accordingly
- `facility_admin` and `global_admin` **always bypass** the permission system (full access)

---

## Phase 1: Database Schema

### 1.1 Create `permissions` Table (Master Registry)

This is the canonical list of all permissions in the system. Adding a row here automatically makes it appear in both admin UIs.

```sql
CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,              -- e.g. 'cases.view', 'financials.view'
  label TEXT NOT NULL,                    -- e.g. 'View Cases'
  description TEXT,                       -- Optional tooltip text
  category TEXT NOT NULL,                 -- Grouping: 'Cases', 'Financials', 'Analytics', etc.
  resource TEXT NOT NULL,                 -- Groups CRUD columns: 'cases', 'milestones', etc.
  resource_type TEXT NOT NULL DEFAULT 'page',  -- 'page', 'tab', 'action'
  action TEXT NOT NULL,                   -- 'view', 'create', 'edit', 'delete'
  sort_order INTEGER NOT NULL DEFAULT 0,  -- Controls display order within category
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permissions_category ON permissions(category, sort_order);
CREATE INDEX idx_permissions_key ON permissions(key);

-- RLS: Everyone authenticated can read permissions (it's a reference table)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view permissions"
  ON permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can manage permissions"
  ON permissions FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');
```

### 1.2 Create `permission_templates` Table (Global Admin Blueprints)

```sql
CREATE TABLE IF NOT EXISTS permission_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_level TEXT NOT NULL,             -- 'user', 'device_rep'
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(access_level, permission_key)
);

CREATE INDEX idx_permission_templates_access ON permission_templates(access_level);

ALTER TABLE permission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can manage permission templates"
  ON permission_templates FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- Facility admins can read templates (for reference)
CREATE POLICY "Facility admins can view permission templates"
  ON permission_templates FOR SELECT
  USING (get_my_access_level() = 'facility_admin');
```

### 1.3 Create `facility_permissions` Table (Per-Facility Configuration)

```sql
CREATE TABLE IF NOT EXISTS facility_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL,             -- 'user', 'device_rep'
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(facility_id, access_level, permission_key)
);

CREATE INDEX idx_facility_permissions_lookup
  ON facility_permissions(facility_id, access_level);

ALTER TABLE facility_permissions ENABLE ROW LEVEL SECURITY;

-- Global admins can do everything
CREATE POLICY "Global admins can manage all facility permissions"
  ON facility_permissions FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- Facility admins can manage their own facility's permissions
CREATE POLICY "Facility admins can manage own facility permissions"
  ON facility_permissions FOR ALL
  USING (
    get_my_access_level() = 'facility_admin'
    AND facility_id = get_my_facility_id()
  )
  WITH CHECK (
    get_my_access_level() = 'facility_admin'
    AND facility_id = get_my_facility_id()
  );

-- Users can read their own facility's permissions (needed for frontend gating)
CREATE POLICY "Users can view own facility permissions"
  ON facility_permissions FOR SELECT
  USING (facility_id = get_my_facility_id());
```

### 1.4 Seed Permissions Data

```sql
INSERT INTO permissions (key, label, description, category, resource, resource_type, action, sort_order) VALUES
  -- Cases (core)
  ('cases.view',           'View Cases',             'View the cases list and case detail pages',       'Cases',      'cases',      'page',   'view',   1),
  ('cases.create',         'Create Cases',           'Create new surgical cases',                        'Cases',      'cases',      'page',   'create', 2),
  ('cases.edit',           'Edit Cases',             'Edit case info (procedure, surgeon, times)',        'Cases',      'cases',      'page',   'edit',   3),
  ('cases.delete',         'Delete Cases',           'Delete/archive cases',                             'Cases',      'cases',      'page',   'delete', 4),

  -- Case Operations (granular)
  ('milestones.view',      'View Milestones',        'View milestone timestamps on cases',               'Case Operations', 'milestones', 'action', 'view',   10),
  ('milestones.record',    'Record Milestones',      'Record milestone timestamps during cases',          'Case Operations', 'milestones', 'action', 'create', 11),
  ('milestones.edit',      'Edit Milestones',        'Edit previously recorded milestones',               'Case Operations', 'milestones', 'action', 'edit',   12),
  ('flags.view',           'View Flags',             'View case flags',                                   'Case Operations', 'flags',      'action', 'view',   13),
  ('flags.create',         'Create Flags',           'Create case flags',                                 'Case Operations', 'flags',      'action', 'create', 14),
  ('flags.edit',           'Edit Flags',             'Edit case flags',                                   'Case Operations', 'flags',      'action', 'edit',   15),
  ('flags.delete',         'Delete Flags',           'Delete case flags',                                 'Case Operations', 'flags',      'action', 'delete', 16),
  ('delays.view',          'View Delays',            'View case delays',                                  'Case Operations', 'delays',     'action', 'view',   17),
  ('delays.create',        'Create Delays',          'Create case delays',                                'Case Operations', 'delays',     'action', 'create', 18),
  ('delays.edit',          'Edit Delays',            'Edit case delays',                                  'Case Operations', 'delays',     'action', 'edit',   19),
  ('delays.delete',        'Delete Delays',          'Delete case delays',                                'Case Operations', 'delays',     'action', 'delete', 20),
  ('staff.view',           'View Staff',             'View case staff assignments',                       'Case Operations', 'staff',      'action', 'view',   21),
  ('staff.create',         'Assign Staff',           'Assign staff to cases',                             'Case Operations', 'staff',      'action', 'create', 22),
  ('staff.delete',         'Remove Staff',           'Remove staff from cases',                           'Case Operations', 'staff',      'action', 'delete', 23),
  ('complexity.view',      'View Complexity',        'View case complexity ratings',                      'Case Operations', 'complexity', 'action', 'view',   24),
  ('complexity.create',    'Set Complexity',         'Set case complexity ratings',                       'Case Operations', 'complexity', 'action', 'create', 25),
  ('complexity.edit',      'Edit Complexity',        'Edit case complexity ratings',                      'Case Operations', 'complexity', 'action', 'edit',   26),
  ('implants.view',        'View Implants',          'View implant and device info on cases',             'Case Operations', 'implants',   'action', 'view',   27),
  ('implants.create',      'Add Implants',           'Add implant and device info to cases',              'Case Operations', 'implants',   'action', 'create', 28),
  ('implants.edit',        'Edit Implants',          'Edit implant and device info',                      'Case Operations', 'implants',   'action', 'edit',   29),
  ('implants.delete',      'Delete Implants',        'Delete implant and device info',                    'Case Operations', 'implants',   'action', 'delete', 30),

  -- Case Drawer Tabs
  ('tab.case_overview',    'Case Overview Tab',      'View the overview tab on case detail/drawer',       'Case Tabs',  'tab_case_overview',  'tab', 'view', 40),
  ('tab.case_financials',  'Case Financials Tab',    'View the financials tab on case detail/drawer',     'Case Tabs',  'tab_case_financials','tab', 'view', 41),
  ('tab.case_milestones',  'Case Milestones Tab',    'View the milestones tab on case detail/drawer',     'Case Tabs',  'tab_case_milestones','tab', 'view', 42),
  ('tab.case_implants',    'Case Implants Tab',      'View the implants tab on case detail/drawer',       'Case Tabs',  'tab_case_implants', 'tab', 'view', 43),
  ('tab.case_staff',       'Case Staff Tab',         'View the staff tab on case detail/drawer',          'Case Tabs',  'tab_case_staff',    'tab', 'view', 44),

  -- Financials
  ('financials.view',      'View Financials',        'View financial data, revenue projections, costs',   'Financials', 'financials', 'page',   'view', 50),

  -- Analytics
  ('analytics.view',       'View Analytics',         'Access the analytics dashboard',                    'Analytics',  'analytics',  'page',   'view', 60),
  ('scores.view',          'View ORbit Scores',      'View ORbit Score scorecards',                       'Analytics',  'scores',     'page',   'view', 61),

  -- Scheduling
  ('scheduling.view',      'View Schedule',          'View block schedule and room schedules',             'Scheduling', 'scheduling', 'page',   'view',   70),
  ('scheduling.create',    'Create Blocks',          'Create block schedule entries',                      'Scheduling', 'scheduling', 'page',   'create', 71),
  ('scheduling.edit',      'Edit Blocks',            'Edit block schedule entries',                        'Scheduling', 'scheduling', 'page',   'edit',   72),
  ('scheduling.delete',    'Delete Blocks',          'Delete block schedule entries',                      'Scheduling', 'scheduling', 'page',   'delete', 73),

  -- Settings
  ('settings.view',        'View Settings',          'View settings pages (read-only)',                    'Settings',   'settings',   'page',   'view',   80),
  ('settings.manage',      'Manage Settings',        'Manage facility settings, procedures, config',       'Settings',   'settings',   'page',   'edit',   81),
  ('users.view',           'View Users',             'View user list',                                     'Settings',   'users_mgmt', 'page',   'view',   82),
  ('users.manage',         'Manage Users',           'Invite, deactivate, change user access levels',      'Settings',   'users_mgmt', 'page',   'edit',   83),

  -- Admin
  ('audit.view',           'View Audit Log',         'View the audit log',                                 'Admin',      'audit',      'page',   'view', 90)
ON CONFLICT (key) DO NOTHING;
```

### 1.5 Seed Default Permission Templates

```sql
-- Default permissions for 'user' access level
INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  -- Cases: can view, create, edit — not delete
  ('user', 'cases.view', true),
  ('user', 'cases.create', true),
  ('user', 'cases.edit', true),
  ('user', 'cases.delete', false),

  -- Case Operations: can do most things
  ('user', 'milestones.view', true),
  ('user', 'milestones.record', true),
  ('user', 'milestones.edit', true),
  ('user', 'flags.view', true),
  ('user', 'flags.create', true),
  ('user', 'flags.edit', true),
  ('user', 'flags.delete', false),
  ('user', 'delays.view', true),
  ('user', 'delays.create', true),
  ('user', 'delays.edit', true),
  ('user', 'delays.delete', false),
  ('user', 'staff.view', true),
  ('user', 'staff.create', false),
  ('user', 'staff.delete', false),
  ('user', 'complexity.view', true),
  ('user', 'complexity.create', false),
  ('user', 'complexity.edit', false),
  ('user', 'implants.view', true),
  ('user', 'implants.create', false),
  ('user', 'implants.edit', false),
  ('user', 'implants.delete', false),

  -- Case Tabs: can see overview, milestones, staff — not financials or implants
  ('user', 'tab.case_overview', true),
  ('user', 'tab.case_financials', false),
  ('user', 'tab.case_milestones', true),
  ('user', 'tab.case_implants', false),
  ('user', 'tab.case_staff', true),

  -- Financials: denied
  ('user', 'financials.view', false),

  -- Analytics: denied
  ('user', 'analytics.view', false),
  ('user', 'scores.view', false),

  -- Scheduling: can view, not manage
  ('user', 'scheduling.view', true),
  ('user', 'scheduling.create', false),
  ('user', 'scheduling.edit', false),
  ('user', 'scheduling.delete', false),

  -- Settings: denied
  ('user', 'settings.view', false),
  ('user', 'settings.manage', false),
  ('user', 'users.view', false),
  ('user', 'users.manage', false),

  -- Admin: denied
  ('user', 'audit.view', false)
ON CONFLICT (access_level, permission_key) DO NOTHING;

-- Default permissions for 'device_rep' access level
INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  ('device_rep', 'cases.view', true),
  ('device_rep', 'cases.create', false),
  ('device_rep', 'cases.edit', false),
  ('device_rep', 'cases.delete', false),
  ('device_rep', 'milestones.view', true),
  ('device_rep', 'milestones.record', false),
  ('device_rep', 'milestones.edit', false),
  ('device_rep', 'flags.view', false),
  ('device_rep', 'flags.create', false),
  ('device_rep', 'flags.edit', false),
  ('device_rep', 'flags.delete', false),
  ('device_rep', 'delays.view', false),
  ('device_rep', 'delays.create', false),
  ('device_rep', 'delays.edit', false),
  ('device_rep', 'delays.delete', false),
  ('device_rep', 'staff.view', false),
  ('device_rep', 'staff.create', false),
  ('device_rep', 'staff.delete', false),
  ('device_rep', 'complexity.view', false),
  ('device_rep', 'complexity.create', false),
  ('device_rep', 'complexity.edit', false),
  ('device_rep', 'implants.view', true),
  ('device_rep', 'implants.create', true),
  ('device_rep', 'implants.edit', true),
  ('device_rep', 'implants.delete', false),
  ('device_rep', 'tab.case_overview', true),
  ('device_rep', 'tab.case_financials', false),
  ('device_rep', 'tab.case_milestones', true),
  ('device_rep', 'tab.case_implants', true),
  ('device_rep', 'tab.case_staff', false),
  ('device_rep', 'financials.view', false),
  ('device_rep', 'analytics.view', false),
  ('device_rep', 'scores.view', false),
  ('device_rep', 'scheduling.view', false),
  ('device_rep', 'scheduling.create', false),
  ('device_rep', 'scheduling.edit', false),
  ('device_rep', 'scheduling.delete', false),
  ('device_rep', 'settings.view', false),
  ('device_rep', 'settings.manage', false),
  ('device_rep', 'users.view', false),
  ('device_rep', 'users.manage', false),
  ('device_rep', 'audit.view', false)
ON CONFLICT (access_level, permission_key) DO NOTHING;
```

### 1.6 Function: Copy Template to New Facility

This should be called whenever a new facility is created (either manually or via a trigger).

```sql
CREATE OR REPLACE FUNCTION copy_permission_template_to_facility(p_facility_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
  SELECT p_facility_id, pt.access_level, pt.permission_key, pt.granted
  FROM permission_templates pt
  ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.7 Function: Resolve User Permissions (Single RPC)

```sql
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_access_level TEXT;
  v_facility_id UUID;
  v_result JSONB;
BEGIN
  -- Default to current auth user if no user_id provided
  v_user_id := COALESCE(p_user_id, auth.uid());

  -- Get user's access level and facility
  SELECT access_level, facility_id
  INTO v_access_level, v_facility_id
  FROM users
  WHERE id = v_user_id;

  -- Global admin and facility admin bypass everything
  IF v_access_level IN ('global_admin', 'facility_admin') THEN
    SELECT jsonb_object_agg(p.key, true)
    INTO v_result
    FROM permissions p
    WHERE p.is_active = true;
    RETURN v_result;
  END IF;

  -- For 'user' and 'device_rep': resolve from facility_permissions
  SELECT jsonb_object_agg(p.key, COALESCE(fp.granted, false))
  INTO v_result
  FROM permissions p
  LEFT JOIN facility_permissions fp
    ON fp.permission_key = p.key
    AND fp.facility_id = v_facility_id
    AND fp.access_level = v_access_level
  WHERE p.is_active = true;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 1.8 Helper Function for RLS Policies

```sql
CREATE OR REPLACE FUNCTION user_has_permission(p_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_access_level TEXT;
  v_facility_id UUID;
  v_granted BOOLEAN;
BEGIN
  SELECT access_level, facility_id INTO v_access_level, v_facility_id
  FROM users WHERE id = auth.uid();

  IF v_access_level IN ('global_admin', 'facility_admin') THEN
    RETURN true;
  END IF;

  SELECT granted INTO v_granted
  FROM facility_permissions
  WHERE facility_id = v_facility_id
    AND access_level = v_access_level
    AND permission_key = p_key;

  RETURN COALESCE(v_granted, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### 1.9 Backfill Existing Facilities

```sql
-- Copy template to all existing facilities
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN SELECT id FROM facilities LOOP
    PERFORM copy_permission_template_to_facility(f.id);
  END LOOP;
END $$;
```

### 1.10 Tests for Phase 1

After running the migration:

```sql
-- Verify permissions seeded
SELECT COUNT(*) FROM permissions;  -- Should be 41

-- Verify templates seeded
SELECT COUNT(*) FROM permission_templates;  -- Should be 82 (41 per access_level x 2)

-- Verify facility backfill
SELECT f.name, COUNT(fp.id) AS permission_count
FROM facilities f
LEFT JOIN facility_permissions fp ON fp.facility_id = f.id
GROUP BY f.name;
-- Each facility should have 82 rows

-- Test RPC for a global_admin user
SELECT get_user_permissions('405a7e92-9434-4535-89aa-f4ecc3e3ac7b'::UUID);
-- Should return all permissions as true

-- Test RPC for a regular user
SELECT get_user_permissions('<any_user_with_access_level_user>'::UUID);
-- Should return mix of true/false based on facility_permissions

-- Test helper function
SELECT user_has_permission('cases.view');  -- Should return true/false based on current user
```

---

## Phase 2: Web Frontend — Permission Hook & Context

### 2.1 Create `usePermissions` Hook

**File: `lib/hooks/usePermissions.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'

interface UsePermissionsReturn {
  permissions: Record<string, boolean>
  can: (key: string) => boolean
  canAny: (...keys: string[]) => boolean
  canAll: (...keys: string[]) => boolean
  loading: boolean
}

export function usePermissions(): UsePermissionsReturn {
  const { user, accessLevel, loading: userLoading } = useUser()
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (userLoading || !user) return
    fetchPermissions()
  }, [user, userLoading, accessLevel])

  async function fetchPermissions() {
    try {
      const { data, error } = await supabase.rpc('get_user_permissions')
      if (error) throw error
      setPermissions(data || {})
    } catch (err) {
      console.error('Failed to fetch permissions:', err)
      // On error, deny everything for safety
      setPermissions({})
    } finally {
      setLoading(false)
    }
  }

  const can = useCallback(
    (key: string) => {
      if (accessLevel === 'global_admin' || accessLevel === 'facility_admin') return true
      return permissions[key] === true
    },
    [permissions, accessLevel]
  )

  const canAny = useCallback(
    (...keys: string[]) => keys.some(k => can(k)),
    [can]
  )

  const canAll = useCallback(
    (...keys: string[]) => keys.every(k => can(k)),
    [can]
  )

  return { permissions, can, canAny, canAll, loading }
}
```

### 2.2 Add Permissions to UserContext

Add to existing `lib/UserContext.tsx` so every component can use `can()` without separate hooks:

```typescript
// Add to context value:
const permissions = usePermissions()

// Expose in context:
value={{
  ...existingValues,
  can: permissions.can,
  canAny: permissions.canAny,
  canAll: permissions.canAll,
  permissionsLoading: permissions.loading,
}}
```

### 2.3 Usage Examples in Components

**Case Drawer — conditionally render financials tab:**
```tsx
const { can } = useUser()

const tabs = [
  can('tab.case_overview') && { key: 'overview', label: 'Overview' },
  can('tab.case_financials') && { key: 'financials', label: 'Financials' },
  can('tab.case_milestones') && { key: 'milestones', label: 'Milestones' },
  can('tab.case_implants') && { key: 'implants', label: 'Implants' },
  can('tab.case_staff') && { key: 'staff', label: 'Staff' },
].filter(Boolean)
```

**Cases page — conditionally render create button:**
```tsx
{can('cases.create') && (
  <Button onClick={() => router.push('/cases/new')}>New Case</Button>
)}
```

**Navigation — conditionally render nav items:**
```tsx
{can('analytics.view') && <NavLink href="/analytics">Analytics</NavLink>}
{can('scores.view') && <NavLink href="/scorecards">ORbit Scores</NavLink>}
{canAny('settings.view', 'settings.manage') && <NavLink href="/settings">Settings</NavLink>}
```

### 2.4 Wire Initial Proof-of-Concept (3-5 Key Elements)

Apply `can()` gating to these components as proof of concept:
- Case drawer financials tab (`tab.case_financials`)
- Analytics nav link (`analytics.view`)
- Settings nav link (`settings.view` or `settings.manage`)
- Cases "New Case" button (`cases.create`)
- Block schedule edit controls (`scheduling.manage`)

### 2.5 Tests for Phase 2

- Unit test `usePermissions` hook with mocked RPC responses
- Test `can()` returns true for all permissions when accessLevel is `facility_admin`
- Test `can()` returns false for denied permissions when accessLevel is `user`
- Test that components correctly hide/show elements based on `can()`
- Test error fallback: when RPC fails, all permissions default to false

---

## Phase 3: Admin Pages

### 3.1 Global Admin — Permission Template Page

**File: `app/admin/permission-templates/page.tsx`**

**Layout:**
- Page title: "Permission Templates"
- Subtitle: "Configure default permissions for new facilities. Changes do not affect existing facilities."
- Access level selector: dropdown or tabs for `user` | `device_rep`
- Permission matrix grouped by category

**Matrix Layout:**
```
Category: Cases
┌──────────────────┬────────┬────────┬──────┬────────┐
│ Resource         │ View   │ Create │ Edit │ Delete │
├──────────────────┼────────┼────────┼──────┼────────┤
│ Cases            │  ✅    │  ✅    │  ✅  │  ❌    │
├──────────────────┼────────┼────────┼──────┼────────┤

Category: Case Operations
│ Milestones       │  ✅    │  ✅    │  ✅  │   —    │
│ Flags            │  ✅    │  ✅    │  ✅  │  ❌    │
│ Delays           │  ✅    │  ✅    │  ✅  │  ❌    │
│ Staff            │  ✅    │  ❌    │   —  │  ❌    │
│ Complexity       │  ✅    │  ❌    │  ❌  │   —    │
│ Implants         │  ✅    │  ❌    │  ❌  │  ❌    │

Category: Case Tabs
│ Overview Tab     │  ✅    │   —    │   —  │   —    │
│ Financials Tab   │  ❌    │   —    │   —  │   —    │
│ Milestones Tab   │  ✅    │   —    │   —  │   —    │
│ Implants Tab     │  ❌    │   —    │   —  │   —    │
│ Staff Tab        │  ✅    │   —    │   —  │   —    │

Category: Financials
│ Financials       │  ❌    │   —    │   —  │   —    │

Category: Analytics
│ Analytics        │  ❌    │   —    │   —  │   —    │
│ ORbit Scores     │  ❌    │   —    │   —  │   —    │

Category: Scheduling
│ Schedule         │  ✅    │  ❌    │  ❌  │  ❌    │

Category: Settings
│ Settings         │  ❌    │   —    │  ❌  │   —    │
│ Users            │  ❌    │   —    │  ❌  │   —    │

Category: Admin
│ Audit Log        │  ❌    │   —    │   —  │   —    │
└──────────────────┴────────┴────────┴──────┴────────┘
```

**Key behaviors:**
- "—" cells are not rendered (no checkbox) when the action doesn't apply to that resource
- Checkboxes toggle individual permissions
- Save button at bottom (or auto-save with debounce)
- Toast confirmation on save
- The matrix renders dynamically from the `permissions` table — adding a new row to `permissions` automatically adds a row in this UI

**How to render the matrix dynamically:**
1. Fetch all `permissions` rows, grouped by `category`
2. Within each category, group by `resource` to create rows
3. For each resource row, render checkboxes for actions that exist (view/create/edit/delete)
4. If a resource has no permission for a given action, render "—"
5. Fetch `permission_templates` for the selected `access_level`
6. Map granted values to checkbox state

**Data Fetching:**
```typescript
// Fetch all permissions (for matrix structure)
const { data: allPermissions } = await supabase
  .from('permissions')
  .select('*')
  .eq('is_active', true)
  .order('sort_order')

// Fetch templates for selected access level
const { data: templates } = await supabase
  .from('permission_templates')
  .select('*')
  .eq('access_level', selectedAccessLevel)
```

**Save Logic:**
```typescript
async function handleToggle(permissionKey: string, granted: boolean) {
  await supabase
    .from('permission_templates')
    .upsert({
      access_level: selectedAccessLevel,
      permission_key: permissionKey,
      granted,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'access_level,permission_key' })
}
```

### 3.2 Facility Admin — Permissions Page

**File: `app/settings/permissions/page.tsx`**

Nearly identical to the Global Admin template page, but:
- Title: "Roles & Permissions"
- Subtitle: "Configure what each access level can do at your facility."
- Reads/writes `facility_permissions` instead of `permission_templates`
- Scoped to the facility admin's facility (automatic via RLS)
- Same matrix layout, same dynamic rendering from `permissions` table
- Only accessible to `facility_admin` and `global_admin`

**Data Fetching:**
```typescript
// Fetch facility permissions for selected access level
const { data: facilityPerms } = await supabase
  .from('facility_permissions')
  .select('*')
  .eq('access_level', selectedAccessLevel)
  // RLS automatically scopes to facility
```

**Save Logic:**
```typescript
async function handleToggle(permissionKey: string, granted: boolean) {
  await supabase
    .from('facility_permissions')
    .upsert({
      facility_id: userFacilityId,
      access_level: selectedAccessLevel,
      permission_key: permissionKey,
      granted,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'facility_id,access_level,permission_key' })
}
```

### 3.3 Shared Matrix Component

Since both pages use the same matrix UI, extract a shared component:

**File: `components/permissions/PermissionMatrix.tsx`**

Props:
- `permissions: Permission[]` — all permission rows
- `grants: Record<string, boolean>` — current granted state
- `onToggle: (key: string, granted: boolean) => void`
- `readOnly?: boolean`

Both pages import this component and pass different data sources / save handlers.

### 3.4 Add Navigation Links

- Global admin: Add "Permission Templates" to the admin sidebar
- Facility admin: Add "Roles & Permissions" to the Settings navigation
- Both links gated by access level (global_admin for templates, facility_admin+ for facility permissions)

### 3.5 Tests for Phase 3

- Test that the matrix renders all permission categories and resources
- Test that toggling a checkbox calls the correct upsert
- Test that access level tabs switch the displayed data
- Test that "—" cells render for non-applicable actions
- Test that facility admin can only see/edit their own facility's permissions
- Test that global admin can access both pages

---

## Phase 4: Full UI Integration

### 4.1 Audit All Pages and Components

Go through every page and component in the app and apply `can()` gating where appropriate:

**Navigation / Sidebar:**
- Each nav link should check `can()` for the relevant permission
- Entire sections (e.g., Settings) should be hidden if no sub-permissions are granted

**Pages (route-level guards):**
- Analytics page: `can('analytics.view')`
- Scorecards page: `can('scores.view')`
- Settings pages: `canAny('settings.view', 'settings.manage')`
- Audit log: `can('audit.view')`
- Block schedule: `can('scheduling.view')`

**Action buttons throughout the app:**
- "New Case" button: `can('cases.create')`
- "Edit" buttons on cases: `can('cases.edit')`
- "Delete" buttons: `can('cases.delete')`
- Block schedule CRUD: `scheduling.create`, `scheduling.edit`, `scheduling.delete`
- Milestone recording: `milestones.record`

**Case detail / drawer:**
- Tab visibility: each `tab.*` permission
- Flag add button: `flags.create`
- Delay add button: `delays.create`
- Staff assign: `staff.create`
- Implant add: `implants.create`

### 4.2 Create Permission Guard Component (Optional)

For route-level protection, consider a reusable guard:

```tsx
function PermissionGuard({ permission, children, fallback }: {
  permission: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { can, permissionsLoading } = useUser()

  if (permissionsLoading) return <LoadingSpinner />
  if (!can(permission)) return fallback || <AccessDenied />
  return <>{children}</>
}

// Usage:
<PermissionGuard permission="analytics.view">
  <AnalyticsDashboard />
</PermissionGuard>
```

### 4.3 Tests for Phase 4

- Test each page renders AccessDenied when permission is false
- Test each page renders normally when permission is true
- Test navigation items show/hide correctly
- Test action buttons show/hide correctly
- Full workflow test: login as restricted user, verify cannot access gated features

---

## Phase 5: RLS Hardening

### 5.1 Enable RLS on Tables That Currently Have It Disabled

```sql
-- These tables have RLS disabled and need policies:
ALTER TABLE case_implant_companies ENABLE ROW LEVEL SECURITY;
-- NOTE: Already has policies defined, just not enforced!

ALTER TABLE device_rep_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_device_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE implant_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeon_preference_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeon_preferences ENABLE ROW LEVEL SECURITY;

-- Add basic policies for tables missing them (scope to facility + global admin override)
-- Exact policies depend on each table's usage — review individually
```

### 5.2 Add Permission-Based RLS to Sensitive Tables (Optional Enhancement)

For defense-in-depth, sensitive tables can check the permissions system at the RLS level:

```sql
-- Example: financial data tables
CREATE POLICY "Users need financials.view permission"
  ON procedure_reimbursements FOR SELECT
  USING (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    OR (
      facility_id = get_my_facility_id()
      AND user_has_permission('financials.view')
    )
  );
```

### 5.3 Standardize Policy Patterns

Audit existing policies and standardize on using helper functions (`get_my_access_level()`, `get_my_facility_id()`, `user_has_permission()`) instead of inline subqueries for consistency.

### 5.4 Tests for Phase 5

- Test that previously unprotected tables now enforce RLS
- Test that permission-gated RLS returns empty for users without the permission
- Test that admin users still have full access to all tables
- Test that existing functionality is not broken by policy changes

---

## Implementation Order (Claude Code Sessions)

| Session | Phase | Description | Estimated Complexity |
|---------|-------|-------------|---------------------|
| 1 | Phase 1 | Database schema, seed data, RPC functions, backfill | Light (all SQL) |
| 2 | Phase 2 | usePermissions hook, UserContext integration, 5 proof-of-concept elements | Medium |
| 3 | Phase 3 | Shared PermissionMatrix component + both admin pages | Heavy (substantial UI) |
| 4 | Phase 4 | Full UI integration audit across all pages and components | Medium-Heavy |
| 5 | Phase 5 | RLS hardening, enable disabled tables, permission-based policies | Medium |

**Commit after each session:**
1. `feat: permissions system database schema, seed data, and RPC functions`
2. `feat: usePermissions hook and initial UI gating`
3. `feat: permission management admin pages with shared matrix component`
4. `feat: comprehensive permission gating across all pages and components`
5. `feat: RLS hardening with permission-based policies`

---

## Key Design Decisions (Reference)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Permission resolution | Facility-level per access_level | Simplicity; no per-user overrides |
| Admin bypass | facility_admin + global_admin always full access | Reduces complexity; admins need everything |
| Template push behavior | New facilities only | Facility independence; no surprise changes |
| Permission registry | Database-driven, dynamic | Add permissions without code changes |
| Default deny | If no row exists, denied | Safe by default; explicit grants required |
| CRUD granularity | Per-resource where applicable | Maximum flexibility without overwhelming UI |
| Tab gating | Separate permissions per tab | Tabs are a distinct UX concern from page access |
| Shared matrix component | One component, two pages | DRY; consistent UX between global and facility admin |
| iOS | Deferred | Database RPC is platform-agnostic; iOS consumes same function later |
