-- Phase 1: Patient Fields on Cases
--
-- 1. Add `source` column to cases table ('manual', 'epic', 'cerner')
-- 2. Alter create_case_with_milestones RPC: add p_patient_id and p_source params

--------------------------------------------------------------------------------
-- 1. Add source column to cases
--------------------------------------------------------------------------------

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'epic', 'cerner'));

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_cases_source ON public.cases(source) WHERE source != 'manual';

--------------------------------------------------------------------------------
-- 2. Recreate create_case_with_milestones with p_patient_id and p_source
--------------------------------------------------------------------------------

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
  p_staff_assignments jsonb DEFAULT NULL::jsonb,
  p_patient_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'manual'::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
  v_template_id UUID;
BEGIN
  -- 1) Insert the case (now includes patient_id and source)
  INSERT INTO public.cases (
    case_number, scheduled_date, start_time, or_room_id, procedure_type_id,
    status_id, surgeon_id, facility_id, created_by, operative_side,
    payer_id, notes, rep_required_override, is_draft, patient_id, source
  ) VALUES (
    p_case_number, p_scheduled_date, p_start_time, p_or_room_id, p_procedure_type_id,
    p_status_id, p_surgeon_id, p_facility_id, p_created_by, p_operative_side,
    p_payer_id, p_notes, p_rep_required_override, p_is_draft, p_patient_id, p_source
  )
  RETURNING id INTO v_case_id;

  -- 2) For drafts, skip milestone creation entirely
  IF p_is_draft THEN
    IF p_staff_assignments IS NOT NULL AND jsonb_array_length(p_staff_assignments) > 0 THEN
      INSERT INTO public.case_staff (case_id, user_id, role_id)
      SELECT v_case_id, (elem->>'user_id')::UUID, (elem->>'role_id')::UUID
      FROM jsonb_array_elements(p_staff_assignments) AS elem;
    END IF;
    RETURN v_case_id;
  END IF;

  -- 3) Resolve template via cascade:
  --    surgeon override → procedure assignment → facility default

  -- 3a. Check surgeon_template_overrides
  SELECT milestone_template_id INTO v_template_id
  FROM public.surgeon_template_overrides
  WHERE surgeon_id = p_surgeon_id
    AND procedure_type_id = p_procedure_type_id
    AND facility_id = p_facility_id;

  -- 3b. Check procedure_types.milestone_template_id
  IF v_template_id IS NULL THEN
    SELECT milestone_template_id INTO v_template_id
    FROM public.procedure_types
    WHERE id = p_procedure_type_id;
  END IF;

  -- 3c. Fall back to facility default template
  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
    FROM public.milestone_templates
    WHERE facility_id = p_facility_id
      AND is_default = true
      AND is_active = true;
  END IF;

  -- 3d. No template found → raise exception
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'No milestone template found for procedure % at facility %. Please assign a template in Settings > Milestones.',
      p_procedure_type_id, p_facility_id;
  END IF;

  -- 4) Stamp the resolved template on the case
  UPDATE public.cases
  SET milestone_template_id = v_template_id
  WHERE id = v_case_id;

  -- 5) Create case_milestones from template items
  --    Use DISTINCT to handle shared boundary milestones (same milestone in 2 phases)
  INSERT INTO public.case_milestones (case_id, facility_milestone_id, recorded_at, recorded_by)
  SELECT
    v_case_id,
    mti.facility_milestone_id,
    NULL,
    NULL
  FROM (
    SELECT DISTINCT ON (facility_milestone_id)
      facility_milestone_id,
      MIN(display_order) AS min_order
    FROM public.milestone_template_items
    WHERE template_id = v_template_id
    GROUP BY facility_milestone_id
  ) mti
  ORDER BY mti.min_order;

  -- 6) Verify milestones were created
  IF NOT EXISTS (
    SELECT 1 FROM public.case_milestones WHERE case_id = v_case_id
  ) THEN
    RAISE EXCEPTION 'No milestones found in template % for procedure % at facility %',
      v_template_id, p_procedure_type_id, p_facility_id;
  END IF;

  -- 7) Insert staff assignments if provided
  IF p_staff_assignments IS NOT NULL AND jsonb_array_length(p_staff_assignments) > 0 THEN
    INSERT INTO public.case_staff (case_id, user_id, role_id)
    SELECT v_case_id, (elem->>'user_id')::UUID, (elem->>'role_id')::UUID
    FROM jsonb_array_elements(p_staff_assignments) AS elem;
  END IF;

  RETURN v_case_id;
END;
$$;
