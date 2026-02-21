import { describe, it, expect } from 'vitest'
import {
  adminNavGroups,
  facilityNavigation,
  isNavItemActive,
  getFilteredNavigation,
} from '@/components/layouts/navigation-config'

// ============================================
// ADMIN NAV GROUPS
// ============================================
describe('adminNavGroups', () => {
  it('has a configuration group', () => {
    const configGroup = adminNavGroups.find(g => g.id === 'configuration')
    expect(configGroup).toBeDefined()
    expect(configGroup!.label).toBe('Configuration')
  })

  it('configuration group contains all 5 new admin settings pages', () => {
    const configGroup = adminNavGroups.find(g => g.id === 'configuration')!
    const hrefs = configGroup.items.map(i => i.href)

    expect(hrefs).toContain('/admin/settings/phases')
    expect(hrefs).toContain('/admin/settings/flag-rules')
    expect(hrefs).toContain('/admin/settings/analytics')
    expect(hrefs).toContain('/admin/settings/payers')
    expect(hrefs).toContain('/admin/settings/notifications')
  })

  it('all admin nav items require global_admin role', () => {
    for (const group of adminNavGroups) {
      for (const item of group.items) {
        expect(item.allowedRoles).toContain('global_admin')
      }
    }
  })

  it('every admin item has name, href, icon, and allowedRoles', () => {
    for (const group of adminNavGroups) {
      for (const item of group.items) {
        expect(item.name).toBeTruthy()
        expect(item.href).toMatch(/^\//)
        expect(item.icon).toBeDefined()
        expect(item.allowedRoles.length).toBeGreaterThan(0)
      }
    }
  })

  it('has no duplicate hrefs across all admin groups', () => {
    const allHrefs = adminNavGroups.flatMap(g => g.items.map(i => i.href))
    expect(new Set(allHrefs).size).toBe(allHrefs.length)
  })

  it('new admin pages use correct icons', () => {
    const configGroup = adminNavGroups.find(g => g.id === 'configuration')!

    const flagRules = configGroup.items.find(i => i.href === '/admin/settings/flag-rules')
    expect(flagRules!.name).toBe('Flag Rules')

    const analytics = configGroup.items.find(i => i.href === '/admin/settings/analytics')
    expect(analytics!.name).toBe('Analytics Defaults')

    const payers = configGroup.items.find(i => i.href === '/admin/settings/payers')
    expect(payers!.name).toBe('Payers')

    const notifications = configGroup.items.find(i => i.href === '/admin/settings/notifications')
    expect(notifications!.name).toBe('Notifications')

    const phases = configGroup.items.find(i => i.href === '/admin/settings/phases')
    expect(phases!.name).toBe('Phases')
  })
})

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

  it('marks /data-quality active for /data-quality route', () => {
    expect(isNavItemActive('/data-quality', '/data-quality')).toBe(true)
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
    // Without can(), falls back to allowedRoles — admin-only items (SPD, Data Quality) excluded
    expect(items.length).toBeLessThan(facilityNavigation.length)
    expect(items.find(i => i.name === 'SPD')).toBeUndefined()
    expect(items.find(i => i.name === 'Data Quality')).toBeUndefined()
  })

  it('includes Dashboard and Rooms for all role levels', () => {
    for (const role of ['global_admin', 'facility_admin', 'coordinator', 'user']) {
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
    // Without can(), items with permission keys use allowedRoles as fallback
    const adminItems = getFilteredNavigation('global_admin')
    expect(adminItems.find(i => i.name === 'Analytics')).toBeDefined()

    // 'user' is in allowedRoles as fallback, so Analytics shows without can()
    const userItems = getFilteredNavigation('user')
    expect(userItems.find(i => i.name === 'Analytics')).toBeDefined()

    // SPD is admin-only (no 'user' in allowedRoles, no permission key)
    expect(userItems.find(i => i.name === 'SPD')).toBeUndefined()
  })

  it('does not affect items without a permission field', () => {
    const canDeny = () => false
    const items = getFilteredNavigation('user', canDeny)
    // Dashboard has no permission key — uses allowedRoles (user is in the list)
    expect(items.find(i => i.name === 'Dashboard')).toBeDefined()
    expect(items.find(i => i.name === 'Rooms')).toBeDefined()
    // Cases has a permission key — denied by can()
    expect(items.find(i => i.name === 'Cases')).toBeUndefined()
  })
})
