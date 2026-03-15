-- Migration: Add 'push' channel to time-off notification types
-- Enables push notifications for time-off approval, denial, and new request events

-- 1. Update global templates to include 'push' in default_channels
UPDATE public.notification_settings_template
SET default_channels = array_append(default_channels, 'push'),
    updated_at = now()
WHERE notification_type IN ('time_off_requested', 'time_off_approved', 'time_off_denied')
  AND NOT ('push' = ANY(default_channels));

-- 2. Update existing facility settings to include 'push' in channels
UPDATE public.facility_notification_settings
SET channels = array_append(channels, 'push'),
    updated_at = now()
WHERE notification_type IN ('time_off_requested', 'time_off_approved', 'time_off_denied')
  AND NOT ('push' = ANY(channels));
