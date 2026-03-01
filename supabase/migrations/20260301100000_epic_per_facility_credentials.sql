-- Per-facility Epic credentials
--
-- Adds client_secret column to epic_connections so each facility can store
-- its own Epic app registration credentials. Existing RLS policies already
-- restrict access to facility_admin + global_admin, matching the protection
-- level of access_token / refresh_token.
--
-- Also updates the security-definer status RPC to include client_id
-- (a public app identifier, not sensitive).

--------------------------------------------------------------------------------
-- 1. Add client_secret column (nullable for backward compat)
--------------------------------------------------------------------------------

ALTER TABLE public.epic_connections
  ADD COLUMN IF NOT EXISTS client_secret TEXT;

COMMENT ON COLUMN public.epic_connections.client_secret
  IS 'Per-facility Epic OAuth client secret. Protected by RLS (admin-only). Nullable — falls back to EPIC_CLIENT_SECRET env var.';

--------------------------------------------------------------------------------
-- 2. Update get_epic_connection_status() to also return client_id
--    (client_id is a public app identifier, not sensitive)
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_epic_connection_status(UUID);

CREATE FUNCTION public.get_epic_connection_status(p_facility_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  last_connected_at TIMESTAMPTZ,
  connected_by UUID,
  token_expires_at TIMESTAMPTZ,
  fhir_base_url TEXT,
  client_id TEXT
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
    ec.fhir_base_url,
    ec.client_id
  FROM public.epic_connections ec
  WHERE ec.facility_id = p_facility_id;
END;
$$;

-- Re-grant execute after drop/recreate
GRANT EXECUTE ON FUNCTION public.get_epic_connection_status(UUID) TO authenticated;
