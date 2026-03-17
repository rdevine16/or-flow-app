-- Remove data_quality.view permission (consolidated into data_quality.manage)
-- Data quality is admin-level: you either have full access or none.

-- 1. Remove any facility_permissions grants for data_quality.view
DELETE FROM facility_permissions WHERE permission_key = 'data_quality.view';

-- 2. Remove any permission_templates grants for data_quality.view
DELETE FROM permission_templates WHERE permission_key = 'data_quality.view';

-- 3. Remove the permission definition itself
DELETE FROM permissions WHERE key = 'data_quality.view';
