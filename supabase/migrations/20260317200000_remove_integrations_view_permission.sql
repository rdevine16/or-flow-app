-- Remove integrations.view permission (consolidated into integrations.manage)
-- Integrations is admin-level: you either have full access or none.

-- 1. Remove any facility_permissions grants for integrations.view
DELETE FROM facility_permissions WHERE permission_key = 'integrations.view';

-- 2. Remove any permission_templates grants for integrations.view
DELETE FROM permission_templates WHERE permission_key = 'integrations.view';

-- 3. Remove the permission definition itself
DELETE FROM permissions WHERE key = 'integrations.view';
