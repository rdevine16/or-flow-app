-- =====================================================
-- Phase 8: Test Data Manager — Entity Pool Tables
-- =====================================================
-- Six facility-scoped tables for CRUD-able test data:
-- surgeons, procedures, rooms, patients, diagnoses, schedules
-- Replaces hardcoded test data in surgical-data.ts
-- RLS: global admins only via get_my_access_level()
-- =====================================================

-- =====================================================
-- 1. ehr_test_surgeons
-- =====================================================
CREATE TABLE ehr_test_surgeons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  npi TEXT,
  specialty TEXT,
  external_provider_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ehr_test_surgeons_facility ON ehr_test_surgeons(facility_id);

ALTER TABLE ehr_test_surgeons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ehr_test_surgeons_all"
  ON ehr_test_surgeons FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- =====================================================
-- 2. ehr_test_procedures
-- =====================================================
CREATE TABLE ehr_test_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpt_code TEXT,
  typical_duration_min INTEGER,
  specialty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ehr_test_procedures_facility ON ehr_test_procedures(facility_id);

ALTER TABLE ehr_test_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ehr_test_procedures_all"
  ON ehr_test_procedures FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- =====================================================
-- 3. ehr_test_rooms
-- =====================================================
CREATE TABLE ehr_test_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_code TEXT,
  room_type TEXT CHECK (room_type IN ('operating_room', 'endo_suite', 'cath_lab', 'minor_procedure_room')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ehr_test_rooms_facility ON ehr_test_rooms(facility_id);

ALTER TABLE ehr_test_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ehr_test_rooms_all"
  ON ehr_test_rooms FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- =====================================================
-- 4. ehr_test_patients
-- =====================================================
CREATE TABLE ehr_test_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  mrn TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'O', 'U')),
  address_line TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ehr_test_patients_facility ON ehr_test_patients(facility_id);

ALTER TABLE ehr_test_patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ehr_test_patients_all"
  ON ehr_test_patients FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- =====================================================
-- 5. ehr_test_diagnoses
-- =====================================================
CREATE TABLE ehr_test_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  icd10_code TEXT NOT NULL,
  description TEXT NOT NULL,
  specialty TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ehr_test_diagnoses_facility ON ehr_test_diagnoses(facility_id);

ALTER TABLE ehr_test_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ehr_test_diagnoses_all"
  ON ehr_test_diagnoses FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- =====================================================
-- 6. ehr_test_schedules
-- =====================================================
CREATE TABLE ehr_test_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES ehr_test_patients(id) ON DELETE CASCADE,
  surgeon_id UUID NOT NULL REFERENCES ehr_test_surgeons(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES ehr_test_procedures(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES ehr_test_rooms(id) ON DELETE CASCADE,
  diagnosis_id UUID REFERENCES ehr_test_diagnoses(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_min INTEGER NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'S12'
    CHECK (trigger_event IN ('S12', 'S13', 'S14', 'S15', 'S16')),
  external_case_id TEXT,
  references_schedule_id UUID REFERENCES ehr_test_schedules(id) ON DELETE SET NULL,
  notes TEXT,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ehr_test_schedules_facility ON ehr_test_schedules(facility_id);
CREATE INDEX idx_ehr_test_schedules_patient ON ehr_test_schedules(patient_id);
CREATE INDEX idx_ehr_test_schedules_surgeon ON ehr_test_schedules(surgeon_id);
CREATE INDEX idx_ehr_test_schedules_ref ON ehr_test_schedules(references_schedule_id);

ALTER TABLE ehr_test_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ehr_test_schedules_all"
  ON ehr_test_schedules FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- =====================================================
-- updated_at triggers
-- =====================================================
CREATE TRIGGER set_updated_at_ehr_test_surgeons
  BEFORE UPDATE ON ehr_test_surgeons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_ehr_test_procedures
  BEFORE UPDATE ON ehr_test_procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_ehr_test_rooms
  BEFORE UPDATE ON ehr_test_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_ehr_test_patients
  BEFORE UPDATE ON ehr_test_patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_ehr_test_diagnoses
  BEFORE UPDATE ON ehr_test_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_ehr_test_schedules
  BEFORE UPDATE ON ehr_test_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
