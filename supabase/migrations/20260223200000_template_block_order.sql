--------------------------------------------------------------------------------
-- Add block_order JSONB to template tables
-- Stores per-parent-phase ordering of sortable items (milestone IDs + sub-phase
-- block IDs) so sub-phase block positions persist across page navigations.
-- Format: { "parent-phase-uuid": ["item-uuid", "sp-block:sub-phase-uuid", ...] }
--------------------------------------------------------------------------------

ALTER TABLE public.milestone_templates
  ADD COLUMN block_order JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.milestone_template_types
  ADD COLUMN block_order JSONB NOT NULL DEFAULT '{}';
