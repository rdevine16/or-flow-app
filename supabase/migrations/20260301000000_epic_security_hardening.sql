-- Phase 6: Epic Security Hardening
--
-- 1. Replace the broad non-admin SELECT policy on epic_connections
--    with a security-definer function that returns only safe columns.
--    This prevents non-admin users from reading access_token/refresh_token.
--
-- 2. Create get_epic_connection_status() RPC for safe status lookups.

--------------------------------------------------------------------------------
-- 1. Drop the overly broad SELECT policy for non-admin users
--------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own facility epic_connections"
  ON public.epic_connections;

--------------------------------------------------------------------------------
-- 2. Create a security-definer function that returns safe status fields only
--    This allows non-admin facility users to see connection status without
--    exposing OAuth tokens.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_epic_connection_status(p_facility_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  last_connected_at TIMESTAMPTZ,
  connected_by UUID,
  token_expires_at TIMESTAMPTZ,
  fhir_base_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Verify the calling user belongs to the requested facility
  IF get_my_facility_id() IS DISTINCT FROM p_facility_id
     AND get_my_access_level() <> 'global_admin' THEN
    RAISE EXCEPTION 'Access denied: not a member of facility %', p_facility_id;
  END IF;

  RETURN QUERY
  SELECT
    ec.id,
    ec.status,
    ec.last_connected_at,
    ec.connected_by,
    ec.token_expires_at,
    ec.fhir_base_url
  FROM public.epic_connections ec
  WHERE ec.facility_id = p_facility_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_epic_connection_status(UUID) TO authenticated;
