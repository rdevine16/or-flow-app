import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSubscriptionTier } from '../useSubscriptionTier'

// ============================================
// MOCKS
// ============================================

let mockFacilityData: unknown | null = null

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: vi.fn((queryFn, options) => {
    // If not enabled, return loading state
    if (options?.enabled === false) {
      return { data: null, loading: false }
    }

    // Simulate async data fetch
    return {
      data: mockFacilityData,
      loading: false,
    }
  }),
}))

// ============================================
// TESTS
// ============================================

describe('useSubscriptionTier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFacilityData = null
  })

  describe('Tier Resolution', () => {
    it('defaults to enterprise when no facility ID provided', () => {
      const { result } = renderHook(() => useSubscriptionTier(null))

      expect(result.current.tier).toBe('enterprise')
      expect(result.current.tierName).toBe('Enterprise')
      expect(result.current.loading).toBe(false)
    })

    it('defaults to enterprise when facility has no plan assigned', () => {
      mockFacilityData = {
        subscription_plan_id: null,
        subscription_plans: null,
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))

      expect(result.current.tier).toBe('enterprise')
      expect(result.current.tierName).toBe('Enterprise')
    })

    it('returns essential tier when facility has essential plan', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-essential',
        subscription_plans: {
          slug: 'essential',
          name: 'Essential',
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
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))

      expect(result.current.tier).toBe('essential')
      expect(result.current.tierName).toBe('Essential')
      expect(result.current.features.analytics).toBe(false)
      expect(result.current.features.financials).toBe(false)
    })

    it('returns professional tier when facility has professional plan', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
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
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))

      expect(result.current.tier).toBe('professional')
      expect(result.current.tierName).toBe('Professional')
      expect(result.current.features.analytics).toBe(true)
      expect(result.current.features.flags).toBe(true)
      expect(result.current.features.financials).toBe(false)
    })

    it('returns enterprise tier when facility has enterprise plan', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-enterprise',
        subscription_plans: {
          slug: 'enterprise',
          name: 'Enterprise',
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
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))

      expect(result.current.tier).toBe('enterprise')
      expect(result.current.tierName).toBe('Enterprise')
      expect(result.current.features.financials).toBe(true)
      expect(result.current.features.integrations).toBe(true)
    })
  })

  describe('Supabase Join Handling', () => {
    it('handles subscription_plans as single object (many-to-one FK)', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
          features: { analytics: true, financials: false, flags: true, orbit_score: true, data_quality: true, spd: true, integrations: false },
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.tier).toBe('professional')
    })

    it('handles subscription_plans as array (extracts first element)', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: [
          {
            slug: 'professional',
            name: 'Professional',
            features: { analytics: true, financials: false, flags: true, orbit_score: true, data_quality: true, spd: true, integrations: false },
          },
        ],
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.tier).toBe('professional')
    })

    it('handles empty array from Supabase join (defaults to enterprise)', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-unknown',
        subscription_plans: [],
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.tier).toBe('enterprise')
    })
  })

  describe('isTierAtLeast Method', () => {
    it('returns true when facility tier meets required tier', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
          features: { analytics: true, financials: false, flags: true, orbit_score: true, data_quality: true, spd: true, integrations: false },
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.isTierAtLeast('professional')).toBe(true)
      expect(result.current.isTierAtLeast('essential')).toBe(true)
    })

    it('returns false when facility tier is below required tier', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-essential',
        subscription_plans: {
          slug: 'essential',
          name: 'Essential',
          features: { analytics: false, financials: false, flags: false, orbit_score: false, data_quality: false, spd: false, integrations: false },
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.isTierAtLeast('professional')).toBe(false)
      expect(result.current.isTierAtLeast('enterprise')).toBe(false)
    })

    it('returns true for enterprise default (no plan assigned)', () => {
      mockFacilityData = {
        subscription_plan_id: null,
        subscription_plans: null,
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.isTierAtLeast('enterprise')).toBe(true)
      expect(result.current.isTierAtLeast('professional')).toBe(true)
      expect(result.current.isTierAtLeast('essential')).toBe(true)
    })
  })

  describe('hasFeature Method', () => {
    it('returns true for enabled features', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
          features: { analytics: true, financials: false, flags: true, orbit_score: true, data_quality: true, spd: true, integrations: false },
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.hasFeature('analytics')).toBe(true)
      expect(result.current.hasFeature('flags')).toBe(true)
    })

    it('returns false for disabled features', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-essential',
        subscription_plans: {
          slug: 'essential',
          name: 'Essential',
          features: { analytics: false, financials: false, flags: false, orbit_score: false, data_quality: false, spd: false, integrations: false },
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.hasFeature('analytics')).toBe(false)
      expect(result.current.hasFeature('financials')).toBe(false)
    })

    it('defaults to false for missing features', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-custom',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
          features: {}, // Empty features object
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.hasFeature('analytics')).toBe(false)
      expect(result.current.hasFeature('financials')).toBe(false)
    })
  })

  describe('Loading State', () => {
    it('returns loading=false when data is available', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
          features: { analytics: true, financials: false, flags: true, orbit_score: true, data_quality: true, spd: true, integrations: false },
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.loading).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('handles facility with plan_id but missing subscription_plans join', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-unknown',
        subscription_plans: null,
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.tier).toBe('enterprise') // Default fallback
      expect(result.current.tierName).toBe('Enterprise')
    })

    it('handles malformed features object (uses tier definition fallback)', () => {
      mockFacilityData = {
        subscription_plan_id: 'plan-professional',
        subscription_plans: {
          slug: 'professional',
          name: 'Professional',
          features: null, // Invalid features
        },
      }

      const { result } = renderHook(() => useSubscriptionTier('facility-1'))
      expect(result.current.tier).toBe('professional')
      // Should fall back to TIER_DEFINITIONS[professional].features
      expect(result.current.features.analytics).toBe(true)
    })
  })
})
