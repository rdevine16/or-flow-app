import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CasesFilterBar from '../CasesFilterBar'

// ============================================
// HELPERS
// ============================================

const MOCK_SURGEONS = [
  { id: 'surgeon-1', first_name: 'John', last_name: 'Smith' },
  { id: 'surgeon-2', first_name: 'Jane', last_name: 'Doe' },
]

const MOCK_ROOMS = [
  { id: 'room-1', name: 'OR-1' },
  { id: 'room-2', name: 'OR-2' },
]

const MOCK_PROCEDURES = [
  { id: 'proc-1', name: 'Total Hip Replacement' },
  { id: 'proc-2', name: 'Knee Arthroscopy' },
]

function renderFilterBar(overrides: Partial<Parameters<typeof CasesFilterBar>[0]> = {}) {
  const defaultProps = {
    searchInput: '',
    onSearchChange: vi.fn(),
    surgeonIds: [] as string[],
    onSurgeonIdsChange: vi.fn(),
    roomIds: [] as string[],
    onRoomIdsChange: vi.fn(),
    procedureIds: [] as string[],
    onProcedureIdsChange: vi.fn(),
    surgeons: MOCK_SURGEONS,
    rooms: MOCK_ROOMS,
    procedureTypes: MOCK_PROCEDURES,
    hasActiveFilters: false,
    onClearAll: vi.fn(),
    ...overrides,
  }
  return { ...render(<CasesFilterBar {...defaultProps} />), props: defaultProps }
}

// ============================================
// UNIT TESTS: Rendering
// ============================================

describe('CasesFilterBar — unit', () => {
  it('renders search input with placeholder', () => {
    renderFilterBar()
    expect(screen.getByPlaceholderText('Search cases, surgeons, rooms...')).toBeDefined()
  })

  it('renders surgeon, room, and procedure filter dropdown buttons', () => {
    renderFilterBar()
    expect(screen.getByText('Surgeon')).toBeDefined()
    expect(screen.getByText('Room')).toBeDefined()
    expect(screen.getByText('Procedure')).toBeDefined()
  })

  it('does not render clear all button when no active filters', () => {
    renderFilterBar({ hasActiveFilters: false })
    expect(screen.queryByText('Clear all')).toBeNull()
  })

  it('renders clear all button when filters are active', () => {
    renderFilterBar({ hasActiveFilters: true })
    expect(screen.getByText('Clear all')).toBeDefined()
  })

  it('renders search input with provided value', () => {
    renderFilterBar({ searchInput: 'C-001' })
    const input = screen.getByPlaceholderText('Search cases, surgeons, rooms...') as HTMLInputElement
    expect(input.value).toBe('C-001')
  })
})

// ============================================
// UNIT TESTS: Active Filter Pills
// ============================================

