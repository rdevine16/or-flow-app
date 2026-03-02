-- Migration: raw_message_purge_cron
-- Creates a function and pg_cron job to purge raw_message PHI content
-- from ehr_integration_log after the configurable retention period.
-- Preserves parsed_data and all other columns — only raw PHI text is nullified.

-- =====================================================
-- Purge function
-- =====================================================

CREATE OR REPLACE FUNCTION public.purge_expired_raw_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  purged_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- For each active integration, purge raw_message older than retention_days
  FOR rec IN
    SELECT
      ei.id AS integration_id,
      COALESCE((ei.config->>'retention_days')::INTEGER, 90) AS retention_days
    FROM public.ehr_integrations ei
    WHERE ei.is_active = true
  LOOP
    UPDATE public.ehr_integration_log
    SET raw_message = NULL
    WHERE integration_id = rec.integration_id
      AND raw_message IS NOT NULL
      AND created_at < now() - (rec.retention_days || ' days')::INTERVAL;

    purged_count := purged_count + FOUND::INTEGER;
  END LOOP;

  -- Also purge any orphaned entries (inactive integrations) using default 90 days
  UPDATE public.ehr_integration_log eil
  SET raw_message = NULL
  WHERE raw_message IS NOT NULL
    AND created_at < now() - INTERVAL '90 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.ehr_integrations ei
      WHERE ei.id = eil.integration_id AND ei.is_active = true
    );

  GET DIAGNOSTICS purged_count = purged_count + ROW_COUNT;

  RETURN purged_count;
END;
$$;

-- =====================================================
-- Schedule daily purge at 3:00 AM UTC
-- =====================================================

SELECT cron.schedule(
  'purge-ehr-raw-messages',
  '0 3 * * *',
  $$SELECT public.purge_expired_raw_messages()$$
);
