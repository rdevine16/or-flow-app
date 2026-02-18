// components/cases/__tests__/CaseActivitySummary.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaseActivitySummary from '../CaseActivitySummary'

describe('CaseActivitySummary', () => {
  it('renders all activity rows with correct labels', () => {
    render(
      <CaseActivitySummary
        completedMilestones={3}
        totalMilestones={8}
        implantsFilled={2}
        implantTotal={4}
        delayCount={1}
        flagCount={0}
      />
    )

    expect(screen.getByText('Milestones')).toBeInTheDocument()
    expect(screen.getByText('Implants')).toBeInTheDocument()
    expect(screen.getByText('Delays')).toBeInTheDocument()
    expect(screen.getByText('Flags')).toBeInTheDocument()
  })

  it('displays milestone count in X/Y format', () => {
    render(
      <CaseActivitySummary
        completedMilestones={5}
        totalMilestones={10}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={0}
      />
    )

    expect(screen.getByText('5/10')).toBeInTheDocument()
  })

  it('displays implant count in X/Y format', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={3}
        implantTotal={4}
        delayCount={0}
        flagCount={0}
      />
    )

    expect(screen.getByText('3/4')).toBeInTheDocument()
  })

  it('displays delay count as plain number', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={3}
        flagCount={0}
      />
    )

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('displays flag count as plain number', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={2}
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('applies amber color to delay count when greater than 0', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={2}
        flagCount={0}
      />
    )

    const delayValue = screen.getByText('2')
    expect(delayValue).toHaveClass('text-amber-600')
  })

  it('does not apply amber color to delay count when 0', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={0}
      />
    )

    // Find the Delays row and check its value
    const delaysRow = screen.getByText('Delays').closest('div')
    const delayValue = delaysRow?.querySelector('.font-mono')
    expect(delayValue).not.toHaveClass('text-amber-600')
    expect(delayValue).toHaveClass('text-slate-800')
  })

  it('applies red color to flag count when greater than 0', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={3}
      />
    )

    const flagValue = screen.getByText('3')
    expect(flagValue).toHaveClass('text-red-600')
  })

  it('does not apply red color to flag count when 0', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={0}
      />
    )

    const flagValues = screen.getAllByText('0')
    const flagValue = flagValues[flagValues.length - 1] // Last one is Flags
    expect(flagValue).not.toHaveClass('text-red-600')
    expect(flagValue).toHaveClass('text-slate-800')
  })

  it('handles 0/0 milestone scenario', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={0}
      />
    )

    const milestoneRow = screen.getByText('Milestones').closest('div')
    expect(milestoneRow).toHaveTextContent('0/0')
  })

  it('handles all milestones completed scenario', () => {
    render(
      <CaseActivitySummary
        completedMilestones={8}
        totalMilestones={8}
        implantsFilled={4}
        implantTotal={4}
        delayCount={0}
        flagCount={0}
      />
    )

    expect(screen.getByText('8/8')).toBeInTheDocument()
    expect(screen.getByText('4/4')).toBeInTheDocument()
  })

  it('handles mixed activity with some delays and flags', () => {
    render(
      <CaseActivitySummary
        completedMilestones={4}
        totalMilestones={10}
        implantsFilled={2}
        implantTotal={4}
        delayCount={3}
        flagCount={1}
      />
    )

    expect(screen.getByText('4/10')).toBeInTheDocument()
    expect(screen.getByText('2/4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    const delayValue = screen.getByText('3')
    const flagValue = screen.getByText('1')
    expect(delayValue).toHaveClass('text-amber-600')
    expect(flagValue).toHaveClass('text-red-600')
  })

  it('renders section title', () => {
    render(
      <CaseActivitySummary
        completedMilestones={0}
        totalMilestones={0}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={0}
      />
    )

    expect(screen.getByText('Case Activity')).toBeInTheDocument()
  })

  it('applies monospace font to values for tabular alignment', () => {
    render(
      <CaseActivitySummary
        completedMilestones={5}
        totalMilestones={10}
        implantsFilled={0}
        implantTotal={0}
        delayCount={0}
        flagCount={0}
      />
    )

    const milestoneValue = screen.getByText('5/10')
    expect(milestoneValue).toHaveClass('font-mono')
    expect(milestoneValue).toHaveClass('tabular-nums')
  })
})
