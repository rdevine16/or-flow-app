-- ============================================
-- Phase 2.1: Draft Cases
-- Adds is_draft column, updates RPC for draft support,
-- and creates finalize_draft_case RPC.
-- ============================================

-- Add is_draft column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE public.cases
      ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT false;
  END IF;
END$$;
-- ============================================
-- Update create_case_with_milestones to support drafts
-- When p_is_draft = true: insert case without milestones
-- When p_is_draft = false (default): existing behavior
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
  p_rep_required_override BOOLEAN DEFAULT NULL,
  p_is_draft          BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id UUID;
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
    rep_required_override,
    is_draft
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
    p_rep_required_override,
    p_is_draft
  )
  RETURNING id INTO v_case_id;

  -- 2) For drafts, skip milestone creation entirely
  IF p_is_draft THEN
    RETURN v_case_id;
  END IF;

  -- 3) Query procedure_milestone_config and insert case_milestones
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

  -- 4) Verify milestones were created
  IF NOT EXISTS (
    SELECT 1 FROM public.case_milestones WHERE case_id = v_case_id
  ) THEN
    RAISE EXCEPTION 'No milestones configured for procedure % at facility %',
      p_procedure_type_id, p_facility_id;
  END IF;

  RETURN v_case_id;
END;
$$;
-- ============================================
-- finalize_draft_case: Convert a draft to a full case
-- Updates the case, creates milestones, rolls back on failure.
-- ============================================
CREATE OR REPLACE FUNCTION public.finalize_draft_case(
  p_case_id           UUID,
  p_case_number       TEXT,
  p_scheduled_date    DATE,
  p_start_time        TIME,
  p_or_room_id        UUID,
  p_procedure_type_id UUID,
  p_status_id         UUID,
  p_surgeon_id        UUID,
  p_facility_id       UUID,
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
BEGIN
  -- 1) Verify the case exists and is a draft
  IF NOT EXISTS (
    SELECT 1 FROM public.cases
    WHERE id = p_case_id AND is_draft = true
  ) THEN
    RAISE EXCEPTION 'Case % is not a draft or does not exist', p_case_id;
  END IF;

  -- 2) Update the case with all fields, mark as non-draft
  UPDATE public.cases SET
    case_number = p_case_number,
    scheduled_date = p_scheduled_date,
    start_time = p_start_time,
    or_room_id = p_or_room_id,
    procedure_type_id = p_procedure_type_id,
    status_id = p_status_id,
    surgeon_id = p_surgeon_id,
    anesthesiologist_id = p_anesthesiologist_id,
    operative_side = p_operative_side,
    payer_id = p_payer_id,
    notes = p_notes,
    rep_required_override = p_rep_required_override,
    is_draft = false
  WHERE id = p_case_id;

  -- 3) Remove any existing milestones (shouldn't exist, but be safe)
  DELETE FROM public.case_milestones WHERE case_id = p_case_id;

  -- 4) Create milestones from procedure config
  INSERT INTO public.case_milestones (case_id, facility_milestone_id, recorded_at, recorded_by)
  SELECT
    p_case_id,
    pmc.facility_milestone_id,
    NULL,
    NULL
  FROM public.procedure_milestone_config pmc
  WHERE pmc.procedure_type_id = p_procedure_type_id
    AND pmc.facility_id = p_facility_id
    AND pmc.is_enabled = true;

  -- 5) Verify milestones were created
  IF NOT EXISTS (
    SELECT 1 FROM public.case_milestones WHERE case_id = p_case_id
  ) THEN
    RAISE EXCEPTION 'No milestones configured for procedure % at facility %',
      p_procedure_type_id, p_facility_id;
  END IF;

  RETURN p_case_id;
END;
$$;
