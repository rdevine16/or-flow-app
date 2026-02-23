-- Migration C: Milestone Template System — RPC Rewrites
-- Part of: feature/milestone-template-system Phase 1
--
-- Rewrites 3 RPCs to use the new template-based milestone resolution:
-- 1. create_case_with_milestones() — template cascade resolution
-- 2. finalize_draft_case() — template cascade (fixes surgeon override bug)
-- 3. seed_facility_with_templates() — adds template seeding for new facilities

--------------------------------------------------------------------------------
-- 1. create_case_with_milestones() — rewritten with template cascade
--
--    Resolution order:
--    1. surgeon_template_overrides(surgeon_id, procedure_type_id)
--    2. procedure_types.milestone_template_id
--    3. Facility default template (is_default = true)
--    Then: template → milestone_template_items → case_milestones
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
  p_staff_assignments jsonb DEFAULT NULL::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id UUID;
  v_template_id UUID;
BEGIN
  -- 1) Insert the case
  INSERT INTO public.cases (
    case_number, scheduled_date, start_time, or_room_id, procedure_type_id,
    status_id, surgeon_id, facility_id, created_by, operative_side,
    payer_id, notes, rep_required_override, is_draft
  ) VALUES (
    p_case_number, p_scheduled_date, p_start_time, p_or_room_id, p_procedure_type_id,
    p_status_id, p_surgeon_id, p_facility_id, p_created_by, p_operative_side,
    p_payer_id, p_notes, p_rep_required_override, p_is_draft
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

  -- 4) Create case_milestones from template items
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

  -- 5) Verify milestones were created
  IF NOT EXISTS (
    SELECT 1 FROM public.case_milestones WHERE case_id = v_case_id
  ) THEN
    RAISE EXCEPTION 'No milestones found in template % for procedure % at facility %',
      v_template_id, p_procedure_type_id, p_facility_id;
  END IF;

  -- 6) Insert staff assignments if provided
  IF p_staff_assignments IS NOT NULL AND jsonb_array_length(p_staff_assignments) > 0 THEN
    INSERT INTO public.case_staff (case_id, user_id, role_id)
    SELECT v_case_id, (elem->>'user_id')::UUID, (elem->>'role_id')::UUID
    FROM jsonb_array_elements(p_staff_assignments) AS elem;
  END IF;

  RETURN v_case_id;
END;
$$;


--------------------------------------------------------------------------------
-- 2. finalize_draft_case() — rewritten with template cascade
--    Previously did NOT apply surgeon overrides (bug). Now fixed.
--------------------------------------------------------------------------------

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
SET search_path = public
AS $$
DECLARE
  v_template_id UUID;
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

  -- 4) Resolve template via cascade (same as create_case_with_milestones)

  -- 4a. Check surgeon_template_overrides
  SELECT milestone_template_id INTO v_template_id
  FROM public.surgeon_template_overrides
  WHERE surgeon_id = p_surgeon_id
    AND procedure_type_id = p_procedure_type_id
    AND facility_id = p_facility_id;

  -- 4b. Check procedure_types.milestone_template_id
  IF v_template_id IS NULL THEN
    SELECT milestone_template_id INTO v_template_id
    FROM public.procedure_types
    WHERE id = p_procedure_type_id;
  END IF;

  -- 4c. Fall back to facility default template
  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
    FROM public.milestone_templates
    WHERE facility_id = p_facility_id
      AND is_default = true
      AND is_active = true;
  END IF;

  -- 4d. No template found → raise exception
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'No milestone template found for procedure % at facility %. Please assign a template in Settings > Milestones.',
      p_procedure_type_id, p_facility_id;
  END IF;

  -- 5) Create case_milestones from template items (DISTINCT for shared boundaries)
  INSERT INTO public.case_milestones (case_id, facility_milestone_id, recorded_at, recorded_by)
  SELECT
    p_case_id,
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
    SELECT 1 FROM public.case_milestones WHERE case_id = p_case_id
  ) THEN
    RAISE EXCEPTION 'No milestones found in template % for procedure % at facility %',
      v_template_id, p_procedure_type_id, p_facility_id;
  END IF;

  RETURN p_case_id;
