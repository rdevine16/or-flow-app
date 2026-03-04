// components/__tests__/FeatureGate-workflow.test.tsx
// Workflow tests for FeatureGate — end-to-end tier gating scenarios

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureGate, FEATURES } from '@/components/FeatureGate'

// ============================================
// Mocks
// ============================================

let mockIsTierAtLeast: (requiredTier: string) => boolean = () => true
let mockTierLoading = false
let mockIsEnabled = true
let mockIsLoading = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    isTierAtLeast: mockIsTierAtLeast,
    tierLoading: mockTierLoading,
  }),
}))

vi.mock('@/lib/features/useFeature', () => ({
  useFeature: () => ({
    isEnabled: mockIsEnabled,
    isLoading: mockIsLoading,
  }),
  FEATURES: {
    PATIENT_CHECKIN: 'patient_checkin',
  },
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ============================================
// Workflow Scenarios
// ============================================

describe('FeatureGate Workflow Tests', () => {
  beforeEach(() => {
    mockIsTierAtLeast = () => true
    mockTierLoading = false
    mockIsEnabled = true
    mockIsLoading = false
  })

  // ============================================
  // Workflow: Essential tier user encounters Professional-gated content
  // ============================================

  describe('Workflow: Essential → Professional upgrade flow', () => {
    beforeEach(() => {
      // Essential tier: only passes 'essential' check
      mockIsTierAtLeast = (tier) => tier === 'essential'
    })

    it('Step 1: User sees blurred analytics card with upgrade prompt', () => {
      const { container } = render(
        <FeatureGate requires="professional" mode="blur">
          <div data-testid="analytics-card">
            <h3>Surgeon Performance</h3>
            <p>Average OR time: 45 min</p>
            <p>Cases completed: 120</p>
          </div>
        </FeatureGate>
      )

      // Content is rendered but blurred
      expect(screen.getByTestId('analytics-card')).toBeDefined()
      expect(screen.getByText('Surgeon Performance')).toBeDefined()

      // Blur styling applied
      const blurredDiv = container.querySelector('.blur-\\[6px\\]')
      expect(blurredDiv).toBeDefined()

      // Upgrade prompt overlay
      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
      expect(screen.getByText('View Plans')).toBeDefined()
    })

    it('Step 2: User sees locked sidebar menu item with tier badge', () => {
      render(
        <FeatureGate requires="professional" mode="lock">
          <a href="/analytics/financials" className="nav-item">
            Financial Analytics
          </a>
        </FeatureGate>
      )

      // Menu item is rendered but locked
      expect(screen.getByText('Financial Analytics')).toBeDefined()

      // Lock icon and "Pro" badge visible
      expect(screen.getByText('Pro')).toBeDefined()

      // Item is non-interactive
      const navItem = screen.getByText('Financial Analytics').closest('div')
      expect(navItem?.className).toContain('opacity-50')
      expect(navItem?.className).toContain('pointer-events-none')
    })

    it('Step 3: User sees hidden tab (flags not available)', () => {
      render(
        <FeatureGate requires="professional" mode="hide">
          <button>Flags</button>
        </FeatureGate>
      )

      // Tab is completely hidden
      expect(screen.queryByText('Flags')).toBeNull()
    })

    it('Step 4: User sees locked tab with tooltip hint', () => {
      const { container } = render(
        <FeatureGate requires="professional" mode="locked-tab">
          <button>ORbit Score</button>
        </FeatureGate>
      )

      // Tab content is NOT rendered
      expect(screen.queryByText('ORbit Score')).toBeNull()

      // Lock icon + tier badge shown instead
      expect(screen.getByText('Pro')).toBeDefined()

      // Tooltip hint on hover
      const lockedTab = container.querySelector('[title]')
      expect(lockedTab?.getAttribute('title')).toBe('Upgrade to Professional to access this tab')
    })
  })

  // ============================================
  // Workflow: Professional tier user encounters Enterprise-gated content
  // ============================================

  describe('Workflow: Professional → Enterprise upgrade flow', () => {
    beforeEach(() => {
      // Professional tier: passes 'essential' and 'professional' checks
      mockIsTierAtLeast = (tier) => tier === 'essential' || tier === 'professional'
    })

    it('Step 1: User sees blurred financial projection with enterprise upgrade prompt', () => {
      const { container } = render(
        <FeatureGate
          requires="enterprise"
          mode="blur"
          upgradeMessage="Unlock detailed cost analysis and margin tracking"
        >
          <div data-testid="financial-projection">
            <h4>Projected Margin</h4>
            <p>$125,000 per quarter</p>
          </div>
        </FeatureGate>
      )

      // Content is blurred
      expect(screen.getByTestId('financial-projection')).toBeDefined()
      const blurredDiv = container.querySelector('.blur-\\[6px\\]')
      expect(blurredDiv).toBeDefined()

      // Enterprise upgrade prompt with custom message
      expect(screen.getByText('Upgrade to Enterprise')).toBeDefined()
      expect(screen.getByText('Unlock detailed cost analysis and margin tracking')).toBeDefined()
    })

    it('Step 2: User sees locked integration settings', () => {
      render(
        <FeatureGate requires="enterprise" mode="lock">
          <div>EHR Integration Settings</div>
        </FeatureGate>
      )

      // Content is locked (greyed out)
      expect(screen.getByText('EHR Integration Settings')).toBeDefined()
      expect(screen.getByText('Enterprise')).toBeDefined()
    })
  })

  // ============================================
  // Workflow: Enterprise tier user has full access
  // ============================================

  describe('Workflow: Enterprise tier has unrestricted access', () => {
    beforeEach(() => {
      // Enterprise tier: passes ALL tier checks
      mockIsTierAtLeast = () => true
    })

    it('Step 1: User sees all analytics without restrictions', () => {
      const { container } = render(
        <FeatureGate requires="professional" mode="blur">
          <div data-testid="analytics-card">Surgeon Performance</div>
        </FeatureGate>
      )

      // Content is NOT blurred
      expect(screen.getByTestId('analytics-card')).toBeDefined()
      const blurredDiv = container.querySelector('.blur-\\[6px\\]')
      expect(blurredDiv).toBeNull()

      // No upgrade prompt
      expect(screen.queryByText('Upgrade to Professional')).toBeNull()
    })

    it('Step 2: User sees all financial analytics without restrictions', () => {
      const { container } = render(
        <FeatureGate requires="enterprise" mode="blur">
          <div data-testid="financial-projection">Projected Margin</div>
        </FeatureGate>
      )

      // Content is NOT blurred
      expect(screen.getByTestId('financial-projection')).toBeDefined()
      const blurredDiv = container.querySelector('.blur-\\[6px\\]')
      expect(blurredDiv).toBeNull()
    })

    it('Step 3: User sees all sidebar items unlocked', () => {
      const { container } = render(
        <FeatureGate requires="professional" mode="lock">
          <a href="/analytics/financials">Financial Analytics</a>
        </FeatureGate>
      )

      // No lock styling
      const lockedContainer = container.querySelector('.opacity-50.pointer-events-none')
      expect(lockedContainer).toBeNull()

      // No tier badge
      expect(screen.queryByText('Pro')).toBeNull()
    })
  })

  // ============================================
  // Workflow: Combined feature + tier gating
  // ============================================

  describe('Workflow: Feature trial + tier gating interaction', () => {
    it('Step 1: User on Essential tier with Patient Check-In feature ENABLED', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'
      mockIsEnabled = true

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
          <div>Patient Check-In Content</div>
        </FeatureGate>
      )

      // Feature is enabled, tier is sufficient (no tier requirement)
      expect(screen.getByText('Patient Check-In Content')).toBeDefined()
    })

    it('Step 2: User on Essential tier with Patient Check-In feature DISABLED', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'
      mockIsEnabled = false

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN} showUpgrade>
          <div>Patient Check-In Content</div>
        </FeatureGate>
      )

      // Content is hidden
      expect(screen.queryByText('Patient Check-In Content')).toBeNull()

      // Legacy feature upgrade prompt shown
      expect(screen.getByText('Patient Check-In')).toBeDefined()
      expect(screen.getByText('View Available Add-Ons')).toBeDefined()
    })

    it('Step 3: User on Essential tier with feature enabled BUT tier insufficient', () => {
      mockIsTierAtLeast = (tier) => tier === 'essential'
      mockIsEnabled = true

      render(
        <FeatureGate
          feature={FEATURES.PATIENT_CHECKIN}
          requires="professional"
          mode="blur"
        >
          <div>Advanced Check-In Features</div>
        </FeatureGate>
      )

      // Content is blurred (tier blocks even though feature is enabled)
      expect(screen.getByText('Advanced Check-In Features')).toBeDefined()
      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
    })

    it('Step 4: User on Professional tier with feature enabled', () => {
      mockIsTierAtLeast = (tier) => tier === 'professional' || tier === 'essential'
      mockIsEnabled = true

      render(
        <FeatureGate
          feature={FEATURES.PATIENT_CHECKIN}
          requires="professional"
          mode="blur"
        >
          <div>Advanced Check-In Features</div>
        </FeatureGate>
      )

      // Both feature and tier pass — content is accessible
      expect(screen.getByText('Advanced Check-In Features')).toBeDefined()
      expect(screen.queryByText('Upgrade to Professional')).toBeNull()
    })
  })

  // ============================================
  // Workflow: Loading states
  // ============================================

  describe('Workflow: Loading states during tier check', () => {
    it('Step 1: Shows nothing while tier data is loading', () => {
      mockTierLoading = true

      render(
        <FeatureGate requires="professional">
          <div>Content</div>
        </FeatureGate>
      )

      // Nothing renders during loading
      expect(screen.queryByText('Content')).toBeNull()
      expect(screen.queryByText('Upgrade to Professional')).toBeNull()
    })

    it('Step 2: Shows nothing while feature data is loading', () => {
      mockIsLoading = true

      render(
        <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
          <div>Content</div>
        </FeatureGate>
      )

      // Nothing renders during loading
      expect(screen.queryByText('Content')).toBeNull()
    })

    it('Step 3: Shows content once tier data loads and tier is sufficient', () => {
      mockTierLoading = false
      mockIsTierAtLeast = () => true

      render(
        <FeatureGate requires="professional">
          <div>Content</div>
        </FeatureGate>
      )

      // Content renders after loading completes
      expect(screen.getByText('Content')).toBeDefined()
    })
  })
})
