-- Skip validated and excluded cases during issue detection
-- Prevents re-flagging cases that were already reviewed

CREATE OR REPLACE FUNCTION public.run_issue_detection_for_case(p_case_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_facility_id UUID;
  v_data_validated BOOLEAN;
  v_is_excluded BOOLEAN;
  v_issue RECORD;
  v_issue_type_id UUID;
  v_facility_milestone_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Get facility_id and validation state
  SELECT facility_id, data_validated, is_excluded_from_metrics
  INTO v_facility_id, v_data_validated, v_is_excluded
  FROM cases WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Skip validated or excluded cases
  IF v_data_validated IS TRUE OR v_is_excluded IS TRUE THEN
    RETURN 0;
  END IF;

  -- Loop through detected issues
  FOR v_issue IN SELECT * FROM detect_case_issues(p_case_id)
  LOOP
    -- Get issue_type_id
    SELECT id INTO v_issue_type_id FROM issue_types WHERE name = v_issue.issue_type;

    -- Get facility_milestone_id if milestone_name provided
    v_facility_milestone_id := NULL;
    IF v_issue.milestone_name IS NOT NULL THEN
      SELECT id INTO v_facility_milestone_id
      FROM facility_milestones
      WHERE facility_id = v_facility_id
        AND display_name = v_issue.milestone_name
        AND deleted_at IS NULL
      LIMIT 1;
    END IF;

    -- Insert issue (on conflict do nothing to avoid duplicates)
    INSERT INTO metric_issues (
      facility_id,
      case_id,
      issue_type_id,
      facility_milestone_id,
      detected_value,
      expected_min,
      expected_max,
      details
    ) VALUES (
      v_facility_id,
      p_case_id,
      v_issue_type_id,
      v_facility_milestone_id,
      v_issue.detected_value,
      v_issue.expected_min,
      v_issue.expected_max,
      v_issue.details
    )
    ON CONFLICT (case_id, facility_milestone_id, issue_type_id) DO UPDATE
    SET
      detected_value = EXCLUDED.detected_value,
      expected_min = EXCLUDED.expected_min,
      expected_max = EXCLUDED.expected_max,
      details = EXCLUDED.details,
      detected_at = NOW()
    WHERE metric_issues.resolved_at IS NULL;  -- Only update unresolved issues

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
