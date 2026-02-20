// components/settings/flags/__tests__/ScopeBadge.test.tsx
// Unit tests for ScopeBadge component

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScopeBadge } from '../ScopeBadge'

describe('ScopeBadge', () => {
  it('displays "Facility" when value is facility', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    expect(screen.getByText('Facility')).toBeDefined()
  })

  it('displays "Personal" when value is personal', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="personal" onChange={onChange} />)

    expect(screen.getByText('Personal')).toBeDefined()
  })

  it('applies violet styles when scope is personal', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="personal" onChange={onChange} />)

    const button = screen.getByText('Personal')
    expect(button.className).toContain('bg-violet-50')
    expect(button.className).toContain('text-violet-600')
    expect(button.className).toContain('border-violet-200')
  })

  it('applies slate styles when scope is facility', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    const button = screen.getByText('Facility')
    expect(button.className).toContain('bg-slate-50')
    expect(button.className).toContain('text-slate-500')
    expect(button.className).toContain('border-slate-200')
  })

  it('toggles from facility to personal when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    const button = screen.getByText('Facility')
    await user.click(button)

    expect(onChange).toHaveBeenCalledWith('personal')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('toggles from personal to facility when clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeBadge value="personal" onChange={onChange} />)

    const button = screen.getByText('Personal')
    await user.click(button)

    expect(onChange).toHaveBeenCalledWith('facility')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('disables button when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} disabled={true} />)

    const button = screen.getByText('Facility')
    expect(button.getAttribute('disabled')).not.toBeNull()
  })

  it('applies disabled styles when disabled', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="personal" onChange={onChange} disabled={true} />)

    const button = screen.getByText('Personal')
    expect(button.className).toContain('opacity-40')
    expect(button.className).toContain('cursor-default')
  })

  it('does not call onChange when clicking disabled badge', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ScopeBadge value="facility" onChange={onChange} disabled={true} />)

    const button = screen.getByText('Facility')
    await user.click(button)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('updates display when value prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ScopeBadge value="facility" onChange={onChange} />)

    expect(screen.getByText('Facility')).toBeDefined()

    rerender(<ScopeBadge value="personal" onChange={onChange} />)

    expect(screen.getByText('Personal')).toBeDefined()
    expect(screen.queryByText('Facility')).toBeNull()
  })
})
