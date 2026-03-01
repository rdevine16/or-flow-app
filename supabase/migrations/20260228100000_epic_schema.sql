-- Phase 2a: Epic Schema — 4 tables, RLS, indexes, triggers, seed data
--
-- 1. epic_connections — one per facility, stores OAuth connection state + tokens
-- 2. epic_entity_mappings — per-facility mapping of Epic → ORbit entities
-- 3. epic_field_mappings — global field mapping rules (FHIR field → ORbit column)
-- 4. epic_import_log — audit trail for every import operation

--------------------------------------------------------------------------------
-- 1. epic_connections
--------------------------------------------------------------------------------

CREATE TABLE public.epic_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,

  -- FHIR server config
  fhir_base_url TEXT NOT NULL DEFAULT 'https://fhir.epic.com/interconnect-fhir-oauth',
  client_id TEXT NOT NULL,

  -- OAuth tokens (stored in table with RLS; Vault migration possible later)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_scopes TEXT[],

  -- Connection state
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connected', 'error', 'token_expired')),
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,

  -- Future sync support (v1: always 'manual')
  sync_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (sync_mode IN ('manual', 'scheduled')),
  sync_interval_minutes INTEGER,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,

  -- Metadata
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(facility_id)
);

-- updated_at trigger
CREATE TRIGGER update_epic_connections_updated_at
  BEFORE UPDATE ON public.epic_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_epic_connections_facility ON public.epic_connections(facility_id);

-- RLS
ALTER TABLE public.epic_connections ENABLE ROW LEVEL SECURITY;

-- Facility admins can manage their facility's connection
CREATE POLICY "Facility admins can manage epic_connections"
  ON public.epic_connections
  USING (
    (public.get_my_access_level() = 'facility_admin'::text)
    AND (facility_id = public.get_my_facility_id())
  );

-- Global admins can manage all connections
CREATE POLICY "Global admins can manage all epic_connections"
  ON public.epic_connections
  USING (public.get_my_access_level() = 'global_admin'::text);

-- All facility users can view connection status (but not tokens — handled by select columns)
CREATE POLICY "Users can view own facility epic_connections"
  ON public.epic_connections
  FOR SELECT
  USING (facility_id = public.get_my_facility_id());


--------------------------------------------------------------------------------
-- 2. epic_entity_mappings
--------------------------------------------------------------------------------

CREATE TABLE public.epic_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.epic_connections(id) ON DELETE CASCADE,

  -- Mapping type determines what orbit_entity_id references
  mapping_type TEXT NOT NULL
    CHECK (mapping_type IN ('surgeon', 'room', 'procedure')),

  -- Epic side
  epic_resource_type TEXT NOT NULL,
  epic_resource_id TEXT NOT NULL,
  epic_display_name TEXT,

  -- ORbit side (interpreted based on mapping_type)
  -- surgeon → surgeons.id, room → rooms.id, procedure → procedure_types.id
  orbit_entity_id UUID,

  -- Match metadata
  match_method TEXT NOT NULL DEFAULT 'manual'
    CHECK (match_method IN ('auto', 'manual')),
  match_confidence NUMERIC(3,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(connection_id, mapping_type, epic_resource_id)
);

-- updated_at trigger
CREATE TRIGGER update_epic_entity_mappings_updated_at
  BEFORE UPDATE ON public.epic_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_epic_entity_mappings_connection
  ON public.epic_entity_mappings(connection_id);
CREATE INDEX idx_epic_entity_mappings_lookup
  ON public.epic_entity_mappings(connection_id, mapping_type, epic_resource_id);

-- RLS
ALTER TABLE public.epic_entity_mappings ENABLE ROW LEVEL SECURITY;

-- Facility admins can manage their facility's mappings
CREATE POLICY "Facility admins can manage epic_entity_mappings"
  ON public.epic_entity_mappings
  USING (
    (public.get_my_access_level() = 'facility_admin'::text)
    AND (facility_id = public.get_my_facility_id())
  );

-- Global admins can manage all mappings
CREATE POLICY "Global admins can manage all epic_entity_mappings"
  ON public.epic_entity_mappings
  USING (public.get_my_access_level() = 'global_admin'::text);

-- Users can view own facility mappings
CREATE POLICY "Users can view own facility epic_entity_mappings"
  ON public.epic_entity_mappings
  FOR SELECT
  USING (facility_id = public.get_my_facility_id());


--------------------------------------------------------------------------------
-- 3. epic_field_mappings (global, not facility-scoped)
--------------------------------------------------------------------------------

