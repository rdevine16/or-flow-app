-- ============================================================================
-- Migration: Fix infinite recursion in cases <-> case_implant_companies RLS
--
-- Problem:
--   cases SELECT policy (device rep branch) joins case_implant_companies
--   case_implant_companies SELECT policy joins cases
--   -> PostgreSQL detects infinite recursion when evaluating RLS
--
-- Fix:
--   Create a SECURITY DEFINER helper that reads cases.facility_id without
--   triggering RLS, then rewrite case_implant_companies SELECT policies to
--   use it instead of joining cases directly. This breaks the cycle while
--   preserving identical access semantics.
-- ============================================================================

-- Step 1: Create SECURITY DEFINER function to read case facility_id without RLS
CREATE OR REPLACE FUNCTION public.get_case_facility_id(p_case_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT facility_id FROM public.cases WHERE id = p_case_id;
$$;

-- Step 2: Drop ALL existing SELECT policies on case_implant_companies
-- (May be original named policies or a combined policy from migration 20260222100003)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'case_implant_companies'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.case_implant_companies', pol.policyname);
    RAISE NOTICE 'Dropped SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 3: Recreate SELECT policies using get_case_facility_id() instead of joining cases

-- Policy 1: Device reps can view their company's case_implant_companies records
-- Original semantics: user is device_rep, has accepted facility access for the
-- case's facility, and user has an implant_company_id set.
CREATE POLICY "Device reps can view their company cases"
ON public.case_implant_companies
FOR SELECT
USING (
  public.get_my_access_level() = 'device_rep'
  AND EXISTS (
    SELECT 1
    FROM public.facility_device_reps fdr
    WHERE fdr.user_id = (select auth.uid())
      AND fdr.facility_id = public.get_case_facility_id(case_id)
      AND fdr.status = 'accepted'
  )
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = (select auth.uid())
      AND u.implant_company_id IS NOT NULL
  )
);

-- Policy 2: Users can view case_implant_companies for cases at their facility
-- Original semantics: case belongs to user's facility, or user is global_admin.
CREATE POLICY "Users can view case implant companies for own facility"
ON public.case_implant_companies
FOR SELECT
USING (
  public.get_case_facility_id(case_id) = public.get_my_facility_id()
  OR public.get_my_access_level() = 'global_admin'
);
