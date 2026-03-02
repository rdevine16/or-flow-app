-- =============================================================================
-- Migration: Notification Center Schema
-- Feature: Notification Center Revamp — Phase 1
--
-- Changes:
--   1. ALTER notifications: add category, metadata; make expires_at nullable
--   2. Update RLS on notifications to allow persistent (NULL expires_at) rows
--   3. DROP data_quality_notifications table (consolidated into notifications)
--   4. CREATE FUNCTION create_notification_if_enabled()
--   5. CREATE FUNCTION clean_old_notifications()
--   6. Add indexes for panel queries
--   7. Seed new notification types for integration events + data quality
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend notifications table
-- ----------------------------------------------------------------------------

-- Add category column (matches the 4 settings categories)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text;

-- Add metadata JSONB column for flexible per-type data
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Make expires_at nullable (persistent notifications have NULL expires_at)
ALTER TABLE public.notifications
  ALTER COLUMN expires_at DROP NOT NULL,
  ALTER COLUMN expires_at DROP DEFAULT;

-- ----------------------------------------------------------------------------
-- 2. Update RLS policy to include persistent notifications (NULL expires_at)
-- ----------------------------------------------------------------------------

-- Drop the old policy that filters by expires_at > now()
DROP POLICY IF EXISTS "Users can view facility notifications" ON public.notifications;

-- Recreate: allow NULL expires_at (persistent) OR not-yet-expired
CREATE POLICY "Users can view facility notifications"
  ON public.notifications FOR SELECT
  USING (
    facility_id = public.get_my_facility_id()
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ----------------------------------------------------------------------------
-- 3. Drop data_quality_notifications (consolidated into notifications)
-- ----------------------------------------------------------------------------

-- Drop policies first
DROP POLICY IF EXISTS "System can create notifications" ON public.data_quality_notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.data_quality_notifications;

-- Drop indexes
DROP INDEX IF EXISTS idx_dq_notifications_facility;
DROP INDEX IF EXISTS idx_dq_notifications_user;
DROP INDEX IF EXISTS idx_data_quality_notifications_facility_id;

-- Drop the table
DROP TABLE IF EXISTS public.data_quality_notifications;

-- Drop the unused function
DROP FUNCTION IF EXISTS public.notify_facility_admins_of_issues();

-- ----------------------------------------------------------------------------
-- 4. CREATE FUNCTION create_notification_if_enabled()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification_if_enabled(
  p_facility_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_category text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_case_id uuid DEFAULT NULL,
  p_sent_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_is_enabled boolean;
  v_channels text[];
  v_expires_at timestamptz;
BEGIN
  -- Check if this notification type is enabled for the facility
  SELECT fns.is_enabled, fns.channels
  INTO v_is_enabled, v_channels
  FROM facility_notification_settings fns
  WHERE fns.facility_id = p_facility_id
    AND fns.notification_type = p_type
    AND fns.is_active = true;

  -- If no setting found or disabled, skip
  IF NOT FOUND OR v_is_enabled IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  -- If 'in_app' is not in channels, skip (we only handle in-app for now)
  IF NOT ('in_app' = ANY(v_channels)) THEN
    RETURN NULL;
  END IF;

  -- Special case: patient_call keeps existing 24hr expiry
  IF p_type = 'patient_call' THEN
    v_expires_at := now() + interval '24 hours';
  ELSE
    v_expires_at := NULL;  -- persistent
  END IF;

  -- Insert the notification
  INSERT INTO notifications (
    facility_id, type, title, message, category,
    metadata, case_id, sent_by, expires_at
  )
  VALUES (
    p_facility_id, p_type, p_title, p_message, p_category,
    p_metadata, p_case_id, p_sent_by, v_expires_at
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- Grant execute to authenticated users (edge functions use service role,
-- but in-app creation may come from authenticated context)
GRANT EXECUTE ON FUNCTION public.create_notification_if_enabled TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification_if_enabled TO service_role;

-- ----------------------------------------------------------------------------
-- 5. CREATE FUNCTION clean_old_notifications()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_read_deleted integer;
  v_unread_deleted integer;
BEGIN
  -- Delete read notifications older than 30 days (based on read_at)
  -- Excludes patient_call (handled by existing clean_expired_notifications)
  WITH deleted_read AS (
    DELETE FROM notifications n
    WHERE n.type != 'patient_call'
      AND EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id
          AND nr.read_at < now() - interval '30 days'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_read_deleted FROM deleted_read;

  -- Delete unread notifications older than 90 days (based on created_at)
  -- Excludes patient_call
  WITH deleted_unread AS (
    DELETE FROM notifications n
    WHERE n.type != 'patient_call'
      AND n.created_at < now() - interval '90 days'
      AND NOT EXISTS (
        SELECT 1 FROM notification_reads nr
        WHERE nr.notification_id = n.id
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_unread_deleted FROM deleted_unread;

  v_deleted_count := v_read_deleted + v_unread_deleted;
  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_old_notifications TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Add indexes for panel queries
-- ----------------------------------------------------------------------------

-- Composite index for category-filtered queries
CREATE INDEX IF NOT EXISTS idx_notifications_facility_category
  ON public.notifications (facility_id, category);

-- Composite index for chronological listing (facility + created_at DESC)
-- Note: idx_notifications_facility already exists, but this composite index
-- is more efficient for the panel's sorted queries
CREATE INDEX IF NOT EXISTS idx_notifications_facility_created
  ON public.notifications (facility_id, created_at DESC);

-- Index on notification_reads for user + notification lookups
-- (idx_notification_reads_user and idx_notification_reads_notification exist,
-- but this composite is better for the unread check pattern)
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_notification
  ON public.notification_reads (user_id, notification_id);

-- ----------------------------------------------------------------------------
-- 7. Seed new notification types for integration events + data quality
-- ----------------------------------------------------------------------------

-- Add new types to the global template catalog
INSERT INTO notification_settings_template
  (notification_type, category, display_label, description, default_enabled, default_channels, display_order)
VALUES
  ('case_auto_created', 'Case Alerts', 'Case Auto-Created (Integration)',
   'When a new case is automatically created from an EHR integration message',
   true, ARRAY['in_app'], 5),
  ('case_auto_updated', 'Case Alerts', 'Case Auto-Updated (Integration)',
   'When an existing case is automatically updated from an EHR integration message',
   true, ARRAY['in_app'], 6),
  ('case_auto_cancelled', 'Case Alerts', 'Case Auto-Cancelled (Integration)',
   'When a case is automatically cancelled from an EHR integration message',
   true, ARRAY['in_app'], 7),
  ('data_quality_issue', 'Reports & Summaries', 'Data Quality Issues Detected',
   'When the data quality detection system finds new issues in your facility data',
   true, ARRAY['in_app'], 4)
ON CONFLICT (notification_type) DO NOTHING;

-- Seed facility_notification_settings for ALL existing facilities
-- (new facilities get auto-seeded by copy_notification_settings_to_facility trigger)
INSERT INTO facility_notification_settings
  (facility_id, notification_type, category, display_label, is_enabled, channels, display_order, source_template_id)
SELECT
  f.id,
  nst.notification_type,
  nst.category,
  nst.display_label,
  nst.default_enabled,
  nst.default_channels,
  nst.display_order,
  nst.id
FROM facilities f
CROSS JOIN notification_settings_template nst
WHERE nst.notification_type IN ('case_auto_created', 'case_auto_updated', 'case_auto_cancelled', 'data_quality_issue')
  AND nst.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM facility_notification_settings fns
    WHERE fns.facility_id = f.id
      AND fns.notification_type = nst.notification_type
  );
