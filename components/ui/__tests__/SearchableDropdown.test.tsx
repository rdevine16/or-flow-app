import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchableDropdown from '../SearchableDropdown'

const OPTIONS = [
  { id: '1', label: 'Option A' },
  { id: '2', label: 'Option B' },
  { id: '3', label: 'Option C', subtitle: 'With subtitle' },
]

describe('SearchableDropdown', () => {
  it('renders label and placeholder', () => {
    render(
      <SearchableDropdown
        label="Test Label"
        placeholder="Pick one"
        options={OPTIONS}
        onChange={() => {}}
      />
    )

    expect(screen.getByText('Test Label')).toBeInTheDocument()
    expect(screen.getByText('Pick one')).toBeInTheDocument()
  })

  it('shows selected option label', () => {
    render(
      <SearchableDropdown
        label="Room"
        options={OPTIONS}
        value="2"
        onChange={() => {}}
      />
    )

    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('displays error message and applies error styling when error prop is set', () => {
    const { container } = render(
      <SearchableDropdown
        label="Surgeon"
        placeholder="Select Surgeon"
        options={OPTIONS}
        onChange={() => {}}
        error="Surgeon is required"
      />
    )

    // Error message is rendered
    expect(screen.getByText('Surgeon is required')).toBeInTheDocument()

    // The trigger button has red border class
    const button = container.querySelector('button')
    expect(button?.className).toContain('border-red-400')
  })

  it('does not show error styling when error prop is absent', () => {
    const { container } = render(
      <SearchableDropdown
        label="Room"
        options={OPTIONS}
        onChange={() => {}}
      />
    )

    const button = container.querySelector('button')
    expect(button?.className).toContain('border-slate-200')
    expect(button?.className).not.toContain('border-red-400')
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
  })

  it('clears error styling when error prop changes to undefined', () => {
    const { container, rerender } = render(
      <SearchableDropdown
        label="Room"
        options={OPTIONS}
        onChange={() => {}}
        error="Required"
      />
    )

    expect(screen.getByText('Required')).toBeInTheDocument()

    rerender(
      <SearchableDropdown
        label="Room"
        options={OPTIONS}
        onChange={() => {}}
        error={undefined}
      />
    )

    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    const button = container.querySelector('button')
    expect(button?.className).not.toContain('border-red-400')
  })

  it('opens dropdown and shows options on click', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown
        label="Pick"
        options={OPTIONS}
        onChange={() => {}}
      />
    )

    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
    expect(screen.getByText('Option C')).toBeInTheDocument()
  })

  it('calls onChange when an option is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <SearchableDropdown
        label="Pick"
        options={OPTIONS}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Option B'))
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    render(
      <SearchableDropdown
        label="Pick"
        options={OPTIONS}
        onChange={() => {}}
        disabled
      />
    )

    await user.click(screen.getByRole('button'))
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument()
  })
})
