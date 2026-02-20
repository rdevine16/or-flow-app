// components/settings/flags/__tests__/SeverityPills.test.tsx
// Unit tests for SeverityPills component

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeverityPills } from '../SeverityPills'
import type { Severity } from '@/types/flag-settings'

describe('SeverityPills', () => {
  it('renders all three severity pills: info, warning, critical', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} />)

    expect(screen.getByText('Info')).toBeDefined()
    expect(screen.getByText('Warning')).toBeDefined()
    expect(screen.getByText('Critical')).toBeDefined()
  })

  it('applies selected styles to the active severity', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const warningButton = screen.getByText('Warning').closest('button')!
    expect(warningButton.className).toContain('bg-amber-50')
    expect(warningButton.className).toContain('text-amber-700')
    expect(warningButton.className).toContain('ring-amber-200')
  })

  it('applies inactive styles to non-selected pills', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const infoButton = screen.getByText('Info').closest('button')!
    expect(infoButton.className).toContain('text-slate-400')
    expect(infoButton.className).not.toContain('bg-sky-50')
  })

  it('calls onChange with the clicked severity', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} />)

    const criticalButton = screen.getByText('Critical')
    await user.click(criticalButton)

    expect(onChange).toHaveBeenCalledWith('critical')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('allows changing between all three severities', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} />)

    await user.click(screen.getByText('Warning'))
    expect(onChange).toHaveBeenCalledWith('warning')

    await user.click(screen.getByText('Critical'))
    expect(onChange).toHaveBeenCalledWith('critical')

    await user.click(screen.getByText('Info'))
    expect(onChange).toHaveBeenCalledWith('info')
  })

  it('disables all pills when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="info" onChange={onChange} disabled={true} />)

    const infoButton = screen.getByText('Info').closest('button')!
    const warningButton = screen.getByText('Warning').closest('button')!
    const criticalButton = screen.getByText('Critical').closest('button')!

    expect(infoButton.disabled).toBe(true)
    expect(warningButton.disabled).toBe(true)
    expect(criticalButton.disabled).toBe(true)
  })

  it('applies disabled styles when disabled', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} disabled={true} />)

    const warningButton = screen.getByText('Warning').closest('button')!
    expect(warningButton.className).toContain('opacity-40')
    expect(warningButton.className).toContain('cursor-default')
  })

  it('does not call onChange when clicking a disabled pill', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SeverityPills value="info" onChange={onChange} disabled={true} />)

    const criticalButton = screen.getByText('Critical')
    await user.click(criticalButton)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('updates visual state when value prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SeverityPills value="info" onChange={onChange} />)

    let infoButton = screen.getByText('Info').closest('button')!
    expect(infoButton.className).toContain('bg-blue-50')

    rerender(<SeverityPills value="critical" onChange={onChange} />)

    infoButton = screen.getByText('Info').closest('button')!
    const criticalButton = screen.getByText('Critical').closest('button')!
    expect(infoButton.className).not.toContain('bg-blue-50')
    expect(criticalButton.className).toContain('bg-red-50')
  })

  it('renders a colored dot indicator for each pill', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const warningButton = screen.getByText('Warning').closest('button')!
    const dot = warningButton.querySelector('span.w-1\\.5')
    expect(dot).toBeDefined()
    expect(dot?.className).toContain('rounded-full')
  })

  it('selected pill dot uses bg-current (inherits color from button)', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const warningButton = screen.getByText('Warning').closest('button')!
    const dot = warningButton.querySelector('span.w-1\\.5')
    expect(dot?.className).toContain('bg-current')
  })

  it('unselected pill dot uses bg-slate-300', () => {
    const onChange = vi.fn()
    render(<SeverityPills value="warning" onChange={onChange} />)

    const infoButton = screen.getByText('Info').closest('button')!
    const dot = infoButton.querySelector('span.w-1\\.5')
    expect(dot?.className).toContain('bg-slate-300')
  })
})
