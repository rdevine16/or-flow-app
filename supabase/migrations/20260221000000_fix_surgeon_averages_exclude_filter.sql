-- Fix: recalculate_surgeon_averages must skip cases with is_excluded_from_metrics = true.
-- Without this, excluded cases (like test/invalid data) could pollute surgeon averages
-- when refresh runs, if those cases happen to have patient_in + patient_out timestamps.

CREATE OR REPLACE FUNCTION public.recalculate_surgeon_averages(p_facility_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  procedure_count INT := 0;
  milestone_count INT := 0;
  target_facility_id UUID;
BEGIN
  IF p_facility_id IS NOT NULL THEN
    target_facility_id := p_facility_id;
  END IF;

  -- ============================================
  -- 1. SURGEON PROCEDURE AVERAGES
  -- Average total case time (patient_in → patient_out) per surgeon/procedure
  -- ============================================

  IF target_facility_id IS NOT NULL THEN
    DELETE FROM surgeon_procedure_averages
    WHERE surgeon_id IN (SELECT id FROM users WHERE facility_id = target_facility_id);
  END IF;

  INSERT INTO surgeon_procedure_averages (
    id,
    surgeon_id,
    procedure_type_id,
    avg_total_minutes,
    sample_size,
    updated_at
  )
  SELECT
    gen_random_uuid() as id,
    c.surgeon_id,
    c.procedure_type_id,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (patient_out.recorded_at - patient_in.recorded_at)) / 60
    )::numeric, 1) as avg_total_minutes,
    COUNT(*) as sample_size,
    NOW() as updated_at
  FROM cases c
  JOIN case_milestones patient_in ON patient_in.case_id = c.id
  JOIN facility_milestones fm_in ON fm_in.id = patient_in.facility_milestone_id AND fm_in.name = 'patient_in'
  JOIN case_milestones patient_out ON patient_out.case_id = c.id
  JOIN facility_milestones fm_out ON fm_out.id = patient_out.facility_milestone_id AND fm_out.name = 'patient_out'
  WHERE c.surgeon_id IS NOT NULL
    AND c.procedure_type_id IS NOT NULL
    AND c.is_excluded_from_metrics IS NOT TRUE
    AND (target_facility_id IS NULL OR c.facility_id = target_facility_id)
  GROUP BY c.surgeon_id, c.procedure_type_id
  ON CONFLICT (surgeon_id, procedure_type_id)
  DO UPDATE SET
    avg_total_minutes = EXCLUDED.avg_total_minutes,
    sample_size = EXCLUDED.sample_size,
    updated_at = NOW();

  GET DIAGNOSTICS procedure_count = ROW_COUNT;

  -- ============================================
  -- 2. SURGEON MILESTONE AVERAGES
  -- Average time from patient_in to each milestone per surgeon/procedure
  -- ============================================

  IF target_facility_id IS NOT NULL THEN
    DELETE FROM surgeon_milestone_averages
    WHERE surgeon_id IN (SELECT id FROM users WHERE facility_id = target_facility_id);
  END IF;

  INSERT INTO surgeon_milestone_averages (
    id,
    surgeon_id,
    procedure_type_id,
    milestone_type_id,
    avg_minutes_from_start,
    sample_size,
    updated_at
  )
  SELECT
    gen_random_uuid() as id,
    c.surgeon_id,
    c.procedure_type_id,
    fm_milestone.source_milestone_type_id as milestone_type_id,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (milestone.recorded_at - patient_in.recorded_at)) / 60
    )::numeric, 1) as avg_minutes_from_start,
    COUNT(*) as sample_size,
    NOW() as updated_at
  FROM cases c
  JOIN case_milestones patient_in ON patient_in.case_id = c.id
  JOIN facility_milestones fm_in ON fm_in.id = patient_in.facility_milestone_id AND fm_in.name = 'patient_in'
  JOIN case_milestones milestone ON milestone.case_id = c.id
  JOIN facility_milestones fm_milestone ON fm_milestone.id = milestone.facility_milestone_id
  WHERE fm_milestone.name != 'patient_in'
    AND milestone.recorded_at > patient_in.recorded_at
    AND c.surgeon_id IS NOT NULL
    AND c.procedure_type_id IS NOT NULL
    AND c.is_excluded_from_metrics IS NOT TRUE
    AND fm_milestone.source_milestone_type_id IS NOT NULL
    AND (target_facility_id IS NULL OR c.facility_id = target_facility_id)
  GROUP BY c.surgeon_id, c.procedure_type_id, fm_milestone.source_milestone_type_id
  ON CONFLICT (surgeon_id, procedure_type_id, milestone_type_id)
  DO UPDATE SET
    avg_minutes_from_start = EXCLUDED.avg_minutes_from_start,
    sample_size = EXCLUDED.sample_size,
    updated_at = NOW();

  GET DIAGNOSTICS milestone_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'procedure_averages_updated', procedure_count,
    'milestone_averages_updated', milestone_count
  );
END;
$$;

