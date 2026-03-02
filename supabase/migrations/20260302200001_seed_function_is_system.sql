-- Ensure is_system is automatically synced from templates when new facilities are seeded.
-- Rather than modifying the large seed_facility_with_templates function, we add a trigger
-- that copies is_system from the template on insert.

CREATE OR REPLACE FUNCTION public.sync_system_cancellation_reasons()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_template_id IS NOT NULL THEN
    NEW.is_system := COALESCE(
      (SELECT t.is_system FROM cancellation_reason_templates t WHERE t.id = NEW.source_template_id),
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_system_cancellation_reason ON cancellation_reasons;
CREATE TRIGGER trg_sync_system_cancellation_reason
  BEFORE INSERT ON cancellation_reasons
  FOR EACH ROW
  WHEN (NEW.source_template_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_system_cancellation_reasons();
