-- =============================================================================
-- Migration: Global Announcements System
-- Phase 1: Tables, RLS, Triggers, Indexes, Cron, Push
-- =============================================================================

-- =============================================================================
-- 1. ANNOUNCEMENTS TABLE
-- =============================================================================
CREATE TABLE public.announcements (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id   UUID          NOT NULL REFERENCES public.facilities(id),
  created_by    UUID          NOT NULL REFERENCES public.users(id),
  title         VARCHAR(100)  NOT NULL,
  body          TEXT,
  audience      TEXT          NOT NULL CHECK (audience IN ('staff', 'surgeons', 'both')),
  priority      TEXT          NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'warning', 'critical')),
  category      TEXT          NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'maintenance', 'policy_update', 'safety_alert')),
  status        TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('scheduled', 'active', 'expired', 'deactivated')),
  starts_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ   NOT NULL,
  deactivated_at TIMESTAMPTZ,
  deactivated_by UUID         REFERENCES public.users(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_active     BOOLEAN       NOT NULL DEFAULT true,
  deleted_at    TIMESTAMPTZ,
  deleted_by    UUID          REFERENCES public.users(id)
);

-- =============================================================================
-- 2. ANNOUNCEMENT DISMISSALS TABLE
-- =============================================================================
CREATE TABLE public.announcement_dismissals (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID          NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES public.users(id),
  dismissed_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================
CREATE INDEX idx_announcements_facility_status
  ON public.announcements (facility_id, status, starts_at, expires_at)
  WHERE is_active = true;

CREATE INDEX idx_announcements_facility_created
  ON public.announcements (facility_id, created_at DESC)
  WHERE is_active = true;

CREATE INDEX idx_announcement_dismissals_announcement
  ON public.announcement_dismissals (announcement_id, user_id);

-- =============================================================================
-- 4. TRIGGERS (soft delete + updated_at)
-- =============================================================================
CREATE TRIGGER sync_soft_delete_announcements
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_soft_delete_columns();

CREATE TRIGGER set_updated_at_announcements
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 5. RLS POLICIES
-- =============================================================================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Announcements: Global admins have full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Global admins can do anything with announcements'
  ) THEN
    CREATE POLICY "Global admins can do anything with announcements"
      ON public.announcements
      USING (public.get_my_access_level() = 'global_admin'::text);
  END IF;
END $$;

-- Announcements: Facility admins can manage own facility
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Facility admins can manage own facility announcements'
  ) THEN
    CREATE POLICY "Facility admins can manage own facility announcements"
      ON public.announcements
      USING (
        public.get_my_access_level() = 'facility_admin'::text
        AND facility_id = public.get_my_facility_id()
      );
  END IF;
END $$;

-- Announcements: All facility users can view active announcements
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view own facility announcements'
  ) THEN
    CREATE POLICY "Users can view own facility announcements"
      ON public.announcements
      FOR SELECT
      USING (
        facility_id = public.get_my_facility_id()
        AND is_active = true
      );
  END IF;
END $$;

-- Dismissals: Users can insert their own dismissals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can dismiss announcements'
  ) THEN
    CREATE POLICY "Users can dismiss announcements"
      ON public.announcement_dismissals
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Dismissals: Users can view their own dismissals
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view own dismissals'
  ) THEN
    CREATE POLICY "Users can view own dismissals"
      ON public.announcement_dismissals
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Dismissals: Global admins can view all dismissals (for analytics)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Global admins can view all dismissals'
  ) THEN
    CREATE POLICY "Global admins can view all dismissals"
      ON public.announcement_dismissals
      FOR SELECT
      USING (public.get_my_access_level() = 'global_admin'::text);
  END IF;
END $$;

-- Dismissals: Facility admins can view dismissals for own facility announcements
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Facility admins can view facility dismissals'
  ) THEN
    CREATE POLICY "Facility admins can view facility dismissals"
      ON public.announcement_dismissals
      FOR SELECT
      USING (
        public.get_my_access_level() = 'facility_admin'::text
        AND EXISTS (
          SELECT 1 FROM public.announcements a
          WHERE a.id = announcement_id
            AND a.facility_id = public.get_my_facility_id()
        )
      );
  END IF;
