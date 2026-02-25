// app/settings/milestones/__tests__/page-templates-tab.test.tsx
// Workflow tests: tab navigation to/from Templates tab
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Need to mock before importing the page component
let mockTab: string | null = null
const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(mockTab ? `tab=${mockTab}` : ''),
  usePathname: () => '/settings/milestones',
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    effectiveFacilityId: 'facility-1',
    loading: false,
  }),
}))

const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  is: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  order: vi.fn(() => ({ data: [], error: null })),
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({ data: [], loading: false, error: null, setData: vi.fn(), refetch: vi.fn() }),
  useCurrentUser: () => ({ data: { userId: 'u1', facilityId: 'f1' }, loading: false }),
}))

// Mock the TemplateBuilder to avoid complex dependency chain
vi.mock('@/components/settings/milestones/TemplateBuilder', () => ({
  TemplateBuilder: () => <div data-testid="template-builder">Template Builder Content</div>,
}))

// Mock PhaseLibrary
vi.mock('@/components/settings/milestones/PhaseLibrary', () => ({
  PhaseLibrary: () => <div data-testid="phase-library">Phase Library Content</div>,
}))

// Import after mocks
import MilestonesSettingsPage from '../PageClient'

beforeEach(() => {
  vi.clearAllMocks()
  mockTab = null
})

describe('MilestonesSettingsPage - Tab Navigation', () => {
  it('renders all five tab buttons', () => {
    render(<MilestonesSettingsPage />)

    // "Milestones" appears in both the h1 and the tab — use getAllByText
    const milestoneMatches = screen.getAllByText('Milestones')
    expect(milestoneMatches.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Phases')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Procedures')).toBeInTheDocument()
    expect(screen.getByText('Surgeons')).toBeInTheDocument()
  })

  it('defaults to Milestones tab when no ?tab param', () => {
    mockTab = null
    render(<MilestonesSettingsPage />)

    // Find the Milestones tab button (not the h1) — look for buttons containing "Milestones"
    const buttons = screen.getAllByText('Milestones').map(el => el.closest('button')).filter(Boolean)
    const milestonesBtn = buttons[0]
    expect(milestonesBtn?.className).toContain('border-blue')
  })

  it('renders TemplateBuilder when ?tab=templates', () => {
    mockTab = 'templates'
    render(<MilestonesSettingsPage />)

    expect(screen.getByTestId('template-builder')).toBeInTheDocument()
    expect(screen.getByText('Template Builder Content')).toBeInTheDocument()
  })

  it('renders PhaseLibrary when ?tab=phases', () => {
    mockTab = 'phases'
    render(<MilestonesSettingsPage />)

    expect(screen.getByTestId('phase-library')).toBeInTheDocument()
  })

  it('clicking Templates tab navigates via router.push', async () => {
    const user = userEvent.setup()
    render(<MilestonesSettingsPage />)

    const templatesBtn = screen.getByText('Templates').closest('button')!
    await user.click(templatesBtn)

    expect(mockPush).toHaveBeenCalledWith('/settings/milestones?tab=templates')
  })

  it('clicking Milestones tab removes tab param from URL', async () => {
    const user = userEvent.setup()
    mockTab = 'templates'
    render(<MilestonesSettingsPage />)

    const buttons = screen.getAllByText('Milestones').map(el => el.closest('button')).filter(Boolean)
    await user.click(buttons[0]!)

    expect(mockPush).toHaveBeenCalledWith('/settings/milestones')
  })

  it('falls back to Milestones tab for invalid ?tab param', () => {
    mockTab = 'invalid-tab'
    render(<MilestonesSettingsPage />)

    // Should NOT render the TemplateBuilder
    expect(screen.queryByTestId('template-builder')).not.toBeInTheDocument()
    // Should show default Milestones tab content (the active styling)
    const buttons = screen.getAllByText('Milestones').map(el => el.closest('button')).filter(Boolean)
    expect(buttons[0]?.className).toContain('border-blue')
  })

  it('shows placeholder content for Procedures and Surgeons tabs', () => {
    mockTab = 'procedures'
    const { rerender } = render(<MilestonesSettingsPage />)
    expect(screen.getByText(/Procedure template assignment/)).toBeInTheDocument()

    mockTab = 'surgeons'
    rerender(<MilestonesSettingsPage />)
    expect(screen.getByText(/Surgeon template overrides/)).toBeInTheDocument()
  })
})
