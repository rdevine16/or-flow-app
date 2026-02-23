--------------------------------------------------------------------------------
-- Add sub_phase_map JSONB to template tables
-- Stores per-template sub-phase relationships so nesting is template-specific.
-- Format: { "childPhaseId": "parentPhaseId" }
-- A phase can be a sub-phase in one template but a top-level phase in another.
--------------------------------------------------------------------------------

ALTER TABLE public.milestone_templates
  ADD COLUMN sub_phase_map JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.milestone_template_types
  ADD COLUMN sub_phase_map JSONB NOT NULL DEFAULT '{}';
