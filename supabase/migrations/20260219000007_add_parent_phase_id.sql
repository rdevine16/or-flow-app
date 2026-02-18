-- Add parent_phase_id to phase_definitions for subphase nesting
-- Part of: Milestone Pages — Subphases, Edit/Archive UX, Intervals

--------------------------------------------------------------------------------
-- 1. Add parent_phase_id column to phase_definitions
--------------------------------------------------------------------------------

ALTER TABLE public.phase_definitions
    ADD COLUMN parent_phase_id UUID REFERENCES public.phase_definitions(id) ON DELETE SET NULL;

-- Index for efficient child-phase lookups
CREATE INDEX idx_phase_definitions_parent
    ON public.phase_definitions USING btree (parent_phase_id)
    WHERE parent_phase_id IS NOT NULL;

--------------------------------------------------------------------------------
-- 2. Add parent_template_id column to phase_definition_templates
--------------------------------------------------------------------------------

ALTER TABLE public.phase_definition_templates
    ADD COLUMN parent_template_id UUID REFERENCES public.phase_definition_templates(id) ON DELETE SET NULL;
