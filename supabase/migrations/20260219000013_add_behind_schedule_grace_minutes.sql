-- Migration: Add behind_schedule_grace_minutes to facility_analytics_settings
-- Allows facilities to configure the grace period used by the dashboard
-- "rooms running behind" alert instead of using a hardcoded 15 minutes.

ALTER TABLE public.facility_analytics_settings
  ADD COLUMN IF NOT EXISTS behind_schedule_grace_minutes integer DEFAULT 15 NOT NULL
    CONSTRAINT facility_analytics_settings_behind_schedule_grace_check
      CHECK (behind_schedule_grace_minutes >= 0 AND behind_schedule_grace_minutes <= 60);
