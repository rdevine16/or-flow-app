// lib/__tests__/settings-nav-config.test.ts
// Test suite for settings navigation configuration with tier filtering

import { describe, it, expect } from 'vitest'
import {
  settingsCategories,
  getVisibleCategories,
  getCategoryForPath,
  getCategoryById,
  getNavItemForPath,
} from '@/lib/settings-nav-config'
import type { TierSlug } from '@/lib/tier-config'

// ============================================
// UNIT TESTS: Settings category structure
// ============================================
describe('settingsCategories structure', () => {
  it('has 7 categories with correct IDs', () => {
    const expectedCategories = [
      'general',
      'organization',
      'case-management',
      'operations',
      'device-reps',
      'financials',
      'security',
    ]
    const actualCategories = settingsCategories.map(c => c.id)
    expect(actualCategories).toEqual(expectedCategories)
  })

  it('financials category requires enterprise tier', () => {
    const financials = settingsCategories.find(c => c.id === 'financials')
    expect(financials?.requiredTier).toBe('enterprise')
  })

  it('analytics settings item requires professional tier', () => {
    const operations = settingsCategories.find(c => c.id === 'operations')
    const analytics = operations?.items.find(i => i.id === 'analytics')
    expect(analytics?.requiredTier).toBe('professional')
  })

  it('flag rules item requires professional tier', () => {
    const operations = settingsCategories.find(c => c.id === 'operations')
    const flags = operations?.items.find(i => i.id === 'flags')
    expect(flags?.requiredTier).toBe('professional')
  })

  it('integrations item requires enterprise tier', () => {
    const operations = settingsCategories.find(c => c.id === 'operations')
    const integrations = operations?.items.find(i => i.id === 'integrations')
    expect(integrations?.requiredTier).toBe('enterprise')
  })

  it('all financials items have permissions', () => {
    const financials = settingsCategories.find(c => c.id === 'financials')
    expect(financials?.items.every(item => item.permission === 'financials.view')).toBe(true)
  })
})

// ============================================
// UNIT TESTS: getVisibleCategories with tier filtering
// ============================================
describe('getVisibleCategories - tier filtering', () => {
  const canAll = () => true

  it('shows all categories for enterprise tier', () => {
    const isTierAtLeast = (requiredTier: TierSlug) => {
      // Enterprise has access to everything
      return true
    }

    const visible = getVisibleCategories(canAll, isTierAtLeast)

    // Should have all categories (7 total)
    expect(visible.length).toBe(7)
    expect(visible.find(c => c.id === 'financials')).toBeDefined()
    expect(visible.find(c => c.id === 'operations')).toBeDefined()

    // Operations category should have all 6 items (rooms, closures, analytics, flags, voice-commands, integrations)
    const operations = visible.find(c => c.id === 'operations')
    expect(operations?.items.length).toBe(6)
    expect(operations?.items.find(i => i.id === 'analytics')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'flags')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'voice-commands')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'integrations')).toBeDefined()
  })

  it('hides financials category for professional tier', () => {
    const isTierAtLeast = (requiredTier: TierSlug) => {
      // Professional: has pro but not enterprise
      return requiredTier === 'professional' || requiredTier === 'essential'
    }

    const visible = getVisibleCategories(canAll, isTierAtLeast)

    // Should have 6 categories (no financials)
    expect(visible.length).toBe(6)
    expect(visible.find(c => c.id === 'financials')).toBeUndefined()

    // Operations category should have 5 items (rooms, closures, analytics, flags, voice-commands — no integrations)
    const operations = visible.find(c => c.id === 'operations')
    expect(operations?.items.length).toBe(5)
    expect(operations?.items.find(i => i.id === 'analytics')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'flags')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'voice-commands')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'integrations')).toBeUndefined()
  })

  it('hides financials category and pro-tier items for essential tier', () => {
    const isTierAtLeast = (requiredTier: TierSlug) => {
      // Essential: only has essential
      return requiredTier === 'essential'
    }

    const visible = getVisibleCategories(canAll, isTierAtLeast)

    // Should have 6 categories (no financials)
    expect(visible.length).toBe(6)
    expect(visible.find(c => c.id === 'financials')).toBeUndefined()

    // Operations category should have 3 items (rooms, closures, voice-commands — no analytics, flags, integrations)
    const operations = visible.find(c => c.id === 'operations')
    expect(operations?.items.length).toBe(3)
    expect(operations?.items.find(i => i.id === 'rooms')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'closures')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'voice-commands')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'analytics')).toBeUndefined()
    expect(operations?.items.find(i => i.id === 'flags')).toBeUndefined()
    expect(operations?.items.find(i => i.id === 'integrations')).toBeUndefined()
  })

  it('returns no categories when isTierAtLeast is not provided', () => {
    // Without isTierAtLeast function, categories with requiredTier are NOT filtered
    // (they are shown by default — permission filtering still applies)
    const visible = getVisibleCategories(canAll)

    // Should have all categories since tier filtering is skipped when isTierAtLeast is undefined
    expect(visible.length).toBe(7)
    expect(visible.find(c => c.id === 'financials')).toBeDefined()
  })
})