END;
$$;


--------------------------------------------------------------------------------
-- 3. seed_facility_with_templates() — extended with template system seeding
--    Adds PART 15-17 for facility_phases, milestone_templates, template items,
--    and procedure template assignment.
--    Keeps existing parts (including procedure_milestone_config) for backward
--    compatibility until Phase 7 drops old tables.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_facility_with_templates(
  target_facility_id UUID,
  template_config JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  template_rec RECORD;
  new_procedure_id UUID;
  milestone_rec RECORD;
  new_milestone_id UUID;
  facility_milestone_map JSONB := '{}';
  procedure_map JSONB := '{}';
  -- New: template system variables
  v_phase_template_map JSONB := '{}';  -- phase_template.id → facility_phase.id
  v_template_type_map JSONB := '{}';   -- milestone_template_type.id → milestone_template.id
  v_new_phase_id UUID;
  v_new_template_id UUID;
  v_default_template_id UUID;
  v_item_rec RECORD;
  v_item_order INT;
BEGIN
  -- ========================================================================
  -- PART 1: Seed facility_milestones from milestone_types
  -- ========================================================================
  IF COALESCE((template_config->>'milestones')::boolean, true) THEN
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
  ELSE
    -- Even if milestones are skipped, build the map for downstream parts
    FOR milestone_rec IN
      SELECT mt.id AS type_id, fm.id AS fm_id
      FROM facility_milestones fm
      JOIN milestone_types mt ON fm.source_milestone_type_id = mt.id
      WHERE fm.facility_id = target_facility_id AND fm.is_active = true
    LOOP
      facility_milestone_map := facility_milestone_map || jsonb_build_object(milestone_rec.type_id::text, milestone_rec.fm_id::text);
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 2: Seed procedure_types from procedure_type_templates
  -- ========================================================================
  IF COALESCE((template_config->>'procedures')::boolean, true) THEN
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
  ELSE
    -- Even if procedures are skipped, build the map
    FOR template_rec IN
      SELECT ptt.id AS template_id, pt.id AS pt_id
      FROM procedure_types pt
      JOIN procedure_type_templates ptt ON pt.source_template_id = ptt.id
      WHERE pt.facility_id = target_facility_id AND pt.is_active = true
    LOOP
      procedure_map := procedure_map || jsonb_build_object(template_rec.template_id::text, template_rec.pt_id::text);
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 3: Seed procedure_milestone_config from procedure_milestone_templates
  --         (kept for backward compatibility until Phase 7)
  -- ========================================================================
  IF COALESCE((template_config->>'procedure_milestone_config')::boolean, true) THEN
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
  END IF;

  -- ========================================================================
  -- PART 4: Seed flag rules from global templates
  -- ========================================================================
  IF COALESCE((template_config->>'flag_rules')::boolean, true) THEN
    PERFORM public.seed_facility_flag_rules(target_facility_id);
  END IF;

  -- ========================================================================
  -- PART 5: Seed analytics settings from template
  -- ========================================================================
  IF COALESCE((template_config->>'analytics_settings')::boolean, true) THEN
    PERFORM public.copy_analytics_settings_to_facility(target_facility_id);
  END IF;

  -- ========================================================================
  -- PART 6: Seed payers from templates
  -- ========================================================================
  IF COALESCE((template_config->>'payers')::boolean, true) THEN
    PERFORM public.copy_payer_templates_to_facility(target_facility_id);
  END IF;

  -- ========================================================================
  -- PART 7: Seed notification settings from templates
  -- ========================================================================
  IF COALESCE((template_config->>'notification_settings')::boolean, true) THEN
    PERFORM public.copy_notification_settings_to_facility(target_facility_id);
  END IF;

  -- ========================================================================
  -- PART 8: Seed delay types
  -- ========================================================================
  IF COALESCE((template_config->>'delay_types')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM delay_types WHERE facility_id IS NULL AND is_active = true ORDER BY display_order
    LOOP
      INSERT INTO delay_types (facility_id, name, display_name, display_order)
      VALUES (target_facility_id, template_rec.name, template_rec.display_name, template_rec.display_order)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 9: Seed cost categories from cost_category_templates
  -- ========================================================================
  IF COALESCE((template_config->>'cost_categories')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM cost_category_templates WHERE is_active = true ORDER BY display_order
    LOOP
      INSERT INTO cost_categories (facility_id, name, type, description, display_order)
      VALUES (target_facility_id, template_rec.name, template_rec.type, template_rec.description, template_rec.display_order)
      ON CONFLICT (facility_id, name) DO NOTHING;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 10: Seed implant companies
  -- ========================================================================
  IF COALESCE((template_config->>'implant_companies')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM implant_companies WHERE facility_id IS NULL AND is_active = true ORDER BY name
    LOOP
      INSERT INTO implant_companies (facility_id, name)
      VALUES (target_facility_id, template_rec.name)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 11: Seed complexities from complexity_templates
  -- ========================================================================
  IF COALESCE((template_config->>'complexities')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM complexity_templates WHERE is_active = true ORDER BY display_order
    LOOP
      INSERT INTO complexities (
        facility_id, name, display_name, description,
        procedure_category_ids, display_order, source_template_id
      ) VALUES (
        target_facility_id, template_rec.name, template_rec.display_name, template_rec.description,
        template_rec.procedure_category_ids, template_rec.display_order, template_rec.id
      )
      ON CONFLICT (facility_id, name) DO NOTHING;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 12: Seed cancellation reasons from cancellation_reason_templates
  -- ========================================================================
  IF COALESCE((template_config->>'cancellation_reasons')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM cancellation_reason_templates WHERE is_active = true ORDER BY display_order
    LOOP
      INSERT INTO cancellation_reasons (
        facility_id, name, display_name, category, display_order, source_template_id
      ) VALUES (
        target_facility_id, template_rec.name, template_rec.display_name,
        template_rec.category, template_rec.display_order, template_rec.id
      )
      ON CONFLICT (facility_id, name) DO NOTHING;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 13: Seed pre-op checklist fields from preop_checklist_field_templates
  -- ========================================================================
  IF COALESCE((template_config->>'preop_checklist_fields')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM preop_checklist_field_templates WHERE is_active = true ORDER BY display_order
    LOOP
      INSERT INTO preop_checklist_fields (
        facility_id, source_template_id, field_key, display_label,
        field_type, options, default_value, placeholder,
        is_required, show_on_escort_page, display_order
      ) VALUES (
        target_facility_id, template_rec.id, template_rec.field_key, template_rec.display_label,
        template_rec.field_type, template_rec.options, template_rec.default_value, template_rec.placeholder,
        template_rec.is_required, template_rec.show_on_escort_page, template_rec.display_order
      )
      ON CONFLICT (facility_id, field_key) DO NOTHING;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 14: Seed phase definitions (kept for backward compatibility)
  -- ========================================================================
  IF COALESCE((template_config->>'phase_definitions')::boolean, true) THEN
    PERFORM public.seed_facility_phases(target_facility_id);
  END IF;

  -- ========================================================================
  -- PART 15: Seed facility_phases from phase_templates (NEW)
  -- ========================================================================
  IF COALESCE((template_config->>'facility_phases')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM public.phase_templates
      WHERE is_active = true
      ORDER BY display_order
    LOOP
      INSERT INTO public.facility_phases (
        facility_id, name, display_name, color_key, display_order, is_active
      ) VALUES (
        target_facility_id,
        template_rec.name, template_rec.display_name, template_rec.color_key,
        template_rec.display_order, true
      )
      ON CONFLICT (facility_id, name) WHERE is_active = true
      DO UPDATE SET facility_id = target_facility_id
      RETURNING id INTO v_new_phase_id;

      IF v_new_phase_id IS NULL THEN
        SELECT id INTO v_new_phase_id FROM public.facility_phases
        WHERE facility_id = target_facility_id AND name = template_rec.name AND is_active = true;
      END IF;

      v_phase_template_map := v_phase_template_map || jsonb_build_object(
        template_rec.id::text, v_new_phase_id::text
      );
    END LOOP;

    -- Map parent_phase_id for sub-phases
    UPDATE public.facility_phases fp
    SET parent_phase_id = (v_phase_template_map->>pt.parent_phase_template_id::text)::uuid
    FROM public.phase_templates pt
    WHERE fp.facility_id = target_facility_id
      AND fp.name = pt.name
      AND pt.parent_phase_template_id IS NOT NULL
      AND fp.is_active = true;
  END IF;

  -- ========================================================================
  -- PART 16: Seed milestone_templates from milestone_template_types (NEW)
  -- ========================================================================
  IF COALESCE((template_config->>'milestone_templates')::boolean, true) THEN
    FOR template_rec IN
      SELECT * FROM public.milestone_template_types
      WHERE is_active = true
      ORDER BY name
    LOOP
      INSERT INTO public.milestone_templates (
        facility_id, name, description, is_default, is_active
      ) VALUES (
        target_facility_id,
        template_rec.name, template_rec.description,
        template_rec.is_default, true
      )
      ON CONFLICT (facility_id, name) WHERE is_active = true
      DO UPDATE SET facility_id = target_facility_id
      RETURNING id INTO v_new_template_id;

      IF v_new_template_id IS NULL THEN
        SELECT id INTO v_new_template_id FROM public.milestone_templates
        WHERE facility_id = target_facility_id AND name = template_rec.name AND is_active = true;
      END IF;

      v_template_type_map := v_template_type_map || jsonb_build_object(
        template_rec.id::text, v_new_template_id::text
      );

      -- Track the default template for procedure assignment
      IF template_rec.is_default THEN
        v_default_template_id := v_new_template_id;
      END IF;

      -- Populate milestone_template_items from milestone_template_type_items
      v_item_order := 0;
      FOR v_item_rec IN
        SELECT * FROM public.milestone_template_type_items
        WHERE template_type_id = template_rec.id
        ORDER BY display_order
      LOOP
        v_item_order := v_item_order + 1;
        INSERT INTO public.milestone_template_items (
          template_id, facility_milestone_id, facility_phase_id, display_order
        ) VALUES (
          v_new_template_id,
          (facility_milestone_map->>v_item_rec.milestone_type_id::text)::uuid,
          (v_phase_template_map->>v_item_rec.phase_template_id::text)::uuid,
          v_item_order
        )
        ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
  END IF;

  -- ========================================================================
  -- PART 17: Assign milestone templates to procedure types (NEW)
  --          Uses procedure_type_templates.milestone_template_type_id mapping
  -- ========================================================================
  IF COALESCE((template_config->>'milestone_templates')::boolean, true)
     AND COALESCE((template_config->>'procedures')::boolean, true) THEN
    FOR template_rec IN
      SELECT ptt.id AS ptt_id, ptt.milestone_template_type_id
      FROM public.procedure_type_templates ptt
      WHERE ptt.is_active = true
        AND ptt.milestone_template_type_id IS NOT NULL
    LOOP
      UPDATE public.procedure_types
      SET milestone_template_id = (v_template_type_map->>template_rec.milestone_template_type_id::text)::uuid
      WHERE id = (procedure_map->>template_rec.ptt_id::text)::uuid
        AND (procedure_map->>template_rec.ptt_id::text) IS NOT NULL;
    END LOOP;

    -- Assign default template to any procedure types that didn't get one
    IF v_default_template_id IS NOT NULL THEN
      UPDATE public.procedure_types
      SET milestone_template_id = v_default_template_id
      WHERE facility_id = target_facility_id
        AND milestone_template_id IS NULL;
    END IF;
  END IF;

END;
$$;
