-- Remove users.view and users.manage permissions (legacy, replaced by staff_management.manage)
-- The permissions settings page is already gated by settings.permissions.

-- 1. Remove any facility_permissions grants
DELETE FROM facility_permissions WHERE permission_key IN ('users.view', 'users.manage');

-- 2. Remove any permission_templates grants
DELETE FROM permission_templates WHERE permission_key IN ('users.view', 'users.manage');

-- 3. Remove the permission definitions
DELETE FROM permissions WHERE key IN ('users.view', 'users.manage');
