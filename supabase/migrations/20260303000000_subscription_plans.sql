-- =============================================================================
-- Subscription Plans — Phase 1: Schema, Seed Data, Permission Sync
-- =============================================================================
-- Creates the 3-tier subscription model (Essential / Professional / Enterprise)
-- that gates features per facility. Tier changes auto-sync facility_permissions
-- via trigger, so existing can() checks "just work."
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. subscription_plans — Tier definitions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort ON subscription_plans(sort_order);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read plans (needed for tier hooks, upgrade prompts)
DROP POLICY IF EXISTS "Authenticated users can view subscription plans" ON subscription_plans;
CREATE POLICY "Authenticated users can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only global admins can modify plans
DROP POLICY IF EXISTS "Global admins can manage subscription plans" ON subscription_plans;
CREATE POLICY "Global admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (get_my_access_level() = 'global_admin')
  WITH CHECK (get_my_access_level() = 'global_admin');

-- ---------------------------------------------------------------------------
-- 2. Seed the 3 tiers
-- ---------------------------------------------------------------------------
-- features JSONB maps feature categories to booleans. The sync function
-- translates these to specific permission keys in facility_permissions.
--
-- Feature categories:
--   analytics     — Analytics pages (surgeon perf, block util, KPIs)
--   financials    — Financial analytics, case financial tab
--   flags         — Flag system (rules, case flags, flag tab)
--   orbit_score   — ORbit Score scorecards
--   data_quality  — Data quality detection, validation tab
--   spd           — SPD tracking
--   integrations  — EHR integrations (Epic, Cerner, MEDITECH)
-- ---------------------------------------------------------------------------

INSERT INTO subscription_plans (slug, name, description, price_monthly_cents, sort_order, features)
VALUES
  (
    'essential',
    'Essential',
    'Day-of surgical flow with patient tracking. Track patient in/out times, room status, and basic operational metrics.',
    75000,
    1,
    '{
      "analytics": false,
      "financials": false,
      "flags": false,
      "orbit_score": false,
      "data_quality": false,
      "spd": false,
      "integrations": false
    }'::JSONB
  ),
  (
    'professional',
    'Professional',
    'Full analytics suite with scoring, flags, and data quality. Unlock surgeon performance insights and operational optimization.',
    150000,
    2,
    '{
      "analytics": true,
      "financials": false,
      "flags": true,
      "orbit_score": true,
      "data_quality": true,
      "spd": true,
      "integrations": false
    }'::JSONB
  ),
  (
    'enterprise',
    'Enterprise',
    'Complete platform with financials, EHR integrations, and unlimited customization. Everything in Professional plus revenue analytics and system integrations.',
    250000,
    3,
    '{
      "analytics": true,
      "financials": true,
      "flags": true,
      "orbit_score": true,
      "data_quality": true,
      "spd": true,
      "integrations": true
    }'::JSONB
  )
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Add subscription_plan_id FK to facilities
-- ---------------------------------------------------------------------------

ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS subscription_plan_id UUID
    REFERENCES subscription_plans(id);

CREATE INDEX IF NOT EXISTS idx_facilities_subscription_plan
  ON facilities(subscription_plan_id);

-- Default all existing facilities to Enterprise (grandfathered)
UPDATE facilities
SET subscription_plan_id = (SELECT id FROM subscription_plans WHERE slug = 'enterprise')
WHERE subscription_plan_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4. sync_facility_permissions_for_tier() — Auto-sync permissions on tier change
-- ---------------------------------------------------------------------------
-- When a facility's subscription_plan_id changes, this function updates
-- facility_permissions to match the tier's feature set.
--
-- Mapping from tier features to permission keys:
--   analytics    → analytics.view, scores.view (scores also gated by orbit_score)
--   financials   → financials.view, tab.case_financials
--   flags        → flags.view, flags.create, flags.edit, flags.delete, tab.case_flags
--   orbit_score  → scores.view
--   data_quality → tab.case_validation
--
-- Only affects permissions that are tier-gated. Permissions like cases.view,
-- cases.create, milestones.*, scheduling.*, settings.*, etc. are NOT touched
-- — those remain under facility_admin control via the existing permissions UI.
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
  -- A permission is granted if its gating feature is true in the tier
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
    "tab.case_validation": "data_quality"
  }'::JSONB;

  -- For each tier-gated permission, update facility_permissions
  FOR v_permission_key, v_should_grant IN
    SELECT
      kv.key,
      COALESCE((v_features ->> (kv.value #>> '{}'))::BOOLEAN, false)
    FROM jsonb_each(v_tier_permission_map) AS kv
  LOOP
    -- Update all access levels for this facility + permission
    -- If the tier disables a feature, revoke the permission.
    -- If the tier enables it, grant it (respecting what was already there).
    UPDATE facility_permissions
    SET
      granted = CASE
        WHEN v_should_grant THEN granted  -- Keep existing grant state if tier allows
        ELSE false                        -- Revoke if tier doesn't include this feature
      END,
      updated_at = NOW()
    WHERE facility_id = NEW.id
      AND permission_key = v_permission_key
      AND (
        -- Only update rows that need changing:
        -- Revoke when tier disables (currently granted)
        (NOT v_should_grant AND granted = true)
      );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 5. Trigger on facilities — fires when subscription_plan_id changes
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sync_permissions_on_tier_change ON facilities;
CREATE TRIGGER trg_sync_permissions_on_tier_change
  AFTER UPDATE OF subscription_plan_id ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION sync_facility_permissions_for_tier();
