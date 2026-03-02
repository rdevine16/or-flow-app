-- Migration: ehr_phi_access_log
-- PHI access tracking table for HIPAA compliance.
-- Records when users view raw HL7v2 messages containing PHI.

-- =====================================================
-- ehr_phi_access_log — PHI access tracking
-- =====================================================

CREATE TABLE public.ehr_phi_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  log_entry_id UUID NOT NULL REFERENCES public.ehr_integration_log(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'view_raw_message'
    CHECK (access_type IN ('view_raw_message', 'export_message', 'view_parsed_data')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================

-- Query by user (who accessed what)
CREATE INDEX idx_ehr_phi_access_log_user
  ON public.ehr_phi_access_log(user_id, created_at DESC);

-- Query by log entry (who viewed this message)
CREATE INDEX idx_ehr_phi_access_log_entry
  ON public.ehr_phi_access_log(log_entry_id);

-- Query by facility + date range (facility audit report)
CREATE INDEX idx_ehr_phi_access_log_facility
  ON public.ehr_phi_access_log(facility_id, created_at DESC);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE public.ehr_phi_access_log ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert (to log their own access)
CREATE POLICY "ehr_phi_access_log_insert" ON public.ehr_phi_access_log
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- Facility admins and global admins can read
CREATE POLICY "ehr_phi_access_log_select" ON public.ehr_phi_access_log
  FOR SELECT USING (
    get_my_access_level() = 'global_admin'
    OR (
      get_my_access_level() = 'facility_admin'
      AND facility_id = get_my_facility_id()
    )
  );
