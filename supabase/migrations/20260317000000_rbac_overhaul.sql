-- =============================================================================
-- Migration: RBAC Overhaul — Granular Permissions & Financial Gating (Phase 1)
-- =============================================================================
-- Adds 33 new granular permissions (63 total), fixes incorrect defaults,
-- adds coordinator to valid_access_level CHECK, and backfills all facilities.
-- NOTE: settings.manage is KEPT for backward compat — removed in Phase 2
-- after all TypeScript references are replaced with granular settings.* keys.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add 'coordinator' to the valid_access_level CHECK constraint on users
-- ---------------------------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS valid_access_level;
ALTER TABLE users ADD CONSTRAINT valid_access_level
  CHECK (access_level = ANY (ARRAY['global_admin','facility_admin','coordinator','user','device_rep']));

-- ---------------------------------------------------------------------------
-- 2. Insert 33 new permissions into the permissions table
-- ---------------------------------------------------------------------------
INSERT INTO permissions (key, label, description, category, resource, resource_type, action, sort_order) VALUES
  -- Rooms
  ('rooms.view', 'View Rooms', 'View operating rooms page', 'Rooms', 'rooms', 'page', 'view', 0),
  -- SPD
  ('spd.view', 'View SPD', 'View sterile processing page', 'SPD', 'spd', 'page', 'view', 0),
  -- Data Quality
  ('data_quality.view', 'View Data Quality', 'View data quality page', 'Data Quality', 'data_quality', 'page', 'view', 0),
  -- Staff Management
  ('staff_management.view', 'View Staff Management', 'View staff management page', 'Staff Management', 'staff_management', 'page', 'view', 0),
  -- Integrations
  ('integrations.view', 'View Integrations', 'View EHR integrations', 'Integrations', 'integrations', 'page', 'view', 0),
  ('integrations.manage', 'Manage Integrations', 'Configure EHR integrations', 'Integrations', 'integrations', 'page', 'manage', 1),
  -- Financial Flags
  ('flags.financial', 'View Financial Flags', 'View flags with financial data', 'Financials', 'flags', 'feature', 'view', 1),
  -- Settings — General
  ('settings.general', 'General Settings', 'Access general facility settings', 'Settings', 'settings_general', 'page', 'manage', 1),
  ('settings.rooms', 'Room Settings', 'Access room settings', 'Settings', 'settings_rooms', 'page', 'manage', 2),
  ('settings.procedures', 'Procedure Settings', 'Access procedure type settings', 'Settings', 'settings_procedures', 'page', 'manage', 3),
  ('settings.milestones', 'Milestone Settings', 'Access milestone settings', 'Settings', 'settings_milestones', 'page', 'manage', 4),
  ('settings.flags', 'Flag Settings', 'Access flag rule settings', 'Settings', 'settings_flags', 'page', 'manage', 5),
  ('settings.delays', 'Delay Type Settings', 'Access delay type settings', 'Settings', 'settings_delays', 'page', 'manage', 6),
  ('settings.complexities', 'Complexity Settings', 'Access complexity settings', 'Settings', 'settings_complexities', 'page', 'manage', 7),
  ('settings.implant_companies', 'Implant Company Settings', 'Access implant company settings', 'Settings', 'settings_implant_companies', 'page', 'manage', 8),
  ('settings.cancellation_reasons', 'Cancellation Reason Settings', 'Access cancellation reason settings', 'Settings', 'settings_cancellation_reasons', 'page', 'manage', 9),
  ('settings.closures', 'Closure Settings', 'Access facility closure settings', 'Settings', 'settings_closures', 'page', 'manage', 10),
  ('settings.checklist', 'Checklist Settings', 'Access checklist builder settings', 'Settings', 'settings_checklist', 'page', 'manage', 11),
  ('settings.checkin', 'Checkin Settings', 'Access patient checkin settings', 'Settings', 'settings_checkin', 'page', 'manage', 12),
  ('settings.surgeon_preferences', 'Surgeon Preference Settings', 'Access surgeon preference settings', 'Settings', 'settings_surgeon_preferences', 'page', 'manage', 13),
  ('settings.voice_commands', 'Voice Command Settings', 'Access voice command settings', 'Settings', 'settings_voice_commands', 'page', 'manage', 14),
  ('settings.notifications', 'Notification Settings', 'Access notification settings', 'Settings', 'settings_notifications', 'page', 'manage', 15),
  ('settings.device_reps', 'Device Rep Settings', 'Access device rep settings', 'Settings', 'settings_device_reps', 'page', 'manage', 16),
  ('settings.analytics', 'Analytics Settings', 'Access analytics settings', 'Settings', 'settings_analytics', 'page', 'manage', 17),
  ('settings.permissions', 'Permission Settings', 'Access permission settings', 'Settings', 'settings_permissions', 'page', 'manage', 18),
  ('settings.subscription', 'Subscription Settings', 'Access subscription settings', 'Settings', 'settings_subscription', 'page', 'manage', 19),
  ('settings.integrations', 'Integration Settings', 'Access integration settings page', 'Settings', 'settings_integrations', 'page', 'manage', 20),
  -- Settings — Financial
  ('settings.financials_general', 'Financial Settings Overview', 'Access financial settings overview', 'Financial Settings', 'settings_financials', 'page', 'manage', 0),
  ('settings.financials_costs', 'Cost Category Settings', 'Access cost category settings', 'Financial Settings', 'settings_financials_costs', 'page', 'manage', 1),
  ('settings.financials_payers', 'Payer Settings', 'Access payer settings', 'Financial Settings', 'settings_financials_payers', 'page', 'manage', 2),
  ('settings.financials_pricing', 'Procedure Pricing Settings', 'Access procedure pricing settings', 'Financial Settings', 'settings_financials_pricing', 'page', 'manage', 3),
  ('settings.financials_targets', 'Financial Target Settings', 'Access financial target settings', 'Financial Settings', 'settings_financials_targets', 'page', 'manage', 4),
  ('settings.financials_surgeon_variance', 'Surgeon Variance Settings', 'Access surgeon variance settings', 'Financial Settings', 'settings_financials_surgeon_variance', 'page', 'manage', 5)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Keep settings.manage for backward compatibility during transition.
