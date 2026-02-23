-- Migration A: Milestone Template System — Table Creation
-- Part of: feature/milestone-template-system Phase 1
--
-- Creates 7 new tables, adds 2 FK columns, sets up RLS, triggers, constraints.
-- No data is migrated here — see 20260223000002.

--------------------------------------------------------------------------------
-- 1. facility_phases — per-facility phase library
--    Replaces the boundary-based model in phase_definitions.
--    Phases here are just identity (name + color) — boundaries are position-based
--    in milestone_template_items.
--------------------------------------------------------------------------------

CREATE TABLE public.facility_phases (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id      UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    display_name     TEXT NOT NULL,
    color_key        TEXT,
    display_order    INTEGER NOT NULL DEFAULT 0,
    parent_phase_id  UUID REFERENCES public.facility_phases(id) ON DELETE SET NULL,
    is_active        BOOLEAN NOT NULL DEFAULT true,
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID
);

-- Partial unique: one active phase per name per facility
CREATE UNIQUE INDEX facility_phases_facility_name_active
    ON public.facility_phases(facility_id, name) WHERE is_active = true;

CREATE INDEX idx_facility_phases_facility
    ON public.facility_phases USING btree (facility_id);

-- Soft-delete trigger
CREATE TRIGGER sync_soft_delete_facility_phases
    BEFORE UPDATE ON public.facility_phases
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();

-- RLS (standard 4-policy pattern)
ALTER TABLE public.facility_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility admins can manage own facility facility_phases"
    ON public.facility_phases
    USING (
        (public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())
    );

CREATE POLICY "Global admins can manage all facility_phases"
    ON public.facility_phases
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Global admins can view all facility_phases"
    ON public.facility_phases
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Users can view own facility facility_phases"
    ON public.facility_phases
    FOR SELECT
    USING (facility_id = public.get_my_facility_id());


--------------------------------------------------------------------------------
-- 2. milestone_templates — named template per facility
--    One default per facility (enforced by trigger below).
--------------------------------------------------------------------------------

CREATE TABLE public.milestone_templates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id  UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    is_default   BOOLEAN NOT NULL DEFAULT false,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    deleted_at   TIMESTAMPTZ,
    deleted_by   UUID
);

-- Partial unique: one active template per name per facility
CREATE UNIQUE INDEX milestone_templates_facility_name_active
    ON public.milestone_templates(facility_id, name) WHERE is_active = true;

CREATE INDEX idx_milestone_templates_facility
    ON public.milestone_templates USING btree (facility_id);

-- Soft-delete trigger
CREATE TRIGGER sync_soft_delete_milestone_templates
    BEFORE UPDATE ON public.milestone_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();

-- Single-default trigger: when a template is set as default, clear default on all
-- other templates in the same facility (race-condition safe via BEFORE trigger).
CREATE OR REPLACE FUNCTION public.enforce_single_default_template()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_default = true AND NEW.is_active = true THEN
        UPDATE public.milestone_templates
        SET is_default = false
        WHERE facility_id = NEW.facility_id
          AND id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_default_milestone_template
    BEFORE INSERT OR UPDATE ON public.milestone_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_default_template();

-- RLS
ALTER TABLE public.milestone_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility admins can manage own facility milestone_templates"
    ON public.milestone_templates
    USING (
        (public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())
    );

CREATE POLICY "Global admins can manage all milestone_templates"
    ON public.milestone_templates
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Global admins can view all milestone_templates"
    ON public.milestone_templates
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Users can view own facility milestone_templates"
    ON public.milestone_templates
    FOR SELECT
    USING (facility_id = public.get_my_facility_id());


--------------------------------------------------------------------------------
-- 3. milestone_template_items — ordered milestones in a template
--    Each item belongs to one phase (facility_phase_id, nullable for unphased).
--    A milestone CAN appear in two adjacent phases for shared boundaries
--    (e.g., "incision" as last of Pre-Op and first of Surgical).
--    display_order is the global position within the template.
--------------------------------------------------------------------------------

CREATE TABLE public.milestone_template_items (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id           UUID NOT NULL REFERENCES public.milestone_templates(id) ON DELETE CASCADE,
    facility_milestone_id UUID NOT NULL REFERENCES public.facility_milestones(id) ON DELETE CASCADE,
    facility_phase_id     UUID REFERENCES public.facility_phases(id) ON DELETE SET NULL,
    display_order         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_milestone_template_items_template
    ON public.milestone_template_items USING btree (template_id);

CREATE INDEX idx_milestone_template_items_milestone
    ON public.milestone_template_items USING btree (facility_milestone_id);

-- RLS: items inherit access from their template's facility_id
ALTER TABLE public.milestone_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility admins can manage own facility milestone_template_items"
    ON public.milestone_template_items
    USING (
        EXISTS (
            SELECT 1 FROM public.milestone_templates mt
            WHERE mt.id = template_id
              AND mt.facility_id = public.get_my_facility_id()
              AND public.get_my_access_level() = 'facility_admin'::text
        )
    );

CREATE POLICY "Global admins can manage all milestone_template_items"
    ON public.milestone_template_items
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Global admins can view all milestone_template_items"
    ON public.milestone_template_items
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Users can view own facility milestone_template_items"
    ON public.milestone_template_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.milestone_templates mt
            WHERE mt.id = template_id
              AND mt.facility_id = public.get_my_facility_id()
        )
    );


