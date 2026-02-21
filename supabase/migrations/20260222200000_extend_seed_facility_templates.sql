-- ============================================================================
-- Extend seed_facility_with_templates() with JSONB config + missing categories
-- ============================================================================
-- Changes:
-- 1. Add template_config JSONB parameter (defaults all sections to true)
-- 2. Add 7 missing template categories:
--    - Delay types, Cost categories, Implant companies, Complexities,
--      Cancellation reasons, Pre-op checklist fields, Phase definitions
-- 3. Wrap each section in conditional IF block
-- 4. Drop auto-seed triggers (wizard calls RPC explicitly)
-- ============================================================================

-- ============================================================================
-- 1. Drop facility creation triggers (wizard will call RPC explicitly)
-- ============================================================================
DROP TRIGGER IF EXISTS on_facility_created_seed_templates ON public.facilities;
DROP TRIGGER IF EXISTS on_facility_created_seed_phases ON public.facilities;

-- Drop the trigger functions (no longer needed)
DROP FUNCTION IF EXISTS public.trigger_seed_facility_on_create();
DROP FUNCTION IF EXISTS public.trigger_seed_facility_phases();

-- ============================================================================
-- 2. Replace seed_facility_with_templates() with configurable version
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_facility_with_templates(
  target_facility_id UUID,
  template_config JSONB DEFAULT '{}'::JSONB
)
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
    -- Even if milestones are skipped, build the map for procedure_milestone_config
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
    -- Even if procedures are skipped, build the map for procedure_milestone_config
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
  -- PART 8: Seed delay types (global templates have facility_id IS NULL)
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
  -- PART 10: Seed implant companies (global templates have facility_id IS NULL)
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
  -- PART 14: Seed phase definitions (requires milestones to exist)
  -- ========================================================================
  IF COALESCE((template_config->>'phase_definitions')::boolean, true) THEN
    PERFORM public.seed_facility_phases(target_facility_id);
  END IF;

END;
$$;

-- Note: Permissions seeding (copy_permission_template_to_facility) is independent
-- and invoked from the admin UI. No changes needed here.
