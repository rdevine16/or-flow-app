-- Migration: Time-Off Notifications
-- Adds targeted notification support, time-off notification types,
-- and DB triggers for automatic in-app notifications on request/review.

-- ============================================================
-- 1. Add target_user_id to notifications (per-user targeting)
-- ============================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id);

-- Index for efficient per-user notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_target_user
  ON public.notifications (target_user_id)
  WHERE target_user_id IS NOT NULL;

-- ============================================================
-- 2. Update RLS policy to respect target_user_id
-- ============================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view facility notifications" ON public.notifications;

-- Recreate: facility-scoped + target_user_id filtering
-- NULL target = broadcast to all facility users (existing behavior)
-- Non-NULL target = only visible to that specific user
CREATE POLICY "Users can view facility notifications"
  ON public.notifications FOR SELECT
  USING (
    facility_id = public.get_my_facility_id()
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
    AND (expires_at IS NULL OR expires_at > now())
  );

-- ============================================================
-- 3. Update create_notification_if_enabled() with target_user_id
-- ============================================================

-- Drop the old 8-param version so CREATE OR REPLACE works cleanly
DROP FUNCTION IF EXISTS public.create_notification_if_enabled(uuid, text, text, text, text, jsonb, uuid, uuid);

CREATE OR REPLACE FUNCTION public.create_notification_if_enabled(
  p_facility_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_category text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_case_id uuid DEFAULT NULL,
  p_sent_by uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL
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

  -- If 'in_app' is not in channels, skip
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
    metadata, case_id, sent_by, expires_at, target_user_id
  )
  VALUES (
    p_facility_id, p_type, p_title, p_message, p_category,
    p_metadata, p_case_id, p_sent_by, v_expires_at, p_target_user_id
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification_if_enabled(uuid, text, text, text, text, jsonb, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification_if_enabled(uuid, text, text, text, text, jsonb, uuid, uuid, uuid) TO service_role;

-- ============================================================
-- 4. Add notification types to template catalog
-- ============================================================

INSERT INTO public.notification_settings_template (
  notification_type, category, display_label, description,
  default_enabled, default_channels, display_order
) VALUES
  ('time_off_requested', 'staff_management', 'Time-Off Requested',
   'Notify admins when a staff member requests time off',
   true, '{in_app,email}', 14),
  ('time_off_approved', 'staff_management', 'Time-Off Approved',
   'Notify staff when their time-off request is approved',
   true, '{in_app,email}', 15),
  ('time_off_denied', 'staff_management', 'Time-Off Denied',
   'Notify staff when their time-off request is denied',
   true, '{in_app,email}', 16)
ON CONFLICT (notification_type) DO NOTHING;

-- ============================================================
-- 5. Seed new types to existing facilities
-- ============================================================

INSERT INTO public.facility_notification_settings (
  facility_id, notification_type, category, display_label,
  is_enabled, channels, display_order
)
SELECT
  f.id,
  t.notification_type,
  t.category,
  t.display_label,
  t.default_enabled,
  t.default_channels,
  t.display_order
FROM public.facilities f
CROSS JOIN public.notification_settings_template t
WHERE t.notification_type IN ('time_off_requested', 'time_off_approved', 'time_off_denied')
  AND t.is_active = true
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. DB trigger: notify admins when a time-off request is created
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_time_off_requested()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name text;
  v_request_type text;
  v_admin record;
BEGIN
  -- Only fire for active requests
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- Get requesting user's name
  SELECT first_name || ' ' || last_name INTO v_user_name
  FROM users WHERE id = NEW.user_id;

  -- Friendly request type label
  v_request_type := CASE NEW.request_type
    WHEN 'pto' THEN 'PTO'
    WHEN 'sick' THEN 'Sick Leave'
    WHEN 'personal' THEN 'Personal Day'
    ELSE NEW.request_type
  END;

  -- Create one targeted notification per facility admin
  FOR v_admin IN
    SELECT id FROM users
    WHERE facility_id = NEW.facility_id
      AND access_level IN ('facility_admin', 'global_admin')
      AND is_active = true
      AND id != NEW.user_id  -- don't notify the requester
  LOOP
    PERFORM create_notification_if_enabled(
      NEW.facility_id,
      'time_off_requested',
      format('Time-Off Request: %s', v_user_name),
      format('%s requested %s from %s to %s',
        v_user_name, v_request_type,
        to_char(NEW.start_date, 'Mon DD'), to_char(NEW.end_date, 'Mon DD')),
      'staff_management',
      jsonb_build_object(
        'time_off_request_id', NEW.id,
        'user_id', NEW.user_id,
        'link_to', '/staff-management'
      ),
      NULL,           -- case_id
      NEW.user_id,    -- sent_by
      v_admin.id      -- target_user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_time_off_requested_trigger
  AFTER INSERT ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_time_off_requested();

-- ============================================================
-- 7. DB trigger: notify staff when their request is reviewed
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_time_off_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer_name text;
  v_status_label text;
BEGIN
  -- Only fire when status changes from 'pending'
  IF OLD.status != 'pending' OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- Don't notify if soft-deleted
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- Get reviewer name
  IF NEW.reviewed_by IS NOT NULL THEN
    SELECT first_name || ' ' || last_name INTO v_reviewer_name
    FROM users WHERE id = NEW.reviewed_by;
  ELSE
    v_reviewer_name := 'An admin';
  END IF;

  v_status_label := CASE NEW.status
    WHEN 'approved' THEN 'Approved'
    WHEN 'denied' THEN 'Denied'
    ELSE NEW.status
  END;

  -- Create notification targeted at the requesting user
  PERFORM create_notification_if_enabled(
    NEW.facility_id,
    CASE NEW.status
      WHEN 'approved' THEN 'time_off_approved'
      WHEN 'denied' THEN 'time_off_denied'
      ELSE 'time_off_denied'
    END,
    format('Time-Off Request %s', v_status_label),
    format('%s %s your %s request for %s to %s',
      v_reviewer_name, lower(v_status_label),
      CASE NEW.request_type
        WHEN 'pto' THEN 'PTO'
        WHEN 'sick' THEN 'Sick Leave'
        WHEN 'personal' THEN 'Personal Day'
        ELSE NEW.request_type
      END,
      to_char(NEW.start_date, 'Mon DD'), to_char(NEW.end_date, 'Mon DD')),
    'staff_management',
    jsonb_build_object(
      'time_off_request_id', NEW.id,
      'status', NEW.status,
      'link_to', '/staff-management'
    ),
    NULL,              -- case_id
    NEW.reviewed_by,   -- sent_by
    NEW.user_id        -- target_user_id (the staff member)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_time_off_reviewed_trigger
  AFTER UPDATE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_time_off_reviewed();
