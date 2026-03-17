-- Remove staff_management.view permission (consolidated into staff_management.manage)
-- Staff management is admin-level: you either have full access or none.

-- 1. Remove any facility_permissions grants for staff_management.view
DELETE FROM facility_permissions WHERE permission_key = 'staff_management.view';

-- 2. Remove any permission_templates grants for staff_management.view
DELETE FROM permission_templates WHERE permission_key = 'staff_management.view';

-- 3. Remove the permission definition itself
DELETE FROM permissions WHERE key = 'staff_management.view';
