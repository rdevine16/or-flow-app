-- Update time-off notification triggers to deep-link to the time-off calendar tab
-- instead of just /staff-management (which defaults to the directory tab).

-- 1. Update notify_time_off_requested() — admin sees new request on calendar tab
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

  RETURN NEW;
END;
$$;

-- 2. Update notify_time_off_reviewed() — staff sees approval/denial on calendar tab
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
  IF OLD.status != 'pending' OR NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

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
      'link_to', '/staff-management?tab=time-off-calendar'
    ),
    NULL,
    NEW.reviewed_by,
    NEW.user_id
  );

  RETURN NEW;
END;
$$;
