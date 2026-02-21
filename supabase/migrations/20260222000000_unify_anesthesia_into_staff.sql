-- Migration: Unify Anesthesia into Staff System
-- Removes dedicated cases.anesthesiologist_id column, migrates data to case_staff,
-- and updates all RPCs that referenced the column.

BEGIN;

-- ============================================================================
-- 1. DATA MIGRATION: Copy anesthesiologist_id into case_staff (de-duplicated)
-- ============================================================================
-- Insert into case_staff where anesthesiologist_id is set but NOT already in case_staff
INSERT INTO case_staff (case_id, user_id, role_id)
SELECT c.id, c.anesthesiologist_id, ur.id
FROM cases c
JOIN user_roles ur ON ur.name = 'anesthesiologist'
WHERE c.anesthesiologist_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM case_staff cs
  WHERE cs.case_id = c.id
  AND cs.user_id = c.anesthesiologist_id
);

-- ============================================================================
-- 2. DROP FK CONSTRAINT AND COLUMN
-- ============================================================================
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_anesthesiologist_id_fkey;
ALTER TABLE public.cases DROP COLUMN IF EXISTS anesthesiologist_id;

-- ============================================================================
-- 3. DROP UNUSED RPC: get_anesthesiologist_block_stats
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_anesthesiologist_block_stats(uuid);

-- ============================================================================
-- 4. UPDATE RPC: create_case_with_milestones (remove p_anesthesiologist_id)
--    Must DROP old signature first — parameter list changed, so CREATE OR REPLACE
--    alone would create an overloaded function instead of replacing.
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_case_with_milestones(text, date, time without time zone, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, boolean, boolean, jsonb);

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

-- ============================================================================
-- 5. UPDATE RPC: finalize_draft_case (remove p_anesthesiologist_id)
--    Must DROP old signature first — parameter list changed.
-- ============================================================================
DROP FUNCTION IF EXISTS public.finalize_draft_case(uuid, text, date, time, uuid, uuid, uuid, uuid, uuid, uuid, text, uuid, text, boolean);

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

-- ============================================================================
-- 6. UPDATE RPC: get_surgeon_day_overview (read anesthesiologist from case_staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_surgeon_day_overview(
  p_surgeon_id uuid,
  p_facility_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result JSON;
    v_cases JSON;
    v_procedure_summary JSON;
    v_median_times JSON;
    v_turnover_median NUMERIC;
BEGIN
    -- Get today's cases (anesthesiologist now comes from case_staff)
    SELECT json_agg(row_to_json(c_data))
    INTO v_cases
    FROM (
        SELECT
            c.id,
            c.case_number,
            c.scheduled_date,
            c.start_time,
            c.notes,
            json_build_object('name', r.name) as or_room,
            json_build_object(
                'name', pt.name,
                'procedure_category_id', pt.procedure_category_id
            ) as procedure_type,
            json_build_object('name', cs_status.name) as status,
            (
              SELECT json_build_object(
                'first_name', ua.first_name,
                'last_name', ua.last_name
              )
              FROM case_staff cs_staff
              JOIN user_roles ur ON cs_staff.role_id = ur.id
              JOIN users ua ON cs_staff.user_id = ua.id
              WHERE cs_staff.case_id = c.id
                AND ur.name = 'anesthesiologist'
                AND cs_staff.removed_at IS NULL
              LIMIT 1
            ) as anesthesiologist
        FROM cases c
        LEFT JOIN or_rooms r ON c.or_room_id = r.id
        LEFT JOIN procedure_types pt ON c.procedure_type_id = pt.id
        LEFT JOIN case_statuses cs_status ON c.status_id = cs_status.id
        WHERE c.surgeon_id = p_surgeon_id
          AND c.scheduled_date = p_date
        ORDER BY c.start_time
    ) c_data;

    -- Get procedure category summary
    SELECT json_agg(row_to_json(ps_data))
    INTO v_procedure_summary
    FROM (
        SELECT
            pc.id as category_id,
            pc.display_name as category_name,
            COUNT(*) as count,
            array_agg(DISTINCT pt.name) as procedures
        FROM cases c
        JOIN procedure_types pt ON c.procedure_type_id = pt.id
        LEFT JOIN procedure_categories pc ON pt.procedure_category_id = pc.id
        WHERE c.surgeon_id = p_surgeon_id
          AND c.scheduled_date = p_date
        GROUP BY pc.id, pc.display_name
        ORDER BY COUNT(*) DESC
    ) ps_data;

    -- Get median times
    SELECT json_agg(row_to_json(mt_data))
    INTO v_median_times
    FROM get_surgeon_median_times(p_surgeon_id) mt_data;

    -- Get turnover median
    SELECT get_facility_median_turnover(p_facility_id)
    INTO v_turnover_median;

    -- Build result
    result := json_build_object(
        'cases', COALESCE(v_cases, '[]'::json),
        'procedure_summary', COALESCE(v_procedure_summary, '[]'::json),
        'median_times', COALESCE(v_median_times, '[]'::json),
        'facility_turnover_median', COALESCE(v_turnover_median, 20)
    );

    RETURN result;
END;
$$;

COMMIT;
