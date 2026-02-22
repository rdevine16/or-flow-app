-- ============================================================================
-- Migration: Fix 2 remaining lint issues from previous migration
-- 1. get_facility_median_block_time — staff_roles → user_roles (correct table name)
-- 2. detect_case_issues — remove unused variable v_milestones
-- ============================================================================

-- 1. Fix get_facility_median_block_time: use user_roles (not staff_roles)
CREATE OR REPLACE FUNCTION public.get_facility_median_block_time(p_facility_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result NUMERIC;
BEGIN
    WITH block_times AS (
        SELECT
            EXTRACT(EPOCH FROM (
                (SELECT cm.recorded_at
                 FROM case_milestones cm
                 JOIN facility_milestones fm ON cm.facility_milestone_id = fm.id
                 WHERE cm.case_id = c.id AND fm.name = 'anes_end'
                 LIMIT 1)
                -
                (SELECT cm.recorded_at
                 FROM case_milestones cm
                 JOIN facility_milestones fm ON cm.facility_milestone_id = fm.id
                 WHERE cm.case_id = c.id AND fm.name = 'anes_start'
                 LIMIT 1)
            )) / 60 as block_minutes
        FROM cases c
        JOIN case_statuses cs ON c.status_id = cs.id
        WHERE c.facility_id = p_facility_id
          AND EXISTS (
            SELECT 1 FROM case_staff cs2
            JOIN user_roles ur ON cs2.role_id = ur.id
            WHERE cs2.case_id = c.id AND ur.name = 'anesthesiologist'
          )
          AND cs.name = 'completed'
    )
    SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY bt.block_minutes)::numeric, 1)
    INTO result
    FROM block_times bt
    WHERE bt.block_minutes IS NOT NULL
      AND bt.block_minutes > 0
      AND bt.block_minutes < 120;

    RETURN COALESCE(result, 20.0);
END;
$$;

-- 2. Fix detect_case_issues: remove unused v_milestones variable
CREATE OR REPLACE FUNCTION public.detect_case_issues(p_case_id uuid)
RETURNS TABLE(issue_type text, milestone_name text, detected_value numeric, expected_min numeric, expected_max numeric, details jsonb)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_facility_id UUID;
  v_case_status TEXT;
  v_scheduled_date DATE;
  v_prev_milestone RECORD;
  v_curr_milestone RECORD;
