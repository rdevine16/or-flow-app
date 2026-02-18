-- ============================================
-- Phase 1.1: Atomic case creation RPC
-- Phase 1.5: Add created_by column to cases
-- ============================================

-- 1.5 — Add created_by if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.cases
      ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END$$;
-- Ensure created_at exists (should already, but be safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.cases
      ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END$$;
-- ============================================
-- 1.1 — create_case_with_milestones RPC
-- Single transaction: inserts case + milestones.
-- Rolls back entirely on any failure.
-- ============================================
CREATE OR REPLACE FUNCTION public.create_case_with_milestones(
  p_case_number       TEXT,
  p_scheduled_date    DATE,
  p_start_time        TIME,
  p_or_room_id        UUID,
  p_procedure_type_id UUID,
  p_status_id         UUID,
  p_surgeon_id        UUID,
  p_facility_id       UUID,
  p_created_by        UUID DEFAULT NULL,
  p_anesthesiologist_id UUID DEFAULT NULL,
  p_operative_side    TEXT DEFAULT NULL,
  p_payer_id          UUID DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_rep_required_override BOOLEAN DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id UUID;
  v_milestone RECORD;
BEGIN
  -- 1) Insert the case
  INSERT INTO public.cases (
    case_number,
    scheduled_date,
    start_time,
    or_room_id,
    procedure_type_id,
    status_id,
    surgeon_id,
    facility_id,
    created_by,
    anesthesiologist_id,
    operative_side,
    payer_id,
    notes,
    rep_required_override
  ) VALUES (
    p_case_number,
    p_scheduled_date,
    p_start_time,
    p_or_room_id,
    p_procedure_type_id,
    p_status_id,
    p_surgeon_id,
    p_facility_id,
    p_created_by,
    p_anesthesiologist_id,
    p_operative_side,
    p_payer_id,
    p_notes,
    p_rep_required_override
  )
  RETURNING id INTO v_case_id;

  -- 2) Query procedure_milestone_config and insert case_milestones
  INSERT INTO public.case_milestones (case_id, facility_milestone_id, recorded_at, recorded_by)
  SELECT
    v_case_id,
    pmc.facility_milestone_id,
    NULL,
    NULL
  FROM public.procedure_milestone_config pmc
  WHERE pmc.procedure_type_id = p_procedure_type_id
    AND pmc.facility_id = p_facility_id
    AND pmc.is_enabled = true;

  -- 3) Verify milestones were created (should be pre-checked by caller,
  --    but enforce at DB level too)
  IF NOT EXISTS (
    SELECT 1 FROM public.case_milestones WHERE case_id = v_case_id
  ) THEN
    RAISE EXCEPTION 'No milestones configured for procedure % at facility %',
      p_procedure_type_id, p_facility_id;
  END IF;

  RETURN v_case_id;
END;
$$;
