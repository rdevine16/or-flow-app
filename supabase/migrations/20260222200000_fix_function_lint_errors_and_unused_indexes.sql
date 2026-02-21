-- ============================================================================
-- Migration: Fix function lint errors/warnings + drop unused indexes
--
-- PART 1: Fix 3 function ERRORS from db lint
--   1a. get_facility_median_block_time — references dropped anesthesiologist_id
--   1b. detect_case_issues — EXTRACT(DAY FROM integer) type mismatch
--   1c. generate_escort_link — gen_random_bytes not found (needs extensions schema)
--
-- PART 2: Fix 4 function WARNINGS from db lint
--   2a. calculate_case_costs — unused parameter p_facility_id
--   2b. record_case_stats — unused variable v_patient_out
--   2c. seed_facility_milestones — text→jsonb implicit cast
--   2d. seed_facility_with_templates — text→jsonb implicit cast (×2)
--
-- PART 3: Drop unused indexes (0 scans since stats reset)
-- ============================================================================

-- ============================================================================
-- 1a. get_facility_median_block_time
-- FIX: Replace c.anesthesiologist_id IS NOT NULL with case_staff check
-- (anesthesiologist_id column was dropped in migration 20260222000000)
-- ============================================================================
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

-- ============================================================================
-- 1b. detect_case_issues
-- FIX: EXTRACT(DAY FROM (CURRENT_DATE - date)) fails because date minus date
-- returns integer, not interval. Replace with direct integer subtraction.
-- ============================================================================
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

  -- FIX: (CURRENT_DATE - v_scheduled_date) returns integer directly, not interval.
  -- Use ::numeric cast instead of EXTRACT(DAY FROM ...) which expects an interval.
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

-- ============================================================================
-- 1c. generate_escort_link
-- FIX: gen_random_bytes lives in pgcrypto extension (extensions schema in Supabase).
-- Schema-qualify the call so the function compiles regardless of search_path.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_escort_link(p_checkin_id uuid, p_expires_hours integer DEFAULT 24)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token TEXT;
  v_facility_id UUID;
  v_user_id UUID;
BEGIN
  SELECT facility_id INTO v_facility_id FROM patient_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in not found';
  END IF;

  v_user_id := auth.uid();

  -- FIX: Qualify gen_random_bytes with extensions schema
  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');

  UPDATE escort_status_links
  SET is_active = false
  WHERE checkin_id = p_checkin_id;

  INSERT INTO escort_status_links (
    checkin_id,
    facility_id,
    token,
    expires_at,
    created_by
  ) VALUES (
    p_checkin_id,
    v_facility_id,
    v_token,
    NOW() + (p_expires_hours || ' hours')::INTERVAL,
    v_user_id
  );

  RETURN v_token;
END;
$$;

-- ============================================================================
-- 2a. calculate_case_costs
-- FIX: Unused parameter p_facility_id — add facility validation so the
-- parameter is referenced and the function is safer.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_case_costs(p_procedure_type_id uuid, p_surgeon_id uuid, p_facility_id uuid)
RETURNS TABLE(total_debits numeric, total_credits numeric, net_cost numeric)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_total_debits NUMERIC := 0;
  v_total_credits NUMERIC := 0;
BEGIN
  -- Validate facility exists (also satisfies "unused parameter" lint)
  IF NOT EXISTS (SELECT 1 FROM facilities WHERE id = p_facility_id) THEN
    RAISE EXCEPTION 'Facility not found: %', p_facility_id;
  END IF;

  WITH effective_costs AS (
    SELECT
      pci.cost_category_id,
      cc.type as category_type,
      pci.amount as procedure_amount,
      (
        SELECT sci.amount
        FROM surgeon_cost_items sci
        WHERE sci.surgeon_id = p_surgeon_id
          AND sci.procedure_type_id = p_procedure_type_id
          AND sci.cost_category_id = pci.cost_category_id
        LIMIT 1
      ) as surgeon_amount
    FROM procedure_cost_items pci
    JOIN cost_categories cc ON cc.id = pci.cost_category_id
    WHERE pci.procedure_type_id = p_procedure_type_id

    UNION

    SELECT
      sci.cost_category_id,
      cc.type as category_type,
      NULL as procedure_amount,
      sci.amount as surgeon_amount
    FROM surgeon_cost_items sci
    JOIN cost_categories cc ON cc.id = sci.cost_category_id
    WHERE sci.surgeon_id = p_surgeon_id
      AND sci.procedure_type_id = p_procedure_type_id
      AND NOT EXISTS (
        SELECT 1 FROM procedure_cost_items pci2
        WHERE pci2.procedure_type_id = p_procedure_type_id
          AND pci2.cost_category_id = sci.cost_category_id
      )
  )
  SELECT
    COALESCE(SUM(CASE WHEN category_type = 'debit' THEN COALESCE(surgeon_amount, procedure_amount) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN category_type = 'credit' THEN COALESCE(surgeon_amount, procedure_amount) ELSE 0 END), 0)
  INTO v_total_debits, v_total_credits
  FROM effective_costs;

  RETURN QUERY SELECT v_total_debits, v_total_credits, (v_total_debits - v_total_credits);
