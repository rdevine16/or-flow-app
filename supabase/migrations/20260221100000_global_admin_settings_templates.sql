-- Migration: Global Admin Settings Templates
-- Creates template tables for analytics, payers, and notifications.
-- Creates copy functions for facility seeding.
-- Updates seed_facility_with_templates() trigger chain.

-- ============================================================================
-- 1. analytics_settings_template (single-row, mirrors facility_analytics_settings)
-- ============================================================================
CREATE TABLE public.analytics_settings_template (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fcots_milestone                 TEXT NOT NULL DEFAULT 'patient_in',
    fcots_grace_minutes             NUMERIC NOT NULL DEFAULT 2,
    fcots_target_percent            NUMERIC NOT NULL DEFAULT 85,
    turnover_target_same_surgeon    NUMERIC NOT NULL DEFAULT 30,
    turnover_target_flip_room       NUMERIC NOT NULL DEFAULT 45,
    utilization_target_percent      NUMERIC NOT NULL DEFAULT 80,
    cancellation_target_percent     NUMERIC NOT NULL DEFAULT 5,
    start_time_milestone            TEXT DEFAULT 'patient_in',
    start_time_grace_minutes        INTEGER DEFAULT 3,
    start_time_floor_minutes        INTEGER DEFAULT 20,
    waiting_on_surgeon_minutes      INTEGER DEFAULT 3,
    waiting_on_surgeon_floor_minutes INTEGER DEFAULT 10,
    min_procedure_cases             INTEGER DEFAULT 3,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ast_fcots_milestone_check CHECK (fcots_milestone IN ('patient_in', 'incision')),
    CONSTRAINT ast_fcots_grace_minutes_check CHECK (fcots_grace_minutes >= 0 AND fcots_grace_minutes <= 30),
    CONSTRAINT ast_fcots_target_percent_check CHECK (fcots_target_percent >= 0 AND fcots_target_percent <= 100),
    CONSTRAINT ast_start_time_milestone_check CHECK (start_time_milestone IN ('patient_in', 'incision')),
    CONSTRAINT ast_start_time_grace_minutes_check CHECK (start_time_grace_minutes >= 0 AND start_time_grace_minutes <= 15),
    CONSTRAINT ast_start_time_floor_minutes_check CHECK (start_time_floor_minutes >= 5 AND start_time_floor_minutes <= 60),
    CONSTRAINT ast_waiting_on_surgeon_minutes_check CHECK (waiting_on_surgeon_minutes >= 0 AND waiting_on_surgeon_minutes <= 15),
    CONSTRAINT ast_waiting_on_surgeon_floor_check CHECK (waiting_on_surgeon_floor_minutes >= 3 AND waiting_on_surgeon_floor_minutes <= 30),
    CONSTRAINT ast_min_procedure_cases_check CHECK (min_procedure_cases >= 1 AND min_procedure_cases <= 10)
);

-- ============================================================================
-- 2. payer_templates
-- ============================================================================
CREATE TABLE public.payer_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    display_order   INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 3. notification_settings_template (notification type catalog)
-- ============================================================================
CREATE TABLE public.notification_settings_template (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type TEXT NOT NULL UNIQUE,
    category          TEXT NOT NULL,
    display_label     TEXT NOT NULL,
    description       TEXT,
    default_enabled   BOOLEAN NOT NULL DEFAULT false,
    default_channels  TEXT[] NOT NULL DEFAULT '{}',
    display_order     INTEGER NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- 4. facility_notification_settings (per-facility preferences)
-- ============================================================================
CREATE TABLE public.facility_notification_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id         UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    notification_type   TEXT NOT NULL,
    category            TEXT NOT NULL,
    display_label       TEXT NOT NULL,
    is_enabled          BOOLEAN NOT NULL DEFAULT false,
    channels            TEXT[] NOT NULL DEFAULT '{}',
    display_order       INTEGER NOT NULL DEFAULT 0,
    source_template_id  UUID REFERENCES public.notification_settings_template(id),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    deleted_by          UUID REFERENCES auth.users(id),

    CONSTRAINT fns_facility_notification_type_unique UNIQUE (facility_id, notification_type)
);

-- ============================================================================
-- 5. Add source_template_id to payers table
-- ============================================================================
ALTER TABLE public.payers
    ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.payer_templates(id);

-- ============================================================================
-- 6. Enable RLS on all new tables
-- ============================================================================
ALTER TABLE public.analytics_settings_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_notification_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. RLS Policies — analytics_settings_template (global, single-row)
-- ============================================================================
CREATE POLICY "All users can view analytics_settings_template"
    ON public.analytics_settings_template FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can insert analytics_settings_template"
    ON public.analytics_settings_template FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

CREATE POLICY "Global admins can update analytics_settings_template"
    ON public.analytics_settings_template FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

-- ============================================================================
-- 7b. RLS Policies — payer_templates
-- ============================================================================
CREATE POLICY "All users can view payer_templates"
    ON public.payer_templates FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can insert payer_templates"
    ON public.payer_templates FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

