import { describe, it, expect } from 'vitest'
import {
  type TierSlug,
  type TierFeatureKey,
  isTierAtLeast,
  getTierName,
  isTierFeatureEnabled,
  getMinimumTierForFeature,
  TIER_SLUGS,
} from '../tier-config'

// ============================================
// TESTS — Tier Hierarchy Utilities
// ============================================

describe('tier-config', () => {
  describe('isTierAtLeast', () => {
    it('returns true when current tier equals required tier', () => {
      expect(isTierAtLeast('essential', 'essential')).toBe(true)
      expect(isTierAtLeast('professional', 'professional')).toBe(true)
      expect(isTierAtLeast('enterprise', 'enterprise')).toBe(true)
    })

    it('returns true when current tier exceeds required tier', () => {
      expect(isTierAtLeast('professional', 'essential')).toBe(true)
      expect(isTierAtLeast('enterprise', 'essential')).toBe(true)
      expect(isTierAtLeast('enterprise', 'professional')).toBe(true)
    })

    it('returns false when current tier is below required tier', () => {
      expect(isTierAtLeast('essential', 'professional')).toBe(false)
      expect(isTierAtLeast('essential', 'enterprise')).toBe(false)
      expect(isTierAtLeast('professional', 'enterprise')).toBe(false)
    })
  })

  describe('getTierName', () => {
    it('returns display name for each tier', () => {
      expect(getTierName('essential')).toBe('Essential')
      expect(getTierName('professional')).toBe('Professional')
      expect(getTierName('enterprise')).toBe('Enterprise')
    })
  })

  describe('isTierFeatureEnabled', () => {
    it('essential tier has no features enabled', () => {
      const features: TierFeatureKey[] = [
        'analytics',
        'financials',
        'flags',
        'orbit_score',
        'data_quality',
        'spd',
        'integrations',
      ]
      features.forEach((feature) => {
        expect(isTierFeatureEnabled('essential', feature)).toBe(false)
      })
    })

    it('professional tier enables analytics, flags, orbit_score, data_quality, spd', () => {
      expect(isTierFeatureEnabled('professional', 'analytics')).toBe(true)
      expect(isTierFeatureEnabled('professional', 'flags')).toBe(true)
      expect(isTierFeatureEnabled('professional', 'orbit_score')).toBe(true)
      expect(isTierFeatureEnabled('professional', 'data_quality')).toBe(true)
      expect(isTierFeatureEnabled('professional', 'spd')).toBe(true)
      // Disabled features
      expect(isTierFeatureEnabled('professional', 'financials')).toBe(false)
      expect(isTierFeatureEnabled('professional', 'integrations')).toBe(false)
    })

    it('enterprise tier enables all features', () => {
      const features: TierFeatureKey[] = [
        'analytics',
        'financials',
        'flags',
        'orbit_score',
        'data_quality',
        'spd',
        'integrations',
      ]
      features.forEach((feature) => {
        expect(isTierFeatureEnabled('enterprise', feature)).toBe(true)
      })
    })
  })

  describe('getMinimumTierForFeature', () => {
    it('returns professional for analytics (first tier to enable it)', () => {
      expect(getMinimumTierForFeature('analytics')).toBe('professional')
    })

    it('returns professional for flags', () => {
      expect(getMinimumTierForFeature('flags')).toBe('professional')
    })

    it('returns professional for orbit_score', () => {
      expect(getMinimumTierForFeature('orbit_score')).toBe('professional')
    })

    it('returns professional for data_quality', () => {
      expect(getMinimumTierForFeature('data_quality')).toBe('professional')
    })

    it('returns professional for spd', () => {
      expect(getMinimumTierForFeature('spd')).toBe('professional')
    })

    it('returns enterprise for financials (only tier to enable it)', () => {
      expect(getMinimumTierForFeature('financials')).toBe('enterprise')
    })

    it('returns enterprise for integrations (only tier to enable it)', () => {
      expect(getMinimumTierForFeature('integrations')).toBe('enterprise')
    })
  })

  describe('TIER_SLUGS', () => {
    it('contains all tiers in ascending order', () => {
      expect(TIER_SLUGS).toEqual(['essential', 'professional', 'enterprise'])
    })
  })

  describe('Tier Hierarchy Edge Cases', () => {
    it('handles all pairwise comparisons correctly', () => {
      const tiers: TierSlug[] = ['essential', 'professional', 'enterprise']

      // Every tier should be >= itself
      tiers.forEach((tier) => {
        expect(isTierAtLeast(tier, tier)).toBe(true)
      })

      // Essential is below all other tiers
      expect(isTierAtLeast('essential', 'professional')).toBe(false)
      expect(isTierAtLeast('essential', 'enterprise')).toBe(false)

      // Professional is above essential, below enterprise
      expect(isTierAtLeast('professional', 'essential')).toBe(true)
      expect(isTierAtLeast('professional', 'enterprise')).toBe(false)

      // Enterprise is above all
      expect(isTierAtLeast('enterprise', 'essential')).toBe(true)
      expect(isTierAtLeast('enterprise', 'professional')).toBe(true)
    })
  })
})
