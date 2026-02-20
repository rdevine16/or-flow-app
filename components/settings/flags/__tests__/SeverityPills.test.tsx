// components/settings/flags/__tests__/SeverityPills.test.tsx
// Unit tests for SeverityPills component (single cycling button)

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeverityPills } from '../SeverityPills'

describe('SeverityPills', () => {
  it('renders the current severity label', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} />)

    expect(screen.getByText('Info')).toBeDefined()
  })

  it('applies correct styles for info severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} />)

    const button = screen.getByText('Info').closest('button')!
    expect(button.className).toContain('bg-blue-50')
    expect(button.className).toContain('text-blue-700')
    expect(button.className).toContain('ring-blue-200')
  })

  it('applies correct styles for warning severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const button = screen.getByText('Warning').closest('button')!
    expect(button.className).toContain('bg-amber-50')
    expect(button.className).toContain('text-amber-700')
    expect(button.className).toContain('ring-amber-200')
  })

  it('applies correct styles for critical severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="critical" onChange={onChange} />)

    const button = screen.getByText('Critical').closest('button')!
    expect(button.className).toContain('bg-red-50')
    expect(button.className).toContain('text-red-600')
    expect(button.className).toContain('ring-red-200')
  })

  it('cycles from info to warning on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} />)

    await user.click(screen.getByText('Info'))

    expect(onChange).toHaveBeenCalledWith('warning')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('cycles from warning to critical on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="warning" onChange={onChange} />)

    await user.click(screen.getByText('Warning'))

    expect(onChange).toHaveBeenCalledWith('critical')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('cycles from critical back to info on click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="critical" onChange={onChange} />)

    await user.click(screen.getByText('Critical'))

    expect(onChange).toHaveBeenCalledWith('info')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('disables the button when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} disabled={true} />)

    const button = screen.getByText('Info').closest('button')!
    expect(button.disabled).toBe(true)
  })

  it('applies disabled styles when disabled', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} disabled={true} />)

    const button = screen.getByText('Warning').closest('button')!
    expect(button.className).toContain('opacity-40')
    expect(button.className).toContain('cursor-default')
  })

  it('does not call onChange when clicking while disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} disabled={true} />)

    await user.click(screen.getByText('Info'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('updates visual state when value prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SeverityPills value="info" onChange={onChange} />)

    let button = screen.getByText('Info').closest('button')!
    expect(button.className).toContain('bg-blue-50')

    rerender(<SeverityPills value="critical" onChange={onChange} />)

    button = screen.getByText('Critical').closest('button')!
    expect(button.className).toContain('bg-red-50')
  })
})
