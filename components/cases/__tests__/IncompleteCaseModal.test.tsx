import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IncompleteCaseModal from '../IncompleteCaseModal'

// ============================================
// MOCKS
// ============================================

vi.mock('@/lib/design-tokens', () => ({
  tokens: {
    zIndex: {
      modalBackdrop: 1040,
      modal: 1050,
    },
  },
}))

const surgeons = [
  { id: 'surgeon-1', label: 'Dr. Jane Smith' },
  { id: 'surgeon-2', label: 'Dr. John Doe' },
]

const procedures = [
  { id: 'proc-1', label: 'Knee Replacement' },
  { id: 'proc-2', label: 'Hip Replacement' },
]

const rooms = [
  { id: 'room-1', label: 'OR 1' },
  { id: 'room-2', label: 'OR 2' },
]

// ============================================
// TESTS
// ============================================

describe('IncompleteCaseModal — Phase 2.2', () => {
  const defaultProps = {
    caseId: 'case-1',
    missingFields: {
      surgeon_id: true,
      procedure_type_id: true,
      or_room_id: true,
    },
    surgeons,
    procedures,
    rooms,
    existingValues: {
      surgeon_id: null,
      procedure_type_id: null,
      or_room_id: null,
    },
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal with title and description', () => {
    render(<IncompleteCaseModal {...defaultProps} />)

    expect(screen.getByText('Incomplete Case')).toBeInTheDocument()
    expect(screen.getByText(/missing 3 required fields/)).toBeInTheDocument()
  })

  it('shows only the missing field dropdowns', () => {
    render(
      <IncompleteCaseModal
        {...defaultProps}
        missingFields={{
          surgeon_id: true,
          procedure_type_id: false,
          or_room_id: false,
        }}
      />
    )

    // Should show surgeon dropdown
    expect(screen.getByText('Surgeon *')).toBeInTheDocument()

    // Should NOT show procedure or room dropdowns
    expect(screen.queryByText('Procedure Type *')).not.toBeInTheDocument()
    expect(screen.queryByText('OR Room *')).not.toBeInTheDocument()

    // Should say 1 field
    expect(screen.getByText(/missing 1 required field\./)).toBeInTheDocument()
  })

  it('shows validation errors when trying to save without filling fields', async () => {
    const user = userEvent.setup()
    render(<IncompleteCaseModal {...defaultProps} />)

    await user.click(screen.getByText('Complete Case Details'))

    expect(screen.getByText('Surgeon is required')).toBeInTheDocument()
    expect(screen.getByText('Procedure is required')).toBeInTheDocument()
    expect(screen.getByText('Room is required')).toBeInTheDocument()

    // onSave should NOT have been called
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  it('calls onSave with correct values when all fields are filled', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(
      <IncompleteCaseModal
        {...defaultProps}
        missingFields={{
          surgeon_id: true,
          procedure_type_id: false,
          or_room_id: false,
        }}
        onSave={mockOnSave}
      />
    )

    // The SearchableDropdown renders a button with the placeholder text
    // Click to open, then select an option
    const surgeonDropdown = screen.getByText('Select Surgeon')
    await user.click(surgeonDropdown)

    // Select the first surgeon
    await user.click(screen.getByText('Dr. Jane Smith'))

    // Click save
    await user.click(screen.getByText('Complete Case Details'))

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        surgeon_id: 'surgeon-1',
      })
    })
  })

  it('renders backdrop with blur class', () => {
    const { container } = render(<IncompleteCaseModal {...defaultProps} />)

    const backdrop = container.querySelector('.backdrop-blur-sm')
    expect(backdrop).toBeInTheDocument()
  })

  it('shows Complete Case Details button', () => {
    render(<IncompleteCaseModal {...defaultProps} />)

    expect(screen.getByText('Complete Case Details')).toBeInTheDocument()
  })

  it('clears field error when user selects a value', async () => {
    const user = userEvent.setup()

    render(
      <IncompleteCaseModal
        {...defaultProps}
        missingFields={{
          surgeon_id: true,
          procedure_type_id: false,
          or_room_id: false,
        }}
      />
    )

    // Trigger validation error
    await user.click(screen.getByText('Complete Case Details'))
    expect(screen.getByText('Surgeon is required')).toBeInTheDocument()

    // Select a surgeon
    await user.click(screen.getByText('Select Surgeon'))
    await user.click(screen.getByText('Dr. Jane Smith'))

    // Error should be cleared
    expect(screen.queryByText('Surgeon is required')).not.toBeInTheDocument()
  })

  it('shows correct count for 2 missing fields', () => {
    render(
      <IncompleteCaseModal
        {...defaultProps}
        missingFields={{
          surgeon_id: true,
          procedure_type_id: true,
          or_room_id: false,
        }}
      />
    )

    expect(screen.getByText(/missing 2 required fields/)).toBeInTheDocument()
  })
})