--    It will be deleted in Phase 2 after all TypeScript code is updated
--    to use granular settings.* keys instead.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4. Fix incorrect defaults in permission_templates
-- ---------------------------------------------------------------------------
-- user should NOT have cases.create by default
UPDATE permission_templates
SET granted = false, updated_at = now()
WHERE access_level = 'user' AND permission_key = 'cases.create';

-- coordinator should NOT have financial/analytics access by default
UPDATE permission_templates
SET granted = false, updated_at = now()
WHERE access_level = 'coordinator'
  AND permission_key IN ('financials.view', 'tab.case_financials', 'analytics.view', 'scores.view');

-- ---------------------------------------------------------------------------
-- 5. Insert permission_templates for the 33 new keys (user + coordinator)
-- ---------------------------------------------------------------------------

-- user templates — very restricted: only rooms.view granted
INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  -- Granted
  ('user', 'rooms.view', true),
  -- Denied
  ('user', 'spd.view', false),
  ('user', 'data_quality.view', false),
  ('user', 'staff_management.view', false),
  ('user', 'integrations.view', false),
  ('user', 'integrations.manage', false),
  ('user', 'flags.financial', false),
  ('user', 'settings.general', false),
  ('user', 'settings.rooms', false),
  ('user', 'settings.procedures', false),
  ('user', 'settings.milestones', false),
  ('user', 'settings.flags', false),
  ('user', 'settings.delays', false),
  ('user', 'settings.complexities', false),
  ('user', 'settings.implant_companies', false),
  ('user', 'settings.cancellation_reasons', false),
  ('user', 'settings.closures', false),
  ('user', 'settings.checklist', false),
  ('user', 'settings.checkin', false),
  ('user', 'settings.surgeon_preferences', false),
  ('user', 'settings.voice_commands', false),
  ('user', 'settings.notifications', false),
  ('user', 'settings.device_reps', false),
  ('user', 'settings.analytics', false),
  ('user', 'settings.permissions', false),
  ('user', 'settings.subscription', false),
  ('user', 'settings.integrations', false),
  ('user', 'settings.financials_general', false),
  ('user', 'settings.financials_costs', false),
  ('user', 'settings.financials_payers', false),
  ('user', 'settings.financials_pricing', false),
  ('user', 'settings.financials_targets', false),
  ('user', 'settings.financials_surgeon_variance', false)
