// components/cases/__tests__/CaseActivitySummary.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CaseActivitySummary from '../CaseActivitySummary'

const baseProps = {
  completedMilestones: 0,
  totalMilestones: 0,
  implantsFilled: 0,
  implantTotal: 0,
  delayCount: 0,
  flagCount: 0,
}

describe('CaseActivitySummary', () => {
  describe('Activity tab (default)', () => {
    it('renders all activity rows with correct labels', () => {
      render(
        <CaseActivitySummary
          {...baseProps}
          completedMilestones={3}
          totalMilestones={8}
          implantsFilled={2}
          implantTotal={4}
          delayCount={1}
        />
      )

      expect(screen.getByText('Milestones')).toBeInTheDocument()
      expect(screen.getByText('Implants')).toBeInTheDocument()
      expect(screen.getByText('Delays')).toBeInTheDocument()
    })

    it('displays milestone count in X/Y format', () => {
      render(<CaseActivitySummary {...baseProps} completedMilestones={5} totalMilestones={10} />)
      expect(screen.getByText('5/10')).toBeInTheDocument()
    })

    it('displays implant count in X/Y format', () => {
      render(<CaseActivitySummary {...baseProps} implantsFilled={3} implantTotal={4} />)
      expect(screen.getByText('3/4')).toBeInTheDocument()
    })

    it('displays delay count as plain number', () => {
      render(<CaseActivitySummary {...baseProps} delayCount={3} />)
      const delaysRow = screen.getByText('Delays').closest('div')
      expect(within(delaysRow!).getByText('3')).toBeInTheDocument()
    })

    it('applies amber color to delay count when greater than 0', () => {
      render(<CaseActivitySummary {...baseProps} delayCount={2} />)
      const delaysRow = screen.getByText('Delays').closest('div')
      const delayValue = within(delaysRow!).getByText('2')
      expect(delayValue).toHaveClass('text-amber-600')
    })

    it('does not apply amber color to delay count when 0', () => {
      render(<CaseActivitySummary {...baseProps} />)
      const delaysRow = screen.getByText('Delays').closest('div')
      const delayValue = delaysRow?.querySelector('.font-mono')
      expect(delayValue).not.toHaveClass('text-amber-600')
      expect(delayValue).toHaveClass('text-slate-800')
    })

    it('applies red color to flag count when greater than 0', () => {
      render(<CaseActivitySummary {...baseProps} flagCount={3} />)
      // Row label "Flags" in the activity tab — use selector to disambiguate from tab button
      const flagsRow = screen.getByText('Flags', { selector: 'span.text-slate-500' }).closest('div')
      const flagValue = within(flagsRow!).getByText('3')
      expect(flagValue).toHaveClass('text-red-600')
    })

    it('does not apply red color to flag count when 0', () => {
      render(<CaseActivitySummary {...baseProps} />)
      const flagsRow = screen.getByText('Flags', { selector: 'span.text-sm' }).closest('div')
      const flagValue = flagsRow?.querySelector('.font-mono')
      expect(flagValue).not.toHaveClass('text-red-600')
      expect(flagValue).toHaveClass('text-slate-800')
    })

    it('handles 0/0 milestone scenario', () => {
      render(<CaseActivitySummary {...baseProps} />)
      const milestoneRow = screen.getByText('Milestones').closest('div')
      expect(milestoneRow).toHaveTextContent('0/0')
    })

    it('handles all milestones completed scenario', () => {
      render(
        <CaseActivitySummary {...baseProps} completedMilestones={8} totalMilestones={8} implantsFilled={4} implantTotal={4} />
      )
      expect(screen.getByText('8/8')).toBeInTheDocument()
      expect(screen.getByText('4/4')).toBeInTheDocument()
    })

    it('applies monospace font to values for tabular alignment', () => {
      render(<CaseActivitySummary {...baseProps} completedMilestones={5} totalMilestones={10} />)
      const milestoneValue = screen.getByText('5/10')
      expect(milestoneValue).toHaveClass('font-mono')
      expect(milestoneValue).toHaveClass('tabular-nums')
    })
  })

  describe('Tab navigation', () => {
    it('renders Case Activity and Flags tabs', () => {
      render(<CaseActivitySummary {...baseProps} />)
      expect(screen.getByRole('button', { name: /Case Activity/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Flags/i })).toBeInTheDocument()
    })

    it('shows badge count on Flags tab when flags/delays exist', () => {
      render(<CaseActivitySummary {...baseProps} flagCount={2} delayCount={1} />)
      const flagsTab = screen.getByRole('button', { name: /Flags/i })
      expect(within(flagsTab).getByText('3')).toBeInTheDocument()
    })

    it('does not show badge count on Flags tab when no flags/delays', () => {
      render(<CaseActivitySummary {...baseProps} />)
      const flagsTab = screen.getByRole('button', { name: /Flags/i })
      expect(within(flagsTab).queryByText('0')).not.toBeInTheDocument()
    })

    it('switches to Flags tab on click', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} flags={[]} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('No flags')).toBeInTheDocument()
    })
  })

  describe('Flags tab content', () => {
    const sampleFlags = [
      {
        id: 'f1',
        flag_type: 'threshold' as const,
        severity: 'critical' as const,
        label: 'Late Case Start',
        detail: '227 min (threshold: 15 min)',
        duration_minutes: null,
        note: null,
      },
      {
        id: 'f2',
        flag_type: 'delay' as const,
        severity: 'warning' as const,
        label: 'Equipment Delay',
        detail: '30 min',
        duration_minutes: 30,
        note: 'Waiting for implant trays',
      },
    ]

    it('renders flag cards with labels', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} flagCount={1} delayCount={1} flags={sampleFlags} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('Late Case Start')).toBeInTheDocument()
      expect(screen.getByText('Equipment Delay')).toBeInTheDocument()
    })

    it('renders flag details', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} flagCount={1} delayCount={1} flags={sampleFlags} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('227 min (threshold: 15 min)')).toBeInTheDocument()
      expect(screen.getByText('30 min')).toBeInTheDocument()
    })

    it('renders flag notes', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} flagCount={1} delayCount={1} flags={sampleFlags} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('Waiting for implant trays')).toBeInTheDocument()
    })

    it('shows empty state when no flags', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} flags={[]} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('No flags')).toBeInTheDocument()
      expect(screen.getByText('This case is clean')).toBeInTheDocument()
    })

    it('shows severity label for threshold flags', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} flagCount={1} flags={[sampleFlags[0]]} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('critical')).toBeInTheDocument()
    })

    it('shows delay label for delay flags', async () => {
      const user = userEvent.setup()
      render(<CaseActivitySummary {...baseProps} delayCount={1} flags={[sampleFlags[1]]} />)

      await user.click(screen.getByRole('button', { name: /Flags/i }))
      expect(screen.getByText('delay')).toBeInTheDocument()
    })
  })
})
