-- =============================================================================
-- Migration: Update announcement push trigger with role-based audience targeting
-- Phase 5 of Global Announcements feature
--
-- Previously the trigger broadcast to ALL facility users regardless of audience.
-- Now it uses target_roles / exclude_roles params in the edge function payload:
--   audience='surgeons' → target_roles: ['surgeon']
--   audience='staff'    → exclude_roles: ['surgeon']
--   audience='both'     → broadcast (no role filter)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_announcement_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push_enabled BOOLEAN;
  v_creator_name TEXT;
  v_priority_label TEXT;
  v_payload JSONB;
BEGIN
  -- Fire on INSERT when status='active', or on UPDATE when status changes TO 'active'
  IF NEW.status = 'active' AND NEW.is_active = true
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN

    -- Check if push is enabled for announcements at this facility
    SELECT COALESCE(fns.is_enabled, true) INTO v_push_enabled
    FROM public.facility_notification_settings fns
    WHERE fns.facility_id = NEW.facility_id
      AND fns.notification_type = 'announcement_created'
      AND 'push' = ANY(fns.channels);

    -- Default to true if no setting found
    IF v_push_enabled IS NULL THEN
      v_push_enabled := true;
    END IF;

    -- Get creator name for notification body
    SELECT COALESCE(u.first_name || ' ' || u.last_name, 'Admin')
    INTO v_creator_name
    FROM public.users u
    WHERE u.id = NEW.created_by;

    -- Map priority to label
    v_priority_label := CASE NEW.priority
      WHEN 'critical' THEN '🔴 Critical'
      WHEN 'warning' THEN '🟡 Warning'
      ELSE ''
    END;

    -- Send push notification via pg_net
    IF v_push_enabled THEN
      -- Build base payload
      v_payload := jsonb_build_object(
        'facility_id', NEW.facility_id,
        'exclude_user_id', NEW.created_by,
        'title', CASE WHEN v_priority_label != '' THEN v_priority_label || ' ' || NEW.title ELSE NEW.title END,
        'body', COALESCE(LEFT(NEW.body, 200), 'New announcement from ' || v_creator_name),
        'data', jsonb_build_object(
          'type', 'announcement',
          'announcement_id', NEW.id::text,
          'audience', NEW.audience,
          'link_to', '/staff-management?tab=announcements'
        )
      );

      -- Add role-based targeting based on audience
      IF NEW.audience = 'surgeons' THEN
        -- Only send to users with 'surgeon' role
        v_payload := v_payload || jsonb_build_object('target_roles', jsonb_build_array('surgeon'));
      ELSIF NEW.audience = 'staff' THEN
        -- Send to everyone except surgeons
        v_payload := v_payload || jsonb_build_object('exclude_roles', jsonb_build_array('surgeon'));
      END IF;
      -- audience='both' uses broadcast (no role filter), which is the default

      PERFORM net.http_post(
        url := 'https://zplyoslgguxtojgnkxlt.supabase.co/functions/v1/send-push-notification',
        body := v_payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
