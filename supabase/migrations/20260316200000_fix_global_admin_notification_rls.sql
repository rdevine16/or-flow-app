-- =============================================================================
-- Migration: Fix global admin notification RLS policy
--
-- Problem: The policy "notifications_select_public_policy" gives global admins
-- unrestricted access to ALL notifications across ALL facilities, bypassing
-- both facility scoping and target_user_id filtering. This means global admins
-- see targeted notifications meant for other users (e.g., "Your time-off was
-- approved" sent to a specific staff member).
--
-- Fix: Replace with a policy that still allows global admins to view any
-- facility's notifications (needed for facility switching), but respects
-- target_user_id and expires_at.
-- =============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "notifications_select_public_policy" ON public.notifications;

-- Also drop the old named version in case it exists from an earlier migration
DROP POLICY IF EXISTS "Global admins can view all notifications" ON public.notifications;

-- Create a properly scoped policy for global admins:
-- - Can view notifications from ANY facility (no facility_id restriction)
-- - But only broadcast (target_user_id IS NULL) or notifications targeted at them
-- - Respects expires_at
CREATE POLICY "Global admins can view facility notifications"
  ON public.notifications FOR SELECT
  USING (
    public.get_my_access_level() = 'global_admin'
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
    AND (expires_at IS NULL OR expires_at > now())
  );