BEGIN
  SELECT c.facility_id, cs.name, c.scheduled_date
  INTO v_facility_id, v_case_status, v_scheduled_date
  FROM cases c
  JOIN case_statuses cs ON cs.id = c.status_id
  WHERE c.id = p_case_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_curr_milestone IN (
    SELECT
      fm.id as facility_milestone_id,
      fm.name,
      fm.display_name,
      fm.display_order,
      fm.min_minutes,
      fm.max_minutes,
      fm.validation_type,
      fm.pair_with_id,
      cm.recorded_at
    FROM facility_milestones fm
    LEFT JOIN case_milestones cm ON cm.facility_milestone_id = fm.id AND cm.case_id = p_case_id
    WHERE fm.facility_id = v_facility_id
      AND fm.is_active = true
      AND fm.deleted_at IS NULL
    ORDER BY fm.display_order
  )
  LOOP
    IF v_curr_milestone.recorded_at IS NULL THEN
      IF v_case_status = 'completed' AND v_curr_milestone.name IN ('patient_in', 'patient_out') THEN
        issue_type := 'missing';
        milestone_name := v_curr_milestone.display_name;
        detected_value := NULL;
        expected_min := NULL;
        expected_max := NULL;
        details := jsonb_build_object('required_for', 'completed case');
        RETURN NEXT;
      END IF;
      CONTINUE;
    END IF;

    IF v_curr_milestone.validation_type = 'duration' AND v_curr_milestone.pair_with_id IS NOT NULL THEN
      SELECT cm.recorded_at INTO v_prev_milestone
      FROM case_milestones cm
      WHERE cm.case_id = p_case_id
        AND cm.facility_milestone_id = v_curr_milestone.pair_with_id;

      IF v_prev_milestone.recorded_at IS NOT NULL THEN
        DECLARE
          v_duration_minutes NUMERIC;
        BEGIN
          v_duration_minutes := EXTRACT(EPOCH FROM (v_prev_milestone.recorded_at - v_curr_milestone.recorded_at)) / 60;

          IF v_curr_milestone.max_minutes IS NOT NULL AND v_duration_minutes > v_curr_milestone.max_minutes THEN
            issue_type := 'timeout';
            milestone_name := v_curr_milestone.display_name;
            detected_value := v_duration_minutes;
            expected_min := v_curr_milestone.min_minutes;
            expected_max := v_curr_milestone.max_minutes;
            details := jsonb_build_object('validation_type', 'duration', 'pair_milestone', v_curr_milestone.pair_with_id);
            RETURN NEXT;
          END IF;

          IF v_curr_milestone.min_minutes IS NOT NULL AND v_duration_minutes < v_curr_milestone.min_minutes THEN
            issue_type := 'too_fast';
            milestone_name := v_curr_milestone.display_name;
            detected_value := v_duration_minutes;
            expected_min := v_curr_milestone.min_minutes;
            expected_max := v_curr_milestone.max_minutes;
            details := jsonb_build_object('validation_type', 'duration', 'pair_milestone', v_curr_milestone.pair_with_id);
            RETURN NEXT;
          END IF;
        END;
      END IF;
    ELSE
      SELECT cm.recorded_at, fm.display_name INTO v_prev_milestone
      FROM case_milestones cm
      JOIN facility_milestones fm ON fm.id = cm.facility_milestone_id
      WHERE cm.case_id = p_case_id
        AND fm.display_order < v_curr_milestone.display_order
        AND fm.is_active = true
      ORDER BY fm.display_order DESC
      LIMIT 1;

      IF v_prev_milestone.recorded_at IS NOT NULL THEN
        DECLARE
          v_gap_minutes NUMERIC;
        BEGIN
          v_gap_minutes := EXTRACT(EPOCH FROM (v_curr_milestone.recorded_at - v_prev_milestone.recorded_at)) / 60;

          IF v_gap_minutes < 0 THEN
            issue_type := 'impossible';
            milestone_name := v_curr_milestone.display_name;
            detected_value := v_gap_minutes;
            expected_min := 0;
            expected_max := NULL;
            details := jsonb_build_object(
              'validation_type', 'sequence_gap',
              'previous_milestone', v_prev_milestone.display_name,
              'message', 'Recorded before previous milestone'
            );
            RETURN NEXT;
          END IF;

          IF v_curr_milestone.max_minutes IS NOT NULL AND v_gap_minutes > v_curr_milestone.max_minutes THEN
            issue_type := 'timeout';
            milestone_name := v_curr_milestone.display_name;
            detected_value := v_gap_minutes;
            expected_min := v_curr_milestone.min_minutes;
            expected_max := v_curr_milestone.max_minutes;
            details := jsonb_build_object(
              'validation_type', 'sequence_gap',
              'previous_milestone', v_prev_milestone.display_name
            );
            RETURN NEXT;
          END IF;

          IF v_curr_milestone.min_minutes IS NOT NULL AND v_gap_minutes < v_curr_milestone.min_minutes THEN
            issue_type := 'too_fast';
            milestone_name := v_curr_milestone.display_name;
            detected_value := v_gap_minutes;
            expected_min := v_curr_milestone.min_minutes;
            expected_max := v_curr_milestone.max_minutes;
            details := jsonb_build_object(
              'validation_type', 'sequence_gap',
              'previous_milestone', v_prev_milestone.display_name
            );
            RETURN NEXT;
          END IF;
        END;
      END IF;
    END IF;
  END LOOP;

  IF v_case_status = 'scheduled' AND v_scheduled_date < CURRENT_DATE THEN
    IF NOT EXISTS (SELECT 1 FROM case_milestones WHERE case_id = p_case_id) THEN
      issue_type := 'stale';
      milestone_name := NULL;
      detected_value := (CURRENT_DATE - v_scheduled_date)::numeric;
      expected_min := NULL;
      expected_max := NULL;
      details := jsonb_build_object(
        'scheduled_date', v_scheduled_date,
        'days_overdue', (CURRENT_DATE - v_scheduled_date)
      );
      RETURN NEXT;
    END IF;
  END IF;

  IF v_case_status IN ('in_progress', 'delayed') THEN
    DECLARE
      v_last_activity TIMESTAMPTZ;
    BEGIN
      SELECT MAX(recorded_at) INTO v_last_activity
      FROM case_milestones
      WHERE case_id = p_case_id;

      IF v_last_activity IS NOT NULL AND v_last_activity < NOW() - INTERVAL '24 hours' THEN
        issue_type := 'incomplete';
        milestone_name := NULL;
        detected_value := EXTRACT(EPOCH FROM (NOW() - v_last_activity)) / 3600;
        expected_min := NULL;
        expected_max := 24;
        details := jsonb_build_object(
          'last_activity', v_last_activity,
          'hours_since_activity', EXTRACT(EPOCH FROM (NOW() - v_last_activity)) / 3600,
          'case_status', v_case_status
        );
        RETURN NEXT;
      END IF;
    END;
  END IF;

  RETURN;
END;
$$;
