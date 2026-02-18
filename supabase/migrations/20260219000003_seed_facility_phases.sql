-- Phase 1: Database Foundation — seed function, trigger, templates, backfill
-- Part of: Milestone Hierarchy Redesign

--------------------------------------------------------------------------------
-- 1. Seed default phase_definition_templates
--    Correct boundary definitions (from review Q14/A14):
--    Pre-Op:   patient_in → incision
--    Surgical: incision → closing
--    Closing:  closing → closing_complete
--    Post-Op:  closing_complete → patient_out
--------------------------------------------------------------------------------

INSERT INTO public.phase_definition_templates (name, display_name, display_order, start_milestone_type_id, end_milestone_type_id, color_key)
VALUES
    ('pre_op',   'Pre-Op',   1,
        (SELECT id FROM public.milestone_types WHERE name = 'patient_in'),
        (SELECT id FROM public.milestone_types WHERE name = 'incision'),
        'blue'),
    ('surgical', 'Surgical', 2,
        (SELECT id FROM public.milestone_types WHERE name = 'incision'),
        (SELECT id FROM public.milestone_types WHERE name = 'closing'),
        'green'),
    ('closing',  'Closing',  3,
        (SELECT id FROM public.milestone_types WHERE name = 'closing'),
        (SELECT id FROM public.milestone_types WHERE name = 'closing_complete'),
        'amber'),
    ('post_op',  'Post-Op',  4,
        (SELECT id FROM public.milestone_types WHERE name = 'closing_complete'),
        (SELECT id FROM public.milestone_types WHERE name = 'patient_out'),
        'purple');


--------------------------------------------------------------------------------
-- 2. seed_facility_phases(p_facility_id) function
--    Copies phase_definition_templates → phase_definitions for a facility,
--    mapping milestone_type_id → facility_milestone_id via source_milestone_type_id.
--    Skips phases where a boundary milestone doesn't exist at the facility.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_facility_phases(p_facility_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template RECORD;
    v_start_fm_id UUID;
    v_end_fm_id UUID;
BEGIN
    FOR v_template IN
        SELECT * FROM public.phase_definition_templates WHERE is_active = true ORDER BY display_order
    LOOP
        -- Map start_milestone_type_id → facility_milestone_id
        SELECT id INTO v_start_fm_id
        FROM public.facility_milestones
        WHERE facility_id = p_facility_id
          AND source_milestone_type_id = v_template.start_milestone_type_id
          AND is_active = true
        LIMIT 1;

        -- Map end_milestone_type_id → facility_milestone_id
        SELECT id INTO v_end_fm_id
        FROM public.facility_milestones
        WHERE facility_id = p_facility_id
          AND source_milestone_type_id = v_template.end_milestone_type_id
          AND is_active = true
        LIMIT 1;

        -- Skip if either boundary milestone is missing at this facility
        IF v_start_fm_id IS NULL OR v_end_fm_id IS NULL THEN
            RAISE NOTICE 'seed_facility_phases: skipping phase "%" for facility % — boundary milestone not found (start: %, end: %)',
                v_template.name, p_facility_id, v_start_fm_id, v_end_fm_id;
            CONTINUE;
        END IF;

        -- Skip if this phase already exists (idempotent)
        IF EXISTS (
            SELECT 1 FROM public.phase_definitions
            WHERE facility_id = p_facility_id
              AND name = v_template.name
              AND is_active = true
        ) THEN
            RAISE NOTICE 'seed_facility_phases: phase "%" already exists for facility % — skipping',
                v_template.name, p_facility_id;
            CONTINUE;
        END IF;

        INSERT INTO public.phase_definitions (
            facility_id, name, display_name, display_order,
            start_milestone_id, end_milestone_id, color_key
        ) VALUES (
            p_facility_id, v_template.name, v_template.display_name, v_template.display_order,
            v_start_fm_id, v_end_fm_id, v_template.color_key
        );
    END LOOP;
END;
$$;


--------------------------------------------------------------------------------
-- 3. AFTER INSERT trigger on facilities — auto-seed phases for new facilities
--    This runs AFTER the existing on_facility_created_copy_milestones trigger,
--    which creates facility_milestones first (so we can reference them).
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_seed_facility_phases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.seed_facility_phases(NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_facility_created_seed_phases
    AFTER INSERT ON public.facilities
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_seed_facility_phases();


--------------------------------------------------------------------------------
-- 4. Backfill: seed phase_definitions for all existing facilities
--------------------------------------------------------------------------------

DO $$
DECLARE
    v_facility RECORD;
BEGIN
    FOR v_facility IN SELECT id, name FROM public.facilities ORDER BY name
    LOOP
        RAISE NOTICE 'Backfilling phases for facility: % (%)', v_facility.name, v_facility.id;
        PERFORM public.seed_facility_phases(v_facility.id);
    END LOOP;
END;
$$;