describe('CasesFilterBar — active filter pills', () => {
  it('renders surgeon filter pills when surgeon IDs are selected', () => {
    renderFilterBar({ surgeonIds: ['surgeon-1'] })
    // "Dr. Smith" appears in both the dropdown button label and the filter pill
    const smithElements = screen.getAllByText('Dr. Smith')
    expect(smithElements.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Active:')).toBeDefined()
  })

  it('renders room filter pills when room IDs are selected', () => {
    renderFilterBar({ roomIds: ['room-1'] })
    // "OR-1" appears in both dropdown button label and filter pill
    const roomElements = screen.getAllByText('OR-1')
    expect(roomElements.length).toBeGreaterThanOrEqual(2)
  })

  it('renders procedure filter pills when procedure IDs are selected', () => {
    renderFilterBar({ procedureIds: ['proc-1'] })
    // Procedure name appears in both dropdown button label and filter pill
    const procElements = screen.getAllByText('Total Hip Replacement')
    expect(procElements.length).toBeGreaterThanOrEqual(2)
  })

  it('renders multiple filter pills for multiple selections', () => {
    renderFilterBar({
      surgeonIds: ['surgeon-1'],
      roomIds: ['room-1'],
      procedureIds: ['proc-1'],
    })
    // Each appears as pill + possibly in dropdown label
    expect(screen.getAllByText('Dr. Smith').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('OR-1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Total Hip Replacement').length).toBeGreaterThanOrEqual(1)
    // All three pills have dismiss buttons
    expect(screen.getByLabelText('Remove Dr. Smith filter')).toBeDefined()
    expect(screen.getByLabelText('Remove OR-1 filter')).toBeDefined()
    expect(screen.getByLabelText('Remove Total Hip Replacement filter')).toBeDefined()
  })

  it('does not render active section when no entity filters selected', () => {
    renderFilterBar()
    expect(screen.queryByText('Active:')).toBeNull()
  })
})

// ============================================
// UNIT TESTS: Interactions
// ============================================

describe('CasesFilterBar — interactions', () => {
  it('calls onSearchChange when typing in search input', async () => {
    const user = userEvent.setup()
    const { props } = renderFilterBar()

    const input = screen.getByPlaceholderText('Search cases, surgeons, rooms...')
    await user.type(input, 'C')

    expect(props.onSearchChange).toHaveBeenCalledWith('C')
  })

  it('calls onClearAll when clear all button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderFilterBar({ hasActiveFilters: true })

    await user.click(screen.getByText('Clear all'))
    expect(props.onClearAll).toHaveBeenCalledOnce()
  })

  it('opens surgeon dropdown on click and shows options', async () => {
    const user = userEvent.setup()
    renderFilterBar()

    await user.click(screen.getByText('Surgeon'))
    expect(screen.getByText('Dr. Smith')).toBeDefined()
    expect(screen.getByText('Dr. Doe')).toBeDefined()
  })

  it('opens room dropdown on click and shows options', async () => {
    const user = userEvent.setup()
    renderFilterBar()

    await user.click(screen.getByText('Room'))
    // Room label button + dropdown option
    const allOR1 = screen.getAllByText('OR-1')
    expect(allOR1.length).toBeGreaterThanOrEqual(1)
  })

  it('calls onSurgeonIdsChange when selecting a surgeon from dropdown', async () => {
    const user = userEvent.setup()
    const { props } = renderFilterBar()

    await user.click(screen.getByText('Surgeon'))
    await user.click(screen.getByText('Dr. Smith'))

    expect(props.onSurgeonIdsChange).toHaveBeenCalledWith(['surgeon-1'])
  })

  it('removes surgeon pill when dismiss button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderFilterBar({ surgeonIds: ['surgeon-1'] })

    const removeButton = screen.getByLabelText('Remove Dr. Smith filter')
    await user.click(removeButton)

    expect(props.onSurgeonIdsChange).toHaveBeenCalledWith([])
  })

  it('removes room pill when dismiss button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderFilterBar({ roomIds: ['room-1'] })

    const removeButton = screen.getByLabelText('Remove OR-1 filter')
    await user.click(removeButton)

    expect(props.onRoomIdsChange).toHaveBeenCalledWith([])
  })

  it('shows selected count badge in dropdown button when multiple items selected', () => {
    renderFilterBar({ surgeonIds: ['surgeon-1', 'surgeon-2'] })
    expect(screen.getByText('2 selected')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })
})

// ============================================
// INTEGRATION: Search Suggestions
// ============================================

describe('CasesFilterBar — search suggestions', () => {
  it('shows surgeon suggestions when typing a name', async () => {
    const user = userEvent.setup()
    renderFilterBar({ searchInput: 'Sm' })

    const input = screen.getByPlaceholderText('Search cases, surgeons, rooms...')
    await user.click(input)

    // The suggestions should show for the current search input
    // Since searchInput is controlled, typing triggers onSearchChange
    // and suggestions are derived from the prop value
    expect(screen.getByText('Dr. Smith')).toBeDefined()
  })

  it('shows room suggestions when typing a room name', async () => {
    const user = userEvent.setup()
    renderFilterBar({ searchInput: 'OR-1' })

    const input = screen.getByPlaceholderText('Search cases, surgeons, rooms...')
    await user.click(input)

    // OR-1 should appear as a suggestion
    const allOR1 = screen.getAllByText('OR-1')
    expect(allOR1.length).toBeGreaterThanOrEqual(1)
  })

  it('clears search input after selecting a suggestion', async () => {
    const user = userEvent.setup()
    const { props } = renderFilterBar({ searchInput: 'Smith' })

    const input = screen.getByPlaceholderText('Search cases, surgeons, rooms...')
    await user.click(input)

    // Click the surgeon suggestion
    const suggestionButton = screen.getAllByText('Dr. Smith')[0]
    await user.click(suggestionButton)

    // Should clear search and add surgeon filter
    expect(props.onSearchChange).toHaveBeenCalledWith('')
    expect(props.onSurgeonIdsChange).toHaveBeenCalledWith(['surgeon-1'])
  })
})

// ============================================
// WORKFLOW: Multi-filter scenario
// ============================================

describe('CasesFilterBar — workflow', () => {
  it('shows all three filter pills when surgeon + room + procedure selected', () => {
    renderFilterBar({
      surgeonIds: ['surgeon-1'],
      roomIds: ['room-2'],
      procedureIds: ['proc-2'],
      hasActiveFilters: true,
    })

    // All three pills visible (dismiss buttons prove pills are rendered)
    expect(screen.getByLabelText('Remove Dr. Smith filter')).toBeDefined()
    expect(screen.getByLabelText('Remove OR-2 filter')).toBeDefined()
    expect(screen.getByLabelText('Remove Knee Arthroscopy filter')).toBeDefined()
    // Clear all is visible
    expect(screen.getByText('Clear all')).toBeDefined()
  })
})
