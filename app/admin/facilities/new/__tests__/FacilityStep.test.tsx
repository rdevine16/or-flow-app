// app/admin/facilities/new/__tests__/FacilityStep.test.tsx
// Tests for FacilityStep component (Step 1 of facility wizard)

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FacilityStep from '../FacilityStep'
import type { FacilityData } from '../types'
import { DEFAULT_FACILITY_DATA } from '../types'

describe('FacilityStep', () => {
  const mockOnChange = vi.fn()

  function setup(data: Partial<FacilityData> = {}) {
    const facilityData: FacilityData = { ...DEFAULT_FACILITY_DATA, ...data }
    const props = {
      data: facilityData,
      onChange: mockOnChange,
    }
    return render(<FacilityStep {...props} />)
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  describe('Rendering', () => {
    it('renders the facility step with correct heading and description', () => {
      setup()
      expect(screen.getByText('Facility Information')).toBeTruthy()
      expect(screen.getByText('Core identity and classification')).toBeTruthy()
    })

    it('renders all required field labels with asterisks', () => {
      setup()
      expect(screen.getByText(/Facility Name/)).toBeTruthy()
      expect(screen.getByText(/Timezone/)).toBeTruthy()
    })

    it('renders facility name input with correct value', () => {
      setup({ name: 'Pacific Surgery Center' })
      const input = screen.getByTestId('facility-name-input') as HTMLInputElement
      expect(input.value).toBe('Pacific Surgery Center')
    })

    it('renders facility type select with default value', () => {
      setup()
      const select = screen.getByTestId('facility-type-select') as HTMLSelectElement
      expect(select.value).toBe('asc')
    })

    it('renders phone input with correct value', () => {
      setup({ phone: '(555) 123-4567' })
      const input = screen.getByTestId('facility-phone-input') as HTMLInputElement
      expect(input.value).toBe('(555) 123-4567')
    })

    it('renders all address fields', () => {
      setup()
      expect(screen.getByTestId('facility-street-input')).toBeTruthy()
      expect(screen.getByTestId('facility-street2-input')).toBeTruthy()
      expect(screen.getByTestId('facility-city-input')).toBeTruthy()
      expect(screen.getByTestId('facility-state-select')).toBeTruthy()
      expect(screen.getByTestId('facility-zip-input')).toBeTruthy()
    })

    it('renders timezone select with default value', () => {
      setup()
      const select = screen.getByTestId('facility-timezone-select') as HTMLSelectElement
      expect(select.value).toBe('America/New_York')
    })

    it('renders subscription status radios', () => {
      setup()
      expect(screen.getByTestId('subscription-trial-radio')).toBeTruthy()
      expect(screen.getByTestId('subscription-active-radio')).toBeTruthy()
    })

    it('renders trial radio as checked by default', () => {
      setup()
      const trialRadio = screen.getByTestId('subscription-trial-radio') as HTMLInputElement
      expect(trialRadio.checked).toBe(true)
    })

    it('shows trial length select when subscription status is trial', () => {
      setup({ subscriptionStatus: 'trial' })
      expect(screen.getByTestId('trial-length-select')).toBeTruthy()
    })

    it('hides trial length select when subscription status is active', () => {
      setup({ subscriptionStatus: 'active' })
      expect(screen.queryByTestId('trial-length-select')).toBeNull()
    })
  })

  // ============================================================================
  // FIELD UPDATES
  // ============================================================================

  describe('Field Updates', () => {
    it('calls onChange when facility name is updated', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-name-input')
      fireEvent.change(input, { target: { value: 'New Surgery Center' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Surgery Center' })
      )
    })

    it('calls onChange when facility type is updated', () => {
      mockOnChange.mockClear()
      setup()
      const select = screen.getByTestId('facility-type-select')
      fireEvent.change(select, { target: { value: 'hospital' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ facilityType: 'hospital' })
      )
    })

    it('calls onChange when phone is updated', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-phone-input')
      fireEvent.change(input, { target: { value: '5551234567' } })
      expect(mockOnChange).toHaveBeenCalled()
    })

    it('calls onChange when street address is updated', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-street-input')
      fireEvent.change(input, { target: { value: '123 Main St' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ streetAddress: '123 Main St' })
      )
    })

    it('calls onChange when street address 2 is updated', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-street2-input')
      fireEvent.change(input, { target: { value: 'Suite 100' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ streetAddress2: 'Suite 100' })
      )
    })

    it('calls onChange when city is updated', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-city-input')
      fireEvent.change(input, { target: { value: 'Seattle' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Seattle' })
      )
    })

    it('calls onChange when state is updated', () => {
      mockOnChange.mockClear()
      setup()
      const select = screen.getByTestId('facility-state-select')
      fireEvent.change(select, { target: { value: 'WA' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'WA' })
      )
    })

    it('calls onChange when zip code is updated', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-zip-input')
      fireEvent.change(input, { target: { value: '98101' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ zipCode: '98101' })
      )
    })

    it('calls onChange when timezone is updated', () => {
      mockOnChange.mockClear()
      setup()
      const select = screen.getByTestId('facility-timezone-select')
      fireEvent.change(select, { target: { value: 'America/Los_Angeles' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ timezone: 'America/Los_Angeles' })
      )
    })

    it('calls onChange when subscription status is changed to active', () => {
      mockOnChange.mockClear()
      setup({ subscriptionStatus: 'trial' })
      const activeRadio = screen.getByTestId('subscription-active-radio')
      fireEvent.click(activeRadio)
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionStatus: 'active' })
      )
    })

    it('calls onChange when trial length is updated', () => {
      mockOnChange.mockClear()
      setup({ subscriptionStatus: 'trial', trialDays: 30 })
      const select = screen.getByTestId('trial-length-select')
      fireEvent.change(select, { target: { value: '60' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ trialDays: 60 })
      )
    })
  })

  // ============================================================================
  // PHONE FORMATTING
  // ============================================================================

  describe('Phone Formatting', () => {
    it('formats phone number with 3 digits', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-phone-input')
      fireEvent.change(input, { target: { value: '555' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '555' })
      )
    })

    it('formats phone number with 6 digits', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-phone-input')
      fireEvent.change(input, { target: { value: '555123' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '(555) 123' })
      )
    })

    it('formats phone number with 10 digits', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-phone-input')
      fireEvent.change(input, { target: { value: '5551234567' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '(555) 123-4567' })
      )
    })

    it('strips non-digit characters from phone input', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-phone-input')
      fireEvent.change(input, { target: { value: '(555) 123-4567' } })
      // formatPhone should strip non-digits and reformat
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '(555) 123-4567' })
      )
    })
  })

  // ============================================================================
  // ZIP CODE VALIDATION
  // ============================================================================

  describe('ZIP Code Validation', () => {
    it('strips non-digit characters from zip code', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-zip-input')
      fireEvent.change(input, { target: { value: 'abc98101xyz' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ zipCode: '98101' })
      )
    })

    it('limits zip code to 5 digits', () => {
      mockOnChange.mockClear()
      setup()
      const input = screen.getByTestId('facility-zip-input')
      fireEvent.change(input, { target: { value: '981011234' } })
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ zipCode: '98101' })
      )
    })
  })

  // ============================================================================
  // CONDITIONAL RENDERING
  // ============================================================================

  describe('Conditional Rendering', () => {
    it('shows trial length when trial is selected', () => {
      setup({ subscriptionStatus: 'trial' })
      expect(screen.getByTestId('trial-length-select')).toBeTruthy()
      expect(screen.getByText(/Trial begins when the facility is created/)).toBeTruthy()
    })

    it('hides trial length when active is selected', () => {
      setup({ subscriptionStatus: 'active' })
      expect(screen.queryByTestId('trial-length-select')).toBeNull()
    })

    it('shows trial length after changing from active to trial', () => {
      const { rerender } = setup({ subscriptionStatus: 'active' })
      expect(screen.queryByTestId('trial-length-select')).toBeNull()

      // Simulate subscription status change
      rerender(
        <FacilityStep
          data={{ ...DEFAULT_FACILITY_DATA, subscriptionStatus: 'trial' }}
          onChange={mockOnChange}
        />
      )
      expect(screen.getByTestId('trial-length-select')).toBeTruthy()
    })
  })
})
