import { describe, it, expect } from 'vitest'
import {
  facilityNavigation,
  isNavItemActive,
  getFilteredNavigation,
} from '@/components/layouts/navigation-config'

// ============================================
// NAV STRUCTURE
// ============================================
describe('facilityNavigation', () => {
  it('has Dashboard as first item at /dashboard', () => {
    expect(facilityNavigation[0].name).toBe('Dashboard')
    expect(facilityNavigation[0].href).toBe('/dashboard')
  })

  it('has Rooms as second item at /rooms', () => {
    expect(facilityNavigation[1].name).toBe('Rooms')
    expect(facilityNavigation[1].href).toBe('/rooms')
  })

  it('has no duplicate hrefs', () => {
    const hrefs = facilityNavigation.map(item => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('every item has name, href, icon, and allowedRoles', () => {
    for (const item of facilityNavigation) {
      expect(item.name).toBeTruthy()
      expect(item.href).toMatch(/^\//)
      expect(item.icon).toBeDefined()
      expect(item.allowedRoles.length).toBeGreaterThan(0)
    }
  })
})

// ============================================
// ACTIVE STATE LOGIC
// ============================================
describe('isNavItemActive', () => {
  it('marks /dashboard active only for exact /dashboard path', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true)
  })

  it('marks /dashboard active for /dashboard sub-routes', () => {
    expect(isNavItemActive('/dashboard', '/dashboard/data-quality')).toBe(true)
  })

  it('does NOT mark /dashboard active when on /rooms', () => {
    expect(isNavItemActive('/dashboard', '/rooms')).toBe(false)
  })

  it('marks /rooms active for exact /rooms path', () => {
    expect(isNavItemActive('/rooms', '/rooms')).toBe(true)
  })

  it('does NOT mark /rooms active when on /dashboard', () => {
    expect(isNavItemActive('/rooms', '/dashboard')).toBe(false)
  })

  it('marks /cases active for /cases sub-routes', () => {
    expect(isNavItemActive('/cases', '/cases/123')).toBe(true)
  })

  it('marks /analytics active for /analytics sub-routes', () => {
    expect(isNavItemActive('/analytics', '/analytics/orbit-score')).toBe(true)
  })

  it('does NOT mark /cases active when on /dashboard', () => {
    expect(isNavItemActive('/cases', '/dashboard')).toBe(false)
  })
})

// ============================================
// ROLE FILTERING
// ============================================
describe('getFilteredNavigation', () => {
  it('returns items matching global_admin role', () => {
    const items = getFilteredNavigation('global_admin')
    expect(items.every(item => item.allowedRoles.includes('global_admin'))).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('returns subset for regular user (no admin-only items)', () => {
    const items = getFilteredNavigation('user')
    expect(items.length).toBeLessThan(facilityNavigation.length)
    expect(items.every(item => item.allowedRoles.includes('user'))).toBe(true)
  })

  it('includes Dashboard and Rooms for all role levels', () => {
    for (const role of ['global_admin', 'facility_admin', 'user']) {
      const items = getFilteredNavigation(role)
      expect(items.find(i => i.name === 'Dashboard')).toBeDefined()
      expect(items.find(i => i.name === 'Rooms')).toBeDefined()
    }
  })
})

// ============================================
// PERMISSION-BASED FILTERING
// ============================================
describe('getFilteredNavigation — permission gating', () => {
  it('uses can() for items with a permission field', () => {
    const canDeny = () => false
    const items = getFilteredNavigation('user', canDeny)
    // Analytics, Settings, Block Schedule have permission keys — denied by can()
    expect(items.find(i => i.name === 'Analytics')).toBeUndefined()
    expect(items.find(i => i.name === 'Settings')).toBeUndefined()
    expect(items.find(i => i.name === 'Block Schedule')).toBeUndefined()
  })

  it('includes permission-gated items when can() returns true', () => {
    const canAllow = () => true
    const items = getFilteredNavigation('user', canAllow)
    // Items with permission keys should be included via can()
    expect(items.find(i => i.name === 'Analytics')).toBeDefined()
    expect(items.find(i => i.name === 'Settings')).toBeDefined()
    expect(items.find(i => i.name === 'Block Schedule')).toBeDefined()
  })

  it('falls back to allowedRoles when can() is not provided', () => {
    // Without can(), items with permission keys use allowedRoles
    const adminItems = getFilteredNavigation('global_admin')
    expect(adminItems.find(i => i.name === 'Analytics')).toBeDefined()

    const userItems = getFilteredNavigation('user')
    expect(userItems.find(i => i.name === 'Analytics')).toBeUndefined()
  })

  it('does not affect items without a permission field', () => {
    const canDeny = () => false
    const items = getFilteredNavigation('user', canDeny)
    // Dashboard and Cases have no permission key — use allowedRoles (user is in their list)
    expect(items.find(i => i.name === 'Dashboard')).toBeDefined()
    expect(items.find(i => i.name === 'Cases')).toBeDefined()
  })
})
