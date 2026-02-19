-- get_flag_analytics: Comprehensive flag analytics aggregation RPC
-- Returns a single JSON blob with all analytics dimensions for the flags page.
-- Handles previous-period comparison internally for trend calculations.
--
-- Filters: completed cases, data_validated=true, is_draft=false, is_excluded_from_metrics=false
-- Date filtering: by cases.scheduled_date (consistent with all analytics pages)

CREATE OR REPLACE FUNCTION public.get_flag_analytics(
  p_facility_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_period_days int;
  v_prev_start date;
  v_prev_end date;

  -- KPI intermediate values
  v_total_cases bigint;
  v_flagged_cases bigint;
  v_delayed_cases bigint;
  v_critical_count bigint;
  v_warning_count bigint;
  v_info_count bigint;
  v_total_flags bigint;
  v_prev_total_cases bigint;
  v_prev_flagged_cases bigint;
  v_prev_delayed_cases bigint;

  -- Section results
  v_summary jsonb;
  v_sparkline jsonb;
  v_weekly_trend jsonb;
  v_day_heatmap jsonb;
  v_flag_rule_breakdown jsonb;
  v_delay_type_breakdown jsonb;
  v_surgeon_flags jsonb;
  v_room_flags jsonb;
  v_recent_cases jsonb;
BEGIN
  -- ================================================================
  -- Compute previous period (same duration, immediately before)
  -- ================================================================
  v_period_days := p_end_date - p_start_date;
  v_prev_end := p_start_date - 1;
  v_prev_start := v_prev_end - v_period_days;

  -- ================================================================
  -- SECTION 1: Summary KPIs
  -- ================================================================

  -- Current period: total completed validated cases
  SELECT count(*) INTO v_total_cases
  FROM cases c
  JOIN case_statuses cs ON cs.id = c.status_id
  WHERE c.facility_id = p_facility_id
    AND c.scheduled_date BETWEEN p_start_date AND p_end_date
    AND cs.name = 'completed'
    AND c.data_validated = true
    AND c.is_draft = false
    AND c.is_excluded_from_metrics = false;

  -- Current period: flag counts by type and severity
  SELECT
    count(DISTINCT cf.case_id),
    count(DISTINCT cf.case_id) FILTER (WHERE cf.flag_type = 'delay'),
    count(*) FILTER (WHERE cf.severity = 'critical'),
    count(*) FILTER (WHERE cf.severity = 'warning'),
    count(*) FILTER (WHERE cf.severity = 'info'),
    count(*)
  INTO v_flagged_cases, v_delayed_cases, v_critical_count, v_warning_count, v_info_count, v_total_flags
  FROM case_flags cf
  JOIN cases c ON c.id = cf.case_id
  JOIN case_statuses cs ON cs.id = c.status_id
  WHERE cf.facility_id = p_facility_id
    AND c.scheduled_date BETWEEN p_start_date AND p_end_date
    AND cs.name = 'completed'
    AND c.data_validated = true
    AND c.is_draft = false
    AND c.is_excluded_from_metrics = false;

  -- Previous period: total cases
  SELECT count(*) INTO v_prev_total_cases
  FROM cases c
  JOIN case_statuses cs ON cs.id = c.status_id
  WHERE c.facility_id = p_facility_id
    AND c.scheduled_date BETWEEN v_prev_start AND v_prev_end
    AND cs.name = 'completed'
    AND c.data_validated = true
    AND c.is_draft = false
    AND c.is_excluded_from_metrics = false;

  -- Previous period: flag counts
  SELECT
    count(DISTINCT cf.case_id),
    count(DISTINCT cf.case_id) FILTER (WHERE cf.flag_type = 'delay')
  INTO v_prev_flagged_cases, v_prev_delayed_cases
  FROM case_flags cf
  JOIN cases c ON c.id = cf.case_id
  JOIN case_statuses cs ON cs.id = c.status_id
  WHERE cf.facility_id = p_facility_id
    AND c.scheduled_date BETWEEN v_prev_start AND v_prev_end
    AND cs.name = 'completed'
    AND c.data_validated = true
    AND c.is_draft = false
    AND c.is_excluded_from_metrics = false;

  v_summary := jsonb_build_object(
    'totalCases', COALESCE(v_total_cases, 0),
    'flaggedCases', COALESCE(v_flagged_cases, 0),
    'flagRate', CASE WHEN v_total_cases > 0
      THEN round((v_flagged_cases::numeric / v_total_cases * 100)::numeric, 1)
      ELSE 0 END,
    'flagRateTrend', CASE
      WHEN v_prev_total_cases > 0 AND v_total_cases > 0 THEN
        round(((v_flagged_cases::numeric / v_total_cases) -
               (v_prev_flagged_cases::numeric / v_prev_total_cases)) * 100, 1)
      ELSE 0 END,
    'delayedCases', COALESCE(v_delayed_cases, 0),
    'delayRate', CASE WHEN v_total_cases > 0
      THEN round((v_delayed_cases::numeric / v_total_cases * 100)::numeric, 1)
      ELSE 0 END,
    'delayRateTrend', CASE
      WHEN v_prev_total_cases > 0 AND v_total_cases > 0 THEN
        round(((v_delayed_cases::numeric / v_total_cases) -
               (v_prev_delayed_cases::numeric / v_prev_total_cases)) * 100, 1)
      ELSE 0 END,
    'criticalCount', COALESCE(v_critical_count, 0),
    'warningCount', COALESCE(v_warning_count, 0),
    'infoCount', COALESCE(v_info_count, 0),
    'totalFlags', COALESCE(v_total_flags, 0),
    'avgFlagsPerCase', CASE WHEN v_flagged_cases > 0
      THEN round((v_total_flags::numeric / v_flagged_cases)::numeric, 1)
      ELSE 0 END
  );

  -- ================================================================
  -- SECTION 2: Sparkline Data (weekly flag rate + delay rate arrays)
  -- ================================================================

  SELECT jsonb_build_object(
    'flagRate', COALESCE((
      SELECT jsonb_agg(w.flag_rate ORDER BY w.week_start)
      FROM (
        SELECT
          date_trunc('week', c.scheduled_date)::date AS week_start,
          CASE WHEN count(DISTINCT c.id) > 0
            THEN round(count(DISTINCT cf.case_id)::numeric / count(DISTINCT c.id) * 100, 1)
            ELSE 0 END AS flag_rate
        FROM cases c
        JOIN case_statuses cs ON cs.id = c.status_id
        LEFT JOIN case_flags cf ON cf.case_id = c.id AND cf.facility_id = p_facility_id
        WHERE c.facility_id = p_facility_id
          AND c.scheduled_date BETWEEN p_start_date AND p_end_date
          AND cs.name = 'completed'
          AND c.data_validated = true
          AND c.is_draft = false
          AND c.is_excluded_from_metrics = false
        GROUP BY date_trunc('week', c.scheduled_date)
      ) w
    ), '[]'::jsonb),
    'delayRate', COALESCE((
      SELECT jsonb_agg(w.delay_rate ORDER BY w.week_start)
      FROM (
        SELECT
          date_trunc('week', c.scheduled_date)::date AS week_start,
          CASE WHEN count(DISTINCT c.id) > 0
            THEN round(count(DISTINCT CASE WHEN cf.flag_type = 'delay' THEN cf.case_id END)::numeric /
                        count(DISTINCT c.id) * 100, 1)
            ELSE 0 END AS delay_rate
        FROM cases c
        JOIN case_statuses cs ON cs.id = c.status_id
        LEFT JOIN case_flags cf ON cf.case_id = c.id AND cf.facility_id = p_facility_id
        WHERE c.facility_id = p_facility_id
          AND c.scheduled_date BETWEEN p_start_date AND p_end_date
          AND cs.name = 'completed'
          AND c.data_validated = true
          AND c.is_draft = false
          AND c.is_excluded_from_metrics = false
        GROUP BY date_trunc('week', c.scheduled_date)
      ) w
    ), '[]'::jsonb)
  ) INTO v_sparkline;

  -- ================================================================
  -- SECTION 3: Weekly Trend (threshold vs delay flag counts by week)
  -- ================================================================

  SELECT COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'week', t.week_label,
      'threshold', t.threshold_count,
      'delay', t.delay_count,
      'total', t.total_count
    ) ORDER BY t.week_start)
    FROM (
      SELECT
        date_trunc('week', c.scheduled_date)::date AS week_start,
        to_char(date_trunc('week', c.scheduled_date), 'Mon DD') AS week_label,
        count(*) FILTER (WHERE cf.flag_type = 'threshold') AS threshold_count,
        count(*) FILTER (WHERE cf.flag_type = 'delay') AS delay_count,
        count(*) AS total_count
      FROM case_flags cf
      JOIN cases c ON c.id = cf.case_id
      JOIN case_statuses cs ON cs.id = c.status_id
      WHERE cf.facility_id = p_facility_id
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
      GROUP BY date_trunc('week', c.scheduled_date)
    ) t
  ), '[]'::jsonb) INTO v_weekly_trend;

  -- ================================================================
  -- SECTION 4: Day-of-Week Heatmap
  -- Maps by metric (per review Q&A):
  --   FCOTS    = flag_rules.metric = 'fcots_delay'
  --   Timing   = flag_rules.metric IN ('total_case_time','surgical_time','pre_op_time')
  --   Turnover = flag_rules.metric = 'turnover_time'
  --   Delays   = flag_type = 'delay'
  -- ================================================================

  SELECT COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'day', d.day_name,
      'dayNum', d.day_num,
      'fcots', d.fcots,
      'timing', d.timing,
      'turnover', d.turnover,
      'delay', d.delay_count,
      'total', d.total
    ) ORDER BY d.day_num)
    FROM (
      SELECT
        EXTRACT(ISODOW FROM c.scheduled_date)::int AS day_num,
        to_char(c.scheduled_date, 'Dy') AS day_name,
        count(*) FILTER (WHERE cf.flag_type = 'threshold' AND fr.metric = 'fcots_delay') AS fcots,
        count(*) FILTER (WHERE cf.flag_type = 'threshold'
          AND fr.metric IN ('total_case_time', 'surgical_time', 'pre_op_time')) AS timing,
        count(*) FILTER (WHERE cf.flag_type = 'threshold' AND fr.metric = 'turnover_time') AS turnover,
        count(*) FILTER (WHERE cf.flag_type = 'delay') AS delay_count,
        count(*) AS total
      FROM case_flags cf
      JOIN cases c ON c.id = cf.case_id
      JOIN case_statuses cs ON cs.id = c.status_id
      LEFT JOIN flag_rules fr ON fr.id = cf.flag_rule_id
      WHERE cf.facility_id = p_facility_id
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
      GROUP BY EXTRACT(ISODOW FROM c.scheduled_date), to_char(c.scheduled_date, 'Dy')
    ) d
  ), '[]'::jsonb) INTO v_day_heatmap;

  -- ================================================================
  -- SECTION 5: Flag Rule Breakdown (threshold flags grouped by rule)
  -- Percentage is relative to total threshold flags
  -- ================================================================

  SELECT COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', rb.rule_name,
      'count', rb.flag_count,
      'severity', rb.rule_severity,
      'pct', rb.pct
    ) ORDER BY rb.flag_count DESC)
    FROM (
      SELECT
        fr.name AS rule_name,
        fr.severity AS rule_severity,
        count(*) AS flag_count,
        round(count(*)::numeric / sum(count(*)) OVER () * 100, 1) AS pct
      FROM case_flags cf
      JOIN cases c ON c.id = cf.case_id
      JOIN case_statuses cs ON cs.id = c.status_id
      JOIN flag_rules fr ON fr.id = cf.flag_rule_id
      WHERE cf.facility_id = p_facility_id
        AND cf.flag_type = 'threshold'
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
      GROUP BY fr.name, fr.severity
    ) rb
  ), '[]'::jsonb) INTO v_flag_rule_breakdown;

  -- ================================================================
  -- SECTION 6: Delay Type Breakdown (delay flags grouped by type)
  -- Percentage is relative to total delay flags
  -- ================================================================

  SELECT COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', db.delay_name,
      'count', db.flag_count,
      'pct', db.pct,
      'avgDuration', db.avg_duration
    ) ORDER BY db.flag_count DESC)
    FROM (
      SELECT
        dt.display_name AS delay_name,
        count(*) AS flag_count,
        round(count(*)::numeric / sum(count(*)) OVER () * 100, 1) AS pct,
        round(avg(cf.duration_minutes)::numeric, 0) AS avg_duration
      FROM case_flags cf
      JOIN cases c ON c.id = cf.case_id
      JOIN case_statuses cs ON cs.id = c.status_id
      JOIN delay_types dt ON dt.id = cf.delay_type_id
      WHERE cf.facility_id = p_facility_id
        AND cf.flag_type = 'delay'
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
      GROUP BY dt.display_name
    ) db
  ), '[]'::jsonb) INTO v_delay_type_breakdown;

  -- ================================================================
  -- SECTION 7: Surgeon Flag Distribution
  -- Includes trend vs previous period and top flag per surgeon
  -- ================================================================

  SELECT COALESCE((
    WITH surgeon_current AS (
      SELECT
        c.surgeon_id,
        count(DISTINCT c.id) AS total_cases,
        count(DISTINCT cf.case_id) AS flagged_cases,
        count(cf.id) AS flag_count
      FROM cases c
      JOIN case_statuses cs ON cs.id = c.status_id
      LEFT JOIN case_flags cf ON cf.case_id = c.id AND cf.facility_id = p_facility_id
      WHERE c.facility_id = p_facility_id
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
        AND c.surgeon_id IS NOT NULL
      GROUP BY c.surgeon_id
      HAVING count(cf.id) > 0
    ),
    surgeon_prev AS (
      SELECT
        c.surgeon_id,
        count(DISTINCT c.id) AS total_cases,
        count(DISTINCT cf.case_id) AS flagged_cases
      FROM cases c
      JOIN case_statuses cs ON cs.id = c.status_id
      LEFT JOIN case_flags cf ON cf.case_id = c.id AND cf.facility_id = p_facility_id
      WHERE c.facility_id = p_facility_id
        AND c.scheduled_date BETWEEN v_prev_start AND v_prev_end
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
        AND c.surgeon_id IS NOT NULL
      GROUP BY c.surgeon_id
    ),
    surgeon_top_flag AS (
      SELECT DISTINCT ON (ranked.surgeon_id)
        ranked.surgeon_id,
        ranked.flag_name
      FROM (
        SELECT
          c.surgeon_id,
          COALESCE(fr.name, dt.display_name, 'Unknown') AS flag_name,
          count(*) AS cnt
        FROM case_flags cf
        JOIN cases c ON c.id = cf.case_id
        JOIN case_statuses cs ON cs.id = c.status_id
        LEFT JOIN flag_rules fr ON fr.id = cf.flag_rule_id
        LEFT JOIN delay_types dt ON dt.id = cf.delay_type_id
        WHERE cf.facility_id = p_facility_id
          AND c.scheduled_date BETWEEN p_start_date AND p_end_date
          AND cs.name = 'completed'
          AND c.data_validated = true
          AND c.is_draft = false
          AND c.is_excluded_from_metrics = false
          AND c.surgeon_id IS NOT NULL
        GROUP BY c.surgeon_id, COALESCE(fr.name, dt.display_name, 'Unknown')
        ORDER BY c.surgeon_id, count(*) DESC
      ) ranked
    )
    SELECT jsonb_agg(jsonb_build_object(
      'name', u.first_name || ' ' || u.last_name,
      'surgeonId', sc.surgeon_id,
      'cases', sc.total_cases,
      'flags', sc.flag_count,
      'rate', round(sc.flagged_cases::numeric / sc.total_cases * 100, 1),
      'trend', CASE
        WHEN sp.total_cases > 0 AND sc.total_cases > 0 THEN
          round(((sc.flagged_cases::numeric / sc.total_cases) -
                 (sp.flagged_cases::numeric / sp.total_cases)) * 100, 1)
        ELSE 0 END,
      'topFlag', COALESCE(stf.flag_name, 'N/A')
    ) ORDER BY sc.flagged_cases::numeric / sc.total_cases DESC)
    FROM surgeon_current sc
    JOIN users u ON u.id = sc.surgeon_id
    LEFT JOIN surgeon_prev sp ON sp.surgeon_id = sc.surgeon_id
    LEFT JOIN surgeon_top_flag stf ON stf.surgeon_id = sc.surgeon_id
  ), '[]'::jsonb) INTO v_surgeon_flags;

  -- ================================================================
  -- SECTION 8: Room Flag Distribution
  -- Includes top threshold flag and top delay type per room
  -- ================================================================

  SELECT COALESCE((
    WITH room_current AS (
      SELECT
        c.or_room_id,
        count(DISTINCT c.id) AS total_cases,
        count(DISTINCT cf.case_id) AS flagged_cases,
        count(cf.id) AS flag_count
      FROM cases c
      JOIN case_statuses cs ON cs.id = c.status_id
      LEFT JOIN case_flags cf ON cf.case_id = c.id AND cf.facility_id = p_facility_id
      WHERE c.facility_id = p_facility_id
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
        AND c.or_room_id IS NOT NULL
      GROUP BY c.or_room_id
    ),
    room_top_issue AS (
      SELECT DISTINCT ON (ranked.or_room_id)
        ranked.or_room_id,
        ranked.rule_name
      FROM (
        SELECT
          c.or_room_id,
          fr.name AS rule_name,
          count(*) AS cnt
        FROM case_flags cf
        JOIN cases c ON c.id = cf.case_id
        JOIN case_statuses cs ON cs.id = c.status_id
        JOIN flag_rules fr ON fr.id = cf.flag_rule_id
        WHERE cf.facility_id = p_facility_id
          AND cf.flag_type = 'threshold'
          AND c.scheduled_date BETWEEN p_start_date AND p_end_date
          AND cs.name = 'completed'
          AND c.data_validated = true
          AND c.is_draft = false
          AND c.is_excluded_from_metrics = false
          AND c.or_room_id IS NOT NULL
        GROUP BY c.or_room_id, fr.name
        ORDER BY c.or_room_id, count(*) DESC
      ) ranked
    ),
    room_top_delay AS (
      SELECT DISTINCT ON (ranked.or_room_id)
        ranked.or_room_id,
        ranked.delay_name
      FROM (
        SELECT
          c.or_room_id,
          dt.display_name AS delay_name,
          count(*) AS cnt
        FROM case_flags cf
        JOIN cases c ON c.id = cf.case_id
        JOIN case_statuses cs ON cs.id = c.status_id
        JOIN delay_types dt ON dt.id = cf.delay_type_id
        WHERE cf.facility_id = p_facility_id
          AND cf.flag_type = 'delay'
          AND c.scheduled_date BETWEEN p_start_date AND p_end_date
          AND cs.name = 'completed'
          AND c.data_validated = true
          AND c.is_draft = false
          AND c.is_excluded_from_metrics = false
          AND c.or_room_id IS NOT NULL
        GROUP BY c.or_room_id, dt.display_name
        ORDER BY c.or_room_id, count(*) DESC
      ) ranked
    )
    SELECT jsonb_agg(jsonb_build_object(
      'room', r.name,
      'roomId', rc.or_room_id,
      'cases', rc.total_cases,
      'flags', rc.flag_count,
      'rate', CASE WHEN rc.total_cases > 0
        THEN round(rc.flagged_cases::numeric / rc.total_cases * 100, 1)
        ELSE 0 END,
      'topIssue', COALESCE(rti.rule_name, 'N/A'),
      'topDelay', COALESCE(rtd.delay_name, 'N/A')
    ) ORDER BY rc.flagged_cases::numeric / GREATEST(rc.total_cases, 1) DESC)
    FROM room_current rc
    JOIN or_rooms r ON r.id = rc.or_room_id
    LEFT JOIN room_top_issue rti ON rti.or_room_id = rc.or_room_id
    LEFT JOIN room_top_delay rtd ON rtd.or_room_id = rc.or_room_id
  ), '[]'::jsonb) INTO v_room_flags;

  -- ================================================================
  -- SECTION 9: Recent Flagged Cases (all flagged cases, sorted by date desc)
  -- UI shows 5 initially and expands inline to show all
  -- ================================================================

  SELECT COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'caseId', rc.case_id,
      'caseNumber', rc.case_number,
      'date', rc.scheduled_date,
      'surgeon', rc.surgeon_name,
      'procedure', rc.procedure_name,
      'flags', rc.flags
    ) ORDER BY rc.scheduled_date DESC, rc.case_number DESC)
    FROM (
      SELECT
        c.id AS case_id,
        c.case_number,
        c.scheduled_date,
        COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') AS surgeon_name,
        COALESCE(pt.name, 'Unknown') AS procedure_name,
        (
          SELECT jsonb_agg(jsonb_build_object(
            'type', cf2.flag_type,
            'name', COALESCE(fr2.name, dt2.display_name, 'Unknown'),
            'severity', cf2.severity
          ))
          FROM case_flags cf2
          LEFT JOIN flag_rules fr2 ON fr2.id = cf2.flag_rule_id
          LEFT JOIN delay_types dt2 ON dt2.id = cf2.delay_type_id
          WHERE cf2.case_id = c.id AND cf2.facility_id = p_facility_id
        ) AS flags
      FROM cases c
      JOIN case_statuses cs ON cs.id = c.status_id
      LEFT JOIN users u ON u.id = c.surgeon_id
      LEFT JOIN procedure_types pt ON pt.id = c.procedure_type_id
      WHERE c.facility_id = p_facility_id
        AND c.scheduled_date BETWEEN p_start_date AND p_end_date
        AND cs.name = 'completed'
        AND c.data_validated = true
        AND c.is_draft = false
        AND c.is_excluded_from_metrics = false
        AND EXISTS (
          SELECT 1 FROM case_flags cf
          WHERE cf.case_id = c.id AND cf.facility_id = p_facility_id
        )
    ) rc
  ), '[]'::jsonb) INTO v_recent_cases;

  -- ================================================================
  -- Build and return final result
  -- ================================================================

  RETURN jsonb_build_object(
    'summary', v_summary,
    'sparklineData', v_sparkline,
    'weeklyTrend', v_weekly_trend,
    'dayOfWeekHeatmap', v_day_heatmap,
    'flagRuleBreakdown', v_flag_rule_breakdown,
    'delayTypeBreakdown', v_delay_type_breakdown,
    'surgeonFlags', v_surgeon_flags,
    'roomFlags', v_room_flags,
    'recentFlaggedCases', v_recent_cases
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_flag_analytics(uuid, date, date) TO authenticated;