CREATE TABLE public.epic_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FHIR source
  fhir_resource_type TEXT NOT NULL,
  fhir_field_path TEXT NOT NULL,

  -- ORbit target
  orbit_table TEXT NOT NULL,
  orbit_column TEXT NOT NULL,

  -- Metadata
  label TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Widened UNIQUE: allows one FHIR field to map to multiple ORbit columns
  UNIQUE(fhir_resource_type, fhir_field_path, orbit_table, orbit_column)
);

-- updated_at trigger
CREATE TRIGGER update_epic_field_mappings_updated_at
  BEFORE UPDATE ON public.epic_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.epic_field_mappings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read field mappings
CREATE POLICY "All authenticated users can view epic_field_mappings"
  ON public.epic_field_mappings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only global admins can write field mappings
CREATE POLICY "Global admins can insert epic_field_mappings"
  ON public.epic_field_mappings
  FOR INSERT
  WITH CHECK (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Global admins can update epic_field_mappings"
  ON public.epic_field_mappings
  FOR UPDATE
  USING (public.get_my_access_level() = 'global_admin'::text);

CREATE POLICY "Global admins can delete epic_field_mappings"
  ON public.epic_field_mappings
  FOR DELETE
  USING (public.get_my_access_level() = 'global_admin'::text);

-- Seed with sensible defaults (skip duration mapping per Q6 decision)
INSERT INTO public.epic_field_mappings
  (fhir_resource_type, fhir_field_path, orbit_table, orbit_column, label, description)
VALUES
  ('Appointment', 'start', 'cases', 'scheduled_date', 'Surgery Date',
   'Maps appointment start date to case scheduled date'),
  ('Appointment', 'start', 'cases', 'start_time', 'Surgery Time',
   'Maps appointment start time to case start time'),
  ('Appointment', 'serviceType', 'cases', 'procedure_type_id', 'Procedure Type',
   'Maps service type to ORbit procedure (via entity mapping)'),
  ('Patient', 'name.family', 'patients', 'last_name', 'Patient Last Name',
   'Maps patient family name'),
  ('Patient', 'name.given', 'patients', 'first_name', 'Patient First Name',
   'Maps patient given name'),
  ('Patient', 'birthDate', 'patients', 'date_of_birth', 'Date of Birth',
   'Maps patient birth date'),
  ('Patient', 'identifier[MRN]', 'patients', 'mrn', 'Medical Record Number',
   'Maps patient MRN identifier'),
  ('Practitioner', 'name', 'surgeons', 'id', 'Surgeon',
   'Maps practitioner to ORbit surgeon (via entity mapping)'),
  ('Location', 'name', 'rooms', 'id', 'Operating Room',
   'Maps location to ORbit room (via entity mapping)');


--------------------------------------------------------------------------------
-- 4. epic_import_log
--------------------------------------------------------------------------------

CREATE TABLE public.epic_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.epic_connections(id) ON DELETE CASCADE,

  -- Source FHIR references
  fhir_appointment_id TEXT,
  fhir_service_request_id TEXT,

  -- Result
  orbit_case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'skipped', 'duplicate')),
  error_message TEXT,

  -- Audit snapshot
  fhir_resource_snapshot JSONB,
  field_mapping_applied JSONB,

  imported_by UUID NOT NULL REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_epic_import_log_facility
  ON public.epic_import_log(facility_id);
CREATE INDEX idx_epic_import_log_appointment
  ON public.epic_import_log(fhir_appointment_id);
CREATE INDEX idx_epic_import_log_case
  ON public.epic_import_log(orbit_case_id);

-- RLS
ALTER TABLE public.epic_import_log ENABLE ROW LEVEL SECURITY;

-- Facility admins can view their import logs
CREATE POLICY "Facility admins can view epic_import_log"
  ON public.epic_import_log
  FOR SELECT
  USING (
    (public.get_my_access_level() = 'facility_admin'::text)
    AND (facility_id = public.get_my_facility_id())
  );

-- Facility admins can insert import logs (during import)
CREATE POLICY "Facility admins can insert epic_import_log"
  ON public.epic_import_log
  FOR INSERT
  WITH CHECK (
    (public.get_my_access_level() = 'facility_admin'::text)
    AND (facility_id = public.get_my_facility_id())
  );

-- Global admins can view all import logs
CREATE POLICY "Global admins can view all epic_import_log"
  ON public.epic_import_log
  FOR SELECT
  USING (public.get_my_access_level() = 'global_admin'::text);
