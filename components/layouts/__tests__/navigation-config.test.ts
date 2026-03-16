import { describe, it, expect } from 'vitest'
import {
  adminNavGroups,
  facilityNavigation,
  isNavItemActive,
  getFilteredNavigation,
} from '@/components/layouts/navigation-config'
import { ALL_PERMISSION_KEYS } from '@/lib/permissions'

// ============================================
// ADMIN NAV GROUPS
// ============================================
describe('adminNavGroups', () => {
  it('has expected groups', () => {
    const ids = adminNavGroups.map(g => g.id)
    expect(ids).toContain('overview')
    expect(ids).toContain('management')
    expect(ids).toContain('configuration')
    expect(ids).toContain('compliance')
  })

  it('every admin item has name, href, and icon', () => {
    for (const group of adminNavGroups) {
      for (const item of group.items) {
        expect(item.name).toBeTruthy()
        expect(item.href).toMatch(/^\//)
        expect(item.icon).toBeDefined()
      }
    }
  })

  it('no admin items have allowedRoles property', () => {
    for (const group of adminNavGroups) {
      for (const item of group.items) {
        expect(item).not.toHaveProperty('allowedRoles')
      }
    }
  })

  it('has no duplicate hrefs across all admin groups', () => {
    const allHrefs = adminNavGroups.flatMap(g => g.items.map(i => i.href))
    expect(new Set(allHrefs).size).toBe(allHrefs.length)
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

  it('every item has name, href, and icon', () => {
    for (const item of facilityNavigation) {
      expect(item.name).toBeTruthy()
      expect(item.href).toMatch(/^\//)
      expect(item.icon).toBeDefined()
    }
  })

  it('no items have allowedRoles property', () => {
    for (const item of facilityNavigation) {
      expect(item).not.toHaveProperty('allowedRoles')
    }
  })

  it('all permission keys are valid PERMISSION_KEYS values', () => {
    for (const item of facilityNavigation) {
      if (item.permission) {
        expect(ALL_PERMISSION_KEYS).toContain(item.permission)
      }
    }
  })

  it('Dashboard has no permission key (always visible)', () => {
    const dashboard = facilityNavigation.find(i => i.name === 'Dashboard')
    expect(dashboard).toBeDefined()
    expect(dashboard!.permission).toBeUndefined()
  })

  it('all non-Dashboard items have a permission key', () => {
    for (const item of facilityNavigation) {
      if (item.name !== 'Dashboard') {
        expect(item.permission).toBeTruthy()
      }
    }
  })

  it('has correct permission keys for each item', () => {
    const expectedKeys: Record<string, string> = {
      Rooms: 'rooms.view',
      'Block Schedule': 'scheduling.view',
      Cases: 'cases.view',
      SPD: 'spd.view',
      Analytics: 'analytics.view',
      'Data Quality': 'data_quality.view',
      'Staff Management': 'staff_management.view',
      Settings: 'settings.view',
    }

    for (const [name, key] of Object.entries(expectedKeys)) {
      const item = facilityNavigation.find(i => i.name === name)
      expect(item).toBeDefined()
      expect(item!.permission).toBe(key)
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
// PERMISSION-BASED FILTERING
// ============================================
describe('getFilteredNavigation', () => {
  it('includes Dashboard even when can() denies all permissions', () => {
    const canDeny = () => false
    const items = getFilteredNavigation(canDeny)
    expect(items.find(i => i.name === 'Dashboard')).toBeDefined()
  })

  it('excludes permission-gated items when can() denies all', () => {
    const canDeny = () => false
    const items = getFilteredNavigation(canDeny)
    expect(items.find(i => i.name === 'Analytics')).toBeUndefined()
    expect(items.find(i => i.name === 'Settings')).toBeUndefined()
    expect(items.find(i => i.name === 'Block Schedule')).toBeUndefined()
    expect(items.find(i => i.name === 'Cases')).toBeUndefined()
    expect(items.find(i => i.name === 'Rooms')).toBeUndefined()
    expect(items.find(i => i.name === 'SPD')).toBeUndefined()
    expect(items.find(i => i.name === 'Data Quality')).toBeUndefined()
    expect(items.find(i => i.name === 'Staff Management')).toBeUndefined()
  })

  it('includes all items when can() grants all permissions', () => {
    const canAllow = () => true
    const items = getFilteredNavigation(canAllow)
    expect(items.length).toBe(facilityNavigation.length)
  })

  it('filters selectively based on can() responses', () => {
    const canSelective = (key: string) => key === 'cases.view' || key === 'rooms.view'
    const items = getFilteredNavigation(canSelective)
    expect(items.find(i => i.name === 'Dashboard')).toBeDefined()
    expect(items.find(i => i.name === 'Cases')).toBeDefined()
    expect(items.find(i => i.name === 'Rooms')).toBeDefined()
    expect(items.find(i => i.name === 'Analytics')).toBeUndefined()
    expect(items.find(i => i.name === 'Settings')).toBeUndefined()
  })

  it('does not filter by tier (tier gating is in Sidebar)', () => {
    const canAllow = () => true
    const items = getFilteredNavigation(canAllow)
    const spd = items.find(i => i.name === 'SPD')
    const analytics = items.find(i => i.name === 'Analytics')
    const dataQuality = items.find(i => i.name === 'Data Quality')
    expect(spd).toBeDefined()
    expect(analytics).toBeDefined()
    expect(dataQuality).toBeDefined()
    expect(spd?.requiredTier).toBe('professional')
    expect(analytics?.requiredTier).toBe('professional')
    expect(dataQuality?.requiredTier).toBe('professional')
  })
})

// ============================================
// INTEGRATION: User role scenarios via permission grants
// ============================================
describe('getFilteredNavigation — role scenarios', () => {
  it('user sees Dashboard, Cases, Rooms when granted those permissions', () => {
    const userCan = (key: string) =>
      ['cases.view', 'rooms.view'].includes(key)
    const items = getFilteredNavigation(userCan)
    expect(items.map(i => i.name)).toEqual(
      expect.arrayContaining(['Dashboard', 'Cases', 'Rooms'])
    )
    expect(items.find(i => i.name === 'Settings')).toBeUndefined()
    expect(items.find(i => i.name === 'SPD')).toBeUndefined()
  })

  it('coordinator sees Dashboard, Rooms, Block Schedule, Cases, Settings', () => {
    const coordinatorCan = (key: string) =>
      ['rooms.view', 'scheduling.view', 'cases.view', 'settings.view'].includes(key)
    const items = getFilteredNavigation(coordinatorCan)
    const names = items.map(i => i.name)
    expect(names).toContain('Dashboard')
    expect(names).toContain('Rooms')
    expect(names).toContain('Block Schedule')
    expect(names).toContain('Cases')
    expect(names).toContain('Settings')
    expect(names).not.toContain('Analytics')
    expect(names).not.toContain('SPD')
  })

  it('facility_admin with all permissions sees everything', () => {
    const adminCan = () => true
    const items = getFilteredNavigation(adminCan)
    expect(items.length).toBe(facilityNavigation.length)
  })
})
