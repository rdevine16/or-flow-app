// components/settings/flags/__tests__/SeverityPills.test.tsx
// Unit tests for SeverityPills component (dropdown + badges variants)

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeverityPills } from '../SeverityPills'

describe('SeverityPills — dropdown variant (default)', () => {
  it('renders a select element with the current value', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()
    expect((select as HTMLSelectElement).value).toBe('info')
  })

  it('renders all three severity options', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent('Info')
    expect(options[1]).toHaveTextContent('Warning')
    expect(options[2]).toHaveTextContent('Critical')
  })

  it('applies correct styles for info severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-blue-50')
    expect(select.className).toContain('text-blue-700')
    expect(select.className).toContain('ring-blue-200')
  })

  it('applies correct styles for warning severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-amber-50')
    expect(select.className).toContain('text-amber-700')
    expect(select.className).toContain('ring-amber-200')
  })

  it('applies correct styles for critical severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="critical" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-red-50')
    expect(select.className).toContain('text-red-600')
    expect(select.className).toContain('ring-red-200')
  })

  it('calls onChange with the selected severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'critical' } })

    expect(onChange).toHaveBeenCalledWith('critical')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('disables the select when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} disabled={true} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })

  it('applies disabled styles when disabled', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} disabled={true} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('opacity-40')
  })

  it('updates visual state when value prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SeverityPills value="info" onChange={onChange} />)

    let select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-blue-50')

    rerender(<SeverityPills value="critical" onChange={onChange} />)

    select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-red-50')
  })
})

describe('SeverityPills — badges variant', () => {
  it('renders all three severity buttons', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} variant="badges" />)

    expect(screen.getByText('Info')).toBeDefined()
    expect(screen.getByText('Warning')).toBeDefined()
    expect(screen.getByText('Critical')).toBeDefined()
  })

  it('highlights the selected severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} variant="badges" />)

    const warningBtn = screen.getByText('Warning')
    expect(warningBtn.className).toContain('bg-amber-50')
    expect(warningBtn.className).toContain('text-amber-700')

    const infoBtn = screen.getByText('Info')
    expect(infoBtn.className).toContain('text-slate-400')
  })

  it('calls onChange with clicked severity', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} variant="badges" />)

    await user.click(screen.getByText('Critical'))

    expect(onChange).toHaveBeenCalledWith('critical')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('disables all buttons when disabled', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} variant="badges" disabled={true} />)

    const infoBtn = screen.getByText('Info')
    expect(infoBtn.closest('button')!.disabled).toBe(true)
    expect(infoBtn.className).toContain('opacity-40')
  })

  it('does not call onChange when clicking while disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} variant="badges" disabled={true} />)

    await user.click(screen.getByText('Warning'))

    expect(onChange).not.toHaveBeenCalled()
  })
})
