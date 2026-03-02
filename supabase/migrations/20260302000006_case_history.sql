-- Migration: Case History table for automatic change tracking
-- Phase 16 of Epic HL7v2 Integration
--
-- Captures every INSERT and UPDATE on the cases table via an AFTER trigger.
-- Tracks change source (manual vs epic_hl7v2 vs system), user attribution,
-- and optionally links to ehr_integration_log for HL7v2-sourced changes.

-- =====================================================
-- 1. Create the case_history table
-- =====================================================

CREATE TABLE public.case_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,

  -- What changed
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'cancelled', 'status_change')),
  changed_fields JSONB NOT NULL DEFAULT '{}',
    -- { "surgeon_id": { "old": "uuid-old", "new": "uuid-new" },
    --   "scheduled_date": { "old": "2026-03-15", "new": "2026-03-20" } }

  -- Who/what made the change
  change_source TEXT NOT NULL DEFAULT 'manual' CHECK (change_source IN ('manual', 'epic_hl7v2', 'system')),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- auth.uid() or app.current_user_id (NULL for system)

  -- HL7v2 integration link (NULL for manual changes)
  ehr_integration_log_id UUID REFERENCES ehr_integration_log(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- 2. Indexes
-- =====================================================

CREATE INDEX idx_case_history_case_id ON case_history(case_id, created_at DESC);
CREATE INDEX idx_case_history_facility ON case_history(facility_id);
CREATE INDEX idx_case_history_ehr_log ON case_history(ehr_integration_log_id) WHERE ehr_integration_log_id IS NOT NULL;

-- =====================================================
-- 3. RLS policies
-- =====================================================

ALTER TABLE case_history ENABLE ROW LEVEL SECURITY;

-- SELECT: facility-scoped (same pattern as other tables)
CREATE POLICY "case_history_select"
  ON case_history
  FOR SELECT USING (
    get_my_access_level() = 'global_admin'
    OR facility_id = get_my_facility_id()
  );

-- No INSERT/UPDATE/DELETE policies — only the trigger writes to this table.
-- Service-role bypasses RLS for Edge Function writes.

-- =====================================================
-- 4. Trigger function
-- =====================================================

CREATE OR REPLACE FUNCTION trg_case_history_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields JSONB := '{}';
  v_change_type TEXT;
  v_change_source TEXT;
  v_changed_by UUID;
  v_ehr_log_id UUID;
  v_cols TEXT[] := ARRAY[
    'case_number', 'scheduled_date', 'start_time', 'status_id', 'or_room_id',
    'procedure_type_id', 'surgeon_id', 'patient_id', 'payer_id', 'operative_side',
    'notes', 'primary_diagnosis_code', 'primary_diagnosis_desc', 'source',
    'external_case_id', 'external_system', 'import_source', 'data_validated',
    'is_excluded_from_metrics', 'cancelled_at', 'cancellation_reason_id',
    'cancellation_notes', 'milestone_template_id', 'is_draft'
  ];
  v_col TEXT;
  v_old_val TEXT;
  v_new_val TEXT;
BEGIN
  -- Determine change source from session config (set by import service) or default to 'manual'
  v_change_source := coalesce(current_setting('app.change_source', true), 'manual');

  -- User attribution: auth.uid() for browser, fallback to session config for service-role
  BEGIN
    v_changed_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  IF v_changed_by IS NULL THEN
    BEGIN
      v_changed_by := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_changed_by := NULL;
    END;
  END IF;

  -- HL7v2 integration log link (set by import service before update)
  BEGIN
    v_ehr_log_id := current_setting('app.ehr_log_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_ehr_log_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_change_type := 'created';
    v_changed_fields := '{}';  -- No diff for creation, just record the event

    INSERT INTO case_history (case_id, facility_id, change_type, changed_fields, change_source, changed_by, ehr_integration_log_id)
    VALUES (NEW.id, NEW.facility_id, v_change_type, v_changed_fields, v_change_source, v_changed_by, v_ehr_log_id);

    RETURN NEW;
  END IF;

  -- For UPDATE: compute diff of tracked columns
  FOREACH v_col IN ARRAY v_cols LOOP
    EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', v_col, v_col)
      INTO v_old_val, v_new_val
      USING OLD, NEW;

    IF v_old_val IS DISTINCT FROM v_new_val THEN
      v_changed_fields := v_changed_fields || jsonb_build_object(
        v_col, jsonb_build_object('old', v_old_val, 'new', v_new_val)
      );
    END IF;
  END LOOP;

  -- Skip if nothing actually changed (e.g., updated_at-only triggers)
  IF v_changed_fields = '{}' THEN
    RETURN NEW;
  END IF;

  -- Determine change_type
  IF NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN
    v_change_type := 'cancelled';
  ELSIF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    v_change_type := 'status_change';
  ELSE
    v_change_type := 'updated';
  END IF;

  INSERT INTO case_history (case_id, facility_id, change_type, changed_fields, change_source, changed_by, ehr_integration_log_id)
  VALUES (NEW.id, NEW.facility_id, v_change_type, v_changed_fields, v_change_source, v_changed_by, v_ehr_log_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Attach trigger to cases table
-- =====================================================

CREATE TRIGGER trg_case_history
  AFTER INSERT OR UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION trg_case_history_fn();

-- =====================================================
-- 6. Post-hoc attribution RPC
-- =====================================================
-- PostgREST runs each request as a separate transaction, so SET LOCAL
-- session config won't persist across separate API calls. This RPC
-- provides a practical alternative: after a case mutation, call it to
-- tag the most recent case_history entry with the correct attribution.
-- The trigger still reads session config (for direct SQL/stored proc callers),
-- but import services using PostgREST use this RPC instead.

CREATE OR REPLACE FUNCTION tag_latest_case_history(
  p_case_id UUID,
  p_change_source TEXT,
  p_ehr_log_id UUID DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE case_history
  SET change_source = p_change_source,
      ehr_integration_log_id = p_ehr_log_id
  WHERE id = (
    SELECT id FROM case_history
    WHERE case_id = p_case_id
    ORDER BY created_at DESC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