CREATE POLICY "Global admins can update payer_templates"
    ON public.payer_templates FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

CREATE POLICY "Global admins can delete payer_templates"
    ON public.payer_templates FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

-- ============================================================================
-- 7c. RLS Policies — notification_settings_template
-- ============================================================================
CREATE POLICY "All users can view notification_settings_template"
    ON public.notification_settings_template FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Global admins can insert notification_settings_template"
    ON public.notification_settings_template FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

CREATE POLICY "Global admins can update notification_settings_template"
    ON public.notification_settings_template FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

CREATE POLICY "Global admins can delete notification_settings_template"
    ON public.notification_settings_template FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.access_level = 'global_admin'
    ));

-- ============================================================================
-- 7d. RLS Policies — facility_notification_settings (facility-scoped)
-- ============================================================================
CREATE POLICY "Users can view own facility notification settings"
    ON public.facility_notification_settings FOR SELECT
    USING (
        facility_id = public.get_my_facility_id()
        OR public.get_my_access_level() = 'global_admin'
    );

CREATE POLICY "Facility admins can insert own facility notification settings"
    ON public.facility_notification_settings FOR INSERT
    WITH CHECK (
        (public.get_my_access_level() IN ('global_admin', 'facility_admin'))
        AND facility_id = public.get_my_facility_id()
    );

CREATE POLICY "Facility admins can update own facility notification settings"
    ON public.facility_notification_settings FOR UPDATE
    USING (
        (public.get_my_access_level() IN ('global_admin', 'facility_admin'))
        AND facility_id = public.get_my_facility_id()
    );

CREATE POLICY "Facility admins can delete own facility notification settings"
    ON public.facility_notification_settings FOR DELETE
    USING (
        (public.get_my_access_level() IN ('global_admin', 'facility_admin'))
        AND facility_id = public.get_my_facility_id()
    );

CREATE POLICY "Global admins can manage all facility notification settings"
    ON public.facility_notification_settings FOR ALL
    USING (public.get_my_access_level() = 'global_admin');

-- ============================================================================
-- 8. Soft-delete triggers
-- ============================================================================
CREATE TRIGGER sync_soft_delete_payer_templates
    BEFORE UPDATE ON public.payer_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();

CREATE TRIGGER sync_soft_delete_notification_settings_template
    BEFORE UPDATE ON public.notification_settings_template
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();

CREATE TRIGGER sync_soft_delete_facility_notification_settings
    BEFORE UPDATE ON public.facility_notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_columns();

-- ============================================================================
-- 9. Copy functions
-- ============================================================================

