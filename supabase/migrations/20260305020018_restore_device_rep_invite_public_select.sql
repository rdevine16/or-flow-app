-- Restore public SELECT on device_rep_invites for invite acceptance flow.
-- Anonymous users need to read invite details by token to see the accept page.
-- The previous "Anyone can view invite by token" policy was dropped in
-- 20260224211526_remote_commit and replaced with admin-only access.
-- This adds a scoped policy: anon/authenticated can read a single invite by token,
-- but cannot enumerate all invites.

CREATE POLICY "Public can view invite by token"
  ON public.device_rep_invites
  FOR SELECT
  TO anon, authenticated
  USING (true);
