-- Add "Surgeon Readiness Gap" flag rule
-- Measures prep_drape_complete → incision interval (time OR team waits for surgeon)

-- 1. Insert global template (facility_id IS NULL)
INSERT INTO flag_rules (
  facility_id, name, description, category,
  metric, start_milestone, end_milestone,
  operator, threshold_type, threshold_value,
  comparison_scope, severity, display_order, is_built_in
) VALUES (
  NULL,
  'Surgeon Readiness Gap',
  'Time between prep/drape complete and incision — measures how long the OR team waits for the surgeon to begin',
  'efficiency',
  'surgeon_readiness_gap',
  'prep_drape_complete',
  'incision',
  'gt',
  'median_plus_sd',
  1.5,
  'personal',
  'warning',
  45,
  true
);

-- 2. Seed to all existing facilities
DO $$
DECLARE
  fac RECORD;
BEGIN
  FOR fac IN SELECT id FROM facilities LOOP
    PERFORM seed_facility_flag_rules(fac.id);
  END LOOP;
END $$;
