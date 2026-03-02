-- Migration: ehr_integration_tables
-- Creates ehr_integrations, ehr_integration_log, ehr_entity_mappings tables
-- with RLS policies, indexes, and updated_at triggers

-- =====================================================
-- ehr_integrations — Per-facility integration configurations
-- =====================================================

CREATE TABLE public.ehr_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('epic_hl7v2', 'modmed_fhir', 'csv_import')),
  display_name TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_message_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, integration_type)
);

-- =====================================================
-- ehr_integration_log — Audit trail for all inbound messages
-- =====================================================

CREATE TABLE public.ehr_integration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.ehr_integrations(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  message_control_id TEXT,
  raw_message TEXT,
  parsed_data JSONB,
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'pending_review', 'processed', 'error', 'ignored')),
  error_message TEXT,
  external_case_id TEXT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  review_notes JSONB,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- =====================================================
-- ehr_entity_mappings — Persistent entity resolution
-- Maps external identifiers (NPI, CPT, room name) to ORbit entities.
-- Checked BEFORE fuzzy matching on every import.
-- =====================================================

CREATE TABLE public.ehr_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.ehr_integrations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('surgeon', 'procedure', 'room')),
  external_identifier TEXT NOT NULL,
  external_display_name TEXT,
  orbit_entity_id UUID,
  orbit_display_name TEXT,
  match_method TEXT NOT NULL DEFAULT 'manual' CHECK (match_method IN ('auto', 'manual')),
  match_confidence REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(integration_id, entity_type, external_identifier)
);

-- =====================================================
-- Indexes
-- =====================================================

-- Review queue queries (pending_review status for a facility)
CREATE INDEX idx_ehr_integration_log_review
  ON public.ehr_integration_log(facility_id, processing_status);

-- Case lookup by external ID
CREATE INDEX idx_ehr_integration_log_case
  ON public.ehr_integration_log(external_case_id, facility_id);

-- Message dedup (belt-and-suspenders with case-level dedup)
CREATE INDEX idx_ehr_integration_log_dedup
  ON public.ehr_integration_log(message_control_id, integration_id);

-- Entity mapping lookup (checked before fuzzy matching)
CREATE INDEX idx_ehr_entity_mappings_lookup
  ON public.ehr_entity_mappings(integration_id, entity_type, external_identifier);

-- API key lookup for Edge Function auth
CREATE INDEX idx_ehr_integrations_api_key
  ON public.ehr_integrations((config->>'api_key'));

-- =====================================================
-- updated_at triggers (reuse existing function)
-- =====================================================

CREATE TRIGGER update_ehr_integrations_updated_at
  BEFORE UPDATE ON public.ehr_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ehr_entity_mappings_updated_at
  BEFORE UPDATE ON public.ehr_entity_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE public.ehr_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ehr_integration_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ehr_entity_mappings ENABLE ROW LEVEL SECURITY;

-- ehr_integrations: facility users can view, admins can manage
CREATE POLICY "ehr_integrations_select" ON public.ehr_integrations
  FOR SELECT USING (
    get_my_access_level() = 'global_admin'
    OR facility_id = get_my_facility_id()
  );

CREATE POLICY "ehr_integrations_insert" ON public.ehr_integrations
  FOR INSERT WITH CHECK (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );

CREATE POLICY "ehr_integrations_update" ON public.ehr_integrations
  FOR UPDATE USING (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );

CREATE POLICY "ehr_integrations_delete" ON public.ehr_integrations
  FOR DELETE USING (
    get_my_access_level() = 'global_admin'
  );

-- ehr_integration_log: facility users can read, admins can write
CREATE POLICY "ehr_integration_log_select" ON public.ehr_integration_log
  FOR SELECT USING (
    get_my_access_level() = 'global_admin'
    OR facility_id = get_my_facility_id()
  );

CREATE POLICY "ehr_integration_log_insert" ON public.ehr_integration_log
  FOR INSERT WITH CHECK (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );

CREATE POLICY "ehr_integration_log_update" ON public.ehr_integration_log
  FOR UPDATE USING (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );

-- ehr_entity_mappings: facility users can read, admins can manage
CREATE POLICY "ehr_entity_mappings_select" ON public.ehr_entity_mappings
  FOR SELECT USING (
    get_my_access_level() = 'global_admin'
    OR facility_id = get_my_facility_id()
  );

CREATE POLICY "ehr_entity_mappings_insert" ON public.ehr_entity_mappings
  FOR INSERT WITH CHECK (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );

CREATE POLICY "ehr_entity_mappings_update" ON public.ehr_entity_mappings
  FOR UPDATE USING (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );

CREATE POLICY "ehr_entity_mappings_delete" ON public.ehr_entity_mappings
  FOR DELETE USING (
    get_my_access_level() IN ('global_admin', 'facility_admin')
    AND (get_my_access_level() = 'global_admin' OR facility_id = get_my_facility_id())
  );
