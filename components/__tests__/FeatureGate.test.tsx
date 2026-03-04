// components/__tests__/FeatureGate.test.tsx
// Test suite for FeatureGate component with tier-based and feature-based gating

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureGate, FEATURES } from '@/components/FeatureGate'

// ============================================
// Mocks
// ============================================

// Mock useUser with controllable tier state
let mockIsTierAtLeast: (requiredTier: string) => boolean = () => true
let mockTierLoading = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    isTierAtLeast: mockIsTierAtLeast,
    tierLoading: mockTierLoading,
  }),
}))

// Mock useFeature with controllable feature state
let mockIsEnabled = true
let mockIsLoading = false

vi.mock('@/lib/features/useFeature', () => ({
  useFeature: () => ({
    isEnabled: mockIsEnabled,
    isLoading: mockIsLoading,
  }),
  FEATURES: {
    PATIENT_CHECKIN: 'patient_checkin',
  },
}))

// Mock next/link (UpgradePrompt uses it)
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ============================================
// Tests
// ============================================

describe('FeatureGate', () => {
  beforeEach(() => {
    // Reset mocks
    mockIsTierAtLeast = () => true
    mockTierLoading = false
    mockIsEnabled = true
    mockIsLoading = false
  })

  // ============================================
  // UNIT TESTS: Tier-based gating (mode variations)
  // ============================================

  describe('Tier-based gating - mode="hide"', () => {
    it('renders children when tier meets requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional'

      render(
        <FeatureGate requires="professional" mode="hide">
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Professional Content')).toBeDefined()
    })

    it('hides children when tier is below requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate requires="professional" mode="hide">
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Professional Content')).toBeNull()
    })

    it('shows fallback when tier is below requirement and fallback is provided', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate requires="professional" mode="hide" fallback={<div>Upgrade to access</div>}>
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Professional Content')).toBeNull()
      expect(screen.getByText('Upgrade to access')).toBeDefined()
    })

    it('shows nothing when tier is loading', () => {
      mockTierLoading = true

      render(
        <FeatureGate requires="professional" mode="hide">
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Professional Content')).toBeNull()
    })
  })

  describe('Tier-based gating - mode="lock"', () => {
    it('renders LockedContent (greyed out with lock icon) when tier is below requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      const { container } = render(
        <FeatureGate requires="professional" mode="lock">
          <div>Professional Content</div>
        </FeatureGate>
      )

      // Content is still rendered but greyed out
      expect(screen.getByText('Professional Content')).toBeDefined()

      // Check for lock icon and tier badge
      const lockedContainer = container.querySelector('.opacity-50.pointer-events-none')
      expect(lockedContainer).toBeDefined()

      // Check for "Pro" badge (Professional shortens to Pro)
      expect(screen.getByText('Pro')).toBeDefined()
    })

    it('passes through children normally when tier meets requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional'

      const { container } = render(
        <FeatureGate requires="professional" mode="lock">
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Professional Content')).toBeDefined()

      // Should NOT have locked styling
      const lockedContainer = container.querySelector('.opacity-50.pointer-events-none')
      expect(lockedContainer).toBeNull()
    })

    it('shows "Enterprise" badge for enterprise tier requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional'

      render(
        <FeatureGate requires="enterprise" mode="lock">
          <div>Enterprise Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Enterprise')).toBeDefined()
    })
  })

  describe('Tier-based gating - mode="blur"', () => {
    it('renders BlurredContent with UpgradePrompt overlay when tier is below requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      const { container } = render(
        <FeatureGate requires="professional" mode="blur">
          <div>Professional Content</div>
        </FeatureGate>
      )

      // Content is still rendered but blurred
      expect(screen.getByText('Professional Content')).toBeDefined()

      // Check for blur styling
      const blurredDiv = container.querySelector('.blur-\\[6px\\]')
      expect(blurredDiv).toBeDefined()

      // Check for UpgradePrompt overlay
      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
      expect(screen.getByText('View Plans')).toBeDefined()
    })

    it('shows custom upgrade message when provided', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate
          requires="professional"
          mode="blur"
          upgradeMessage="Unlock financial analytics"
        >
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Unlock financial analytics')).toBeDefined()
    })

    it('passes through children normally when tier meets requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional'

      const { container } = render(
        <FeatureGate requires="professional" mode="blur">
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Professional Content')).toBeDefined()

      // Should NOT have blur styling
      const blurredDiv = container.querySelector('.blur-\\[6px\\]')
      expect(blurredDiv).toBeNull()
    })
  })

  describe('Tier-based gating - mode="locked-tab"', () => {
    it('renders LockedTab (lock icon + tier badge) when tier is below requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate requires="professional" mode="locked-tab">
          <div>Tab Content</div>
        </FeatureGate>
      )

      // Children should NOT render
      expect(screen.queryByText('Tab Content')).toBeNull()

      // Should show lock icon and tier badge
      expect(screen.getByText('Pro')).toBeDefined()
    })

    it('passes through children when tier meets requirement', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional'

      render(
        <FeatureGate requires="professional" mode="locked-tab">
          <div>Tab Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Tab Content')).toBeDefined()
    })
  })

  // ============================================
  // UNIT TESTS: Feature-based gating (legacy)
  // ============================================

  describe('Feature-based gating (legacy)', () => {
    it('renders children when feature is enabled', () => {
      mockIsEnabled = true

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
          <div>Check-In Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Check-In Content')).toBeDefined()
    })

    it('hides children when feature is disabled', () => {
      mockIsEnabled = false

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
          <div>Check-In Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Check-In Content')).toBeNull()
    })

    it('shows legacy upgrade prompt when showUpgrade=true and feature is disabled', () => {
      mockIsEnabled = false

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN} showUpgrade>
          <div>Check-In Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Check-In Content')).toBeNull()
      expect(screen.getByText('Patient Check-In')).toBeDefined()
      expect(screen.getByText('View Available Add-Ons')).toBeDefined()
    })

    it('shows custom upgrade message in legacy prompt', () => {
      mockIsEnabled = false

      render(
        <FeatureGate
          feature={FEATURES.PATIENT_CHECKIN}
          showUpgrade
          upgradeMessage="Custom feature message"
        >
          <div>Check-In Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Custom feature message')).toBeDefined()
    })

    it('shows nothing when feature is loading', () => {
      mockIsLoading = true

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
          <div>Check-In Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Check-In Content')).toBeNull()
    })
  })

  // ============================================
  // INTEGRATION TESTS: Combined feature + tier gating
  // ============================================

  describe('Combined feature + tier gating', () => {
    it('requires both feature AND tier to pass', () => {
      mockIsEnabled = true
      mockIsTierAtLeast = (tier) => tier === 'professional'

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN} requires="professional">
          <div>Combined Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Combined Content')).toBeDefined()
    })

    it('blocks when feature is disabled even if tier passes', () => {
      mockIsEnabled = false
      mockIsTierAtLeast = (tier) => tier === 'professional'

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN} requires="professional">
          <div>Combined Content</div>
        </FeatureGate>
      )

      expect(screen.queryByText('Combined Content')).toBeNull()
    })

    it('blocks when tier is insufficient even if feature is enabled', () => {
      mockIsEnabled = true
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN} requires="professional" mode="blur">
          <div>Combined Content</div>
        </FeatureGate>
      )

      // Content is blurred (tier denial takes precedence for rendering)
      expect(screen.getByText('Combined Content')).toBeDefined()
      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
    })

    it('shows tier-aware denial when tier blocks (not feature-aware denial)', () => {
      mockIsEnabled = true
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate
          feature={FEATURES.PATIENT_CHECKIN}
          requires="professional"
          mode="blur"
          showUpgrade
        >
          <div>Combined Content</div>
        </FeatureGate>
      )

      // Should show tier upgrade prompt, NOT feature upgrade prompt
      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
      expect(screen.queryByText('Patient Check-In')).toBeNull()
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge cases', () => {
    it('renders children when no feature or tier requirement is specified', () => {
      render(
        <FeatureGate>
          <div>Open Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Open Content')).toBeDefined()
    })

    it('handles enterprise tier requirement correctly', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional'

      render(
        <FeatureGate requires="enterprise" mode="lock">
          <div>Enterprise Content</div>
        </FeatureGate>
      )

      // Professional tier cannot access Enterprise content
      expect(screen.getByText('Enterprise Content')).toBeDefined()
      expect(screen.getByText('Enterprise')).toBeDefined() // badge shown
    })

    it('allows enterprise tier to access professional content', () => {
      mockIsTierAtLeast = () => true // Enterprise tier passes all checks

      render(
        <FeatureGate requires="professional" mode="lock">
          <div>Professional Content</div>
        </FeatureGate>
      )

      expect(screen.getByText('Professional Content')).toBeDefined()

      // Should NOT show lock badge (access granted)
      expect(screen.queryByText('Pro')).toBeNull()
    })

    it('defaults to mode="hide" when mode is not specified', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'

      render(
        <FeatureGate requires="professional">
          <div>Professional Content</div>
        </FeatureGate>
      )

      // Content should be hidden (not blurred, not locked)
      expect(screen.queryByText('Professional Content')).toBeNull()
      expect(screen.queryByText('Upgrade to Professional')).toBeNull()
    })
  })
})
