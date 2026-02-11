import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ============================================
// MOCKS — must be declared before component import
// ============================================

const mockStaffData = [
  { id: 'nurse-1', first_name: 'Alice', last_name: 'Johnson', role_id: 'role-nurse', user_roles: { name: 'nurse' } },
  { id: 'nurse-2', first_name: 'Bob', last_name: 'Brown', role_id: 'role-nurse', user_roles: { name: 'nurse' } },
  { id: 'tech-1', first_name: 'Carol', last_name: 'Davis', role_id: 'role-tech', user_roles: { name: 'tech' } },
  { id: 'anesth-1', first_name: 'David', last_name: 'Wilson', role_id: 'role-anesth', user_roles: { name: 'anesthesiologist' } },
  { id: 'surgeon-1', first_name: 'Eve', last_name: 'Taylor', role_id: 'role-surgeon', user_roles: { name: 'surgeon' } },
  { id: 'other-1', first_name: 'Frank', last_name: 'Miller', role_id: 'role-other', user_roles: { name: 'coordinator' } },
]

let mockQueryResult: { data: typeof mockStaffData | null; error: null } = {
  data: mockStaffData,
  error: null,
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: vi.fn(() => {
      const chain: Record<string, any> = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: (resolve: Function) => resolve(mockQueryResult),
      }
      return chain
    }),
  }),
}))

import StaffMultiSelect from '../StaffMultiSelect'

// ============================================
// TESTS
// ============================================

describe('StaffMultiSelect', () => {
  const defaultProps = {
    facilityId: 'facility-1',
    selectedStaff: [] as { user_id: string; role_id: string }[],
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryResult = { data: mockStaffData, error: null }
  })

  it('renders loading skeleton while fetching staff', () => {
    // Make the query never resolve by overriding then
    mockQueryResult = { data: null, error: null }

    // The component shows a skeleton on first render before data loads
    const { container } = render(<StaffMultiSelect {...defaultProps} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows grouped sections (Nurses, Techs, Anesthesiologists) when dropdown is open', async () => {
    const user = userEvent.setup()
    render(<StaffMultiSelect {...defaultProps} />)

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Select staff members...')).toBeInTheDocument()
    })

    // Open the dropdown
    await user.click(screen.getByText('Select staff members...'))

    // Check section headers
    expect(screen.getByText('Nurses')).toBeInTheDocument()
    expect(screen.getByText('Techs')).toBeInTheDocument()
    expect(screen.getByText('Anesthesiologists')).toBeInTheDocument()
    expect(screen.getByText('Other')).toBeInTheDocument()
  })

  it('excludes surgeons from the list', async () => {
    const user = userEvent.setup()
    render(<StaffMultiSelect {...defaultProps} />)

    await waitFor(() => {
      expect(screen.queryByText('Select staff members...')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Select staff members...'))

    // Surgeon "Eve Taylor" should not appear
    expect(screen.queryByText('Eve Taylor')).not.toBeInTheDocument()

    // Non-surgeons should appear
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('Carol Davis')).toBeInTheDocument()
    expect(screen.getByText('David Wilson')).toBeInTheDocument()
  })

  it('filters out excludeUserIds', async () => {
    const user = userEvent.setup()
    render(
      <StaffMultiSelect
        {...defaultProps}
        excludeUserIds={['nurse-1']}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText('Select staff members...')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Select staff members...'))

    // nurse-1 (Alice Johnson) should be filtered out
    expect(screen.queryByText('Alice Johnson')).not.toBeInTheDocument()

    // Other staff should still appear
    expect(screen.getByText('Bob Brown')).toBeInTheDocument()
  })

  it('toggles staff selection on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StaffMultiSelect {...defaultProps} onChange={onChange} />)

    await waitFor(() => {
      expect(screen.queryByText('Select staff members...')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Select staff members...'))
    await user.click(screen.getByText('Alice Johnson'))

    expect(onChange).toHaveBeenCalledWith([
      { user_id: 'nurse-1', role_id: 'role-nurse' },
    ])
  })

  it('shows selected staff as colored tags', async () => {
    const user = userEvent.setup()
    render(
      <StaffMultiSelect
        {...defaultProps}
        selectedStaff={[
          { user_id: 'nurse-1', role_id: 'role-nurse' },
          { user_id: 'tech-1', role_id: 'role-tech' },
        ]}
      />
    )

    await waitFor(() => {
      // Selected staff names should appear as tags (not placeholder)
      expect(screen.queryByText('Select staff members...')).not.toBeInTheDocument()
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Carol Davis')).toBeInTheDocument()
    })
  })

  it('removes staff when tag X is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <StaffMultiSelect
        {...defaultProps}
        onChange={onChange}
        selectedStaff={[
          { user_id: 'nurse-1', role_id: 'role-nurse' },
          { user_id: 'tech-1', role_id: 'role-tech' },
        ]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    // Find the remove button for Alice Johnson — it's a button within the tag
    const aliceTag = screen.getByText('Alice Johnson').closest('span')!
    const removeButton = aliceTag.querySelector('button')!
    await user.click(removeButton)

    // Should call onChange without nurse-1
    expect(onChange).toHaveBeenCalledWith([
      { user_id: 'tech-1', role_id: 'role-tech' },
    ])
  })

  it('filters staff by search query', async () => {
    const user = userEvent.setup()
    render(<StaffMultiSelect {...defaultProps} />)

    await waitFor(() => {
      expect(screen.queryByText('Select staff members...')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Select staff members...'))

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search staff...')
    await user.type(searchInput, 'Alice')

    // Only Alice should be visible
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument()
    expect(screen.queryByText('Carol Davis')).not.toBeInTheDocument()
  })

  it('shows selected count in footer', async () => {
    const user = userEvent.setup()
    render(
      <StaffMultiSelect
        {...defaultProps}
        selectedStaff={[
          { user_id: 'nurse-1', role_id: 'role-nurse' },
          { user_id: 'tech-1', role_id: 'role-tech' },
        ]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    // Open dropdown to see footer
    await user.click(screen.getByText('Alice Johnson'))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
  })

  it('clears all selections when Clear all is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <StaffMultiSelect
        {...defaultProps}
        onChange={onChange}
        selectedStaff={[
          { user_id: 'nurse-1', role_id: 'role-nurse' },
          { user_id: 'tech-1', role_id: 'role-tech' },
        ]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    // Open dropdown
    await user.click(screen.getByText('Alice Johnson'))

    // Click "Clear all"
    await user.click(screen.getByText('Clear all'))

    expect(onChange).toHaveBeenCalledWith([])
  })
})
