-- =============================================================================
-- Permissions System — Phase 1: Database Schema, Functions, Seed Data
-- =============================================================================
-- Creates the granular, feature-level permissions system for ORbit.
-- Architecture: Template → Facility → Resolution
-- - Global Admin configures permission templates (defaults per access_level)
-- - New facilities receive a copy of the current template
-- - Facility Admins customize their facility's permissions
-- - Single RPC resolves final permissions for any user
-- - facility_admin and global_admin always bypass (full access)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper Functions (used by RLS policies and RPC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_my_access_level()
RETURNS TEXT AS $$
  SELECT access_level FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
CREATE OR REPLACE FUNCTION get_my_facility_id()
RETURNS UUID AS $$
  SELECT facility_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
-- ---------------------------------------------------------------------------
-- 1. permissions — Master registry of all permissions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'page',
  action TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(key);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON permissions;
CREATE POLICY "Authenticated users can view permissions"
  ON permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Global admins can manage permissions" ON permissions;
CREATE POLICY "Global admins can manage permissions"
  ON permissions FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');
-- ---------------------------------------------------------------------------
-- 2. permission_templates — Global admin blueprints per access_level
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permission_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  access_level TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(access_level, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_permission_templates_access ON permission_templates(access_level);
ALTER TABLE permission_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global admins can manage permission templates" ON permission_templates;
CREATE POLICY "Global admins can manage permission templates"
  ON permission_templates FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');
DROP POLICY IF EXISTS "Facility admins can view permission templates" ON permission_templates;
CREATE POLICY "Facility admins can view permission templates"
  ON permission_templates FOR SELECT
  USING (get_my_access_level() = 'facility_admin');
-- ---------------------------------------------------------------------------
-- 3. facility_permissions — Per-facility configuration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS facility_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(facility_id, access_level, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_facility_permissions_lookup
  ON facility_permissions(facility_id, access_level);
ALTER TABLE facility_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Global admins can manage all facility permissions" ON facility_permissions;
CREATE POLICY "Global admins can manage all facility permissions"
  ON facility_permissions FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');
DROP POLICY IF EXISTS "Facility admins can manage own facility permissions" ON facility_permissions;
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
DROP POLICY IF EXISTS "Users can view own facility permissions" ON facility_permissions;
CREATE POLICY "Users can view own facility permissions"
  ON facility_permissions FOR SELECT
  USING (facility_id = get_my_facility_id());
-- ---------------------------------------------------------------------------
-- 4. Seed permissions data (41 permissions)
-- ---------------------------------------------------------------------------

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

  -- Case Drawer Tabs (matching actual drawer tabs)
  ('tab.case_financials',  'Case Financials Tab',    'View the financials tab on case detail/drawer',     'Case Tabs',  'tab_case_financials','tab', 'view', 40),
  ('tab.case_milestones',  'Case Milestones Tab',    'View the milestones tab on case detail/drawer',     'Case Tabs',  'tab_case_milestones','tab', 'view', 41),
  ('tab.case_flags',       'Case Flags Tab',         'View the flags tab on case detail/drawer',          'Case Tabs',  'tab_case_flags',    'tab', 'view', 42),
  ('tab.case_validation',  'Case Validation Tab',    'View the validation/data quality tab on case drawer','Case Tabs', 'tab_case_validation','tab', 'view', 43),

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
-- ---------------------------------------------------------------------------
-- 5. Seed default permission templates — 'user' access level
-- ---------------------------------------------------------------------------

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

  -- Case Tabs: can see milestones, flags, validation — not financials
  ('user', 'tab.case_financials', false),
  ('user', 'tab.case_milestones', true),
  ('user', 'tab.case_flags', true),
  ('user', 'tab.case_validation', true),

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
-- ---------------------------------------------------------------------------
-- 6. Seed default permission templates — 'coordinator' access level
--    Nearly facility_admin level: all granted except settings.manage,
--    users.manage, and audit.view
-- ---------------------------------------------------------------------------

INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  -- Cases: full access
  ('coordinator', 'cases.view', true),
  ('coordinator', 'cases.create', true),
  ('coordinator', 'cases.edit', true),
  ('coordinator', 'cases.delete', true),

  -- Case Operations: full access
  ('coordinator', 'milestones.view', true),
  ('coordinator', 'milestones.record', true),
  ('coordinator', 'milestones.edit', true),
  ('coordinator', 'flags.view', true),
  ('coordinator', 'flags.create', true),
  ('coordinator', 'flags.edit', true),
  ('coordinator', 'flags.delete', true),
  ('coordinator', 'delays.view', true),
  ('coordinator', 'delays.create', true),
  ('coordinator', 'delays.edit', true),
  ('coordinator', 'delays.delete', true),
  ('coordinator', 'staff.view', true),
  ('coordinator', 'staff.create', true),
  ('coordinator', 'staff.delete', true),
  ('coordinator', 'complexity.view', true),
  ('coordinator', 'complexity.create', true),
  ('coordinator', 'complexity.edit', true),
  ('coordinator', 'implants.view', true),
  ('coordinator', 'implants.create', true),
  ('coordinator', 'implants.edit', true),
  ('coordinator', 'implants.delete', true),

  -- Case Tabs: all visible
  ('coordinator', 'tab.case_financials', true),
  ('coordinator', 'tab.case_milestones', true),
  ('coordinator', 'tab.case_flags', true),
  ('coordinator', 'tab.case_validation', true),

  -- Financials: granted
  ('coordinator', 'financials.view', true),

  -- Analytics: granted
  ('coordinator', 'analytics.view', true),
  ('coordinator', 'scores.view', true),

  -- Scheduling: full access
  ('coordinator', 'scheduling.view', true),
  ('coordinator', 'scheduling.create', true),
  ('coordinator', 'scheduling.edit', true),
  ('coordinator', 'scheduling.delete', true),

  -- Settings: can view but not manage
  ('coordinator', 'settings.view', true),
  ('coordinator', 'settings.manage', false),
  ('coordinator', 'users.view', true),
  ('coordinator', 'users.manage', false),

  -- Admin: denied
  ('coordinator', 'audit.view', false)
ON CONFLICT (access_level, permission_key) DO NOTHING;
-- ---------------------------------------------------------------------------
-- 7. Function: Copy template to a new facility
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION copy_permission_template_to_facility(p_facility_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
  SELECT p_facility_id, pt.access_level, pt.permission_key, pt.granted
  FROM permission_templates pt
  ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ---------------------------------------------------------------------------
-- 8. Function: Resolve user permissions (single RPC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_access_level TEXT;
  v_facility_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT access_level, facility_id
  INTO v_access_level, v_facility_id
  FROM users
  WHERE id = v_user_id;

  -- Global admin and facility admin bypass — all permissions granted
  IF v_access_level IN ('global_admin', 'facility_admin') THEN
    SELECT jsonb_object_agg(p.key, true)
    INTO v_result
    FROM permissions p
    WHERE p.is_active = true;
    RETURN v_result;
  END IF;

  -- For 'user' and 'coordinator': resolve from facility_permissions
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
-- ---------------------------------------------------------------------------
-- 9. Function: Helper for RLS policies (future use)
-- ---------------------------------------------------------------------------

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
-- ---------------------------------------------------------------------------
-- 10. Backfill existing facilities
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN SELECT id FROM facilities LOOP
    PERFORM copy_permission_template_to_facility(f.id);
  END LOOP;
END $$;
