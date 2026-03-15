// components/staff-management/__tests__/AnnouncementHistoryTable.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnnouncementHistoryTable } from '../AnnouncementHistoryTable'
import type { Announcement, AnnouncementFilterParams } from '@/types/announcements'

// ============================================
// Mock ConfirmDialog — render inline
// ============================================

vi.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onConfirm, onClose, title, message, confirmText, loading }: {
    open: boolean; onConfirm: () => void; onClose: () => void
    title: string; message: string; confirmText?: string; loading?: boolean
    variant?: string
  }) => {
    if (!open) return null
    return (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <p>{message}</p>
        <button onClick={onConfirm} disabled={loading}>{confirmText ?? 'Confirm'}</button>
        <button onClick={onClose}>Cancel</button>
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
    title: 'OR 3 Maintenance',
    body: 'Room will be closed for repairs',
    audience: 'both',
    priority: 'normal',
    category: 'maintenance',
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

const sampleAnnouncements: Announcement[] = [
  makeAnnouncement(),
  makeAnnouncement({
    id: 'ann-2',
    title: 'Safety Alert',
    priority: 'critical',
    category: 'safety_alert',
    status: 'active',
    created_at: '2026-03-11T09:00:00Z',
    creator: { id: 'user-2', first_name: 'Bob', last_name: 'Admin' },
  }),
  makeAnnouncement({
    id: 'ann-3',
    title: 'Policy Update',
    priority: 'warning',
    category: 'policy_update',
    status: 'expired',
    created_at: '2026-03-08T09:00:00Z',
  }),
]

// ============================================
// Tests
// ============================================

describe('AnnouncementHistoryTable', () => {
  const mockOnFilterChange = vi.fn()
  const mockOnClearFilters = vi.fn()
  const mockOnEdit = vi.fn()
  const mockOnDeactivate = vi.fn()
  const mockOnDelete = vi.fn()
  const emptyFilters: AnnouncementFilterParams = {}

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnDeactivate.mockResolvedValue(undefined)
    mockOnDelete.mockResolvedValue(undefined)
  })

  const renderTable = (
    announcements: Announcement[] = sampleAnnouncements,
    filters: AnnouncementFilterParams = emptyFilters,
    loading = false
  ) =>
    render(
      <AnnouncementHistoryTable
        announcements={announcements}
        loading={loading}
        filters={filters}
        onFilterChange={mockOnFilterChange}
        onClearFilters={mockOnClearFilters}
        onEdit={mockOnEdit}
        onDeactivate={mockOnDeactivate}
        onDelete={mockOnDelete}
      />
    )

  describe('rendering', () => {
    it('renders table with all announcements', () => {
      renderTable()

      // Verify all 3 data rows rendered (+ 1 header row)
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBe(4)
      expect(screen.getByText('OR 3 Maintenance')).toBeInTheDocument()
    })

    it('renders sender names from creator join', () => {
      renderTable()

      // Jane appears in 2 rows (ann-1 and ann-3 share same creator), Bob in 1
      const janeElements = screen.getAllByText('Jane Admin')
      expect(janeElements.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Bob Admin')).toBeInTheDocument()
    })

    it('renders status badges', () => {
      renderTable()

      // "Active" appears in filter dropdown option + 2 active announcement badges
      const activeTexts = screen.getAllByText('Active')
      expect(activeTexts.length).toBeGreaterThanOrEqual(3)
    })

    it('renders priority badges', () => {
      renderTable()

      // Priority labels appear in both dropdown options and badge cells
      const normalTexts = screen.getAllByText('Normal')
      expect(normalTexts.length).toBeGreaterThanOrEqual(2)
      const criticalTexts = screen.getAllByText('Critical')
      expect(criticalTexts.length).toBeGreaterThanOrEqual(2)
    })

    it('shows empty state when no announcements', () => {
      renderTable([])

      expect(screen.getByText('No announcements yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first announcement to get started')).toBeInTheDocument()
    })

    it('shows filtered empty state when filters are active', () => {
      renderTable([], { status: 'active' })

      expect(screen.getByText('No announcements match your filters')).toBeInTheDocument()
    })

    it('shows loading spinner', () => {
      renderTable([], emptyFilters, true)

      // Check for the spinner animation element
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('filters', () => {
    it('renders search input', () => {
      renderTable()

      expect(screen.getByPlaceholderText('Search by title...')).toBeInTheDocument()
    })

    it('calls onFilterChange when search input changes', () => {
      renderTable()

      const searchInput = screen.getByPlaceholderText('Search by title...')
      fireEvent.change(searchInput, { target: { value: 'safety' } })

      expect(mockOnFilterChange).toHaveBeenCalledWith({ search: 'safety' })
    })

    it('renders filter dropdowns', () => {
      renderTable()

      expect(screen.getByText('All Statuses')).toBeInTheDocument()
      expect(screen.getByText('All Priorities')).toBeInTheDocument()
      expect(screen.getByText('All Categories')).toBeInTheDocument()
    })

    it('shows clear filters button when filters are active', () => {
      renderTable(sampleAnnouncements, { status: 'active' })

      expect(screen.getByText('Clear filters')).toBeInTheDocument()
    })

    it('does not show clear filters button when no filters active', () => {
      renderTable()

      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()
    })

    it('calls onClearFilters when clear button clicked', () => {
      renderTable(sampleAnnouncements, { status: 'active' })

      fireEvent.click(screen.getByText('Clear filters'))

      expect(mockOnClearFilters).toHaveBeenCalled()
    })
  })

  describe('sorting', () => {
    it('sorts by created_at descending by default', () => {
      renderTable()

      const rows = screen.getAllByRole('row')
      // Header row + 3 data rows; first data row should be most recent
      const firstDataRow = rows[1]
      expect(firstDataRow).toHaveTextContent('Safety Alert')
    })

    it('toggles sort direction on same column click', () => {
      renderTable()

      // Click Title to sort asc
      fireEvent.click(screen.getByText('Title'))

      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      // Alphabetically first: OR 3 Maintenance
      expect(firstDataRow).toHaveTextContent('OR 3 Maintenance')

      // Click Title again to sort desc
      fireEvent.click(screen.getByText('Title'))

      const rowsAfter = screen.getAllByRole('row')
      expect(rowsAfter[1]).toHaveTextContent('Safety Alert')
    })
  })

  describe('row actions', () => {
    it('shows edit button for active announcements', () => {
      renderTable([makeAnnouncement()])

      expect(screen.getByLabelText('Edit announcement')).toBeInTheDocument()
    })

    it('hides edit button for expired announcements', () => {
      renderTable([makeAnnouncement({ status: 'expired' })])

      expect(screen.queryByLabelText('Edit announcement')).not.toBeInTheDocument()
    })

    it('calls onEdit when edit button clicked', () => {
      const ann = makeAnnouncement()
      renderTable([ann])

      fireEvent.click(screen.getByLabelText('Edit announcement'))

      expect(mockOnEdit).toHaveBeenCalledWith(ann)
    })

    it('shows deactivate button for active announcements', () => {
      renderTable([makeAnnouncement()])

      expect(screen.getByLabelText('Deactivate announcement')).toBeInTheDocument()
    })

    it('hides deactivate button for expired announcements', () => {
      renderTable([makeAnnouncement({ status: 'expired' })])

      expect(screen.queryByLabelText('Deactivate announcement')).not.toBeInTheDocument()
    })

    it('shows confirm dialog when deactivate clicked', () => {
      renderTable([makeAnnouncement()])

      fireEvent.click(screen.getByLabelText('Deactivate announcement'))

      expect(screen.getByText('Deactivate announcement?')).toBeInTheDocument()
    })

    it('calls onDeactivate after confirming', async () => {
      const ann = makeAnnouncement()
      renderTable([ann])

      fireEvent.click(screen.getByLabelText('Deactivate announcement'))
      fireEvent.click(screen.getByText('Deactivate'))

      await waitFor(() => {
        expect(mockOnDeactivate).toHaveBeenCalledWith(ann)
      })
    })

    it('shows confirm dialog when delete clicked', () => {
      renderTable([makeAnnouncement()])

      fireEvent.click(screen.getByLabelText('Delete announcement'))

      expect(screen.getByText('Delete announcement?')).toBeInTheDocument()
    })

    it('calls onDelete after confirming delete', async () => {
      const ann = makeAnnouncement()
      renderTable([ann])

      fireEvent.click(screen.getByLabelText('Delete announcement'))
      fireEvent.click(screen.getByText('Delete'))

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(ann)
      })
    })

    it('always shows delete button regardless of status', () => {
      renderTable([makeAnnouncement({ status: 'expired' })])

      expect(screen.getByLabelText('Delete announcement')).toBeInTheDocument()
    })
  })
})
