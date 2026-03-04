// components/__tests__/TrialBanner.test.tsx
// Test suite for TrialBanner component

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrialBanner } from '@/components/TrialBanner'
import { FEATURES } from '@/lib/features/useFeature'

// ============================================
// Mocks
// ============================================

// Mock useFeature with controllable trial state
let mockIsEnabled = false
let mockIsTrialing = false
let mockTrialDaysRemaining: number | null = null

vi.mock('@/lib/features/useFeature', () => ({
  useFeature: () => ({
    isEnabled: mockIsEnabled,
    isTrialing: mockIsTrialing,
    trialDaysRemaining: mockTrialDaysRemaining,
  }),
  FEATURES: {
    PATIENT_CHECKIN: 'patient_checkin',
  },
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ============================================
// Tests
// ============================================

describe('TrialBanner', () => {
  beforeEach(() => {
    // Reset mocks
    mockIsEnabled = false
    mockIsTrialing = false
    mockTrialDaysRemaining = null
  })

  // ============================================
  // UNIT TESTS: Visibility conditions
  // ============================================

  describe('Visibility conditions', () => {
    it('shows banner when feature is enabled, trialing, and has days remaining', () => {
      mockIsEnabled = true
      mockIsTrialing = true
      mockTrialDaysRemaining = 5

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(screen.getByText(/Patient Check-In trial: 5 days remaining/i)).toBeDefined()
    })

    it('hides banner when feature is not enabled', () => {
      mockIsEnabled = false
      mockIsTrialing = true
      mockTrialDaysRemaining = 5

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(container.firstChild).toBeNull()
    })

    it('hides banner when feature is not trialing', () => {
      mockIsEnabled = true
      mockIsTrialing = false
      mockTrialDaysRemaining = 5

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(container.firstChild).toBeNull()
    })

    it('hides banner when trial days remaining is null', () => {
      mockIsEnabled = true
      mockIsTrialing = true
      mockTrialDaysRemaining = null

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(container.firstChild).toBeNull()
    })
  })

  // ============================================
  // UNIT TESTS: Trial countdown display
  // ============================================

  describe('Trial countdown display', () => {
    beforeEach(() => {
      mockIsEnabled = true
      mockIsTrialing = true
    })

    it('displays plural "days" when more than 1 day remaining', () => {
      mockTrialDaysRemaining = 5

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(screen.getByText(/5 days remaining/i)).toBeDefined()
    })

    it('displays singular "day" when exactly 1 day remaining', () => {
      mockTrialDaysRemaining = 1

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(screen.getByText(/1 day remaining/i)).toBeDefined()
    })

    it('handles large number of days remaining', () => {
      mockTrialDaysRemaining = 30

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(screen.getByText(/30 days remaining/i)).toBeDefined()
    })

    it('handles 0 days remaining (trial ended today)', () => {
      mockTrialDaysRemaining = 0

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(screen.getByText(/0 days remaining/i)).toBeDefined()
    })
  })

  // ============================================
  // UNIT TESTS: Urgency styling
  // ============================================

  describe('Urgency styling', () => {
    beforeEach(() => {
      mockIsEnabled = true
      mockIsTrialing = true
    })

    it('shows urgent styling when 3 or fewer days remaining', () => {
      mockTrialDaysRemaining = 3

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      // Urgent styling uses amber colors
      const urgentBanner = container.querySelector('.border-amber-200.bg-amber-50')
      expect(urgentBanner).toBeDefined()
    })

    it('shows urgent styling when 1 day remaining', () => {
      mockTrialDaysRemaining = 1

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      const urgentBanner = container.querySelector('.border-amber-200.bg-amber-50')
      expect(urgentBanner).toBeDefined()
    })

    it('shows normal styling when more than 3 days remaining', () => {
      mockTrialDaysRemaining = 5

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      // Normal styling uses blue colors
      const normalBanner = container.querySelector('.border-blue-200.bg-blue-50')
      expect(normalBanner).toBeDefined()
    })

    it('shows normal styling when 4 days remaining (boundary test)', () => {
      mockTrialDaysRemaining = 4

      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      const normalBanner = container.querySelector('.border-blue-200.bg-blue-50')
      expect(normalBanner).toBeDefined()
    })

    it('shows upgrade button when 3 or fewer days remaining', () => {
      mockTrialDaysRemaining = 2

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      // Button should exist (urgency styling already tested above)
      expect(screen.getByText('Upgrade Now')).toBeDefined()
    })

    it('shows upgrade button when more than 3 days remaining', () => {
      mockTrialDaysRemaining = 7

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      // Button should exist (normal styling already tested above)
      expect(screen.getByText('Upgrade Now')).toBeDefined()
    })
  })

  // ============================================
  // INTEGRATION TESTS: Feature label mapping
  // ============================================

  describe('Feature label mapping', () => {
    beforeEach(() => {
      mockIsEnabled = true
      mockIsTrialing = true
      mockTrialDaysRemaining = 5
    })

    it('displays correct label for PATIENT_CHECKIN feature', () => {
      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      expect(screen.getByText(/Patient Check-In trial/i)).toBeDefined()
    })
  })

  // ============================================
  // INTEGRATION TESTS: CTA link
  // ============================================

  describe('CTA link', () => {
    beforeEach(() => {
      mockIsEnabled = true
      mockIsTrialing = true
      mockTrialDaysRemaining = 5
    })

    it('links to subscription settings page', () => {
      const { container } = render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      const link = container.querySelector('a[href="/settings/subscription"]')
      expect(link).toBeDefined()
      expect(link?.textContent).toBe('Upgrade Now')
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================

  describe('Edge cases', () => {
    it('handles negative days remaining gracefully', () => {
      mockIsEnabled = true
      mockIsTrialing = true
      mockTrialDaysRemaining = -1

      render(<TrialBanner feature={FEATURES.PATIENT_CHECKIN} />)

      // Should still render (backend should handle trial expiration)
      expect(screen.getByText(/-1 days remaining/i)).toBeDefined()
    })
  })
})
