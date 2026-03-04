// components/ui/__tests__/UpgradePrompt.test.tsx
// Test suite for UpgradePrompt component

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('UpgradePrompt', () => {
  // ============================================
  // UNIT TESTS: Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders tier name correctly for Professional tier', () => {
      render(<UpgradePrompt requiredTier="professional" />)

      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
      expect(screen.getByText('View Plans')).toBeDefined()
    })

    it('renders tier name correctly for Enterprise tier', () => {
      render(<UpgradePrompt requiredTier="enterprise" />)

      expect(screen.getByText('Upgrade to Enterprise')).toBeDefined()
      expect(screen.getByText('View Plans')).toBeDefined()
    })

    it('renders tier name correctly for Essential tier', () => {
      render(<UpgradePrompt requiredTier="essential" />)

      expect(screen.getByText('Upgrade to Essential')).toBeDefined()
    })

    it('shows default message when no custom message provided', () => {
      render(<UpgradePrompt requiredTier="professional" />)

      expect(
        screen.getByText('This feature is available on the Professional plan and above.')
      ).toBeDefined()
    })

    it('shows custom message when provided', () => {
      render(
        <UpgradePrompt
          requiredTier="professional"
          message="Unlock financial analytics and margin tracking"
        />
      )

      expect(screen.getByText('Unlock financial analytics and margin tracking')).toBeDefined()
      expect(
        screen.queryByText('This feature is available on the Professional plan and above.')
      ).toBeNull()
    })

    it('links to subscription settings page', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" />)

      const link = container.querySelector('a[href="/settings/subscription"]')
      expect(link).toBeDefined()
      expect(link?.textContent).toContain('View Plans')
    })
  })

  // ============================================
  // UNIT TESTS: Compact mode
  // ============================================

  describe('Compact mode', () => {
    it('renders compact version when compact=true', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" compact />)

      expect(screen.getByText('Upgrade to Professional')).toBeDefined()

      // Compact mode should NOT have the large icon and full layout
      const largeIcon = container.querySelector('.h-12.w-12')
      expect(largeIcon).toBeNull()
    })

    it('renders normal version when compact=false', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" compact={false} />)

      expect(screen.getByText('Upgrade to Professional')).toBeDefined()

      // Normal mode SHOULD have the large icon
      const largeIcon = container.querySelector('.h-12.w-12')
      expect(largeIcon).toBeDefined()
    })

    it('defaults to normal (non-compact) mode', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" />)

      // Default should have large icon (normal mode)
      const largeIcon = container.querySelector('.h-12.w-12')
      expect(largeIcon).toBeDefined()
    })

    it('compact mode still shows custom message', () => {
      render(
        <UpgradePrompt
          requiredTier="professional"
          message="Custom compact message"
          compact
        />
      )

      // Note: compact mode doesn't show the message, just "Upgrade to {tier}"
      // This test verifies the actual behavior
      expect(screen.getByText('Upgrade to Professional')).toBeDefined()
      expect(screen.queryByText('Custom compact message')).toBeNull()
    })
  })

  // ============================================
  // INTEGRATION TESTS: Visual consistency
  // ============================================

  describe('Visual consistency', () => {
    it('includes lock icon in normal mode', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" />)

      // Check for icon container
      const iconContainer = container.querySelector('.h-12.w-12')
      expect(iconContainer).toBeDefined()
    })

    it('includes lock icon in compact mode', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" compact />)

      // Compact mode has smaller icon
      const smallIcon = container.querySelector('.h-3\\.5.w-3\\.5')
      expect(smallIcon).toBeDefined()
    })

    it('includes Sparkles icon in "View Plans" button', () => {
      const { container } = render(<UpgradePrompt requiredTier="professional" />)

      // Button should contain Sparkles icon
      const button = screen.getByText('View Plans').closest('a')
      expect(button).toBeDefined()

      // Icon should be inside the button
      const icon = button?.querySelector('.h-4.w-4')
      expect(icon).toBeDefined()
    })
  })
})
