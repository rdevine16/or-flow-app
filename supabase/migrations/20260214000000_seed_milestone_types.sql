-- =============================================================================
-- Seed milestone_types data
-- =============================================================================
-- The baseline migration creates the milestone_types table schema but does not
-- include seed data (pg_dump --schema-only). This migration ensures the 10
-- standard milestone types exist for local development.
-- =============================================================================

INSERT INTO public.milestone_types (id, name, display_name, display_order, pair_with_id, pair_position, is_active)
VALUES
  ('10ea55e5-5efa-4b78-bb8f-6872f1cfcec7', 'patient_in',         'Patient In Room',     1,  NULL, NULL,    true),
  ('3d4a1d36-c3cb-45d6-bc89-fbe220025ae5', 'anes_start',         'Anesthesia Start',    2,  NULL, 'start', true),
  ('12cd072b-4267-4245-9dde-8d4938d20adc', 'anes_end',           'Anesthesia End',      3,  NULL, 'end',   true),
  ('b1f8e842-4220-419c-958f-5c1fbe9e8121', 'prep_drape_start',   'Prep/Drape Start',    4,  NULL, 'start', true),
  ('96b1a5df-6290-4e07-a78b-74287f7e39cc', 'prep_drape_complete', 'Prep/Drape Complete', 5,  NULL, 'end',   true),
  ('3a2cf767-9097-4c2c-b8ff-199bac76aeca', 'incision',           'Incision',            6,  NULL, NULL,    true),
  ('9eeb46c2-8eca-4d1d-9939-126a19e32ff6', 'closing',            'Closing',             7,  NULL, 'start', true),
  ('92eb3618-34c5-4eed-8d50-d466352c8397', 'closing_complete',   'Closing Complete',    8,  NULL, 'end',   true),
  ('9ac9e6d5-4b12-4d37-a958-8b48378c9ab5', 'patient_out',        'Patient Out',         9,  NULL, NULL,    true),
  ('fd83c540-bf38-4404-be11-9547f3be1f3e', 'room_cleaned',       'Room Cleaned',        10, NULL, NULL,    true)
ON CONFLICT (id) DO NOTHING;

-- Set pair_with_id references (must be done after all rows exist)
UPDATE public.milestone_types SET pair_with_id = '12cd072b-4267-4245-9dde-8d4938d20adc' WHERE id = '3d4a1d36-c3cb-45d6-bc89-fbe220025ae5';
UPDATE public.milestone_types SET pair_with_id = '3d4a1d36-c3cb-45d6-bc89-fbe220025ae5' WHERE id = '12cd072b-4267-4245-9dde-8d4938d20adc';
UPDATE public.milestone_types SET pair_with_id = '96b1a5df-6290-4e07-a78b-74287f7e39cc' WHERE id = 'b1f8e842-4220-419c-958f-5c1fbe9e8121';
UPDATE public.milestone_types SET pair_with_id = 'b1f8e842-4220-419c-958f-5c1fbe9e8121' WHERE id = '96b1a5df-6290-4e07-a78b-74287f7e39cc';
UPDATE public.milestone_types SET pair_with_id = '92eb3618-34c5-4eed-8d50-d466352c8397' WHERE id = '9eeb46c2-8eca-4d1d-9939-126a19e32ff6';
UPDATE public.milestone_types SET pair_with_id = '9eeb46c2-8eca-4d1d-9939-126a19e32ff6' WHERE id = '92eb3618-34c5-4eed-8d50-d466352c8397';
