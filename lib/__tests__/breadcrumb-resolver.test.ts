import { describe, it, expect } from 'vitest'
import { resolveBreadcrumbs, ROUTE_BREADCRUMBS } from '../breadcrumbs'

describe('resolveBreadcrumbs', () => {
  const emptyLabels = new Map<string, string>()
  const facilityOptions = { isAdmin: false, facilityName: 'General Hospital' }
  const adminOptions = { isAdmin: true, facilityName: null }

  // ============================================
  // EXACT MATCHES
  // ============================================

  describe('exact matches', () => {
    it('resolves / (dashboard)', () => {
      const result = resolveBreadcrumbs('/', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Dashboard', href: null },
      ])
    })

    it('resolves /analytics', () => {
      const result = resolveBreadcrumbs('/analytics', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Analytics', href: null },
      ])
    })

    it('resolves /analytics/surgeons (nested)', () => {
      const result = resolveBreadcrumbs('/analytics/surgeons', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Analytics', href: '/analytics' },
        { label: 'Surgeon Performance', href: null },
      ])
    })

    it('resolves /dashboard/data-quality (3-level)', () => {
      const result = resolveBreadcrumbs('/dashboard/data-quality', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Dashboard', href: '/' },
        { label: 'Data Quality', href: null },
      ])
    })

    it('resolves flat pages (rooms, block-schedule, etc.)', () => {
      const result = resolveBreadcrumbs('/rooms', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Rooms', href: null },
      ])
    })

    it('resolves /cases/new', () => {
      const result = resolveBreadcrumbs('/cases/new', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Cases', href: '/cases' },
        { label: 'New Case', href: null },
      ])
    })
  })

  // ============================================
  // DYNAMIC [id] ROUTES
  // ============================================

  describe('dynamic [id] routes', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    it('resolves /cases/[uuid] with dynamic label', () => {
      const labels = new Map([['/cases/[id]', 'Case #1042']])
      const result = resolveBreadcrumbs(`/cases/${uuid}`, labels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Cases', href: '/cases' },
        { label: 'Case #1042', href: null },
      ])
    })

    it('resolves /cases/[uuid]/edit with linked dynamic segment', () => {
      const labels = new Map([['/cases/[id]', 'Case #1042']])
      const result = resolveBreadcrumbs(`/cases/${uuid}/edit`, labels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Cases', href: '/cases' },
        { label: 'Case #1042', href: `/cases/${uuid}` },
        { label: 'Edit', href: null },
      ])
    })

    it('resolves /cases/[uuid]/cancel', () => {
      const labels = new Map([['/cases/[id]', 'Case #1042']])
      const result = resolveBreadcrumbs(`/cases/${uuid}/cancel`, labels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Cases', href: '/cases' },
        { label: 'Case #1042', href: `/cases/${uuid}` },
        { label: 'Cancel', href: null },
      ])
    })

    it('shows "Loading..." when no dynamic label is registered', () => {
      const result = resolveBreadcrumbs(`/cases/${uuid}`, emptyLabels, facilityOptions)
      expect(result[2]).toEqual({ label: 'Loading...', href: null })
    })

    it('resolves /admin/facilities/[uuid]', () => {
      const labels = new Map([['/admin/facilities/[id]', 'St. Mary Hospital']])
      const result = resolveBreadcrumbs(`/admin/facilities/${uuid}`, labels, adminOptions)
      expect(result).toEqual([
        { label: 'Admin', href: '/admin' },
        { label: 'Facilities', href: '/admin/facilities' },
        { label: 'St. Mary Hospital', href: null },
      ])
    })
  })

  // ============================================
  // ADMIN ROUTES (no facility prefix)
  // ============================================

  describe('admin routes', () => {
    it('resolves /admin', () => {
      const result = resolveBreadcrumbs('/admin', emptyLabels, adminOptions)
      expect(result).toEqual([
        { label: 'Admin', href: null },
      ])
    })

    it('resolves /admin/facilities', () => {
      const result = resolveBreadcrumbs('/admin/facilities', emptyLabels, adminOptions)
      expect(result).toEqual([
        { label: 'Admin', href: '/admin' },
        { label: 'Facilities', href: null },
      ])
    })

    it('resolves /admin/settings/milestones (3-level)', () => {
      const result = resolveBreadcrumbs('/admin/settings/milestones', emptyLabels, adminOptions)
      expect(result).toEqual([
        { label: 'Admin', href: '/admin' },
        { label: 'Settings', href: null },
        { label: 'Milestones', href: null },
      ])
    })

    it('resolves /admin/facilities/new (3-level)', () => {
      const result = resolveBreadcrumbs('/admin/facilities/new', emptyLabels, adminOptions)
      expect(result).toEqual([
        { label: 'Admin', href: '/admin' },
        { label: 'Facilities', href: '/admin/facilities' },
        { label: 'New Facility', href: null },
      ])
    })
  })

  // ============================================
  // SETTINGS FALLBACK via getSettingsLabel
  // ============================================

  describe('settings fallback', () => {
    const optionsWithSettings = {
      ...facilityOptions,
      getSettingsLabel: (pathname: string) => {
        if (pathname === '/settings/financials/cost-categories') return 'Cost Categories'
        if (pathname === '/settings/users') return 'Users & Roles'
        return undefined
      },
    }

    it('resolves /settings/financials/cost-categories via getSettingsLabel', () => {
      const result = resolveBreadcrumbs('/settings/financials/cost-categories', emptyLabels, optionsWithSettings)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Cost Categories', href: null },
      ])
    })

    it('resolves /settings/users via getSettingsLabel', () => {
      const result = resolveBreadcrumbs('/settings/users', emptyLabels, optionsWithSettings)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Users & Roles', href: null },
      ])
    })
  })

  // ============================================
  // SETTINGS FALLBACK — integration with getNavItemForPath
  // ============================================

  describe('settings integration with getNavItemForPath', () => {
    // Import the real getNavItemForPath to test integration
    it('can wire getNavItemForPath as getSettingsLabel', async () => {
      const { getNavItemForPath } = await import('../settings-nav-config')
      const opts = {
        ...facilityOptions,
        getSettingsLabel: (p: string) => getNavItemForPath(p)?.label,
      }
      const result = resolveBreadcrumbs('/settings/users', emptyLabels, opts)
      // Should resolve to something — the exact label depends on settings-nav-config
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result[result.length - 1].href).toBeNull()
    })
  })

  // ============================================
  // LONGEST-PREFIX FALLBACK
  // ============================================

  describe('longest-prefix fallback', () => {
    it('falls back to /analytics for /analytics/unknown-page', () => {
      const result = resolveBreadcrumbs('/analytics/unknown-page', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Analytics', href: null },
      ])
    })

    it('falls back to /cases for /cases/not-a-uuid/something', () => {
      const result = resolveBreadcrumbs('/cases/not-a-uuid/something', emptyLabels, facilityOptions)
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Cases', href: null },
      ])
    })
  })

  // ============================================
  // UNKNOWN ROUTES
  // ============================================

  describe('unknown routes', () => {
    it('falls back to root for completely unknown route', () => {
      const result = resolveBreadcrumbs('/totally/unknown/path', emptyLabels, facilityOptions)
      // Falls back to / (dashboard) since / is a prefix of every path
      expect(result).toEqual([
        { label: 'General Hospital', href: '/' },
        { label: 'Dashboard', href: null },
      ])
    })
  })

  // ============================================
  // FACILITY NAME HANDLING
  // ============================================

  describe('facility name handling', () => {
    it('does not prepend facility when facilityName is null', () => {
      const result = resolveBreadcrumbs('/cases', emptyLabels, { isAdmin: false, facilityName: null })
      expect(result).toEqual([
        { label: 'Cases', href: null },
      ])
    })

    it('does not prepend facility for admin routes', () => {
      const result = resolveBreadcrumbs('/admin', emptyLabels, { isAdmin: true, facilityName: 'General Hospital' })
      expect(result).toEqual([
        { label: 'Admin', href: null },
      ])
    })
  })

  // ============================================
  // ROUTE MAP COVERAGE
  // ============================================

  describe('route map coverage', () => {
    it('has entries for all expected facility routes', () => {
      const expectedRoutes = [
        '/', '/dashboard', '/dashboard/data-quality',
        '/cases', '/cases/new', '/cases/bulk-create', '/cases/[id]', '/cases/[id]/edit', '/cases/[id]/cancel',
        '/analytics', '/analytics/surgeons', '/analytics/block-utilization',
        '/analytics/financials', '/analytics/orbit-score', '/analytics/flags', '/analytics/kpi',
        '/rooms', '/block-schedule', '/checkin', '/spd', '/profile', '/settings',
      ]
      for (const route of expectedRoutes) {
        expect(ROUTE_BREADCRUMBS[route]).toBeDefined()
      }
    })

    it('has entries for all expected admin routes', () => {
      const expectedRoutes = [
        '/admin', '/admin/facilities', '/admin/facilities/new', '/admin/facilities/[id]',
        '/admin/audit-log', '/admin/cancellation-reasons', '/admin/checklist-templates',
        '/admin/complexities', '/admin/demo', '/admin/docs', '/admin/global-security',
        '/admin/permission-templates',
        '/admin/settings/body-regions', '/admin/settings/cost-categories',
        '/admin/settings/delay-types', '/admin/settings/implant-companies',
        '/admin/settings/milestones', '/admin/settings/procedure-categories',
        '/admin/settings/procedure-milestones', '/admin/settings/procedures',
      ]
      for (const route of expectedRoutes) {
        expect(ROUTE_BREADCRUMBS[route]).toBeDefined()
      }
    })
  })
})
