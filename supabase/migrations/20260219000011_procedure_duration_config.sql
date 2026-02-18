-- Phase 1: Database Migration — Procedure Duration Config
-- Add expected_duration_minutes to procedure_types and create surgeon_procedure_duration table

--------------------------------------------------------------------------------
-- 1. Add expected_duration_minutes column to procedure_types
--------------------------------------------------------------------------------

ALTER TABLE public.procedure_types
    ADD COLUMN expected_duration_minutes INTEGER;

--------------------------------------------------------------------------------
-- 2. surgeon_procedure_duration — surgeon-specific procedure duration overrides
--------------------------------------------------------------------------------

CREATE TABLE public.surgeon_procedure_duration (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id               UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    surgeon_id                UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    procedure_type_id         UUID NOT NULL REFERENCES public.procedure_types(id) ON DELETE CASCADE,
    expected_duration_minutes INTEGER NOT NULL,
    is_active                 BOOLEAN DEFAULT true,
    deleted_at                TIMESTAMPTZ,
    created_at                TIMESTAMPTZ DEFAULT now(),
    updated_at                TIMESTAMPTZ DEFAULT now(),
    UNIQUE(facility_id, surgeon_id, procedure_type_id)
);

-- Indexes
CREATE INDEX idx_surgeon_procedure_duration_facility
    ON public.surgeon_procedure_duration USING btree (facility_id);

CREATE INDEX idx_surgeon_procedure_duration_facility_surgeon
    ON public.surgeon_procedure_duration USING btree (facility_id, surgeon_id);

CREATE INDEX idx_surgeon_procedure_duration_facility_procedure
    ON public.surgeon_procedure_duration USING btree (facility_id, procedure_type_id);

-- Enable RLS
ALTER TABLE public.surgeon_procedure_duration ENABLE ROW LEVEL SECURITY;

-- Facility admins can manage their own facility's surgeon procedure durations
CREATE POLICY "Facility admins can manage own facility surgeon_procedure_dur"
    ON public.surgeon_procedure_duration
    USING (
        (public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())
    );

-- Global admins can manage all surgeon procedure durations
CREATE POLICY "Global admins can manage all surgeon_procedure_duration"
    ON public.surgeon_procedure_duration
    USING (public.get_my_access_level() = 'global_admin'::text);

-- Global admins can view all surgeon procedure durations
CREATE POLICY "Global admins can view all surgeon_procedure_duration"
    ON public.surgeon_procedure_duration
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

-- Users can view their own facility's surgeon procedure durations
CREATE POLICY "Users can view own facility surgeon_procedure_duration"
    ON public.surgeon_procedure_duration
    FOR SELECT
    USING (facility_id = public.get_my_facility_id());

-- Soft-delete trigger: keeps is_active and deleted_at in sync
CREATE TRIGGER sync_soft_delete_surgeon_procedure_duration
    BEFORE UPDATE ON public.surgeon_procedure_duration
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();
