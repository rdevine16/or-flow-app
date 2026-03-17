-- =============================================================================
-- RBAC: Add view vs manage separation for rooms, SPD, data quality, staff mgmt
-- =============================================================================
-- Adds 4 new .manage permissions so "view" = read-only, "manage" = can interact
-- Total permissions: 63 → 67
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Insert 4 new .manage permissions
-- ---------------------------------------------------------------------------

INSERT INTO permissions (key, label, description, category, resource, resource_type, action, sort_order)
VALUES
  ('rooms.manage', 'Manage Rooms', 'Assign staff, call next patient, manage room operations', 'Rooms', 'rooms', 'page', 'manage', 58),
  ('spd.manage', 'Manage SPD', 'Remind reps, manage tray logistics', 'SPD', 'spd', 'page', 'manage', 60),
  ('data_quality.manage', 'Manage Data Quality', 'Resolve issues, run scans, edit milestones', 'Data Quality', 'data_quality', 'page', 'manage', 64),
  ('staff_management.manage', 'Manage Staff', 'Invite users, deactivate, manage time-off and holidays', 'Staff Management', 'staff_management', 'page', 'manage', 66)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Insert permission templates (defaults for new facilities)
-- ---------------------------------------------------------------------------

INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  -- User: all manage = false (read-only)
  ('user', 'rooms.manage', false),
  ('user', 'spd.manage', false),
  ('user', 'data_quality.manage', false),
  ('user', 'staff_management.manage', false),

  -- Coordinator: rooms.manage = true (coordinators manage room ops), others = false
  ('coordinator', 'rooms.manage', true),
  ('coordinator', 'spd.manage', false),
  ('coordinator', 'data_quality.manage', false),
  ('coordinator', 'staff_management.manage', false)
ON CONFLICT (access_level, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Backfill facility_permissions for all existing facilities
-- ---------------------------------------------------------------------------

-- User defaults (all false)
INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'user', 'rooms.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'user', 'spd.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'user', 'data_quality.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'user', 'staff_management.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

-- Coordinator defaults (rooms=true, others=false)
INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'coordinator', 'rooms.manage', true FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'coordinator', 'spd.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'coordinator', 'data_quality.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'coordinator', 'staff_management.manage', false FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;