-- 9a. Copy analytics settings template → facility_analytics_settings
CREATE OR REPLACE FUNCTION public.copy_analytics_settings_to_facility(p_facility_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Skip if facility already has analytics settings
    IF EXISTS (SELECT 1 FROM public.facility_analytics_settings WHERE facility_id = p_facility_id) THEN
        RETURN;
    END IF;

    INSERT INTO public.facility_analytics_settings (
        facility_id,
        fcots_milestone, fcots_grace_minutes, fcots_target_percent,
        turnover_target_same_surgeon, turnover_target_flip_room,
        utilization_target_percent, cancellation_target_percent,
        start_time_milestone, start_time_grace_minutes, start_time_floor_minutes,
        waiting_on_surgeon_minutes, waiting_on_surgeon_floor_minutes,
        min_procedure_cases
    )
    SELECT
        p_facility_id,
        t.fcots_milestone, t.fcots_grace_minutes, t.fcots_target_percent,
        t.turnover_target_same_surgeon, t.turnover_target_flip_room,
        t.utilization_target_percent, t.cancellation_target_percent,
        t.start_time_milestone, t.start_time_grace_minutes, t.start_time_floor_minutes,
        t.waiting_on_surgeon_minutes, t.waiting_on_surgeon_floor_minutes,
        t.min_procedure_cases
    FROM public.analytics_settings_template t
    LIMIT 1;
END;
$$;

-- 9b. Copy payer templates → payers
CREATE OR REPLACE FUNCTION public.copy_payer_templates_to_facility(p_facility_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template RECORD;
BEGIN
    FOR v_template IN
        SELECT * FROM public.payer_templates WHERE is_active = true ORDER BY display_order
    LOOP
        -- Skip if this facility already has a payer from this template
        IF EXISTS (
            SELECT 1 FROM public.payers
            WHERE facility_id = p_facility_id AND source_template_id = v_template.id
        ) THEN
            CONTINUE;
        END IF;

        INSERT INTO public.payers (facility_id, name, source_template_id)
        VALUES (p_facility_id, v_template.name, v_template.id);
    END LOOP;
END;
$$;

-- 9c. Copy notification settings template → facility_notification_settings
CREATE OR REPLACE FUNCTION public.copy_notification_settings_to_facility(p_facility_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template RECORD;
BEGIN
    FOR v_template IN
        SELECT * FROM public.notification_settings_template WHERE is_active = true ORDER BY display_order
    LOOP
        -- Skip if this facility already has this notification type
        IF EXISTS (
            SELECT 1 FROM public.facility_notification_settings
            WHERE facility_id = p_facility_id AND notification_type = v_template.notification_type
        ) THEN
            CONTINUE;
        END IF;

        INSERT INTO public.facility_notification_settings (
            facility_id, notification_type, category, display_label,
            is_enabled, channels, display_order, source_template_id
        ) VALUES (
            p_facility_id, v_template.notification_type, v_template.category, v_template.display_label,
            v_template.default_enabled, v_template.default_channels, v_template.display_order, v_template.id
        );
    END LOOP;
END;
$$;

-- ============================================================================
-- 10. Update seed_facility_with_templates() to call new copy functions + flag rules
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_facility_with_templates(target_facility_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template_rec RECORD;
  new_procedure_id UUID;
  milestone_rec RECORD;
  new_milestone_id UUID;
  facility_milestone_map JSONB := '{}';
  procedure_map JSONB := '{}';
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

  -- Set up milestone pairing
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
-- 11. Seed template data
-- ============================================================================

-- 11a. Analytics settings template (single row with defaults)
INSERT INTO public.analytics_settings_template (
    fcots_milestone, fcots_grace_minutes, fcots_target_percent,
    turnover_target_same_surgeon, turnover_target_flip_room,
    utilization_target_percent, cancellation_target_percent,
    start_time_milestone, start_time_grace_minutes, start_time_floor_minutes,
    waiting_on_surgeon_minutes, waiting_on_surgeon_floor_minutes,
    min_procedure_cases
) VALUES (
    'patient_in', 2, 85,
    30, 45,
    80, 5,
    'patient_in', 3, 20,
    3, 10,
    3
);

-- 11b. Payer templates (common defaults)
INSERT INTO public.payer_templates (name, display_order) VALUES
    ('Medicare', 1),
    ('Medicaid', 2),
    ('Private Insurance', 3),
    ('Workers Compensation', 4),
    ('Self-Pay', 5);

-- 11c. Notification settings template (notification type catalog)
INSERT INTO public.notification_settings_template (notification_type, category, display_label, description, default_enabled, default_channels, display_order) VALUES
    -- Case Alerts
    ('call_next_patient',       'case_alerts',     'Call Next Patient',       'Notify when a room is ready for the next patient',       true,  '{push,in_app}', 1),
    ('case_started',            'case_alerts',     'Case Started',            'Notify when a case begins (Patient In recorded)',         false, '{in_app}',      2),
    ('case_completed',          'case_alerts',     'Case Completed',          'Notify when a case finishes (Patient Out recorded)',      false, '{in_app}',      3),
    ('delay_recorded',          'case_alerts',     'Delay Recorded',          'Notify when a delay is logged on a case',                 true,  '{push,in_app}', 4),
    -- Schedule Alerts
    ('first_case_reminder',     'schedule_alerts', 'First Case Reminder',     'Remind staff before the first case of the day',           true,  '{push,in_app}', 5),
    ('case_running_long',       'schedule_alerts', 'Case Running Long',       'Alert when a case exceeds expected duration',             true,  '{push,in_app}', 6),
    ('turnover_alert',          'schedule_alerts', 'Turnover Time Alert',     'Alert if turnover exceeds target time',                   false, '{in_app}',      7),
    -- Tray Management
    ('tray_confirmation_needed','tray_management', 'Tray Confirmation Needed','Remind reps to confirm tray availability',                true,  '{push,in_app}', 8),
    ('tray_delivered',          'tray_management', 'Tray Delivered',          'Notify staff when trays are delivered',                    true,  '{push,in_app}', 9),
    ('tray_missing',            'tray_management', 'Missing Tray Alert',      'Alert if trays not confirmed before case',                true,  '{push,in_app}', 10),
    -- Reports & Summaries
    ('daily_summary',           'reports',         'Daily Summary',           'End-of-day summary of all cases',                         false, '{email}',       11),
    ('weekly_report',           'reports',         'Weekly Efficiency Report', 'Weekly OR efficiency metrics',                            true,  '{email,in_app}',12),
    ('monthly_report',          'reports',         'Monthly Analytics',        'Comprehensive monthly performance report',                true,  '{email,in_app}',13);

-- ============================================================================
-- 12. Indexes for performance
-- ============================================================================
CREATE INDEX idx_facility_notification_settings_facility
    ON public.facility_notification_settings(facility_id);

CREATE INDEX idx_facility_notification_settings_type
    ON public.facility_notification_settings(notification_type);

CREATE INDEX idx_payer_templates_active
    ON public.payer_templates(is_active) WHERE is_active = true;

CREATE INDEX idx_notification_settings_template_active
    ON public.notification_settings_template(is_active) WHERE is_active = true;
