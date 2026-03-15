// components/staff-management/__tests__/CreateAnnouncementDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateAnnouncementDialog } from '../CreateAnnouncementDialog'
import type { Announcement } from '@/types/announcements'

// ============================================
// Mock Modal — simplified render
// ============================================

vi.mock('@/components/ui/Modal', () => {
  const Footer = ({ children }: { children: React.ReactNode }) => <div data-testid="modal-footer">{children}</div>
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
    return <div data-testid="modal"><h2>{title}</h2>{children}</div>
  }
  Modal.Footer = Footer
  Modal.Cancel = Cancel
  Modal.Action = Action
  return { Modal }
})

vi.mock('@/components/ui/Toggle', () => ({
  Toggle: ({ checked, onChange, disabled }: {
    checked: boolean; onChange: () => void; disabled?: boolean; size?: string
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      aria-label="Toggle schedule"
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}))

// ============================================
// Test data
// ============================================

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'ann-1',
    facility_id: 'fac-1',
    created_by: 'user-1',
    title: 'Existing Announcement',
    body: 'Some body text',
    audience: 'both',
    priority: 'warning',
    category: 'maintenance',
    status: 'active',
    starts_at: '2026-03-10T09:00:00Z',
    expires_at: '2026-03-13T09:00:00Z', // 3 days
    deactivated_at: null,
    deactivated_by: null,
    created_at: '2026-03-10T09:00:00Z',
    updated_at: '2026-03-10T09:00:00Z',
    is_active: true,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

// ============================================
// Tests
// ============================================

describe('CreateAnnouncementDialog', () => {
  const mockOnSave = vi.fn()
  const mockOnUpdate = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSave.mockResolvedValue({ success: true })
    mockOnUpdate.mockResolvedValue({ success: true })
  })

  describe('create mode', () => {
    it('renders dialog with "Create Announcement" title when open', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Create Announcement')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(
        <CreateAnnouncementDialog
          open={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument()
    })

    it('renders all form fields', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByPlaceholderText('Enter announcement title')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Optional detailed message/)).toBeInTheDocument()
      expect(screen.getByText('Audience')).toBeInTheDocument()
      expect(screen.getByText('Priority')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Duration')).toBeInTheDocument()
      expect(screen.getByText('Schedule for later')).toBeInTheDocument()
    })

    it('shows character count for title', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('0/100')).toBeInTheDocument()

      const titleInput = screen.getByPlaceholderText('Enter announcement title')
      fireEvent.change(titleInput, { target: { value: 'Test' } })

      expect(screen.getByText('4/100')).toBeInTheDocument()
    })

    it('action button shows "Send Now" by default', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByTestId('modal-action')).toHaveTextContent('Send Now')
    })

    it('action button is disabled when title is empty', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByTestId('modal-action')).toBeDisabled()
    })

    it('action button is enabled when title is filled', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const titleInput = screen.getByPlaceholderText('Enter announcement title')
      fireEvent.change(titleInput, { target: { value: 'Safety alert' } })

      expect(screen.getByTestId('modal-action')).not.toBeDisabled()
    })

    it('shows "Schedule" button text when scheduling is toggled on', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      fireEvent.click(screen.getByRole('switch'))

      expect(screen.getByTestId('modal-action')).toHaveTextContent('Schedule')
    })

    it('shows datetime picker when schedule is toggled on', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.queryByText('Scheduled Date & Time')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('switch'))

      expect(screen.getByText('Scheduled Date & Time')).toBeInTheDocument()
    })
  })

  describe('live banner preview', () => {
    it('shows "Announcement title" placeholder when title is empty', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Announcement title')).toBeInTheDocument()
    })

    it('updates preview title as user types', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const titleInput = screen.getByPlaceholderText('Enter announcement title')
      fireEvent.change(titleInput, { target: { value: 'OR Maintenance' } })

      expect(screen.getByText('OR Maintenance')).toBeInTheDocument()
    })

    it('shows body text in preview when entered', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const bodyInput = screen.getByPlaceholderText(/Optional detailed message/)
      fireEvent.change(bodyInput, { target: { value: 'Room 3 closed for cleaning' } })

      // Body appears in both the textarea value and the preview paragraph
      const bodyElements = screen.getAllByText('Room 3 closed for cleaning')
      expect(bodyElements.length).toBe(2) // textarea + preview
    })

    it('shows default category label in preview', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      expect(screen.getByText('Banner Preview')).toBeInTheDocument()
      // "General" appears in category dropdown option AND preview badge
      const generalElements = screen.getAllByText('General')
      expect(generalElements.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('form submission', () => {
    it('calls onSave with correct input on submit', async () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const titleInput = screen.getByPlaceholderText('Enter announcement title')
      fireEvent.change(titleInput, { target: { value: 'Fire drill today' } })

      // Submit via form
      const form = document.querySelector('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Fire drill today',
            body: null,
            audience: 'both',
            priority: 'normal',
            category: 'general',
            duration_days: 1,
            scheduled_for: null,
          })
        )
      })
    })

    it('closes dialog on successful save', async () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const titleInput = screen.getByPlaceholderText('Enter announcement title')
      fireEvent.change(titleInput, { target: { value: 'Test' } })

      const form = document.querySelector('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('shows error when onSave returns failure', async () => {
      mockOnSave.mockResolvedValue({ success: false, error: 'Database error' })

      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      )

      const titleInput = screen.getByPlaceholderText('Enter announcement title')
      fireEvent.change(titleInput, { target: { value: 'Test' } })

      const form = document.querySelector('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument()
      })
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('edit mode', () => {
    it('renders "Edit Announcement" title', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onUpdate={mockOnUpdate}
          editing={makeAnnouncement()}
        />
      )

      expect(screen.getByText('Edit Announcement')).toBeInTheDocument()
    })

    it('pre-fills form with existing announcement data', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onUpdate={mockOnUpdate}
          editing={makeAnnouncement()}
        />
      )

      expect(screen.getByDisplayValue('Existing Announcement')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Some body text')).toBeInTheDocument()
    })

    it('shows "Save Changes" button text', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onUpdate={mockOnUpdate}
          editing={makeAnnouncement()}
        />
      )

      expect(screen.getByTestId('modal-action')).toHaveTextContent('Save Changes')
    })

    it('calls onUpdate with id and input on submit', async () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onUpdate={mockOnUpdate}
          editing={makeAnnouncement()}
        />
      )

      const titleInput = screen.getByDisplayValue('Existing Announcement')
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

      const form = document.querySelector('form')!
      fireEvent.submit(form)

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(
          'ann-1',
          expect.objectContaining({
            title: 'Updated Title',
            body: 'Some body text',
            audience: 'both',
            priority: 'warning',
            category: 'maintenance',
            duration_days: 3,
          })
        )
      })
      expect(mockOnSave).not.toHaveBeenCalled()
    })

    it('pre-fills schedule toggle for scheduled announcements', () => {
      render(
        <CreateAnnouncementDialog
          open={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          onUpdate={mockOnUpdate}
          editing={makeAnnouncement({ status: 'scheduled' })}
        />
      )

      expect(screen.getByText('Scheduled Date & Time')).toBeInTheDocument()
    })
  })
})
