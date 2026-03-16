-- =============================================================================
-- Add Coordinator Plan + New Feature Keys (block_scheduling, staff_management)
-- =============================================================================
-- Adds a 4th subscription tier "Coordinator" focused on staff management and
-- block scheduling. Also adds block_scheduling and staff_management feature
-- keys to all existing plans.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Insert Coordinator plan
-- ---------------------------------------------------------------------------

INSERT INTO subscription_plans (slug, name, description, price_monthly_cents, sort_order, features)
VALUES (
  'coordinator',
  'Coordinator',
  'Staff management, block scheduling, and staff scheduling.',
  0,
  0,
  '{
    "block_scheduling": true,
    "staff_management": true,
    "analytics": false,
    "financials": false,
    "flags": false,
    "orbit_score": false,
    "data_quality": false,
    "spd": false,
    "integrations": false
  }'::JSONB
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Add block_scheduling + staff_management to existing plans
-- ---------------------------------------------------------------------------

UPDATE subscription_plans
SET features = features || '{"block_scheduling": true, "staff_management": true}'::JSONB
WHERE slug IN ('essential', 'professional', 'enterprise');

-- ---------------------------------------------------------------------------
-- 3. Update permission sync trigger to include scheduling permissions
-- ---------------------------------------------------------------------------
-- Add block_scheduling → scheduling.view mapping so coordinator tier
-- automatically gets scheduling permissions.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_facility_permissions_for_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_features JSONB;
  v_permission_key TEXT;
  v_should_grant BOOLEAN;
  v_tier_permission_map JSONB;
BEGIN
  -- Only fire when subscription_plan_id actually changes
  IF OLD.subscription_plan_id IS NOT DISTINCT FROM NEW.subscription_plan_id THEN
    RETURN NEW;
  END IF;

  -- Get the feature set for the new plan
  SELECT features INTO v_features
  FROM subscription_plans
  WHERE id = NEW.subscription_plan_id;

  -- If no plan found (shouldn't happen with FK), exit gracefully
  IF v_features IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map: permission_key → which feature category gates it
  v_tier_permission_map := '{
    "analytics.view": "analytics",
    "scores.view": "orbit_score",
    "financials.view": "financials",
    "tab.case_financials": "financials",
    "flags.view": "flags",
    "flags.create": "flags",
    "flags.edit": "flags",
    "flags.delete": "flags",
    "tab.case_flags": "flags",
    "tab.case_validation": "data_quality",
    "scheduling.view": "block_scheduling"
  }'::JSONB;

  FOR v_permission_key, v_should_grant IN
    SELECT
      kv.key,
      COALESCE((v_features ->> (kv.value #>> '{}'))::BOOLEAN, false)
    FROM jsonb_each(v_tier_permission_map) AS kv
  LOOP
    UPDATE facility_permissions
    SET
      granted = CASE
        WHEN v_should_grant THEN granted
        ELSE false
      END,
      updated_at = NOW()
    WHERE facility_id = NEW.id
      AND permission_key = v_permission_key
      AND (
        (NOT v_should_grant AND granted = true)
      );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
