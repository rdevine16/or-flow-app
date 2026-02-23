-- Migration B: Milestone Template System — Data Migration
-- Part of: feature/milestone-template-system Phase 1
--
-- Migrates existing data from old toggle-based model to new template-based model.
-- Runs AFTER table creation (20260223000001).
-- Both old and new tables coexist until Phase 7 drops the old ones.

--------------------------------------------------------------------------------
-- PART 1: Seed global admin tables (phase_templates, milestone_template_types)
--------------------------------------------------------------------------------

-- 1a. Copy phase_definition_templates → phase_templates
--     Drops the start/end milestone boundary columns (new model is position-based)
INSERT INTO public.phase_templates (name, display_name, color_key, display_order, parent_phase_template_id, is_active)
SELECT
    pdt.name,
    pdt.display_name,
    pdt.color_key,
    pdt.display_order,
    -- Map parent_template_id to new phase_templates.id (two-pass: insert first, update parent after)
    NULL,
    pdt.is_active
FROM public.phase_definition_templates pdt
ORDER BY pdt.display_order;

-- 1b. Map parent_phase_template_id for sub-phases
UPDATE public.phase_templates pt
SET parent_phase_template_id = parent_pt.id
FROM public.phase_definition_templates pdt
JOIN public.phase_definition_templates parent_pdt ON parent_pdt.id = pdt.parent_template_id
JOIN public.phase_templates parent_pt ON parent_pt.name = parent_pdt.name
WHERE pt.name = pdt.name
  AND pdt.parent_template_id IS NOT NULL;

-- 1c. Create a "Default" global milestone template type
INSERT INTO public.milestone_template_types (name, description, is_default, is_active)
VALUES ('Default', 'Standard milestone template with all milestones', true, true);

-- 1d. Populate global template type items from milestone_types with phase assignments
--     Phase assignment: use phase_definition_templates boundaries to determine which
--     phase each milestone_type belongs to. Shared boundary milestones appear in both phases.
DO $$
DECLARE
    v_default_type_id UUID;
    v_phase_rec RECORD;
    v_ms_rec RECORD;
    v_item_order INT := 0;
    v_phase_template_id UUID;
    v_start_order INT;
    v_end_order INT;
    v_added_milestone_ids UUID[] := '{}';
BEGIN
    SELECT id INTO v_default_type_id
    FROM public.milestone_template_types WHERE name = 'Default';

    -- Walk through phases in order, assigning milestones
    FOR v_phase_rec IN
        SELECT
            pdt.*,
            mt_start.display_order AS start_display_order,
            mt_end.display_order AS end_display_order
        FROM public.phase_definition_templates pdt
        JOIN public.milestone_types mt_start ON mt_start.id = pdt.start_milestone_type_id
        JOIN public.milestone_types mt_end ON mt_end.id = pdt.end_milestone_type_id
        WHERE pdt.is_active = true
          AND pdt.parent_template_id IS NULL  -- Skip sub-phases for now
        ORDER BY pdt.display_order
    LOOP
        SELECT id INTO v_phase_template_id
        FROM public.phase_templates WHERE name = v_phase_rec.name;

        FOR v_ms_rec IN
            SELECT * FROM public.milestone_types
            WHERE is_active = true
              AND display_order >= v_phase_rec.start_display_order
              AND display_order <= v_phase_rec.end_display_order
            ORDER BY display_order
        LOOP
            -- For shared boundaries: if this milestone was already added as
            -- the last item of the previous phase, add it again for this phase
            -- (shared boundary = same milestone in two adjacent phases).
            -- For non-shared milestones: skip if already added.
            IF v_ms_rec.id = ANY(v_added_milestone_ids)
               AND v_ms_rec.display_order != v_phase_rec.start_display_order THEN
                CONTINUE;
            END IF;

            v_item_order := v_item_order + 1;
            INSERT INTO public.milestone_template_type_items
                (template_type_id, milestone_type_id, phase_template_id, display_order)
            VALUES
                (v_default_type_id, v_ms_rec.id, v_phase_template_id, v_item_order);

            IF NOT (v_ms_rec.id = ANY(v_added_milestone_ids)) THEN
                v_added_milestone_ids := v_added_milestone_ids || v_ms_rec.id;
            END IF;
        END LOOP;
    END LOOP;

    -- Add any milestone_types not covered by any phase (unphased)
    FOR v_ms_rec IN
        SELECT * FROM public.milestone_types
        WHERE is_active = true
          AND NOT (id = ANY(v_added_milestone_ids))
        ORDER BY display_order
    LOOP
        v_item_order := v_item_order + 1;
        INSERT INTO public.milestone_template_type_items
            (template_type_id, milestone_type_id, phase_template_id, display_order)
        VALUES
            (v_default_type_id, v_ms_rec.id, NULL, v_item_order);
    END LOOP;
