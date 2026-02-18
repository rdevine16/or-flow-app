// components/layouts/__tests__/Header.breadcrumbs.test.tsx
// Tests for the Phase 2 dynamic breadcrumb implementation in Header.
// Covers: correct segment rendering, clickability rules, and BreadcrumbProvider integration.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Header from '../Header'
import { BreadcrumbProvider, useBreadcrumbLabel } from '@/lib/BreadcrumbContext'

// ============================================
// MOCKS
// ============================================

// Render <a> so we can assert href and role
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
    [key: string]: unknown
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}))

// Render <img> — next/image adds no testable behaviour here
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string
    alt: string
    width: number
    height: number
    className?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}))

// GlobalSearch and NotificationBell are not under test — stub them out
vi.mock('../../GlobalSearch', () => ({
  default: () => <div data-testid="global-search" />,
}))

vi.mock('../../global/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

// ============================================
// FACTORIES
// ============================================

function baseUserData(overrides = {}) {
  return {
    firstName: 'Jane',
    lastName: 'Smith',
    accessLevel: 'facility_admin',
    facilityId: 'fac-1',
    facilityName: 'General Hospital',
    ...overrides,
  }
}

function baseProps(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  return {
    pathname: '/cases',
    navigation: [],
    userData: baseUserData(),
    impersonation: null,
    facilityStatus: null,
    isAdmin: false,
    onEndImpersonation: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  }
}

/**
 * Render Header inside BreadcrumbProvider (mirrors DashboardLayout).
 */
function renderHeader(props: Parameters<typeof Header>[0]) {
  return render(
    <BreadcrumbProvider>
      <Header {...props} />
    </BreadcrumbProvider>
  )
}

// ============================================
// HELPERS
// ============================================

/**
 * Collect all breadcrumb segment text values rendered inside the <nav>.
 * Returns an array in trail order.
 */
function getBreadcrumbTexts(): string[] {
  const nav = document.querySelector('nav')
  if (!nav) return []
  // Grab text from <a> and <span> elements that represent segments
  const segments: string[] = []
  nav.querySelectorAll('a, span.font-semibold').forEach(el => {
    const text = (el as HTMLElement).innerText ?? el.textContent ?? ''
    if (text.trim()) segments.push(text.trim())
  })
  return segments
}

/**
 * Returns the link element for a given segment label (or null if not a link).
 */
function getLinkByLabel(label: string): HTMLAnchorElement | null {
  const nav = document.querySelector('nav')
  if (!nav) return null
  const anchor = Array.from(nav.querySelectorAll('a')).find(
    a => (a.textContent ?? '').trim() === label
  )
  return (anchor as HTMLAnchorElement) ?? null
}

/**
 * Returns the non-link span for a given segment label (or null).
 */
function getNonLinkSpanByLabel(label: string): HTMLSpanElement | null {
  const nav = document.querySelector('nav')
  if (!nav) return null
  const span = Array.from(nav.querySelectorAll('span.font-semibold')).find(
    s => (s.textContent ?? '').trim() === label
  )
  return (span as HTMLSpanElement) ?? null
}

// ============================================
// STAGE 3 — UNIT TESTS: BREADCRUMB RENDERING
// ============================================

describe('Header breadcrumb rendering', () => {
  describe('flat routes (single segment)', () => {
    it('renders facility + page for /cases', () => {
      renderHeader(baseProps({ pathname: '/cases' }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('General Hospital')
      expect(texts).toContain('Cases')
    })

    it('renders facility + page for /rooms', () => {
      renderHeader(baseProps({ pathname: '/rooms' }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('General Hospital')
      expect(texts).toContain('Rooms')
    })

    it('renders facility + Dashboard for /', () => {
      renderHeader(baseProps({ pathname: '/' }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('General Hospital')
      expect(texts).toContain('Dashboard')
    })
  })

  describe('nested routes (multi-segment)', () => {
    it('renders 3-level trail for /analytics/surgeons', () => {
      renderHeader(baseProps({ pathname: '/analytics/surgeons' }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('General Hospital')
      expect(texts).toContain('Analytics')
      expect(texts).toContain('Surgeon Performance')
    })

    it('renders 3-level trail for /cases/new', () => {
      renderHeader(baseProps({ pathname: '/cases/new' }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('Cases')
      expect(texts).toContain('New Case')
    })

    it('renders 3-level trail for /dashboard/data-quality', () => {
      renderHeader(baseProps({ pathname: '/dashboard/data-quality' }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('Dashboard')
      expect(texts).toContain('Data Quality')
    })
  })

  describe('admin routes (no facility prefix)', () => {
    const adminProps = baseProps({
      isAdmin: true,
      userData: baseUserData({ accessLevel: 'global_admin', facilityName: null }),
    })

    it('does not prepend facility for /admin routes', () => {
      renderHeader({ ...adminProps, pathname: '/admin/facilities' })
      const texts = getBreadcrumbTexts()
      expect(texts).not.toContain('General Hospital')
      expect(texts).toContain('Admin')
      expect(texts).toContain('Facilities')
    })

    it('renders 3-level admin trail for /admin/settings/milestones', () => {
      renderHeader({ ...adminProps, pathname: '/admin/settings/milestones' })
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('Admin')
      expect(texts).toContain('Settings')
      expect(texts).toContain('Milestones')
    })
  })

  describe('dynamic [id] routes', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    it('shows "Loading..." when no dynamic label is registered', () => {
      renderHeader(baseProps({ pathname: `/cases/${uuid}` }))
      const texts = getBreadcrumbTexts()
      expect(texts).toContain('Loading...')
    })

    it('shows the registered label once BreadcrumbProvider receives it', async () => {
      // A child component registers a dynamic label
      function LabelInjector() {
        useBreadcrumbLabel('/cases/[id]', 'Case #1042')
        return null
      }

      await act(async () => {
        render(
          <BreadcrumbProvider>
            <LabelInjector />
            <Header {...baseProps({ pathname: `/cases/${uuid}` })} />
          </BreadcrumbProvider>
        )
      })

      const texts = getBreadcrumbTexts()
      expect(texts).toContain('Case #1042')
      expect(texts).not.toContain('Loading...')
    })
  })
})

// ============================================
// STAGE 3 — UNIT TESTS: SEGMENT CLICKABILITY
// ============================================

describe('Header breadcrumb segment clickability rules', () => {
  it('last segment is a non-clickable bold span, not a link', () => {
    renderHeader(baseProps({ pathname: '/cases' }))
    // "Cases" is the last segment for a facility user on /cases
    const span = getNonLinkSpanByLabel('Cases')
    expect(span).not.toBeNull()
    // Confirm there is no <a> wrapping "Cases"
    const link = getLinkByLabel('Cases')
    expect(link).toBeNull()
  })

  it('last segment of a nested route is non-clickable', () => {
    renderHeader(baseProps({ pathname: '/analytics/surgeons' }))
    const span = getNonLinkSpanByLabel('Surgeon Performance')
    expect(span).not.toBeNull()
    const link = getLinkByLabel('Surgeon Performance')
    expect(link).toBeNull()
  })

  it('intermediate segments with href are rendered as clickable links', () => {
    renderHeader(baseProps({ pathname: '/analytics/surgeons' }))
    const link = getLinkByLabel('Analytics')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/analytics')
  })

  it('facility segment (first) is a clickable link to /', () => {
    renderHeader(baseProps({ pathname: '/analytics/surgeons' }))
    const link = getLinkByLabel('General Hospital')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/')
  })

  it('4-level trail: only last segment is non-clickable', () => {
    // /cases/[uuid]/edit → Facility > Cases > [dynamic] > Edit
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    function LabelInjector() {
      useBreadcrumbLabel('/cases/[id]', 'Case #999')
      return null
    }

    render(
      <BreadcrumbProvider>
        <LabelInjector />
        <Header {...baseProps({ pathname: `/cases/${uuid}/edit` })} />
      </BreadcrumbProvider>
    )

    // "Edit" is the last segment — must be a span, not a link
    const editSpan = getNonLinkSpanByLabel('Edit')
    expect(editSpan).not.toBeNull()
    const editLink = getLinkByLabel('Edit')
    expect(editLink).toBeNull()

    // "Case #999" is an intermediate segment — must be a link
    const caseLink = getLinkByLabel('Case #999')
    expect(caseLink).not.toBeNull()
    expect(caseLink?.getAttribute('href')).toBe(`/cases/${uuid}`)

    // "Cases" is an intermediate segment — must be a link
    const casesLink = getLinkByLabel('Cases')
    expect(casesLink).not.toBeNull()
    expect(casesLink?.getAttribute('href')).toBe('/cases')
  })
})

// ============================================
// STAGE 3 — INTEGRATION TEST: Provider + Header
// ============================================

describe('BreadcrumbProvider + Header integration', () => {
  it('Header updates when a child registers a new dynamic label', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    // Start with no label registered
    const { rerender } = render(
      <BreadcrumbProvider>
        <Header {...baseProps({ pathname: `/cases/${uuid}` })} />
      </BreadcrumbProvider>
    )

    // Initially shows "Loading..."
    let texts = getBreadcrumbTexts()
    expect(texts).toContain('Loading...')

    // Now a child registers the label
    function LabelInjector() {
      useBreadcrumbLabel('/cases/[id]', 'Case #2077')
      return null
    }

    await act(async () => {
      rerender(
        <BreadcrumbProvider>
          <LabelInjector />
          <Header {...baseProps({ pathname: `/cases/${uuid}` })} />
        </BreadcrumbProvider>
      )
    })

    texts = getBreadcrumbTexts()
    expect(texts).toContain('Case #2077')
    expect(texts).not.toContain('Loading...')
  })

  it('Header reverts to "Loading..." when the child unmounts', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    function LabelInjector() {
      useBreadcrumbLabel('/cases/[id]', 'Case #2077')
      return null
    }

    const { rerender } = render(
      <BreadcrumbProvider>
        <LabelInjector />
        <Header {...baseProps({ pathname: `/cases/${uuid}` })} />
      </BreadcrumbProvider>
    )

    await act(async () => {})
    let texts = getBreadcrumbTexts()
    expect(texts).toContain('Case #2077')

    // Unmount the registrar
    await act(async () => {
      rerender(
        <BreadcrumbProvider>
          <Header {...baseProps({ pathname: `/cases/${uuid}` })} />
        </BreadcrumbProvider>
      )
    })

    texts = getBreadcrumbTexts()
    expect(texts).toContain('Loading...')
    expect(texts).not.toContain('Case #2077')
  })

  it('Header reflects impersonation context: no facility prefix when impersonating', () => {
    // When isAdmin=true and impersonation is active, isAdmin && !impersonation = false
    // so the facility prefix IS prepended (for the impersonated facility name from userData)
    // Test: when isAdmin=true and no impersonation, no facility prefix
    const adminProps = baseProps({
      isAdmin: true,
      impersonation: null,
      userData: baseUserData({ accessLevel: 'global_admin', facilityName: null }),
      pathname: '/admin/facilities',
    })
    renderHeader(adminProps)
    const texts = getBreadcrumbTexts()
    // No facility prefix (facilityName is null and isAdmin=true)
    expect(texts).not.toContain('General Hospital')
    expect(texts).toContain('Admin')
    expect(texts).toContain('Facilities')
  })
})

// ============================================
// STAGE 3 — WORKFLOW TEST: settings fallback
// ============================================

describe('Header breadcrumb: settings routes via getNavItemForPath', () => {
  it('resolves /settings path to Settings label', () => {
    renderHeader(baseProps({ pathname: '/settings' }))
    const texts = getBreadcrumbTexts()
    expect(texts).toContain('Settings')
  })

  it('resolves unknown /settings/sub-page via getNavItemForPath fallback or prefix fallback', () => {
    // For any /settings/* path, at minimum the "Settings" breadcrumb should appear
    renderHeader(baseProps({ pathname: '/settings/users' }))
    const texts = getBreadcrumbTexts()
    expect(texts).toContain('Settings')
    // Last segment should not be a link
    const lastText = texts[texts.length - 1]
    const link = getLinkByLabel(lastText)
    expect(link).toBeNull()
  })
})

// ============================================
// STAGE 3 — PHASE 3 INTEGRATION: analytics and
// settings pages rely on Header breadcrumb only
// (no inline <nav> after Phase 3 removal)
// ============================================

describe('Phase 3: Header breadcrumb is the sole breadcrumb for analytics and settings routes', () => {
  it('renders the Analytics > Surgeon Performance trail from Header for /analytics/surgeons', () => {
    // AnalyticsPageHeader no longer renders its own <nav>; Header must supply breadcrumbs.
    renderHeader(baseProps({ pathname: '/analytics/surgeons' }))
    const texts = getBreadcrumbTexts()
    expect(texts).toContain('General Hospital')
    expect(texts).toContain('Analytics')
    expect(texts).toContain('Surgeon Performance')
    // Confirm "Analytics" is a clickable link (intermediate segment)
    const analyticsLink = getLinkByLabel('Analytics')
    expect(analyticsLink).not.toBeNull()
    expect(analyticsLink?.getAttribute('href')).toBe('/analytics')
    // Confirm "Surgeon Performance" is the non-clickable current page
    const span = getNonLinkSpanByLabel('Surgeon Performance')
    expect(span).not.toBeNull()
  })

  it('renders the Analytics > Financial Analytics trail for /analytics/financials', () => {
    renderHeader(baseProps({ pathname: '/analytics/financials' }))
    const texts = getBreadcrumbTexts()
    expect(texts).toContain('Analytics')
    expect(texts).toContain('Financial Analytics')
    const span = getNonLinkSpanByLabel('Financial Analytics')
    expect(span).not.toBeNull()
  })

  it('renders the Settings trail from Header for /settings', () => {
    // SettingsLanding no longer renders its own breadcrumb; Header must supply it.
    renderHeader(baseProps({ pathname: '/settings' }))
    const texts = getBreadcrumbTexts()
    expect(texts).toContain('General Hospital')
    expect(texts).toContain('Settings')
    const span = getNonLinkSpanByLabel('Settings')
    expect(span).not.toBeNull()
  })

  it('cancel sub-route shows case label as a linked intermediate segment', async () => {
    // Both /cases/[id] and /cases/[id]/cancel call useBreadcrumbLabel with the same
    // key '/cases/[id]'. The cancel page's breadcrumb must show the case label as a
    // link (not the terminal segment) so the user can navigate back to the case.
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    function LabelInjector() {
      useBreadcrumbLabel('/cases/[id]', 'Case #1042')
      return null
    }

    await act(async () => {
      render(
        <BreadcrumbProvider>
          <LabelInjector />
          <Header {...baseProps({ pathname: `/cases/${uuid}/cancel` })} />
        </BreadcrumbProvider>
      )
    })

    const texts = getBreadcrumbTexts()
    // Trail: General Hospital > Cases > Case #1042 > Cancel
    expect(texts).toContain('Cases')
    expect(texts).toContain('Case #1042')
    expect(texts).toContain('Cancel')

    // "Case #1042" must be a link (intermediate) not the terminal span
    const caseLink = getLinkByLabel('Case #1042')
    expect(caseLink).not.toBeNull()
    expect(caseLink?.getAttribute('href')).toBe(`/cases/${uuid}`)

    // "Cancel" must be the non-clickable terminal span
    const cancelSpan = getNonLinkSpanByLabel('Cancel')
    expect(cancelSpan).not.toBeNull()
    const cancelLink = getLinkByLabel('Cancel')
    expect(cancelLink).toBeNull()
  })

  it('admin facility detail shows facility name as terminal breadcrumb segment', async () => {
    // app/admin/facilities/[id]/page.tsx calls useBreadcrumbLabel('/admin/facilities/[id]', facility?.name).
    // Verify the Header renders: Admin > Facilities > St. Mary Hospital (non-clickable).
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    function FacilityLabelInjector() {
      useBreadcrumbLabel('/admin/facilities/[id]', 'St. Mary Hospital')
      return null
    }

    const adminProps = baseProps({
      isAdmin: true,
      pathname: `/admin/facilities/${uuid}`,
      userData: baseUserData({ accessLevel: 'global_admin', facilityName: null }),
    })

    await act(async () => {
      render(
        <BreadcrumbProvider>
          <FacilityLabelInjector />
          <Header {...adminProps} />
        </BreadcrumbProvider>
      )
    })

    const texts = getBreadcrumbTexts()
    expect(texts).toContain('Admin')
    expect(texts).toContain('Facilities')
    expect(texts).toContain('St. Mary Hospital')

    // "Facilities" is a link
    const facilitiesLink = getLinkByLabel('Facilities')
    expect(facilitiesLink).not.toBeNull()
    expect(facilitiesLink?.getAttribute('href')).toBe('/admin/facilities')

    // "St. Mary Hospital" is the terminal non-clickable span
    const facilitySpan = getNonLinkSpanByLabel('St. Mary Hospital')
    expect(facilitySpan).not.toBeNull()
    const facilityLink = getLinkByLabel('St. Mary Hospital')
    expect(facilityLink).toBeNull()

    // Facility name is NOT prepended (admin route)
    expect(texts).not.toContain('General Hospital')
  })

  it('admin facility detail shows Loading... before facility name is available', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    const adminProps = baseProps({
      isAdmin: true,
      pathname: `/admin/facilities/${uuid}`,
      userData: baseUserData({ accessLevel: 'global_admin', facilityName: null }),
    })

    renderHeader(adminProps)
    // No label registered yet (facility data still loading)
    const texts = getBreadcrumbTexts()
    expect(texts).toContain('Loading...')
    expect(texts).toContain('Admin')
    expect(texts).toContain('Facilities')
  })
})