ON CONFLICT (access_level, permission_key) DO NOTHING;

-- coordinator templates — operational access, no financials/analytics
INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  -- Pages — granted
  ('coordinator', 'rooms.view', true),
  ('coordinator', 'spd.view', true),
  ('coordinator', 'data_quality.view', true),
  ('coordinator', 'staff_management.view', true),
  -- Integrations — denied (admin-level)
  ('coordinator', 'integrations.view', false),
  ('coordinator', 'integrations.manage', false),
  -- Financials — denied
  ('coordinator', 'flags.financial', false),
  -- Settings — operational granted
  ('coordinator', 'settings.rooms', true),
  ('coordinator', 'settings.delays', true),
  ('coordinator', 'settings.complexities', true),
  ('coordinator', 'settings.cancellation_reasons', true),
  ('coordinator', 'settings.closures', true),
  ('coordinator', 'settings.checklist', true),
  ('coordinator', 'settings.checkin', true),
  ('coordinator', 'settings.surgeon_preferences', true),
  ('coordinator', 'settings.voice_commands', true),
  -- Settings — admin-level denied
  ('coordinator', 'settings.general', false),
  ('coordinator', 'settings.procedures', false),
  ('coordinator', 'settings.milestones', false),
  ('coordinator', 'settings.flags', false),
  ('coordinator', 'settings.implant_companies', false),
  ('coordinator', 'settings.notifications', false),
  ('coordinator', 'settings.device_reps', false),
  ('coordinator', 'settings.analytics', false),
  ('coordinator', 'settings.permissions', false),
  ('coordinator', 'settings.subscription', false),
  ('coordinator', 'settings.integrations', false),
  -- Financial settings — all denied
  ('coordinator', 'settings.financials_general', false),
  ('coordinator', 'settings.financials_costs', false),
  ('coordinator', 'settings.financials_payers', false),
  ('coordinator', 'settings.financials_pricing', false),
  ('coordinator', 'settings.financials_targets', false),
  ('coordinator', 'settings.financials_surgeon_variance', false)
ON CONFLICT (access_level, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Fix incorrect defaults in facility_permissions for existing facilities
-- ---------------------------------------------------------------------------
-- user should NOT have cases.create
UPDATE facility_permissions
SET granted = false, updated_at = now()
WHERE access_level = 'user' AND permission_key = 'cases.create';

-- coordinator should NOT have financial/analytics access
UPDATE facility_permissions
SET granted = false, updated_at = now()
WHERE access_level = 'coordinator'
  AND permission_key IN ('financials.view', 'tab.case_financials', 'analytics.view', 'scores.view');

-- ---------------------------------------------------------------------------
-- 7. Backfill facility_permissions for all existing facilities
--    Inserts new permission keys for user + coordinator using template defaults.
--    ON CONFLICT DO NOTHING preserves any existing customizations.
-- ---------------------------------------------------------------------------
INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, pt.access_level, pt.permission_key, pt.granted
FROM facilities f
CROSS JOIN permission_templates pt
WHERE pt.access_level IN ('user', 'coordinator')
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Recreate copy_permission_template_to_facility() — no logic change needed,
--    but recreate to ensure it picks up new permissions correctly.
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

COMMIT;
