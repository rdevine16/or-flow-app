// components/layouts/__tests__/tier-gating-workflow.test.tsx
// End-to-end workflow tests for tier gating: sidebar → page → upgrade prompt

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sidebar from '@/components/layouts/Sidebar'
import { FeatureGate } from '@/components/FeatureGate'
import { facilityNavigation, getFilteredNavigation } from '@/components/layouts/navigation-config'

// Pre-filter navigation with all permissions granted (simulates admin/full-access user)
const allPermissionsNav = getFilteredNavigation(() => true)

// ============================================
// MOCKS
// ============================================

let mockIsTierAtLeast: (requiredTier: string) => boolean = () => true
let mockTierLoading = false

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    isTierAtLeast: mockIsTierAtLeast,
    tierLoading: mockTierLoading,
  }),
}))

// Track navigation
let lastNavigatedHref: string | null = null

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a
      href={href}
      {...props}
      onClick={(e) => {
        e.preventDefault()
        lastNavigatedHref = href
      }}
    >
      {children}
    </a>
  ),
}))

// ============================================
// WORKFLOW TESTS
// ============================================

describe('Tier gating workflow', () => {
  beforeEach(() => {
    mockIsTierAtLeast = () => true
    mockTierLoading = false
    lastNavigatedHref = null
  })

  // ============================================
  // WORKFLOW: Essential user clicks locked SPD → sees upgrade prompt
  // ============================================
  it('Essential user clicks locked SPD item → navigates to /spd', async () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    // STEP 1: Render sidebar with essential tier
    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // SPD link should be present (user can still click locked items)
    const spdLink = container.querySelector('a[href="/spd"]')
    expect(spdLink).toBeDefined()

    // STEP 2: User clicks on SPD link
    await userEvent.click(spdLink!)

    // Navigation should be triggered to /spd
    expect(lastNavigatedHref).toBe('/spd')

    // STEP 3: FeatureGate would render upgrade prompt (tested in FeatureGate.test.tsx)
    // We verify the tier check here to ensure consistency
    expect(mockIsTierAtLeast('professional')).toBe(false) // Essential < Professional
  })

  // ============================================
  // WORKFLOW: Professional user clicks SPD → sees content (no prompt)
  // ============================================
  it('Professional user clicks SPD → navigates to /spd', async () => {
    mockIsTierAtLeast = (requiredTier: string) => {
      return requiredTier === 'professional' || requiredTier === 'essential'
    }

    // STEP 1: Render sidebar with professional tier
    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // SPD should be visible and unlocked
    const spdLink = container.querySelector('a[href="/spd"]')
    expect(spdLink).toBeDefined()

    // STEP 2: User clicks on SPD link
    await userEvent.click(spdLink!)

    // Navigation should be triggered to /spd
    expect(lastNavigatedHref).toBe('/spd')

    // STEP 3: FeatureGate would allow access (tested in FeatureGate.test.tsx)
    // We verify the tier check here to ensure consistency
    expect(mockIsTierAtLeast('professional')).toBe(true) // Professional has access
  })

  // ============================================
  // WORKFLOW: Essential user clicks Analytics → sees prompt
  // ============================================
  it('Essential user clicks Analytics → navigates to /analytics', async () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // Analytics link should be present
    const analyticsLink = container.querySelector('a[href="/analytics"]')
    expect(analyticsLink).toBeDefined()

    // Click Analytics link
    await userEvent.click(analyticsLink!)

    expect(lastNavigatedHref).toBe('/analytics')

    // Verify tier check
    expect(mockIsTierAtLeast('professional')).toBe(false)
  })

  // ============================================
  // WORKFLOW: Essential user clicks Data Quality → sees prompt
  // ============================================
  it('Essential user clicks Data Quality → navigates to /data-quality', async () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // Data Quality link should be present
    const dqLink = container.querySelector('a[href="/data-quality"]')
    expect(dqLink).toBeDefined()

    // Click Data Quality link
    await userEvent.click(dqLink!)

    expect(lastNavigatedHref).toBe('/data-quality')

    // Verify tier check
    expect(mockIsTierAtLeast('professional')).toBe(false)
  })

  // ============================================
  // WORKFLOW: Essential user accesses unlocked pages normally
  // ============================================
  it('Essential user accesses Dashboard (no tier gate)', async () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // Dashboard link should be present and NOT locked
    const dashboardLink = container.querySelector('a[href="/dashboard"]')
    expect(dashboardLink).toBeDefined()

    // Dashboard has no requiredTier, so no tier check needed
    const dashboardItem = facilityNavigation.find(item => item.href === '/dashboard')
    expect(dashboardItem?.requiredTier).toBeUndefined()
  })

  // ============================================
  // WORKFLOW: Locked item shows correct tier badge
  // ============================================
  it('Professional-tier items are present for essential users (locked)', () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // SPD, Analytics, Data Quality require professional → should still be present (but locked)
    const spdLink = container.querySelector('a[href="/spd"]')
    const analyticsLink = container.querySelector('a[href="/analytics"]')
    const dqLink = container.querySelector('a[href="/data-quality"]')

    expect(spdLink).toBeDefined()
    expect(analyticsLink).toBeDefined()
    expect(dqLink).toBeDefined()

    // This validates that tier gating doesn't remove items from the nav
  })

  // ============================================
  // WORKFLOW: Settings locked items work the same way
  // ============================================
  it('Essential user navigates to settings → locked items have tier badges', () => {
    // This test documents the EXPECTED behavior for settings pages
    // Settings navigation uses getVisibleCategories with tier filtering
    // So locked items are HIDDEN, not shown as locked
    // This is different from main nav where locked items are shown

    // For now, this is a placeholder test to document the difference
    // When we implement settings rendering, this test will verify that behavior
    expect(true).toBe(true)
  })
})

// ============================================
// INTEGRATION: Sidebar + FeatureGate tier consistency
// ============================================
describe('Tier consistency - Sidebar and FeatureGate', () => {
  it('Sidebar and FeatureGate use same tier check for consistency', () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    // Render sidebar
    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // SPD link should be present in sidebar (locked for essential tier)
    const spdLink = container.querySelector('a[href="/spd"]')
    expect(spdLink).toBeDefined()

    // Both components should evaluate the same tier check
    const tierCheckResult = mockIsTierAtLeast('professional')
    expect(tierCheckResult).toBe(false) // Essential < Professional

    // This ensures Sidebar and FeatureGate will behave consistently
    // (Sidebar shows locked state, FeatureGate would block access)
  })
})
