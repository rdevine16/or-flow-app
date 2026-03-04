import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// =====================================================
// Mocks
// =====================================================

const mockShowToast = vi.fn()
vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

let mockTier: 'essential' | 'professional' | 'enterprise' = 'professional'

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    effectiveFacilityId: 'fac-1',
    loading: false,
    tier: mockTier,
    tierName:
      mockTier === 'essential'
        ? 'Essential'
        : mockTier === 'professional'
          ? 'Professional'
          : 'Enterprise',
    tierLoading: false,
    isTierAtLeast: (required: string) => {
      const order: Record<string, number> = { essential: 1, professional: 2, enterprise: 3 }
      return order[mockTier] >= order[required]
    },
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    permissionsLoading: false,
    isGlobalAdmin: false,
    isAdmin: true,
    userData: { userId: 'user-1' },
  }),
}))

// Build a fully chainable Supabase mock where every method returns itself,
// and the final result is a resolved promise with {data, error, count}.
function buildChain(result: { data: unknown; error: null; count?: number }) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make it thenable so await/Promise.all works
        return (resolve: (v: unknown) => void) => resolve(result)
      }
      // Return a function that returns the proxy (chainable)
      return () => new Proxy({}, handler)
    },
  }
  return new Proxy({}, handler)
}

let callIndex = 0

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'cases') {
        // The component fires 2 case queries (this month, last month) via Promise.all
        const idx = callIndex++
        const count = idx === 0 ? 42 : 38
        return buildChain({ data: null, error: null, count })
      }
      if (table === 'users') {
        return buildChain({ data: null, error: null, count: 7 })
      }
      return buildChain({ data: [], error: null })
    },
  }),
}))

vi.mock('@/lib/date-utils', () => ({
  getLocalDateString: (d: Date) => d.toISOString().split('T')[0],
}))

import PageClient from '../PageClient'

// =====================================================
// Tests
// =====================================================

describe('SubscriptionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTier = 'professional'
    callIndex = 0
  })

  // --------------------------------------------------
  // Unit: renders current plan from DB, not hardcoded
  // --------------------------------------------------

  it('renders current plan name and price from tier config', async () => {
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('$1,500')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Full analytics suite with scoring, flags, and data quality.')
    ).toBeInTheDocument()
  })

  it('renders Essential plan when tier is essential', async () => {
    mockTier = 'essential'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('$750')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Day-of surgical flow with patient tracking.')
    ).toBeInTheDocument()
  })

  it('renders Enterprise plan when tier is enterprise', async () => {
    mockTier = 'enterprise'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('$2,500')).toBeInTheDocument()
    })
  })

  // --------------------------------------------------
  // Unit: Feature comparison grid
  // --------------------------------------------------

  it('shows feature comparison table with all three tiers', async () => {
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Plan Comparison')).toBeInTheDocument()
    })
    // All tiers present as column header prices
    expect(screen.getByText('$750/mo')).toBeInTheDocument()
    expect(screen.getByText('$1,500/mo')).toBeInTheDocument()
    expect(screen.getByText('$2,500/mo')).toBeInTheDocument()

    // Feature rows
    expect(screen.getByText('Day-of Surgical Flow')).toBeInTheDocument()
    expect(screen.getByText('Advanced Analytics')).toBeInTheDocument()
    expect(screen.getByText('Financial Analytics')).toBeInTheDocument()
    expect(screen.getByText('EHR Integrations')).toBeInTheDocument()
  })

  it('highlights current plan column in comparison grid', async () => {
    mockTier = 'professional'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Plan Comparison')).toBeInTheDocument()
    })
    // "Current" badge in the grid header
    const currentBadges = screen.getAllByText('Current')
    expect(currentBadges.length).toBeGreaterThanOrEqual(1)
  })

  // --------------------------------------------------
  // Integration: Upgrade CTA visibility
  // --------------------------------------------------

  it('shows upgrade CTA for Essential tier', async () => {
    mockTier = 'essential'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Ready to unlock more?')).toBeInTheDocument()
    })
    expect(screen.getByText('Request Upgrade')).toBeInTheDocument()
  })

  it('shows upgrade CTA for Professional tier', async () => {
    mockTier = 'professional'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Ready to unlock more?')).toBeInTheDocument()
    })
  })

  it('hides upgrade CTA for Enterprise tier', async () => {
    mockTier = 'enterprise'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('$2,500')).toBeInTheDocument()
    })
    expect(screen.queryByText('Ready to unlock more?')).not.toBeInTheDocument()
  })

  it('upgrade CTA mailto links to support@orbitsurgical.com', async () => {
    mockTier = 'professional'
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Request Upgrade')).toBeInTheDocument()
    })
    const upgradeLink = screen.getByText('Request Upgrade').closest('a')
    expect(upgradeLink).toHaveAttribute(
      'href',
      'mailto:support@orbitsurgical.com?subject=Subscription%20Upgrade%20Request'
    )
  })

  // --------------------------------------------------
  // Integration: Usage stats section
  // --------------------------------------------------

  it('renders usage stats section with labels', async () => {
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Current Usage')).toBeInTheDocument()
    })
    expect(screen.getByText('Cases This Month')).toBeInTheDocument()
    expect(screen.getByText('Active Users')).toBeInTheDocument()
    expect(screen.getByText('Features Enabled')).toBeInTheDocument()
  })

  // --------------------------------------------------
  // Integration: No "Coming Soon" banner
  // --------------------------------------------------

  it('does not show Coming Soon banner', async () => {
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Plan Comparison')).toBeInTheDocument()
    })
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument()
  })

  // --------------------------------------------------
  // Integration: Contact sales CTA always visible
  // --------------------------------------------------

  it('always shows contact sales CTA', async () => {
    render(<PageClient />)

    await waitFor(() => {
      expect(screen.getByText('Need a custom plan?')).toBeInTheDocument()
    })
    const salesLink = screen.getByText('Contact Sales').closest('a')
    expect(salesLink).toHaveAttribute(
      'href',
      'mailto:support@orbitsurgical.com?subject=Enterprise%20Plan%20Inquiry'
    )
  })

  // --------------------------------------------------
  // Workflow: Essential user views subscription page
  // --------------------------------------------------

  it('workflow: Essential user sees plan, limited features, and upgrade path', async () => {
    mockTier = 'essential'
    render(<PageClient />)

    // 1. Sees their current plan
    await waitFor(() => {
      expect(screen.getByText('$750')).toBeInTheDocument()
    })

    // 2. Sees feature comparison
    expect(screen.getByText('Day-of Surgical Flow')).toBeInTheDocument()
    expect(screen.getByText('Plan Comparison')).toBeInTheDocument()

    // 3. Sees upgrade CTA
    expect(screen.getByText('Ready to unlock more?')).toBeInTheDocument()
    expect(screen.getByText('Request Upgrade')).toBeInTheDocument()

    // 4. Sees usage stats
    expect(screen.getByText('Cases This Month')).toBeInTheDocument()
    expect(screen.getByText('Active Users')).toBeInTheDocument()
  })
})
