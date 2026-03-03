-- Multi-EHR Support: Add Oracle Cerner and MEDITECH as valid integration types
-- Expands CHECK constraints on ehr_integrations.integration_type and case_history.change_source
-- Adds one-active-HL7v2-per-facility constraint

BEGIN;

-- 1. Expand ehr_integrations.integration_type CHECK constraint
ALTER TABLE ehr_integrations
  DROP CONSTRAINT IF EXISTS ehr_integrations_integration_type_check;

ALTER TABLE ehr_integrations
  ADD CONSTRAINT ehr_integrations_integration_type_check
  CHECK (integration_type IN ('epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2', 'modmed_fhir', 'csv_import'));

-- 2. Expand case_history.change_source CHECK constraint
ALTER TABLE case_history
  DROP CONSTRAINT IF EXISTS case_history_change_source_check;

ALTER TABLE case_history
  ADD CONSTRAINT case_history_change_source_check
  CHECK (change_source IN ('manual', 'epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2', 'system'));

-- 3. One active HL7v2 integration per facility
-- A facility can have inactive HL7v2 integrations, but only one active one at a time.
-- Non-HL7v2 integrations (modmed_fhir, csv_import) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_hl7v2_per_facility
  ON ehr_integrations (facility_id)
  WHERE integration_type IN ('epic_hl7v2', 'cerner_hl7v2', 'meditech_hl7v2')
    AND is_active = true;

COMMIT;
