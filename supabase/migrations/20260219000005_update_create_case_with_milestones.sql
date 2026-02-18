-- Phase 6: Update create_case_with_milestones() to merge surgeon overrides
-- When a surgeon has entries in surgeon_milestone_config, their is_enabled
-- value takes precedence over the procedure default via COALESCE.

-- Drop the two older overloads that are no longer called by any client.
-- All callers now pass p_is_draft and p_staff_assignments.
DROP FUNCTION IF EXISTS public.create_case_with_milestones(
  text, date, time without time zone, uuid, uuid, uuid, uuid, uuid,
  uuid, uuid, text, uuid, text, boolean
);
DROP FUNCTION IF EXISTS public.create_case_with_milestones(
  text, date, time without time zone, uuid, uuid, uuid, uuid, uuid,
  uuid, uuid, text, uuid, text, boolean, boolean
);

-- Replace the current version with surgeon override merge
CREATE OR REPLACE FUNCTION public.create_case_with_milestones(
  p_case_number text,
  p_scheduled_date date,
  p_start_time time without time zone,
  p_or_room_id uuid,
  p_procedure_type_id uuid,
  p_status_id uuid,
  p_surgeon_id uuid,
  p_facility_id uuid,
  p_created_by uuid DEFAULT NULL::uuid,
  p_anesthesiologist_id uuid DEFAULT NULL::uuid,
  p_operative_side text DEFAULT NULL::text,
  p_payer_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_rep_required_override boolean DEFAULT NULL::boolean,
  p_is_draft boolean DEFAULT false,
  p_staff_assignments jsonb DEFAULT NULL::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
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

  -- 3) Query procedure_milestone_config, merge surgeon overrides, insert case_milestones
  --    LEFT JOIN surgeon_milestone_config: if a surgeon has an override for this
  --    milestone, their is_enabled takes precedence over the procedure default.
  INSERT INTO public.case_milestones (case_id, facility_milestone_id, recorded_at, recorded_by)
  SELECT
    v_case_id,
    pmc.facility_milestone_id,
    NULL,
    NULL
  FROM public.procedure_milestone_config pmc
  LEFT JOIN public.surgeon_milestone_config smc
    ON  smc.facility_id = pmc.facility_id
    AND smc.procedure_type_id = pmc.procedure_type_id
    AND smc.facility_milestone_id = pmc.facility_milestone_id
    AND smc.surgeon_id = p_surgeon_id
  WHERE pmc.procedure_type_id = p_procedure_type_id
    AND pmc.facility_id = p_facility_id
    AND COALESCE(smc.is_enabled, pmc.is_enabled) = true;

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
