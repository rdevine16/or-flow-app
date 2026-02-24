-- Drop legacy phase_definitions and phase_definition_templates tables.
-- Phase boundaries are now derived from milestone_template_items via
-- resolve_template_phase_boundaries(). These tables are no longer
-- read or written by any RPC, adapter, or frontend query.
--
-- Dropping order matters: phase_definitions has a self-referencing FK
-- (parent_phase_id) and FKs to facility_milestones, so CASCADE handles
-- dependent indexes, policies, and triggers.

-- 1. Drop phase_definitions (per-facility phase boundary config)
DROP TABLE IF EXISTS public.phase_definitions CASCADE;

-- 2. Drop phase_definition_templates (global admin seeding templates)
DROP TABLE IF EXISTS public.phase_definition_templates CASCADE;

-- 3. Drop seed function (idempotent — already dropped in 20260223300000, but safe)
DROP FUNCTION IF EXISTS public.seed_facility_phases(UUID);
