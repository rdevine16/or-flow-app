-- Phase 1: Database Foundation — surgeon_milestone_config
-- Part of: Milestone Hierarchy Redesign

--------------------------------------------------------------------------------
-- surgeon_milestone_config — surgeon-level overrides on procedure defaults
--------------------------------------------------------------------------------

CREATE TABLE public.surgeon_milestone_config (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id           UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    surgeon_id            UUID NOT NULL REFERENCES public.users(id),
    procedure_type_id     UUID NOT NULL REFERENCES public.procedure_types(id) ON DELETE CASCADE,
    facility_milestone_id UUID NOT NULL REFERENCES public.facility_milestones(id) ON DELETE CASCADE,
    is_enabled            BOOLEAN NOT NULL,
    display_order         INTEGER,
    UNIQUE(facility_id, surgeon_id, procedure_type_id, facility_milestone_id)
);

CREATE INDEX idx_surgeon_milestone_config_facility
    ON public.surgeon_milestone_config USING btree (facility_id);

CREATE INDEX idx_surgeon_milestone_config_surgeon_procedure
    ON public.surgeon_milestone_config USING btree (surgeon_id, procedure_type_id);

-- Enable RLS
ALTER TABLE public.surgeon_milestone_config ENABLE ROW LEVEL SECURITY;

-- Facility admins can manage their own facility's surgeon milestone configs
CREATE POLICY "Facility admins can manage own facility surgeon_milestone_conf"
    ON public.surgeon_milestone_config
    USING (
        (public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())
    );

-- Global admins can manage all surgeon milestone configs
CREATE POLICY "Global admins can manage all surgeon_milestone_config"
    ON public.surgeon_milestone_config
    USING (public.get_my_access_level() = 'global_admin'::text);

-- Global admins can view all surgeon milestone configs
CREATE POLICY "Global admins can view all surgeon_milestone_config"
    ON public.surgeon_milestone_config
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

-- Users can view their own facility's surgeon milestone configs
CREATE POLICY "Users can view own facility surgeon_milestone_config"
    ON public.surgeon_milestone_config
    FOR SELECT
    USING (facility_id = public.get_my_facility_id());
