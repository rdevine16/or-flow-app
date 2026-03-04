// lib/tier-config.ts
// Subscription tier configuration — single source of truth for tier hierarchy,
// feature mappings, and comparison utilities.
//
// The features map mirrors the JSONB `features` column in `subscription_plans`.
// When checking feature access, prefer `isTierAtLeast()` for tier-level gating
// and `can()` for permission-level gating.

// ============================================
// Types
// ============================================

export type TierSlug = 'essential' | 'professional' | 'enterprise'

export type TierFeatureKey =
  | 'analytics'
  | 'financials'
  | 'flags'
  | 'orbit_score'
  | 'data_quality'
  | 'spd'
  | 'integrations'

export interface TierDefinition {
  slug: TierSlug
  name: string
  description: string
  priceMonthly: number
  sortOrder: number
  features: Record<TierFeatureKey, boolean>
}

// ============================================
// Tier Hierarchy (ascending order)
// ============================================

const TIER_ORDER: Record<TierSlug, number> = {
  essential: 1,
  professional: 2,
  enterprise: 3,
} as const

/**
 * Check if `currentTier` meets or exceeds `requiredTier`.
 *
 * Usage:
 *   isTierAtLeast('essential', 'professional') // false
 *   isTierAtLeast('enterprise', 'professional') // true
 */
export function isTierAtLeast(currentTier: TierSlug, requiredTier: TierSlug): boolean {
  return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier]
}

// ============================================
// Tier Definitions (mirrors DB seed data)
// ============================================

export const TIER_DEFINITIONS: Record<TierSlug, TierDefinition> = {
  essential: {
    slug: 'essential',
    name: 'Essential',
    description: 'Day-of surgical flow with patient tracking.',
    priceMonthly: 750,
    sortOrder: 1,
    features: {
      analytics: false,
      financials: false,
      flags: false,
      orbit_score: false,
      data_quality: false,
      spd: false,
      integrations: false,
    },
  },
  professional: {
    slug: 'professional',
    name: 'Professional',
    description: 'Full analytics suite with scoring, flags, and data quality.',
    priceMonthly: 1500,
    sortOrder: 2,
    features: {
      analytics: true,
      financials: false,
      flags: true,
      orbit_score: true,
      data_quality: true,
      spd: true,
      integrations: false,
    },
  },
  enterprise: {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Complete platform with financials, EHR integrations, and unlimited customization.',
    priceMonthly: 2500,
    sortOrder: 3,
    features: {
      analytics: true,
      financials: true,
      flags: true,
      orbit_score: true,
      data_quality: true,
      spd: true,
      integrations: true,
    },
  },
} as const

/**
 * All tier slugs in ascending order.
 */
export const TIER_SLUGS: TierSlug[] = ['essential', 'professional', 'enterprise']

/**
 * Get the display name for a tier (e.g. "Professional").
 */
export function getTierName(slug: TierSlug): string {
  return TIER_DEFINITIONS[slug].name
}

/**
 * Check if a specific feature is enabled for a tier.
 */
export function isTierFeatureEnabled(tier: TierSlug, feature: TierFeatureKey): boolean {
  return TIER_DEFINITIONS[tier].features[feature]
}

/**
 * Get the minimum tier required for a feature.
 * Returns null if no tier enables the feature (shouldn't happen with current config).
 */
export function getMinimumTierForFeature(feature: TierFeatureKey): TierSlug | null {
  for (const slug of TIER_SLUGS) {
    if (TIER_DEFINITIONS[slug].features[feature]) {
      return slug
    }
  }
  return null
}
