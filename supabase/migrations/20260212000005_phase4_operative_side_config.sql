-- ============================================
-- Phase 4.2: Operative Side Configuration
-- Adds requires_operative_side to procedure_types so
-- the laterality field is conditionally shown only
-- for procedures where it matters (e.g., knee, hip).
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'procedure_types'
      AND column_name = 'requires_operative_side'
  ) THEN
    ALTER TABLE public.procedure_types
      ADD COLUMN requires_operative_side BOOLEAN NOT NULL DEFAULT false;
  END IF;
END$$;