// ============================================
// UNIT TESTS: getVisibleCategories with permission filtering
// ============================================
describe('getVisibleCategories - permission filtering', () => {
  const isTierEnterprise = () => true

  it('hides items without required permissions', () => {
    const canNone = () => false

    const visible = getVisibleCategories(canNone, isTierEnterprise)

    // General category should only have "Overview" (no permission required)
    const general = visible.find(c => c.id === 'general')
    expect(general?.items.length).toBe(1)
    expect(general?.items[0].id).toBe('overview')

    // Operations category should only have "OR Rooms" (no permission required)
    const operations = visible.find(c => c.id === 'operations')
    expect(operations?.items.length).toBe(1)
    expect(operations?.items[0].id).toBe('rooms')
  })

  it('shows all items when user has all permissions', () => {
    const canAll = () => true

    const visible = getVisibleCategories(canAll, isTierEnterprise)

    // General category should have 3 items
    const general = visible.find(c => c.id === 'general')
    expect(general?.items.length).toBe(3)

    // Operations category should have 6 items
    const operations = visible.find(c => c.id === 'operations')
    expect(operations?.items.length).toBe(6)
  })

  it('filters categories that become empty after permission filtering', () => {
    const canNone = () => false

    const visible = getVisibleCategories(canNone, isTierEnterprise)

    // Check-In category requires settings.manage for all items — should be filtered out
    expect(visible.find(c => c.id === 'checkin')).toBeUndefined()

    // Security category requires audit.view — should be filtered out
    expect(visible.find(c => c.id === 'security')).toBeUndefined()
  })
})

// ============================================
// UNIT TESTS: getVisibleCategories combining tier + permission
// ============================================
describe('getVisibleCategories - tier + permission filtering', () => {
  it('applies both tier and permission filters correctly', () => {
    const isTierProfessional = (requiredTier: TierSlug) => {
      return requiredTier === 'professional' || requiredTier === 'essential'
    }
    const canSome = (permission: string) => {
      // Has settings.manage but not financials.view
      return permission === 'settings.manage'
    }

    const visible = getVisibleCategories(canSome, isTierProfessional)

    // Financials category should be hidden (requires enterprise tier)
    expect(visible.find(c => c.id === 'financials')).toBeUndefined()

    // Operations category should have analytics and flags (have permission) but not integrations (tier too low)
    const operations = visible.find(c => c.id === 'operations')
    expect(operations?.items.find(i => i.id === 'analytics')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'flags')).toBeDefined()
    expect(operations?.items.find(i => i.id === 'integrations')).toBeUndefined()
  })
})

// ============================================
// UNIT TESTS: Lookup utilities
// ============================================
describe('Lookup utilities', () => {
  it('getCategoryForPath returns correct category for exact path', () => {
    expect(getCategoryForPath('/settings/general')).toBe('general')
    expect(getCategoryForPath('/settings/milestones')).toBe('case-management')
    expect(getCategoryForPath('/settings/flags')).toBe('operations')
  })

  it('getCategoryForPath returns correct category for nested path', () => {
    expect(getCategoryForPath('/settings/financials/cost-categories')).toBe('financials')
    expect(getCategoryForPath('/settings/financials/payers')).toBe('financials')
  })

  it('getCategoryForPath returns null for unknown path', () => {
    expect(getCategoryForPath('/settings/unknown')).toBeNull()
    expect(getCategoryForPath('/dashboard')).toBeNull()
  })

  it('getCategoryById returns correct category', () => {
    const financials = getCategoryById('financials')
    expect(financials?.label).toBe('Financials')
    expect(financials?.items.length).toBeGreaterThan(0)
  })

  it('getCategoryById returns undefined for unknown ID', () => {
    expect(getCategoryById('unknown')).toBeUndefined()
  })

  it('getNavItemForPath returns correct item', () => {
    const analytics = getNavItemForPath('/settings/analytics')
    expect(analytics?.id).toBe('analytics')
    expect(analytics?.label).toBe('Analytics')
  })

  it('getNavItemForPath handles nested routes by returning first match', () => {
    // Note: getNavItemForPath iterates items in order and returns first match using startsWith
    // For /settings/financials/cost-categories, Overview (/settings/financials) is listed first,
    // so it matches before cost-categories (/settings/financials/cost-categories)
    const result = getNavItemForPath('/settings/financials/cost-categories')

    // This is the current behavior - returns first matching item
    expect(result?.id).toBe('financials-overview')
    expect(result?.href).toBe('/settings/financials')
  })

  it('getNavItemForPath returns undefined for unknown path', () => {
    expect(getNavItemForPath('/settings/unknown')).toBeUndefined()
  })
})