END;
$$;

-- 1e. Set milestone_template_type_id on all procedure_type_templates to the default
--     (All procedure templates currently use the same milestone set via procedure_milestone_templates)
UPDATE public.procedure_type_templates
SET milestone_template_type_id = (
    SELECT id FROM public.milestone_template_types WHERE name = 'Default'
);


--------------------------------------------------------------------------------
-- PART 2: Migrate facility-level data
--         For each facility: create facility_phases, default template, items,
--         procedure-specific templates, and surgeon overrides.
--------------------------------------------------------------------------------

DO $$
DECLARE
    v_facility RECORD;
    v_phase_def RECORD;
    v_default_template_id UUID;
    v_facility_phase_id UUID;
    v_milestone RECORD;
    v_item_order INT;
    v_start_order INT;
    v_end_order INT;
    v_phase_map JSONB;       -- phase_definition.id → facility_phase.id
    v_added_ids UUID[];      -- track milestones already added to default template
    v_proc RECORD;
    v_disabled_count INT;
    v_proc_template_id UUID;
    v_proc_item_order INT;
    v_proc_milestone RECORD;
    v_surgeon_combo RECORD;
    v_surgeon_milestones UUID[];
    v_matched_template_id UUID;
    v_surgeon_template_id UUID;
    v_surgeon_item_order INT;
    v_effective_enabled BOOLEAN;
