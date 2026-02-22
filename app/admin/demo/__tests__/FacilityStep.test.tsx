// app/admin/demo/__tests__/FacilityStep.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FacilityStep from '../steps/FacilityStep'
import type { DemoFacility, ConfigStatusKey } from '../types'

describe('FacilityStep', () => {
  const mockOnSelectFacility = vi.fn()
  const mockOnMonthsChange = vi.fn()
  const mockOnPurgeFirstChange = vi.fn()

  const mockFacilities: DemoFacility[] = [
    {
      id: 'facility-1',
      name: 'Demo Ortho Center',
      is_demo: true,
      case_number_prefix: 'DOC',
      timezone: 'America/New_York',
    },
    {
      id: 'facility-2',
      name: 'Test Surgical Hospital',
      is_demo: true,
      case_number_prefix: 'TSH',
      timezone: 'America/Chicago',
    },
  ]

  const mockConfigStatus: Record<ConfigStatusKey, number> = {
    surgeons: 5,
    rooms: 8,
    procedureTypes: 12,
    payers: 4,
    facilityMilestones: 10,
    flagRules: 6,
    cancellationReasons: 3,
    delayTypes: 4,
    cases: 150,
  }

  const defaultProps = {
    facilities: mockFacilities,
    selectedFacilityId: null,
    onSelectFacility: mockOnSelectFacility,
    loading: false,
    loadingFacility: false,
    configStatus: null,
    monthsOfHistory: 6,
    onMonthsChange: mockOnMonthsChange,
    purgeFirst: true,
    onPurgeFirstChange: mockOnPurgeFirstChange,
  }

  describe('Loading state', () => {
    it('shows loading spinner when loading is true', () => {
      render(<FacilityStep {...defaultProps} loading={true} />)
      expect(screen.getByText('Loading demo facilities...')).toBeInTheDocument()
    })

    it('does not render facility list when loading', () => {
      render(<FacilityStep {...defaultProps} loading={true} />)
      expect(screen.queryByText('Demo Ortho Center')).not.toBeInTheDocument()
    })
  })

  describe('Facility selection', () => {
    it('renders all facilities from the list', () => {
      render(<FacilityStep {...defaultProps} />)
      expect(screen.getByText('Demo Ortho Center')).toBeInTheDocument()
      expect(screen.getByText('Test Surgical Hospital')).toBeInTheDocument()
    })

    it('shows facility timezone and prefix', () => {
      render(<FacilityStep {...defaultProps} />)
      expect(screen.getByText(/America\/New_York/)).toBeInTheDocument()
      expect(screen.getByText(/DOC/)).toBeInTheDocument()
    })

    it('calls onSelectFacility when a facility is clicked', async () => {
      const user = userEvent.setup()
      render(<FacilityStep {...defaultProps} />)
      const button = screen.getByTestId('facility-option-facility-1')
      await user.click(button)
      expect(mockOnSelectFacility).toHaveBeenCalledWith('facility-1')
    })

    it('highlights the selected facility with blue border and background', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" />)
      const button = screen.getByTestId('facility-option-facility-1')
      expect(button).toHaveClass('border-blue-300', 'bg-blue-50')
    })

    it('shows check icon on selected facility', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" />)
      const button = screen.getByTestId('facility-option-facility-1')
      const checkIcon = button.querySelector('svg.lucide-check')
      expect(checkIcon).toBeInTheDocument()
    })

    it('shows chevron icon on non-selected facility', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" />)
      const button = screen.getByTestId('facility-option-facility-2')
      const chevronIcon = button.querySelector('svg.lucide-chevron-right')
      expect(chevronIcon).toBeInTheDocument()
    })

    it('shows empty state when facilities array is empty', () => {
      render(<FacilityStep {...defaultProps} facilities={[]} />)
      expect(screen.getByText('No demo facilities found')).toBeInTheDocument()
      expect(screen.getByText(/is_demo = true/)).toBeInTheDocument()
    })
  })

  describe('Generation Scope', () => {
    it('does not show Generation Scope section when no facility selected', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId={null} />)
      expect(screen.queryByText('Generation Scope')).not.toBeInTheDocument()
    })

    it('shows Generation Scope section when facility is selected', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" />)
      expect(screen.getByText('Generation Scope')).toBeInTheDocument()
    })

    it('renders months selector with current value', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" monthsOfHistory={6} />)
      const select = screen.getByRole('combobox')
      expect(select).toHaveValue('6')
    })

    it('calls onMonthsChange when months selector is changed', async () => {
      const user = userEvent.setup()
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" monthsOfHistory={6} />)
      const select = screen.getByRole('combobox')
      await user.selectOptions(select, '12')
      expect(mockOnMonthsChange).toHaveBeenCalledWith(12)
    })

    it('shows holiday count in scope description', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" monthsOfHistory={6} />)
      expect(screen.getByText(/holidays skipped/)).toBeInTheDocument()
    })

    it('renders purge checkbox with current value', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" purgeFirst={true} />)
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('calls onPurgeFirstChange when checkbox is toggled', async () => {
      const user = userEvent.setup()
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" purgeFirst={true} />)
      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)
      expect(mockOnPurgeFirstChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Configuration Status Panel', () => {
    it('does not show config status when no facility selected', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId={null} />)
      expect(screen.queryByText('Configuration Status')).not.toBeInTheDocument()
    })

    it('shows config status heading when facility is selected', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={mockConfigStatus} />)
      expect(screen.getByText('Configuration Status')).toBeInTheDocument()
    })

    it('shows loading state when loadingFacility is true', () => {
      render(
        <FacilityStep
          {...defaultProps}
          selectedFacilityId="facility-1"
          loadingFacility={true}
          configStatus={null}
        />,
      )
      expect(screen.getByText('Loading facility configuration...')).toBeInTheDocument()
    })

    it('renders config status grid with all keys', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={mockConfigStatus} />)
      const grid = screen.getByTestId('config-status-grid')
      expect(grid).toBeInTheDocument()

      expect(screen.getByTestId('config-status-surgeons')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-rooms')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-procedureTypes')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-payers')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-facilityMilestones')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-flagRules')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-cancellationReasons')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-delayTypes')).toBeInTheDocument()
      expect(screen.getByTestId('config-status-cases')).toBeInTheDocument()
    })

    it('shows green background for items with counts > 0', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={mockConfigStatus} />)
      const surgeonsCard = screen.getByTestId('config-status-surgeons')
      expect(surgeonsCard).toHaveClass('bg-green-50', 'border-green-200')
    })

    it('shows red background for required items with count = 0', () => {
      const zeroSurgeonsStatus = { ...mockConfigStatus, surgeons: 0 }
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={zeroSurgeonsStatus} />)
      const surgeonsCard = screen.getByTestId('config-status-surgeons')
      expect(surgeonsCard).toHaveClass('bg-red-50', 'border-red-200')
    })

    it('shows amber background for non-required items with count = 0', () => {
      const zeroFlagsStatus = { ...mockConfigStatus, flagRules: 0 }
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={zeroFlagsStatus} />)
      const flagsCard = screen.getByTestId('config-status-flagRules')
      expect(flagsCard).toHaveClass('bg-amber-50', 'border-amber-200')
    })

    it('displays count values correctly', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={mockConfigStatus} />)
      const surgeonsCard = screen.getByTestId('config-status-surgeons')
      expect(surgeonsCard).toHaveTextContent('5')

      const roomsCard = screen.getByTestId('config-status-rooms')
      expect(roomsCard).toHaveTextContent('8')
    })

    it('formats case count with commas', () => {
      const largeCountStatus = { ...mockConfigStatus, cases: 1500 }
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={largeCountStatus} />)
      const casesCard = screen.getByTestId('config-status-cases')
      expect(casesCard).toHaveTextContent('1,500')
    })

    it('shows check icon for items with count > 0', () => {
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={mockConfigStatus} />)
      const surgeonsCard = screen.getByTestId('config-status-surgeons')
      const checkIcon = surgeonsCard.querySelector('svg.lucide-check')
      expect(checkIcon).toBeInTheDocument()
    })

    it('shows alert triangle for required items with count = 0', () => {
      const zeroSurgeonsStatus = { ...mockConfigStatus, surgeons: 0 }
      render(<FacilityStep {...defaultProps} selectedFacilityId="facility-1" configStatus={zeroSurgeonsStatus} />)
      const surgeonsCard = screen.getByTestId('config-status-surgeons')
      const alertIcon = surgeonsCard.querySelector('svg[class*="lucide"]')
      expect(alertIcon).toBeInTheDocument()
      expect(surgeonsCard).toHaveClass('bg-red-50')
    })
  })
})
