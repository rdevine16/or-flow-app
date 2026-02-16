-- Phase 1: Database Foundation — phase_definitions + phase_definition_templates
-- Part of: Milestone Hierarchy Redesign

--------------------------------------------------------------------------------
-- 1. phase_definitions — per-facility phase boundary configuration
--------------------------------------------------------------------------------

CREATE TABLE public.phase_definitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id         UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    display_name        TEXT NOT NULL,
    display_order       INTEGER NOT NULL,
    start_milestone_id  UUID NOT NULL REFERENCES public.facility_milestones(id),
    end_milestone_id    UUID NOT NULL REFERENCES public.facility_milestones(id),
    color_key           TEXT,
    is_active           BOOLEAN DEFAULT true,
    deleted_at          TIMESTAMPTZ
);

-- Partial unique index: only one active phase with a given name per facility
CREATE UNIQUE INDEX phase_definitions_facility_name_active
    ON public.phase_definitions(facility_id, name) WHERE is_active = true;

CREATE INDEX idx_phase_definitions_facility
    ON public.phase_definitions USING btree (facility_id);

-- Enable RLS
ALTER TABLE public.phase_definitions ENABLE ROW LEVEL SECURITY;

-- Facility admins can manage their own facility's phase definitions
CREATE POLICY "Facility admins can manage own facility phase_definitions"
    ON public.phase_definitions
    USING (
        (public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())
    );

-- Global admins can manage all phase definitions
CREATE POLICY "Global admins can manage all phase_definitions"
    ON public.phase_definitions
    USING (public.get_my_access_level() = 'global_admin'::text);

-- Global admins can view all phase definitions
CREATE POLICY "Global admins can view all phase_definitions"
    ON public.phase_definitions
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

-- Users can view their own facility's phase definitions
CREATE POLICY "Users can view own facility phase_definitions"
    ON public.phase_definitions
    FOR SELECT
    USING (facility_id = public.get_my_facility_id());

-- Soft-delete trigger: keeps is_active and deleted_at in sync (same pattern as 20+ other tables)
CREATE TRIGGER sync_soft_delete_phase_definitions
    BEFORE UPDATE ON public.phase_definitions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();


--------------------------------------------------------------------------------
-- 2. phase_definition_templates — global admin templates (seed new facilities)
--------------------------------------------------------------------------------

CREATE TABLE public.phase_definition_templates (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT NOT NULL UNIQUE,
    display_name             TEXT NOT NULL,
    display_order            INTEGER NOT NULL,
    start_milestone_type_id  UUID NOT NULL REFERENCES public.milestone_types(id),
    end_milestone_type_id    UUID NOT NULL REFERENCES public.milestone_types(id),
    color_key                TEXT,
    is_active                BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.phase_definition_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view templates
CREATE POLICY "All users can view phase_definition_templates"
    ON public.phase_definition_templates
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Global admins can create templates
CREATE POLICY "Global admins can create phase_definition_templates"
    ON public.phase_definition_templates
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

-- Global admins can update templates
CREATE POLICY "Global admins can update phase_definition_templates"
    ON public.phase_definition_templates
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

-- Global admins can delete templates
CREATE POLICY "Global admins can delete phase_definition_templates"
    ON public.phase_definition_templates
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));
