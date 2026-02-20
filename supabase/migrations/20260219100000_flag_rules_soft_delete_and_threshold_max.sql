-- Migration: Add soft-delete columns, threshold_value_max, and cost_category_id to flag_rules
-- Feature: Flag Settings Rebuild + Custom Rule Builder (Phase 1)

-- Add soft-delete columns (consistent with ORbit 20-table soft-delete pattern)
ALTER TABLE flag_rules
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id);

-- Add threshold_value_max for "between" threshold type
ALTER TABLE flag_rules
  ADD COLUMN IF NOT EXISTS threshold_value_max numeric;

-- Add cost_category_id for per-category financial metrics
ALTER TABLE flag_rules
  ADD COLUMN IF NOT EXISTS cost_category_id uuid REFERENCES cost_categories(id);

-- Apply the standard soft-delete trigger (sync is_active, deleted_at, deleted_by)
CREATE TRIGGER sync_flag_rules_soft_delete
  BEFORE UPDATE ON flag_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_soft_delete_columns();
