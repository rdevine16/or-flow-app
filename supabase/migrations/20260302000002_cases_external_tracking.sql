-- Migration: cases_external_tracking
-- Adds external tracking columns to cases and patients tables
-- for HL7v2 import support

-- =====================================================
-- cases — External tracking columns
-- =====================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS external_case_id TEXT,
  ADD COLUMN IF NOT EXISTS external_system TEXT,
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS primary_diagnosis_code TEXT,
  ADD COLUMN IF NOT EXISTS primary_diagnosis_desc TEXT;

COMMENT ON COLUMN public.cases.external_case_id IS 'Source system case ID (e.g., Epic SCH-1 placer appointment ID)';
COMMENT ON COLUMN public.cases.external_system IS 'Source system identifier: epic_hl7v2, epic_fhir, modmed, etc.';
COMMENT ON COLUMN public.cases.import_source IS 'Import mechanism: hl7v2, fhir, csv, manual';
COMMENT ON COLUMN public.cases.primary_diagnosis_code IS 'Primary diagnosis ICD-10 code from DG1-3';
COMMENT ON COLUMN public.cases.primary_diagnosis_desc IS 'Primary diagnosis description from DG1-4';

-- =====================================================
-- patients — External patient ID
-- =====================================================

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS external_patient_id TEXT;

COMMENT ON COLUMN public.patients.external_patient_id IS 'Source system patient identifier for cross-reference';

-- =====================================================
-- Indexes for upsert matching and deduplication
-- =====================================================

-- Case dedup: external_case_id + external_system + facility_id
CREATE INDEX IF NOT EXISTS idx_cases_external_lookup
  ON public.cases(external_case_id, external_system, facility_id)
  WHERE external_case_id IS NOT NULL;

-- Patient matching by MRN (may already exist — IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_patients_mrn_facility
  ON public.patients(mrn, facility_id)
  WHERE mrn IS NOT NULL;

-- Patient matching by external ID
CREATE INDEX IF NOT EXISTS idx_patients_external_id
  ON public.patients(external_patient_id, facility_id)
  WHERE external_patient_id IS NOT NULL;