END;
$$;

-- ============================================================================
-- 2b. record_case_stats
-- FIX: Remove unused variable v_patient_out and its SELECT INTO column.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_case_stats(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_case RECORD;
  v_stats RECORD;
  v_patient_in TIMESTAMPTZ;
  v_anes_start TIMESTAMPTZ;
  v_anes_end TIMESTAMPTZ;
  v_actual_start_time TIME;
  v_anesthesia_minutes NUMERIC;
  v_call_to_pi_minutes NUMERIC;
  v_schedule_variance NUMERIC;
  v_room_turnover NUMERIC;
  v_surgical_turnover NUMERIC;
  v_is_first_room BOOLEAN := FALSE;
  v_is_first_surgeon BOOLEAN := FALSE;
  v_surgeon_room_count INTEGER := 1;
  v_surgeon_case_seq INTEGER := 1;
  v_room_case_seq INTEGER := 1;
  v_or_hourly_rate NUMERIC;
  v_or_time_cost NUMERIC;
  v_prev_patient_out TIMESTAMPTZ;
  v_prev_closing TIMESTAMPTZ;
  v_final_profit NUMERIC;
  v_total_debits NUMERIC;
  v_total_credits NUMERIC;
BEGIN
  SELECT
    c.id, c.case_number, c.facility_id, c.surgeon_id, c.procedure_type_id,
    c.payer_id, c.or_room_id, c.scheduled_date, c.start_time,
    c.data_validated, c.is_excluded_from_metrics, c.call_time
  INTO v_case
  FROM cases c
  WHERE c.id = p_case_id;

  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found: %', p_case_id;
  END IF;

  SELECT * INTO v_stats FROM calculate_case_stats(p_case_id);

  IF v_stats.total_time_minutes IS NULL THEN
    RETURN;
  END IF;

  IF v_case.data_validated IS NOT TRUE THEN
    RAISE NOTICE 'Case % not validated yet, skipping stats recording', p_case_id;
    RETURN;
  END IF;

  IF v_case.is_excluded_from_metrics IS TRUE THEN
    UPDATE case_completion_stats
    SET
      is_excluded = TRUE,
      excluded_at = NOW(),
      exclusion_reason = 'Case excluded from metrics'
    WHERE case_id = p_case_id
      AND (is_excluded = FALSE OR is_excluded IS NULL);

    DELETE FROM case_milestone_stats WHERE case_id = p_case_id;

    RAISE NOTICE 'Case % is excluded from metrics', p_case_id;
    RETURN;
  END IF;

  -- FIX: Removed v_patient_out from SELECT INTO (was never read after assignment)
  SELECT
    MAX(CASE WHEN fm.name = 'patient_in' THEN cm.recorded_at END),
    MAX(CASE WHEN fm.name = 'anes_start' THEN cm.recorded_at END),
    MAX(CASE WHEN fm.name = 'anes_end' THEN cm.recorded_at END)
  INTO v_patient_in, v_anes_start, v_anes_end
  FROM case_milestones cm
  JOIN facility_milestones fm ON cm.facility_milestone_id = fm.id
  WHERE cm.case_id = p_case_id;

  IF v_patient_in IS NOT NULL THEN
    v_actual_start_time := v_patient_in::TIME;
  END IF;

  IF v_anes_start IS NOT NULL AND v_anes_end IS NOT NULL THEN
    v_anesthesia_minutes := EXTRACT(EPOCH FROM (v_anes_end - v_anes_start)) / 60;
  END IF;

  IF v_case.call_time IS NOT NULL AND v_patient_in IS NOT NULL THEN
    v_call_to_pi_minutes := EXTRACT(EPOCH FROM (v_patient_in - v_case.call_time)) / 60;
  END IF;

  IF v_case.start_time IS NOT NULL AND v_actual_start_time IS NOT NULL THEN
    v_schedule_variance := EXTRACT(EPOCH FROM (v_actual_start_time - v_case.start_time)) / 60;
  END IF;

  SELECT or_hourly_rate INTO v_or_hourly_rate
  FROM facilities WHERE id = v_case.facility_id;

  IF v_or_hourly_rate IS NOT NULL AND v_stats.total_time_minutes IS NOT NULL THEN
    v_or_time_cost := v_stats.total_time_minutes * (v_or_hourly_rate / 60);
  ELSE
    v_or_time_cost := 0;
  END IF;

  SELECT COUNT(*) + 1 INTO v_room_case_seq
  FROM cases c2
  JOIN case_milestones cm2 ON cm2.case_id = c2.id
  JOIN facility_milestones fm2 ON cm2.facility_milestone_id = fm2.id AND fm2.name = 'patient_in'
  WHERE c2.or_room_id = v_case.or_room_id
    AND c2.scheduled_date = v_case.scheduled_date
    AND c2.id != v_case.id
    AND cm2.recorded_at < v_patient_in;

  v_is_first_room := (v_room_case_seq = 1);

  SELECT COUNT(*) + 1 INTO v_surgeon_case_seq
  FROM cases c2
  JOIN case_milestones cm2 ON cm2.case_id = c2.id
  JOIN facility_milestones fm2 ON cm2.facility_milestone_id = fm2.id AND fm2.name = 'patient_in'
  WHERE c2.surgeon_id = v_case.surgeon_id
    AND c2.scheduled_date = v_case.scheduled_date
    AND c2.id != v_case.id
    AND cm2.recorded_at < v_patient_in;

  v_is_first_surgeon := (v_surgeon_case_seq = 1);

  SELECT COUNT(DISTINCT or_room_id) INTO v_surgeon_room_count
  FROM cases
  WHERE surgeon_id = v_case.surgeon_id
    AND scheduled_date = v_case.scheduled_date;

  IF NOT v_is_first_room AND v_patient_in IS NOT NULL THEN
    SELECT MAX(cm2.recorded_at) INTO v_prev_patient_out
    FROM cases c2
    JOIN case_milestones cm2 ON cm2.case_id = c2.id
    JOIN facility_milestones fm2 ON cm2.facility_milestone_id = fm2.id AND fm2.name = 'patient_out'
    WHERE c2.or_room_id = v_case.or_room_id
      AND c2.scheduled_date = v_case.scheduled_date
      AND c2.id != v_case.id
      AND cm2.recorded_at < v_patient_in;

    IF v_prev_patient_out IS NOT NULL THEN
      v_room_turnover := EXTRACT(EPOCH FROM (v_patient_in - v_prev_patient_out)) / 60;
    END IF;
  END IF;

  IF NOT v_is_first_surgeon THEN
    SELECT MAX(cm2.recorded_at) INTO v_prev_closing
    FROM cases c2
    JOIN case_milestones cm2 ON cm2.case_id = c2.id
    JOIN facility_milestones fm2 ON cm2.facility_milestone_id = fm2.id AND fm2.name = 'closing'
    WHERE c2.surgeon_id = v_case.surgeon_id
      AND c2.scheduled_date = v_case.scheduled_date
      AND c2.id != v_case.id
      AND cm2.recorded_at < v_patient_in;

    IF v_prev_closing IS NOT NULL THEN
      DECLARE v_incision TIMESTAMPTZ;
      BEGIN
        SELECT cm.recorded_at INTO v_incision
        FROM case_milestones cm
        JOIN facility_milestones fm ON cm.facility_milestone_id = fm.id AND fm.name = 'incision'
        WHERE cm.case_id = p_case_id;

        IF v_incision IS NOT NULL THEN
          v_surgical_turnover := EXTRACT(EPOCH FROM (v_incision - v_prev_closing)) / 60;
        END IF;
      END;
    END IF;
  END IF;

  v_total_debits := COALESCE(v_stats.total_debits, 0);
  v_total_credits := COALESCE(v_stats.total_credits, 0);

  v_final_profit := COALESCE(v_stats.reimbursement, 0)
                    - v_total_debits
                    + v_total_credits
                    - COALESCE(v_or_time_cost, 0);

  INSERT INTO case_completion_stats (
    case_id, case_number, facility_id, surgeon_id, procedure_type_id,
    payer_id, or_room_id, case_date, scheduled_start_time, actual_start_time,
    total_duration_minutes, surgical_duration_minutes, anesthesia_duration_minutes,
    call_to_patient_in_minutes, schedule_variance_minutes,
    room_turnover_minutes, surgical_turnover_minutes,
    is_first_case_of_day_room, is_first_case_of_day_surgeon,
    surgeon_room_count, surgeon_case_sequence, room_case_sequence,
    reimbursement, soft_goods_cost, hard_goods_cost, or_cost, profit, or_hourly_rate,
    total_debits, total_credits, net_cost, or_time_cost, cost_source,
    is_excluded,
    updated_at
  ) VALUES (
    v_case.id, v_case.case_number, v_case.facility_id, v_case.surgeon_id, v_case.procedure_type_id,
    v_case.payer_id, v_case.or_room_id, v_case.scheduled_date, v_case.start_time, v_actual_start_time,
    v_stats.total_time_minutes, v_stats.surgical_time_minutes, v_anesthesia_minutes,
    v_call_to_pi_minutes, v_schedule_variance,
    v_room_turnover, v_surgical_turnover,
    v_is_first_room, v_is_first_surgeon,
    v_surgeon_room_count, v_surgeon_case_seq, v_room_case_seq,
    v_stats.reimbursement,
    v_total_debits,
    v_total_credits,
    v_or_time_cost,
    v_final_profit,
    v_or_hourly_rate,
    v_total_debits,
    v_total_credits,
    (v_total_debits - v_total_credits),
    v_or_time_cost,
    v_stats.cost_source,
    FALSE,
    NOW()
  )
  ON CONFLICT (case_id) DO UPDATE SET
    total_duration_minutes = EXCLUDED.total_duration_minutes,
    surgical_duration_minutes = EXCLUDED.surgical_duration_minutes,
    anesthesia_duration_minutes = EXCLUDED.anesthesia_duration_minutes,
    call_to_patient_in_minutes = EXCLUDED.call_to_patient_in_minutes,
    schedule_variance_minutes = EXCLUDED.schedule_variance_minutes,
    room_turnover_minutes = EXCLUDED.room_turnover_minutes,
    surgical_turnover_minutes = EXCLUDED.surgical_turnover_minutes,
    is_first_case_of_day_room = EXCLUDED.is_first_case_of_day_room,
    is_first_case_of_day_surgeon = EXCLUDED.is_first_case_of_day_surgeon,
    surgeon_room_count = EXCLUDED.surgeon_room_count,
    surgeon_case_sequence = EXCLUDED.surgeon_case_sequence,
    room_case_sequence = EXCLUDED.room_case_sequence,
    reimbursement = EXCLUDED.reimbursement,
    soft_goods_cost = EXCLUDED.soft_goods_cost,
    hard_goods_cost = EXCLUDED.hard_goods_cost,
    or_cost = EXCLUDED.or_cost,
    profit = EXCLUDED.profit,
    or_hourly_rate = EXCLUDED.or_hourly_rate,
    total_debits = EXCLUDED.total_debits,
    total_credits = EXCLUDED.total_credits,
    net_cost = EXCLUDED.net_cost,
    or_time_cost = EXCLUDED.or_time_cost,
    cost_source = EXCLUDED.cost_source,
    is_excluded = FALSE,
    excluded_at = NULL,
    excluded_by = NULL,
    exclusion_reason = NULL,
    updated_at = NOW();

  IF v_patient_in IS NOT NULL THEN
    DELETE FROM case_milestone_stats WHERE case_id = p_case_id;

    INSERT INTO case_milestone_stats (
      case_id, facility_id, surgeon_id, procedure_type_id, milestone_type_id,
      case_date, minutes_from_start, recorded_at
    )
    SELECT
      cm.case_id,
      v_case.facility_id,
      v_case.surgeon_id,
      v_case.procedure_type_id,
      fm.source_milestone_type_id,
      v_case.scheduled_date,
      EXTRACT(EPOCH FROM (cm.recorded_at - v_patient_in)) / 60,
      cm.recorded_at
    FROM case_milestones cm
    JOIN facility_milestones fm ON cm.facility_milestone_id = fm.id
    WHERE cm.case_id = p_case_id
      AND fm.name != 'patient_in'
      AND fm.source_milestone_type_id IS NOT NULL
      AND cm.recorded_at IS NOT NULL
      AND cm.recorded_at >= v_patient_in;
  END IF;

  RAISE NOTICE 'Stats recorded for case % (profit: %, debits: %, credits: %, or_cost: %, cost_source: %)',
    p_case_id, v_final_profit, v_total_debits, v_total_credits, v_or_time_cost, v_stats.cost_source;
END;
$$;

-- ============================================================================
-- 2c. seed_facility_milestones
-- FIX: Cast '{}' text literal to jsonb explicitly
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_facility_milestones(target_facility_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  milestone_rec RECORD;
  new_milestone_id UUID;
  pair_mapping JSONB := '{}'::jsonb;
BEGIN
  FOR milestone_rec IN
    SELECT * FROM milestone_types ORDER BY display_order
  LOOP
    INSERT INTO facility_milestones (
      facility_id,
      name,
      display_name,
      display_order,
      pair_position,
      source_milestone_type_id
    ) VALUES (
      target_facility_id,
      milestone_rec.name,
      milestone_rec.display_name,
      milestone_rec.display_order,
      milestone_rec.pair_position,
      milestone_rec.id
    )
    ON CONFLICT (facility_id, name) DO NOTHING
    RETURNING id INTO new_milestone_id;

    IF new_milestone_id IS NOT NULL THEN
      pair_mapping := pair_mapping || jsonb_build_object(milestone_rec.id::text, new_milestone_id::text);
    END IF;
  END LOOP;

  UPDATE facility_milestones fm
  SET pair_with_id = (pair_mapping->>global_mt.pair_with_id::text)::uuid
  FROM milestone_types global_mt
  WHERE fm.facility_id = target_facility_id
    AND fm.source_milestone_type_id = global_mt.id
    AND global_mt.pair_with_id IS NOT NULL;

END;
$$;

-- ============================================================================
-- 2d. seed_facility_with_templates
-- FIX: Cast '{}' text literals to jsonb explicitly (×2)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_facility_with_templates(target_facility_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  template_rec RECORD;
  new_procedure_id UUID;
  milestone_rec RECORD;
  new_milestone_id UUID;
  facility_milestone_map JSONB := '{}'::jsonb;
  procedure_map JSONB := '{}'::jsonb;
BEGIN
  -- PART 1: Seed facility_milestones from milestone_types
  FOR milestone_rec IN
    SELECT * FROM milestone_types ORDER BY display_order
  LOOP
    INSERT INTO facility_milestones (
      facility_id, name, display_name, display_order, pair_position, source_milestone_type_id
    ) VALUES (
      target_facility_id,
      milestone_rec.name, milestone_rec.display_name, milestone_rec.display_order,
      milestone_rec.pair_position, milestone_rec.id
    )
    ON CONFLICT (facility_id, name) DO UPDATE SET facility_id = target_facility_id
    RETURNING id INTO new_milestone_id;

    IF new_milestone_id IS NOT NULL THEN
      facility_milestone_map := facility_milestone_map || jsonb_build_object(milestone_rec.id::text, new_milestone_id::text);
    ELSE
      SELECT id INTO new_milestone_id FROM facility_milestones
      WHERE facility_id = target_facility_id AND name = milestone_rec.name;
      facility_milestone_map := facility_milestone_map || jsonb_build_object(milestone_rec.id::text, new_milestone_id::text);
    END IF;
  END LOOP;

  UPDATE facility_milestones fm
  SET pair_with_id = (facility_milestone_map->>global_mt.pair_with_id::text)::uuid
  FROM milestone_types global_mt
  WHERE fm.facility_id = target_facility_id
    AND fm.source_milestone_type_id = global_mt.id
    AND global_mt.pair_with_id IS NOT NULL;

  -- PART 2: Seed procedure_types from procedure_type_templates
  FOR template_rec IN
    SELECT * FROM procedure_type_templates WHERE is_active = true ORDER BY name
  LOOP
    INSERT INTO procedure_types (
      facility_id, name, body_region_id, implant_category, source_template_id
    ) VALUES (
      target_facility_id,
      template_rec.name, template_rec.body_region_id, template_rec.implant_category, template_rec.id
    )
    ON CONFLICT (facility_id, name) DO UPDATE SET facility_id = target_facility_id
    RETURNING id INTO new_procedure_id;

    IF new_procedure_id IS NULL THEN
      SELECT id INTO new_procedure_id FROM procedure_types
      WHERE facility_id = target_facility_id AND name = template_rec.name;
    END IF;

    procedure_map := procedure_map || jsonb_build_object(template_rec.id::text, new_procedure_id::text);
  END LOOP;

  -- PART 3: Seed procedure_milestone_config from procedure_milestone_templates
  INSERT INTO procedure_milestone_config (
    facility_id, procedure_type_id, facility_milestone_id, display_order
  )
  SELECT
    target_facility_id,
    (procedure_map->>pmt.procedure_type_template_id::text)::uuid,
    (facility_milestone_map->>pmt.milestone_type_id::text)::uuid,
    pmt.display_order
  FROM procedure_milestone_templates pmt
  WHERE (procedure_map->>pmt.procedure_type_template_id::text) IS NOT NULL
    AND (facility_milestone_map->>pmt.milestone_type_id::text) IS NOT NULL
  ON CONFLICT (procedure_type_id, facility_milestone_id) DO NOTHING;

  -- PART 4: Seed flag rules from global templates
  PERFORM public.seed_facility_flag_rules(target_facility_id);

  -- PART 5: Seed analytics settings from template
  PERFORM public.copy_analytics_settings_to_facility(target_facility_id);

  -- PART 6: Seed payers from templates
  PERFORM public.copy_payer_templates_to_facility(target_facility_id);

  -- PART 7: Seed notification settings from templates
  PERFORM public.copy_notification_settings_to_facility(target_facility_id);
END;
$$;

-- ============================================================================
-- PART 3: Drop unused indexes (0 index scans since statistics reset)
-- These slow down INSERT/UPDATE/DELETE without benefiting any reads.
-- Can be re-created if query patterns change.
-- ============================================================================

-- Audit field indexes (_by columns) — never queried directly
DROP INDEX IF EXISTS public.idx_case_milestones_recorded_by;
DROP INDEX IF EXISTS public.idx_case_staff_removed_by;
DROP INDEX IF EXISTS public.idx_cases_validated_by;
DROP INDEX IF EXISTS public.idx_case_flags_created_by;
DROP INDEX IF EXISTS public.idx_cases_called_back_by;
DROP INDEX IF EXISTS public.idx_case_completion_stats_excluded_by;
DROP INDEX IF EXISTS public.idx_cases_created_by;
DROP INDEX IF EXISTS public.idx_cases_cancelled_by;

-- Redundant with composite indexes that ARE used
DROP INDEX IF EXISTS public.idx_case_milestones_facility_milestone_id;  -- covered by case_milestones_case_id_facility_milestone_id_key
DROP INDEX IF EXISTS public.idx_audit_log_action;                       -- covered by idx_audit_log_facility_action_created
DROP INDEX IF EXISTS public.idx_case_flags_severity;                    -- covered by idx_case_flags_facility_severity

-- Stats table indexes never used for lookups
DROP INDEX IF EXISTS public.idx_case_milestone_stats_procedure_type_id;
DROP INDEX IF EXISTS public.idx_case_milestone_stats_milestone_type_id;
DROP INDEX IF EXISTS public.idx_ccs_room_date;
DROP INDEX IF EXISTS public.idx_ccs_surgeon_date;
DROP INDEX IF EXISTS public.idx_case_completion_stats_procedure_type_id;

-- FK reference indexes with 0 scans
DROP INDEX IF EXISTS public.idx_case_staff_user_id;
DROP INDEX IF EXISTS public.idx_case_staff_role_id;
DROP INDEX IF EXISTS public.idx_audit_log_target;
DROP INDEX IF EXISTS public.idx_cases_called_next_case_id;
DROP INDEX IF EXISTS public.idx_cases_payer_id;
DROP INDEX IF EXISTS public.idx_cases_or_room_id;