BEGIN
    FOR v_facility IN SELECT id, name FROM public.facilities ORDER BY name
    LOOP
        v_phase_map := '{}';
        v_added_ids := '{}';
        v_item_order := 0;

        RAISE NOTICE 'Migrating facility: % (%)', v_facility.name, v_facility.id;

        ---------------------------------------------------------------
        -- Step 1: Create facility_phases from phase_definitions
        ---------------------------------------------------------------
        FOR v_phase_def IN
            SELECT * FROM public.phase_definitions
            WHERE facility_id = v_facility.id AND is_active = true
            ORDER BY display_order
        LOOP
            INSERT INTO public.facility_phases
                (facility_id, name, display_name, color_key, display_order, is_active)
            VALUES
                (v_facility.id, v_phase_def.name, v_phase_def.display_name,
                 v_phase_def.color_key, v_phase_def.display_order, true)
            RETURNING id INTO v_facility_phase_id;

            v_phase_map := v_phase_map || jsonb_build_object(
                v_phase_def.id::text, v_facility_phase_id::text
            );
        END LOOP;

        -- Map parent_phase_id for sub-phases
        UPDATE public.facility_phases fp
        SET parent_phase_id = (v_phase_map->>pd.parent_phase_id::text)::uuid
        FROM public.phase_definitions pd
        WHERE fp.facility_id = v_facility.id
          AND fp.name = pd.name
          AND pd.facility_id = v_facility.id
          AND pd.parent_phase_id IS NOT NULL;

        ---------------------------------------------------------------
        -- Step 2: Create "Facility Default" template
        ---------------------------------------------------------------
        INSERT INTO public.milestone_templates
            (facility_id, name, description, is_default, is_active)
        VALUES
            (v_facility.id, 'Facility Default',
             'Auto-generated default template containing all milestones',
             true, true)
        RETURNING id INTO v_default_template_id;

        ---------------------------------------------------------------
        -- Step 3: Populate default template items with phase assignments
        --         Walk phases in order, assigning milestones by display_order range.
        --         Shared boundary milestones appear in both adjacent phases.
        ---------------------------------------------------------------
        FOR v_phase_def IN
            SELECT
                pd.*,
                fm_start.display_order AS start_display_order,
                fm_end.display_order AS end_display_order
            FROM public.phase_definitions pd
            JOIN public.facility_milestones fm_start ON fm_start.id = pd.start_milestone_id
            JOIN public.facility_milestones fm_end ON fm_end.id = pd.end_milestone_id
            WHERE pd.facility_id = v_facility.id AND pd.is_active = true
              AND pd.parent_phase_id IS NULL  -- Skip sub-phases (handle separately)
            ORDER BY pd.display_order
        LOOP
            v_facility_phase_id := (v_phase_map->>v_phase_def.id::text)::uuid;

            FOR v_milestone IN
                SELECT * FROM public.facility_milestones
                WHERE facility_id = v_facility.id AND is_active = true
                  AND display_order >= v_phase_def.start_display_order
                  AND display_order <= v_phase_def.end_display_order
                ORDER BY display_order
            LOOP
                -- Shared boundary: if this milestone was the end of the previous
                -- phase (already added), re-add it as the start of this phase.
                -- Otherwise skip duplicates within the same phase.
                IF v_milestone.id = ANY(v_added_ids)
                   AND v_milestone.display_order != v_phase_def.start_display_order THEN
                    CONTINUE;
                END IF;

                v_item_order := v_item_order + 1;
                INSERT INTO public.milestone_template_items
                    (template_id, facility_milestone_id, facility_phase_id, display_order)
                VALUES
                    (v_default_template_id, v_milestone.id, v_facility_phase_id, v_item_order);

                IF NOT (v_milestone.id = ANY(v_added_ids)) THEN
                    v_added_ids := v_added_ids || v_milestone.id;
                END IF;
            END LOOP;
        END LOOP;

        -- Add unphased milestones (not covered by any phase_definition)
        FOR v_milestone IN
            SELECT * FROM public.facility_milestones
            WHERE facility_id = v_facility.id AND is_active = true
              AND NOT (id = ANY(v_added_ids))
            ORDER BY display_order
        LOOP
            v_item_order := v_item_order + 1;
            INSERT INTO public.milestone_template_items
                (template_id, facility_milestone_id, facility_phase_id, display_order)
            VALUES
                (v_default_template_id, v_milestone.id, NULL, v_item_order);
        END LOOP;

        ---------------------------------------------------------------
        -- Step 4: Handle procedure-specific templates
        --         For each procedure type at this facility:
        --         - If all milestones are enabled → assign default template
        --         - If some are disabled → create custom template
        ---------------------------------------------------------------
        FOR v_proc IN
            SELECT DISTINCT pt.id AS procedure_type_id, pt.name AS procedure_name
            FROM public.procedure_milestone_config pmc
            JOIN public.procedure_types pt ON pt.id = pmc.procedure_type_id
            WHERE pmc.facility_id = v_facility.id
        LOOP
            -- Check if any milestones are disabled for this procedure
            SELECT COUNT(*) INTO v_disabled_count
            FROM public.procedure_milestone_config
            WHERE procedure_type_id = v_proc.procedure_type_id
              AND facility_id = v_facility.id
              AND is_enabled = false;

            IF v_disabled_count = 0 THEN
                -- All enabled → use default template
                UPDATE public.procedure_types
                SET milestone_template_id = v_default_template_id
                WHERE id = v_proc.procedure_type_id;
            ELSE
                -- Some disabled → create custom template for this procedure
                INSERT INTO public.milestone_templates
                    (facility_id, name, description, is_default, is_active)
                VALUES
                    (v_facility.id, v_proc.procedure_name || ' Template',
                     'Auto-migrated from procedure milestone config',
                     false, true)
                RETURNING id INTO v_proc_template_id;

                -- Populate with enabled milestones, preserving phase from default template
                v_proc_item_order := 0;
                FOR v_proc_milestone IN
                    SELECT
                        pmc.facility_milestone_id,
                        mti.facility_phase_id,
                        COALESCE(mti.display_order, pmc.display_order) AS sort_order
                    FROM public.procedure_milestone_config pmc
                    LEFT JOIN public.milestone_template_items mti
                        ON mti.template_id = v_default_template_id
                        AND mti.facility_milestone_id = pmc.facility_milestone_id
                    WHERE pmc.procedure_type_id = v_proc.procedure_type_id
                      AND pmc.facility_id = v_facility.id
                      AND pmc.is_enabled = true
                    ORDER BY sort_order
                LOOP
                    v_proc_item_order := v_proc_item_order + 1;
                    INSERT INTO public.milestone_template_items
                        (template_id, facility_milestone_id, facility_phase_id, display_order)
                    VALUES
                        (v_proc_template_id, v_proc_milestone.facility_milestone_id,
                         v_proc_milestone.facility_phase_id, v_proc_item_order);
                END LOOP;

                UPDATE public.procedure_types
                SET milestone_template_id = v_proc_template_id
                WHERE id = v_proc.procedure_type_id;
            END IF;
        END LOOP;

        -- Assign default template to any procedure types without explicit config
        UPDATE public.procedure_types
        SET milestone_template_id = v_default_template_id
        WHERE facility_id = v_facility.id
          AND milestone_template_id IS NULL;

        ---------------------------------------------------------------
        -- Step 5: Handle surgeon overrides
        --         For each (surgeon, procedure) with surgeon_milestone_config:
        --         - Compute effective milestone set (COALESCE of surgeon + procedure)
        --         - Compare to procedure's template
        --         - If different, find or create matching template, create override
        ---------------------------------------------------------------
        FOR v_surgeon_combo IN
            SELECT DISTINCT surgeon_id, procedure_type_id
            FROM public.surgeon_milestone_config
            WHERE facility_id = v_facility.id
        LOOP
            -- Compute surgeon's effective milestone set
            v_surgeon_milestones := ARRAY(
                SELECT pmc.facility_milestone_id
                FROM public.procedure_milestone_config pmc
                LEFT JOIN public.surgeon_milestone_config smc
                    ON smc.facility_id = pmc.facility_id
                    AND smc.procedure_type_id = pmc.procedure_type_id
                    AND smc.facility_milestone_id = pmc.facility_milestone_id
                    AND smc.surgeon_id = v_surgeon_combo.surgeon_id
                WHERE pmc.facility_id = v_facility.id
                  AND pmc.procedure_type_id = v_surgeon_combo.procedure_type_id
                  AND COALESCE(smc.is_enabled, pmc.is_enabled) = true
                ORDER BY pmc.display_order
            );

            -- Get the procedure's current template
            SELECT milestone_template_id INTO v_matched_template_id
            FROM public.procedure_types
            WHERE id = v_surgeon_combo.procedure_type_id;

            -- Compare surgeon's milestone set to procedure's template items
            IF v_matched_template_id IS NOT NULL AND v_surgeon_milestones IS NOT NULL THEN
                -- Check if sets match
                IF ARRAY(
                    SELECT DISTINCT facility_milestone_id
                    FROM public.milestone_template_items
                    WHERE template_id = v_matched_template_id
                    ORDER BY facility_milestone_id
                ) = (
                    SELECT ARRAY(SELECT unnest(v_surgeon_milestones) ORDER BY 1)
                ) THEN
                    -- Sets match → no override needed
                    CONTINUE;
                END IF;
            END IF;

            -- Sets differ → try to find existing template with matching milestone set
            v_surgeon_template_id := NULL;
            SELECT mt.id INTO v_surgeon_template_id
            FROM public.milestone_templates mt
            WHERE mt.facility_id = v_facility.id
              AND mt.is_active = true
              AND mt.id != v_default_template_id
              AND ARRAY(
                  SELECT DISTINCT facility_milestone_id
                  FROM public.milestone_template_items
                  WHERE template_id = mt.id
                  ORDER BY facility_milestone_id
              ) = (
                  SELECT ARRAY(SELECT unnest(v_surgeon_milestones) ORDER BY 1)
              )
            LIMIT 1;

            IF v_surgeon_template_id IS NULL AND array_length(v_surgeon_milestones, 1) > 0 THEN
                -- Create a new template for this surgeon override
                INSERT INTO public.milestone_templates
                    (facility_id, name, description, is_default, is_active)
                VALUES
                    (v_facility.id,
                     'Surgeon Override (' || v_surgeon_combo.surgeon_id::text || '/' || v_surgeon_combo.procedure_type_id::text || ')',
                     'Auto-migrated from surgeon milestone config',
                     false, true)
                RETURNING id INTO v_surgeon_template_id;

                -- Populate items
                v_surgeon_item_order := 0;
                FOR v_proc_milestone IN
                    SELECT
                        fm.id AS facility_milestone_id,
                        mti.facility_phase_id,
                        fm.display_order AS sort_order
                    FROM unnest(v_surgeon_milestones) AS ms_id
                    JOIN public.facility_milestones fm ON fm.id = ms_id
                    LEFT JOIN public.milestone_template_items mti
                        ON mti.template_id = v_default_template_id
                        AND mti.facility_milestone_id = fm.id
                    ORDER BY fm.display_order
                LOOP
                    v_surgeon_item_order := v_surgeon_item_order + 1;
                    INSERT INTO public.milestone_template_items
                        (template_id, facility_milestone_id, facility_phase_id, display_order)
                    VALUES
                        (v_surgeon_template_id, v_proc_milestone.facility_milestone_id,
                         v_proc_milestone.facility_phase_id, v_surgeon_item_order);
                END LOOP;
            END IF;

            -- Create the override row
            IF v_surgeon_template_id IS NOT NULL THEN
                INSERT INTO public.surgeon_template_overrides
                    (facility_id, surgeon_id, procedure_type_id, milestone_template_id)
                VALUES
                    (v_facility.id, v_surgeon_combo.surgeon_id,
                     v_surgeon_combo.procedure_type_id, v_surgeon_template_id)
                ON CONFLICT (facility_id, surgeon_id, procedure_type_id) DO NOTHING;
            END IF;
        END LOOP;

    END LOOP;
END;
$$;
