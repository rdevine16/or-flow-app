-- ============================================
-- Phase 3.1: Extend create_case_with_milestones RPC
-- to accept staff assignments (JSONB array).
-- Each element: {"user_id": "<uuid>", "role_id": "<uuid>"}
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
  p_is_draft          BOOLEAN DEFAULT false,
  p_staff_assignments JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id UUID;
  v_staff JSONB;
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
    -- Still insert staff even for drafts (team is often known early)
    IF p_staff_assignments IS NOT NULL AND jsonb_array_length(p_staff_assignments) > 0 THEN
      INSERT INTO public.case_staff (case_id, user_id, role_id)
      SELECT
        v_case_id,
        (elem->>'user_id')::UUID,
        (elem->>'role_id')::UUID
      FROM jsonb_array_elements(p_staff_assignments) AS elem;
    END IF;

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

  -- 5) Insert staff assignments if provided
  IF p_staff_assignments IS NOT NULL AND jsonb_array_length(p_staff_assignments) > 0 THEN
    INSERT INTO public.case_staff (case_id, user_id, role_id)
    SELECT
      v_case_id,
      (elem->>'user_id')::UUID,
      (elem->>'role_id')::UUID
    FROM jsonb_array_elements(p_staff_assignments) AS elem;
  END IF;

  RETURN v_case_id;
END;
$$;
