-- =============================================================================
-- Migration: Delete settings.manage permission (Phase 2)
-- =============================================================================
-- All TypeScript code now uses granular settings.* keys.
-- This migration removes the legacy settings.manage permission.
-- CASCADE deletes from permission_templates and facility_permissions.
-- =============================================================================

BEGIN;

-- Delete from facility_permissions first (FK to permissions.key)
DELETE FROM facility_permissions WHERE permission_key = 'settings.manage';

-- Delete from permission_templates (FK to permissions.key)
DELETE FROM permission_templates WHERE permission_key = 'settings.manage';

-- Delete the permission itself
DELETE FROM permissions WHERE key = 'settings.manage';

COMMIT;
