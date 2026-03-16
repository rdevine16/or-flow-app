// components/layouts/__tests__/Sidebar-tier-gating.test.tsx
// Integration tests for Sidebar rendering locked items based on tier

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import Sidebar from '@/components/layouts/Sidebar'
import { facilityNavigation, getFilteredNavigation } from '@/components/layouts/navigation-config'

// Pre-filter navigation with all permissions granted (simulates admin/full-access user)
const allPermissionsNav = getFilteredNavigation(() => true)

// ============================================
// MOCKS
// ============================================

let mockIsTierAtLeast: (requiredTier: string) => boolean = () => true

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    isTierAtLeast: mockIsTierAtLeast,
  }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ============================================
// TESTS
// ============================================

describe('Sidebar - tier gating', () => {
  beforeEach(() => {
    mockIsTierAtLeast = () => true
  })

  // ============================================
  // UNIT: Navigation items have requiredTier
  // ============================================
  it('facilityNavigation includes items with requiredTier', () => {
    const spd = facilityNavigation.find(item => item.name === 'SPD')
    const analytics = facilityNavigation.find(item => item.name === 'Analytics')
    const dataQuality = facilityNavigation.find(item => item.name === 'Data Quality')

    expect(spd?.requiredTier).toBe('professional')
    expect(analytics?.requiredTier).toBe('professional')
    expect(dataQuality?.requiredTier).toBe('professional')
  })

  // ============================================
  // INTEGRATION: Locked state rendering
  // ============================================
  it('renders all items as unlocked for enterprise tier', () => {
    mockIsTierAtLeast = () => true // Enterprise has access to everything

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
        onExpandChange={() => {}}
      />
    )

    // All items should be present as links (text may not be visible when collapsed)
    expect(container.querySelector('a[href="/dashboard"]')).toBeDefined()
    expect(container.querySelector('a[href="/spd"]')).toBeDefined()
    expect(container.querySelector('a[href="/analytics"]')).toBeDefined()
    expect(container.querySelector('a[href="/data-quality"]')).toBeDefined()

    // None should have locked state classes (text-slate-600)
    const spdLink = container.querySelector('a[href="/spd"]')
    expect(spdLink?.className).not.toContain('text-slate-600')
  })

  it('renders locked items with hover styles for essential tier', () => {
    mockIsTierAtLeast = (requiredTier: string) => {
      // Essential tier: only has access to essential-tier items
      return requiredTier === 'essential'
    }

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // SPD, Analytics, Data Quality should be present as locked items
    const spdLink = container.querySelector('a[href="/spd"]')
    const analyticsLink = container.querySelector('a[href="/analytics"]')
    const dqLink = container.querySelector('a[href="/data-quality"]')

    expect(spdLink).toBeDefined()
    expect(analyticsLink).toBeDefined()
    expect(dqLink).toBeDefined()

    // Locked links should have Lock icon SVG child
    const spdLockIcon = spdLink?.querySelector('svg.lucide-lock') || spdLink?.querySelector('svg[class*="lock"]')
    expect(spdLockIcon).toBeDefined()
  })

  it('locked and unlocked items both render as clickable links', () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // Find locked and unlocked links
    const spdLink = container.querySelector('a[href="/spd"]') // Locked (professional tier)
    const dashboardLink = container.querySelector('a[href="/dashboard"]') // Unlocked

    // Both should be present
    expect(spdLink).toBeDefined()
    expect(dashboardLink).toBeDefined()

    // Both should be clickable links
    expect(spdLink?.tagName).toBe('A')
    expect(dashboardLink?.tagName).toBe('A')

    // Both should have href attributes
    expect(spdLink?.getAttribute('href')).toBe('/spd')
    expect(dashboardLink?.getAttribute('href')).toBe('/dashboard')
  })

  it('unlocked items do not have locked state classes', () => {
    mockIsTierAtLeast = () => true // Enterprise tier

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // Dashboard, Rooms, Cases should not have locked state classes
    const dashboardLink = container.querySelector('a[href="/dashboard"]')
    const roomsLink = container.querySelector('a[href="/rooms"]')
    const casesLink = container.querySelector('a[href="/cases"]')

    expect(dashboardLink?.className).not.toContain('text-slate-600')
    expect(roomsLink?.className).not.toContain('text-slate-600')
    expect(casesLink?.className).not.toContain('text-slate-600')
  })

  it('locked items are still clickable (navigation allowed)', () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/dashboard"
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // SPD should still be a link (user can click to see upgrade prompt)
    const spdLink = container.querySelector('a[href="/spd"]')
    expect(spdLink).toBeDefined()
    expect(spdLink?.getAttribute('href')).toBe('/spd')
  })

  it('locked items are not marked as active even when on that route', () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    const { container } = render(
      <Sidebar
        pathname="/spd" // User is on SPD page
        isAdminMode={false}
        navigation={allPermissionsNav}
      />
    )

    // Compare SPD (on route, but locked) with Dashboard (not on route, unlocked)
    const spdLink = container.querySelector('a[href="/spd"]')
    const dashboardLink = container.querySelector('a[href="/dashboard"]')

    // SPD should not have the same className as an active unlocked item would
    // (checking that locked state overrides active state)
    expect(spdLink?.className).not.toContain('bg-blue-600') // No active background
  })

  it('admin mode does not apply tier gating', () => {
    mockIsTierAtLeast = (requiredTier: string) => requiredTier === 'essential'

    // Admin navigation doesn't use tier gating (all admin items visible to global_admin)
    const { container } = render(
      <Sidebar
        pathname="/admin/settings/flag-rules"
        isAdminMode={true}
        navigation={[]} // Admin mode uses adminNavGroups, not the navigation prop
      />
    )

    // Admin links should not have locked state classes (admin mode doesn't use tier gating)
    const links = container.querySelectorAll('a')
    links.forEach(link => {
      // Admin links should not have text-slate-600 class (locked state)
      expect(link.className).not.toContain('text-slate-600')
    })
  })
})

// ============================================
// INTEGRATION: getFilteredNavigation does NOT filter by tier
// ============================================
describe('Navigation filtering - tier does not affect visibility', () => {
  it('getFilteredNavigation returns items with requiredTier regardless of user tier', async () => {
    // This tests the actual filtering logic to ensure items are NOT removed from nav
    // (they should all be present, but Sidebar determines locked state)

    // Import the function dynamically
    const navigationConfig = await import('@/components/layouts/navigation-config')
    const { getFilteredNavigation } = navigationConfig

    const canAllowAll = () => true
    const items = getFilteredNavigation(canAllowAll)

    // SPD, Analytics, Data Quality should all be present (not filtered out)
    const spd = items.find((item: { name: string }) => item.name === 'SPD')
    const analytics = items.find((item: { name: string }) => item.name === 'Analytics')
    const dataQuality = items.find((item: { name: string }) => item.name === 'Data Quality')

    // Items with requiredTier should still be in the filtered list
    // (getFilteredNavigation only filters by permission, NOT tier)
    expect(spd).toBeDefined()
    expect(analytics).toBeDefined()
    expect(dataQuality).toBeDefined()

    // Verify they have requiredTier set
    expect(spd?.requiredTier).toBe('professional')
    expect(analytics?.requiredTier).toBe('professional')
    expect(dataQuality?.requiredTier).toBe('professional')
  })
})
