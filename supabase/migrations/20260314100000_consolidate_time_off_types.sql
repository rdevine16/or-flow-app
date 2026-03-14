-- Migration: Consolidate time-off types — remove 'personal', keep only 'pto' and 'sick'
-- Phase 1 of Consolidate PTO Types + Profile Relocation

-- ============================================================
-- 1. Migrate any existing 'personal' rows to 'pto'
-- ============================================================
UPDATE public.time_off_requests
SET request_type = 'pto'
WHERE request_type = 'personal';

-- ============================================================
-- 2. Replace CHECK constraint to only allow 'pto' and 'sick'
-- ============================================================

-- Drop the existing inline CHECK (PostgreSQL auto-names it)
ALTER TABLE public.time_off_requests
  DROP CONSTRAINT IF EXISTS time_off_requests_request_type_check;

-- Recreate with only two allowed values
ALTER TABLE public.time_off_requests
  ADD CONSTRAINT time_off_requests_request_type_check
  CHECK (request_type IN ('pto', 'sick'));

-- ============================================================
-- 3. Update notify_time_off_requested() — remove 'personal' branch
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

-- ============================================================
-- 4. Update notify_time_off_reviewed() — remove 'personal' branch
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
