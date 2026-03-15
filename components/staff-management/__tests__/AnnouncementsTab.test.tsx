// components/staff-management/__tests__/AnnouncementsTab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnnouncementsTab } from '../AnnouncementsTab'
import type { Announcement } from '@/types/announcements'

// ============================================
// Mocks
// ============================================

const mockCreateAnnouncement = vi.fn()
const mockUpdateAnnouncement = vi.fn()
const mockDeactivateAnnouncement = vi.fn()
const mockDeleteAnnouncement = vi.fn()
const mockSetFilters = vi.fn()
const mockClearFilters = vi.fn()
const mockRefetch = vi.fn()

let mockAnnouncements: Announcement[] = []
let mockLoading = false

vi.mock('@/hooks/useAnnouncements', () => ({
  useAnnouncements: () => ({
    announcements: mockAnnouncements,
    loading: mockLoading,
    error: null,
    refetch: mockRefetch,
    filters: {},
    setFilters: mockSetFilters,
    clearFilters: mockClearFilters,
    createAnnouncement: mockCreateAnnouncement,
    updateAnnouncement: mockUpdateAnnouncement,
    deactivateAnnouncement: mockDeactivateAnnouncement,
    deleteAnnouncement: mockDeleteAnnouncement,
  }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    userData: { userId: 'user-1', firstName: 'Jane', lastName: 'Admin', facilityName: 'Test Hospital' },
    effectiveFacilityId: 'fac-1',
    isAdmin: true,
    isGlobalAdmin: false,
    loading: false,
    isImpersonating: false,
  }),
}))

// Mock the sub-components to keep tests focused
vi.mock('@/components/ui/Modal', () => {
  const Footer = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  const Cancel = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}>{children}</button>
  )
  const Action = ({ onClick, disabled, loading, children }: {
    onClick?: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode
  }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading} data-testid="modal-action">
      {children}
    </button>
  )
  function Modal({ open, title, children }: {
    open: boolean; onClose: () => void; title: string; children: React.ReactNode
    icon?: React.ReactNode; size?: string; scrollable?: boolean
  }) {
    if (!open) return null
    return <div data-testid="create-dialog"><h2>{title}</h2>{children}</div>
  }
  Modal.Footer = Footer
  Modal.Cancel = Cancel
  Modal.Action = Action
  return { Modal }
})

vi.mock('@/components/ui/Toggle', () => ({
  Toggle: ({ checked, onChange }: { checked: boolean; onChange: () => void; disabled?: boolean; size?: string }) => (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}>
      {checked ? 'On' : 'Off'}
    </button>
  ),
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm, onClose, title, confirmText, loading }: {
    open: boolean; onConfirm: () => void; onClose: () => void; title: string
    message: string; confirmText?: string; loading?: boolean; variant?: string
  }) => {
    if (!open) return null
    return (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button onClick={onConfirm} disabled={loading}>{confirmText ?? 'Confirm'}</button>
        <button onClick={onClose}>Cancel action</button>
      </div>
    )
  },
}))

// ============================================
// Test data
// ============================================

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'ann-1',
    facility_id: 'fac-1',
    created_by: 'user-1',
    title: 'Test Announcement',
    body: null,
    audience: 'both',
    priority: 'normal',
    category: 'general',
    status: 'active',
    starts_at: '2026-03-10T09:00:00Z',
    expires_at: '2026-03-11T09:00:00Z',
    deactivated_at: null,
    deactivated_by: null,
    created_at: '2026-03-10T09:00:00Z',
    updated_at: '2026-03-10T09:00:00Z',
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    creator: { id: 'user-1', first_name: 'Jane', last_name: 'Admin' },
    ...overrides,
  }
}

// ============================================
// Tests
// ============================================

describe('AnnouncementsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAnnouncements = []
    mockLoading = false
    mockCreateAnnouncement.mockResolvedValue({ success: true })
    mockUpdateAnnouncement.mockResolvedValue({ success: true })
    mockDeactivateAnnouncement.mockResolvedValue({ success: true })
    mockDeleteAnnouncement.mockResolvedValue({ success: true })
  })

  describe('rendering', () => {
    it('renders header and create button', () => {
      render(<AnnouncementsTab facilityId="fac-1" />)

      expect(screen.getByText('Announcements')).toBeInTheDocument()
      expect(screen.getByText('Create Announcement')).toBeInTheDocument()
    })

    it('renders stats cards with zero counts', () => {
      render(<AnnouncementsTab facilityId="fac-1" />)

      const zeroCounts = screen.getAllByText('0')
      expect(zeroCounts.length).toBe(3)
      // "Active" appears in both stat card label and filter dropdown — check both exist
      const activeTexts = screen.getAllByText('Active')
      expect(activeTexts.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Expired / Deactivated')).toBeInTheDocument()
    })

    it('computes stats from announcements data', () => {
      mockAnnouncements = [
        makeAnnouncement({ id: '1', status: 'active' }),
        makeAnnouncement({ id: '2', status: 'active' }),
        makeAnnouncement({ id: '3', status: 'scheduled' }),
        makeAnnouncement({ id: '4', status: 'expired' }),
        makeAnnouncement({ id: '5', status: 'deactivated' }),
      ]

      render(<AnnouncementsTab facilityId="fac-1" />)

      // Active count = 2, Scheduled = 1, Expired/Deactivated = 2
      // "2" appears in both active and expired/deactivated stat cards, plus possibly elsewhere
      const twoElements = screen.getAllByText('2')
      expect(twoElements.length).toBeGreaterThanOrEqual(2) // active=2, expired+deactivated=2
    })
  })

  describe('create dialog', () => {
    it('opens create dialog when button is clicked', () => {
      render(<AnnouncementsTab facilityId="fac-1" />)

      expect(screen.queryByTestId('create-dialog')).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('Create Announcement'))

      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
      expect(screen.getByText('Create Announcement', { selector: 'h2' })).toBeInTheDocument()
    })
  })

  describe('edit flow', () => {
    it('opens edit dialog when edit action is triggered from table', () => {
      mockAnnouncements = [makeAnnouncement()]

      render(<AnnouncementsTab facilityId="fac-1" />)

      // Click the edit button in the table
      fireEvent.click(screen.getByLabelText('Edit announcement'))

      expect(screen.getByTestId('create-dialog')).toBeInTheDocument()
      expect(screen.getByText('Edit Announcement')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty table state when no announcements exist', () => {
      render(<AnnouncementsTab facilityId="fac-1" />)

      expect(screen.getByText('No announcements yet')).toBeInTheDocument()
    })
  })
})
