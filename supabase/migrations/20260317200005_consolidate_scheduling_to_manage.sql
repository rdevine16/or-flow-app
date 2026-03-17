-- Consolidate scheduling.view/create/edit/delete into scheduling.manage
-- Block scheduling covers both surgeon block assignments and room schedules.

-- 1. Remove grants for old scheduling permissions
DELETE FROM facility_permissions WHERE permission_key IN (
  'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.delete'
);

DELETE FROM permission_templates WHERE permission_key IN (
  'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.delete'
);

-- 2. Remove old permission definitions
DELETE FROM permissions WHERE key IN (
  'scheduling.view', 'scheduling.create', 'scheduling.edit', 'scheduling.delete'
);

-- 3. Insert the consolidated manage permission
INSERT INTO permissions (key, label, description, category, resource, resource_type, action, sort_order)
VALUES (
  'scheduling.manage',
  'Manage Scheduling',
  'Full access to surgeon block scheduling and room schedule board — create, edit, clone, and delete block assignments and room schedules',
  'Scheduling',
  'scheduling',
  'page',
  'manage',
  500
) ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  label = EXCLUDED.label;