--------------------------------------------------------------------------------
-- 4. surgeon_template_overrides — surgeon picks a different template per procedure
--    Hard delete (no soft-delete) — removing an override reverts to procedure default.
--------------------------------------------------------------------------------

CREATE TABLE public.surgeon_template_overrides (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id           UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    surgeon_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    procedure_type_id     UUID NOT NULL REFERENCES public.procedure_types(id) ON DELETE CASCADE,
    milestone_template_id UUID NOT NULL REFERENCES public.milestone_templates(id) ON DELETE CASCADE,
    UNIQUE(facility_id, surgeon_id, procedure_type_id)
);

CREATE INDEX idx_surgeon_template_overrides_facility
    ON public.surgeon_template_overrides USING btree (facility_id);

CREATE INDEX idx_surgeon_template_overrides_surgeon_procedure
    ON public.surgeon_template_overrides USING btree (surgeon_id, procedure_type_id);

-- RLS
ALTER TABLE public.surgeon_template_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facility admins can manage own facility surgeon_template_overrides"
    ON public.surgeon_template_overrides
    USING (
        (public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())
    );

CREATE POLICY "Global admins can manage all surgeon_template_overrides"
    ON public.surgeon_template_overrides
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Global admins can view all surgeon_template_overrides"
    ON public.surgeon_template_overrides
    FOR SELECT
    USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Users can view own facility surgeon_template_overrides"
    ON public.surgeon_template_overrides
    FOR SELECT
    USING (facility_id = public.get_my_facility_id());


--------------------------------------------------------------------------------
-- 5. phase_templates — global admin phase library
--    Seeds facility_phases for new facilities.
--------------------------------------------------------------------------------

CREATE TABLE public.phase_templates (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT NOT NULL UNIQUE,
    display_name             TEXT NOT NULL,
    color_key                TEXT,
    display_order            INTEGER NOT NULL DEFAULT 0,
    parent_phase_template_id UUID REFERENCES public.phase_templates(id) ON DELETE SET NULL,
    is_active                BOOLEAN NOT NULL DEFAULT true
);

-- RLS (global admin write, all authenticated read)
ALTER TABLE public.phase_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view phase_templates"
    ON public.phase_templates
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can create phase_templates"
    ON public.phase_templates
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

CREATE POLICY "Global admins can update phase_templates"
    ON public.phase_templates
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

CREATE POLICY "Global admins can delete phase_templates"
    ON public.phase_templates
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));


--------------------------------------------------------------------------------
-- 6. milestone_template_types — global admin template definitions
--    Seeds milestone_templates for new facilities.
--------------------------------------------------------------------------------

CREATE TABLE public.milestone_template_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    is_active   BOOLEAN NOT NULL DEFAULT true
);

-- Single-default trigger for global template types
CREATE OR REPLACE FUNCTION public.enforce_single_default_template_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_default = true AND NEW.is_active = true THEN
        UPDATE public.milestone_template_types
        SET is_default = false
        WHERE id != NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_default_milestone_template_type
    BEFORE INSERT OR UPDATE ON public.milestone_template_types
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_single_default_template_type();

-- RLS (global admin write, all authenticated read)
ALTER TABLE public.milestone_template_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view milestone_template_types"
    ON public.milestone_template_types
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can create milestone_template_types"
    ON public.milestone_template_types
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

CREATE POLICY "Global admins can update milestone_template_types"
    ON public.milestone_template_types
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

CREATE POLICY "Global admins can delete milestone_template_types"
    ON public.milestone_template_types
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));


--------------------------------------------------------------------------------
-- 7. milestone_template_type_items — global admin template items
--    Seeds milestone_template_items for new facilities.
--------------------------------------------------------------------------------

CREATE TABLE public.milestone_template_type_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_type_id  UUID NOT NULL REFERENCES public.milestone_template_types(id) ON DELETE CASCADE,
    milestone_type_id UUID NOT NULL REFERENCES public.milestone_types(id) ON DELETE CASCADE,
    phase_template_id UUID REFERENCES public.phase_templates(id) ON DELETE SET NULL,
    display_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_milestone_template_type_items_template_type
    ON public.milestone_template_type_items USING btree (template_type_id);

-- RLS (global admin write, all authenticated read)
ALTER TABLE public.milestone_template_type_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view milestone_template_type_items"
    ON public.milestone_template_type_items
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can create milestone_template_type_items"
    ON public.milestone_template_type_items
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

CREATE POLICY "Global admins can update milestone_template_type_items"
    ON public.milestone_template_type_items
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));

CREATE POLICY "Global admins can delete milestone_template_type_items"
    ON public.milestone_template_type_items
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.access_level = 'global_admin'::text
    ));


--------------------------------------------------------------------------------
-- 8. Add milestone_template_id FK to procedure_types
--------------------------------------------------------------------------------

ALTER TABLE public.procedure_types
    ADD COLUMN milestone_template_id UUID REFERENCES public.milestone_templates(id) ON DELETE SET NULL;


--------------------------------------------------------------------------------
-- 9. Add milestone_template_type_id FK to procedure_type_templates
--------------------------------------------------------------------------------

ALTER TABLE public.procedure_type_templates
    ADD COLUMN milestone_template_type_id UUID REFERENCES public.milestone_template_types(id) ON DELETE SET NULL;
