-- Financial Targets: per-month profit targets per facility
-- Used by the financial analytics overview to show target progress

CREATE TABLE IF NOT EXISTS financial_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  year smallint NOT NULL CHECK (year >= 2020 AND year <= 2099),
  month smallint NOT NULL CHECK (month >= 1 AND month <= 12),
  profit_target numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (facility_id, year, month)
);

-- RLS
ALTER TABLE financial_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their facility targets"
  ON financial_targets FOR SELECT
  USING (facility_id IN (SELECT facility_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage their facility targets"
  ON financial_targets FOR ALL
  USING (facility_id IN (SELECT facility_id FROM users WHERE id = auth.uid()))
  WITH CHECK (facility_id IN (SELECT facility_id FROM users WHERE id = auth.uid()));

-- Updated_at trigger (uses existing project function)
CREATE TRIGGER set_financial_targets_updated_at
  BEFORE UPDATE ON financial_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_financial_targets_facility_year_month
  ON financial_targets (facility_id, year, month);
