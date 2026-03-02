-- =============================================================================
-- Migration: Notification Auto-Cleanup & Patient Call Expiry Fix
-- Feature: Notification Center Revamp — Phase 6
--
-- Changes:
--   1. CREATE TRIGGER to auto-set expires_at for patient_call inserts
--   2. Backfill any existing patient_call notifications missing expires_at
--   3. Schedule clean_old_notifications() via pg_cron (daily 3:30 AM)
--   4. Schedule clean_expired_notifications() via pg_cron (daily 3:30 AM)
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auto-set expires_at for patient_call inserts
--
-- Phase 1 made expires_at nullable and removed the default so persistent
-- notifications can have NULL expires_at. But CallNextPatientModal inserts
-- patient_call rows directly without setting expires_at, so we need a trigger
-- to preserve the original 24-hour expiry behavior.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_patient_call_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'patient_call' AND NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_call_expiry
  BEFORE INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_patient_call_expiry();

-- ----------------------------------------------------------------------------
-- 2. Backfill existing patient_call notifications that have NULL expires_at
-- (created between the Phase 1 migration and this fix)
-- ----------------------------------------------------------------------------

UPDATE public.notifications
SET expires_at = created_at + interval '24 hours'
WHERE type = 'patient_call'
  AND expires_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Schedule clean_old_notifications() — daily at 3:30 AM UTC
--    Cleans read notifications (30 days) and unread notifications (90 days).
--    Excludes patient_call (handled by clean_expired_notifications).
-- ----------------------------------------------------------------------------

SELECT cron.schedule(
  'clean-old-notifications',
  '30 3 * * *',
  $$SELECT clean_old_notifications();$$
);

-- ----------------------------------------------------------------------------
-- 4. Schedule clean_expired_notifications() — daily at 3:30 AM UTC
--    Cleans patient_call notifications past their expires_at.
--    This function predates the notification center but was never scheduled.
-- ----------------------------------------------------------------------------

SELECT cron.schedule(
  'clean-expired-notifications',
  '30 3 * * *',
  $$SELECT clean_expired_notifications();$$
);
