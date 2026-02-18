-- Add sync_soft_delete_columns trigger to phase_definitions
-- This trigger was missed in the initial migration. It keeps is_active and deleted_at in sync,
-- matching the pattern used on 20+ other tables in the codebase.

DROP TRIGGER IF EXISTS sync_soft_delete_phase_definitions ON public.phase_definitions;

CREATE TRIGGER sync_soft_delete_phase_definitions
    BEFORE UPDATE ON public.phase_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();
