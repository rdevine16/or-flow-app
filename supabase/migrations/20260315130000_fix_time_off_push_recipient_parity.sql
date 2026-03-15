-- Fix: include global_admin in push notification recipients (parity with in-app notifications)
-- Previously only sent push to facility_admin; in-app notifications went to both facility_admin + global_admin

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
  v_push_enabled boolean := false;
  v_channels text[];
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  SELECT first_name || ' ' || last_name INTO v_user_name
  FROM users WHERE id = NEW.user_id;

  v_request_type := CASE NEW.request_type
    WHEN 'pto' THEN 'PTO'
    WHEN 'sick' THEN 'Sick Leave'
    WHEN 'personal' THEN 'Personal Day'
    ELSE NEW.request_type
  END;

  -- Check if push channel is enabled for this notification type
  SELECT fns.channels INTO v_channels
  FROM facility_notification_settings fns
  WHERE fns.facility_id = NEW.facility_id
    AND fns.notification_type = 'time_off_requested'
    AND fns.is_active = true
    AND fns.is_enabled = true;

  IF FOUND AND 'push' = ANY(v_channels) THEN
    v_push_enabled := true;
  END IF;

  -- Create in-app notifications for each admin (existing behavior)
  FOR v_admin IN
    SELECT id FROM users
    WHERE facility_id = NEW.facility_id
      AND access_level IN ('facility_admin', 'global_admin')
      AND is_active = true
      AND id != NEW.user_id
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
        'link_to', '/staff-management?tab=time-off-calendar'
      ),
      NULL,
      NEW.user_id,
      v_admin.id
    );
  END LOOP;

  -- Send push notification to admins via pg_net (facility_admin + global_admin)
  IF v_push_enabled THEN
    PERFORM net.http_post(
      url := 'https://zplyoslgguxtojgnkxlt.supabase.co/functions/v1/send-push-notification',
      body := jsonb_build_object(
        'facility_id', NEW.facility_id,
        'target_access_level', jsonb_build_array('facility_admin', 'global_admin'),
        'title', 'New Time-Off Request',
        'body', format('%s requested %s from %s to %s',
          v_user_name, v_request_type,
          to_char(NEW.start_date, 'Mon DD'), to_char(NEW.end_date, 'Mon DD')),
        'data', jsonb_build_object(
          'type', 'time_off_request',
          'time_off_request_id', NEW.id::text,
          'link_to', '/staff-management?tab=time-off-calendar'
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;
