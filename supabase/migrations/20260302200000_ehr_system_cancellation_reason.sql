-- Add is_system column to cancellation_reason_templates and cancellation_reasons
-- to protect system-managed reasons (like EHR System Cancellation) from deletion.

-- 1. Add is_system to templates
ALTER TABLE cancellation_reason_templates
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Add is_system to per-facility reasons
ALTER TABLE cancellation_reasons
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 3. Insert the EHR System Cancellation template
INSERT INTO cancellation_reason_templates (name, display_name, category, display_order, is_active, is_system)
VALUES ('ehr_system_cancellation', 'EHR System Cancellation', 'system', 0, true, true)
ON CONFLICT DO NOTHING;

-- 4. Seed into ALL existing facilities (using ON CONFLICT to skip if already present)
INSERT INTO cancellation_reasons (facility_id, name, display_name, category, display_order, is_active, is_system, source_template_id)
SELECT
  f.id,
  'ehr_system_cancellation',
  'EHR System Cancellation',
  'system',
  0,
  true,
  true,
  t.id
FROM facilities f
CROSS JOIN cancellation_reason_templates t
WHERE t.name = 'ehr_system_cancellation'
ON CONFLICT (facility_id, name) DO UPDATE SET is_system = true;

-- 5. Prevent archiving/deleting system reasons via trigger
CREATE OR REPLACE FUNCTION prevent_system_cancellation_reason_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = true AND (
    NEW.is_active = false OR
    NEW.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'System cancellation reasons cannot be archived or deleted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_system_cancellation_reason ON cancellation_reasons;
CREATE TRIGGER trg_protect_system_cancellation_reason
  BEFORE UPDATE ON cancellation_reasons
  FOR EACH ROW
  WHEN (OLD.is_system = true)
  EXECUTE FUNCTION prevent_system_cancellation_reason_delete();