END $$;

-- =============================================================================
-- 6. NOTIFICATION SETTINGS TEMPLATE
-- =============================================================================

-- Seed the template catalog
INSERT INTO public.notification_settings_template (
  notification_type, category, display_label, description,
  default_enabled, default_channels, display_order
) VALUES
  ('announcement_created', 'announcements', 'Announcement Created',
   'Notify when a new facility announcement is posted',
   true, '{in_app,push}', 20)
ON CONFLICT (notification_type) DO NOTHING;

-- Propagate to all existing facilities
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
WHERE t.notification_type = 'announcement_created'
  AND t.is_active = true
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. SCHEDULED ANNOUNCEMENT ACTIVATION (pg_cron)
-- =============================================================================

-- Function: activate scheduled announcements whose start time has arrived
CREATE OR REPLACE FUNCTION public.activate_scheduled_announcements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.announcements
  SET status = 'active'
  WHERE status = 'scheduled'
    AND starts_at <= now()
    AND expires_at > now()
    AND is_active = true;
END;
$$;

-- Schedule to run every minute
SELECT cron.schedule(
  'activate-scheduled-announcements',
  '* * * * *',
  $$SELECT public.activate_scheduled_announcements();$$
);

-- =============================================================================
-- 8. AUTO-EXPIRE ANNOUNCEMENTS (pg_cron)
-- =============================================================================

-- Function: expire announcements past their expiration time
CREATE OR REPLACE FUNCTION public.expire_announcements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.announcements
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at <= now()
    AND is_active = true;
END;
$$;

-- Schedule to run every minute
SELECT cron.schedule(
  'expire-announcements',
  '* * * * *',
  $$SELECT public.expire_announcements();$$
);

-- =============================================================================
-- 9. PUSH NOTIFICATION TRIGGER (on activation)
-- =============================================================================

-- Trigger function: fire push notification when announcement becomes active
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
      -- Determine targeting based on audience
      IF NEW.audience = 'both' THEN
        -- Broadcast to all facility users, exclude creator
        PERFORM net.http_post(
          url := 'https://zplyoslgguxtojgnkxlt.supabase.co/functions/v1/send-push-notification',
          body := jsonb_build_object(
            'facility_id', NEW.facility_id,
            'exclude_user_id', NEW.created_by,
            'title', CASE WHEN v_priority_label != '' THEN v_priority_label || ' ' || NEW.title ELSE NEW.title END,
            'body', COALESCE(LEFT(NEW.body, 200), 'New announcement from ' || v_creator_name),
            'data', jsonb_build_object(
              'type', 'announcement',
              'announcement_id', NEW.id::text,
              'link_to', '/staff-management?tab=announcements'
            )
          ),
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      ELSIF NEW.audience = 'surgeons' THEN
        -- Target surgeon access levels (surgeons are users with 'Surgeon' in roles array)
        -- For now, use broadcast with exclude; Phase 5 will refine with role-based targeting
        PERFORM net.http_post(
          url := 'https://zplyoslgguxtojgnkxlt.supabase.co/functions/v1/send-push-notification',
          body := jsonb_build_object(
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
          ),
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      ELSE
        -- Staff targeting (non-surgeon roles)
        -- For now, use broadcast with exclude; Phase 5 will refine with role-based targeting
        PERFORM net.http_post(
          url := 'https://zplyoslgguxtojgnkxlt.supabase.co/functions/v1/send-push-notification',
          body := jsonb_build_object(
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
          ),
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to announcements table
CREATE TRIGGER notify_announcement_activated_trigger
  AFTER UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_announcement_activated();

-- Also fire on INSERT for immediately active announcements
CREATE TRIGGER notify_announcement_created_active_trigger
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.notify_announcement_activated();
