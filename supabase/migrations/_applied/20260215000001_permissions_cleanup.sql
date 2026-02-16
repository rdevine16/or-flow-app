-- =============================================================================
-- Permissions Cleanup — Align permission keys with actual UI actions
-- =============================================================================
-- Changes:
--   REMOVED: milestones.record, milestones.edit → replaced by milestones.manage
--   REMOVED: flags.edit (no edit UI exists)
--   REMOVED: delays.* (4 keys — delays are flags, same UI)
--   REMOVED: complexity.* (3 keys — no case-level UI)
--   REMOVED: implants.create, implants.delete (implants = view + edit only)
--   ADDED:   milestones.manage (record + undo in one permission)
--
-- CASCADE on permission_key FK auto-cleans permission_templates
-- and facility_permissions when we delete from permissions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Remove obsolete permission keys (cascades to templates + facility rows)
-- ---------------------------------------------------------------------------

DELETE FROM permissions WHERE key IN (
  'milestones.record',
  'milestones.edit',
  'flags.edit',
  'delays.view',
  'delays.create',
  'delays.edit',
  'delays.delete',
  'complexity.view',
  'complexity.create',
  'complexity.edit',
  'implants.create',
  'implants.delete'
);

-- ---------------------------------------------------------------------------
-- 2. Add milestones.manage (replaces milestones.record + milestones.edit)
-- ---------------------------------------------------------------------------

INSERT INTO permissions (key, label, description, category, resource, resource_type, action, sort_order)
VALUES (
  'milestones.manage',
  'Manage Milestones',
  'Record, undo, and clear milestone timestamps on cases',
  'Case Operations',
  'milestones',
  'action',
  'edit',
  11
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Update permission templates for milestones.manage
-- ---------------------------------------------------------------------------

INSERT INTO permission_templates (access_level, permission_key, granted) VALUES
  ('user', 'milestones.manage', true),
  ('coordinator', 'milestones.manage', true)
ON CONFLICT (access_level, permission_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Backfill facility_permissions for milestones.manage
--    Grant to all facilities (matches both user + coordinator templates)
-- ---------------------------------------------------------------------------

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'user', 'milestones.manage', true
FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;

INSERT INTO facility_permissions (facility_id, access_level, permission_key, granted)
SELECT f.id, 'coordinator', 'milestones.manage', true
FROM facilities f
ON CONFLICT (facility_id, access_level, permission_key) DO NOTHING;
