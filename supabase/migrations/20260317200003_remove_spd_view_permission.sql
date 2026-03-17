-- Remove spd.view permission (consolidated into spd.manage)
-- SPD is admin-level: you either have full access or none.

-- 1. Remove any facility_permissions grants for spd.view
DELETE FROM facility_permissions WHERE permission_key = 'spd.view';

-- 2. Remove any permission_templates grants for spd.view
DELETE FROM permission_templates WHERE permission_key = 'spd.view';

-- 3. Remove the permission definition itself
DELETE FROM permissions WHERE key = 'spd.view';
