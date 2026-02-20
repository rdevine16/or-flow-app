// components/settings/flags/__tests__/CategoryFilter.test.tsx
// Unit tests for CategoryFilter component

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryFilter } from '../CategoryFilter'

describe('CategoryFilter', () => {
  const mockCategories = [
    { key: 'timing', label: 'Timing' },
    { key: 'efficiency', label: 'Efficiency' },
    { key: 'financial', label: 'Financial' },
  ]

  it('renders "All" tab at the start', () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="all" onChange={onChange} categories={mockCategories} />)

    const allButton = screen.getByRole('button', { name: 'All' })
    expect(allButton).toBeDefined()
  })

  it('renders "Archived" tab at the end', () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="all" onChange={onChange} categories={mockCategories} />)

    const archivedButton = screen.getByRole('button', { name: 'Archived' })
    expect(archivedButton).toBeDefined()
  })

  it('renders all provided category tabs in order', () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="all" onChange={onChange} categories={mockCategories} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5) // All + 3 categories + Archived
    expect(buttons[0].textContent).toBe('All')
    expect(buttons[1].textContent).toBe('Timing')
    expect(buttons[2].textContent).toBe('Efficiency')
    expect(buttons[3].textContent).toBe('Financial')
    expect(buttons[4].textContent).toBe('Archived')
  })

  it('applies active styles to the selected tab', () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="timing" onChange={onChange} categories={mockCategories} />)

    const timingButton = screen.getByRole('button', { name: 'Timing' })
    expect(timingButton.className).toContain('bg-white')
    expect(timingButton.className).toContain('text-slate-900')
    expect(timingButton.className).toContain('shadow-sm')
  })

  it('applies inactive styles to non-selected tabs', () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="timing" onChange={onChange} categories={mockCategories} />)

    const allButton = screen.getByRole('button', { name: 'All' })
    expect(allButton.className).toContain('text-slate-500')
    expect(allButton.className).not.toContain('bg-white')
  })

  it('calls onChange with the clicked tab key', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryFilter value="all" onChange={onChange} categories={mockCategories} />)

    const efficiencyButton = screen.getByRole('button', { name: 'Efficiency' })
    await user.click(efficiencyButton)

    expect(onChange).toHaveBeenCalledWith('efficiency')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls onChange when clicking Archived tab', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryFilter value="all" onChange={onChange} categories={mockCategories} />)

    const archivedButton = screen.getByRole('button', { name: 'Archived' })
    await user.click(archivedButton)

    expect(onChange).toHaveBeenCalledWith('archived')
  })

  it('handles empty categories array gracefully', () => {
    const onChange = vi.fn()
    render(<CategoryFilter value="all" onChange={onChange} categories={[]} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2) // Just All + Archived
    expect(buttons[0].textContent).toBe('All')
    expect(buttons[1].textContent).toBe('Archived')
  })

  it('updates active state when value prop changes', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <CategoryFilter value="all" onChange={onChange} categories={mockCategories} />
    )

    let allButton = screen.getByRole('button', { name: 'All' })
    expect(allButton.className).toContain('bg-white')

    rerender(<CategoryFilter value="financial" onChange={onChange} categories={mockCategories} />)

    allButton = screen.getByRole('button', { name: 'All' })
    const financialButton = screen.getByRole('button', { name: 'Financial' })
    expect(allButton.className).not.toContain('bg-white')
    expect(financialButton.className).toContain('bg-white')
  })
})
