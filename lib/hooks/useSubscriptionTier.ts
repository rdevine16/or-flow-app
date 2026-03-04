// lib/hooks/useSubscriptionTier.ts
// Fetches the subscription tier for a facility by joining facilities → subscription_plans.
// Returns the tier slug, feature access, and comparison utilities.
//
// Usage:
//   const { tier, tierName, features, loading, isTierAtLeast } = useSubscriptionTier(facilityId)
//   if (isTierAtLeast('professional')) { ... }

'use client'

import { useCallback } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import {
  type TierSlug,
  type TierFeatureKey,
  isTierAtLeast as isTierAtLeastUtil,
  getTierName,
  TIER_DEFINITIONS,
} from '@/lib/tier-config'

// ============================================
// Types
// ============================================

interface SubscriptionPlanRow {
  slug: string
  name: string
  features: Record<string, boolean>
}

interface FacilityPlanRow {
  subscription_plan_id: string | null
  // Supabase returns FK joins as arrays or single objects depending on the relationship
  subscription_plans: SubscriptionPlanRow | SubscriptionPlanRow[] | null
}

export interface UseSubscriptionTierReturn {
  /** The current tier slug (defaults to 'enterprise' if not set) */
  tier: TierSlug
  /** Display name (e.g. "Professional") */
  tierName: string
  /** Feature access map from the DB plan */
  features: Record<TierFeatureKey, boolean>
  /** Whether the tier data is still loading */
  loading: boolean
  /** Check if the facility's tier meets or exceeds the required tier */
  isTierAtLeast: (requiredTier: TierSlug) => boolean
  /** Check if a specific feature category is enabled */
  hasFeature: (feature: TierFeatureKey) => boolean
}

// ============================================
// Hook
// ============================================

/**
 * Fetch the subscription tier for a facility.
 *
 * Defaults to 'enterprise' when:
 * - No facility ID provided
 * - Facility has no plan assigned
 * - Data is still loading (optimistic default)
 *
 * This ensures existing facilities (all defaulted to Enterprise in migration)
 * and global admins see full access.
 */
export function useSubscriptionTier(facilityId: string | null): UseSubscriptionTierReturn {
  const { data, loading } = useSupabaseQuery<FacilityPlanRow | null>(
    async (supabase) => {
      if (!facilityId) return null

      const { data: facility, error } = await supabase
        .from('facilities')
        .select(`
          subscription_plan_id,
          subscription_plans (slug, name, features)
        `)
        .eq('id', facilityId)
        .single()

      if (error) throw error
      return facility as unknown as FacilityPlanRow | null
    },
    {
      deps: [facilityId],
      enabled: !!facilityId,
    },
  )

  // Resolve the tier — default to enterprise if no plan set
  // Handle both array and single object from Supabase join
  const rawPlan = data?.subscription_plans
  const planData = Array.isArray(rawPlan) ? rawPlan[0] ?? null : rawPlan
  const tier: TierSlug = (planData?.slug as TierSlug) ?? 'enterprise'
  const tierName = planData?.name ?? getTierName(tier)
  const features = (planData?.features as Record<TierFeatureKey, boolean>) ??
    TIER_DEFINITIONS[tier].features

  const isTierAtLeast = useCallback(
    (requiredTier: TierSlug) => isTierAtLeastUtil(tier, requiredTier),
    [tier],
  )

  const hasFeature = useCallback(
    (feature: TierFeatureKey) => features[feature] ?? false,
    [features],
  )

  return {
    tier,
    tierName,
    features,
    loading,
    isTierAtLeast,
    hasFeature,
  }
}
