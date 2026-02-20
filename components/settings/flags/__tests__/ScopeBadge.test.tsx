// components/settings/flags/__tests__/ScopeBadge.test.tsx
// Unit tests for ScopeBadge component (dropdown)

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScopeBadge } from '../ScopeBadge'

describe('ScopeBadge', () => {
  it('renders a select element with current value', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()
    expect((select as HTMLSelectElement).value).toBe('facility')
  })

  it('renders both scope options', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Facility')
    expect(options[1]).toHaveTextContent('Personal')
  })

  it('applies violet styles when scope is personal', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="personal" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-violet-50')
    expect(select.className).toContain('text-violet-600')
    expect(select.className).toContain('border-violet-200')
  })

  it('applies slate styles when scope is facility', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('bg-slate-50')
    expect(select.className).toContain('text-slate-500')
    expect(select.className).toContain('border-slate-200')
  })

  it('calls onChange with selected scope', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'personal' } })

    expect(onChange).toHaveBeenCalledWith('personal')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange when switching from personal to facility', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="personal" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'facility' } })

    expect(onChange).toHaveBeenCalledWith('facility')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('disables select when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="facility" onChange={onChange} disabled={true} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
  })

  it('applies disabled styles when disabled', () => {
    const onChange = vi.fn()
    render(<ScopeBadge value="personal" onChange={onChange} disabled={true} />)

    const select = screen.getByRole('combobox')
    expect(select.className).toContain('opacity-40')
  })

  it('updates display when value prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<ScopeBadge value="facility" onChange={onChange} />)

    let select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('facility')
    expect(select.className).toContain('bg-slate-50')

    rerender(<ScopeBadge value="personal" onChange={onChange} />)

    select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('personal')
    expect(select.className).toContain('bg-violet-50')
  })
})
