import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import IssueChip from '../IssueChip'

describe('IssueChip', () => {
  describe('severity color mapping', () => {
    it('renders error severity with red styling', () => {
      const { container } = render(<IssueChip label="Missing Data" severity="error" />)

      const chip = container.querySelector('[data-testid="issue-chip-error"]')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveClass('bg-red-100', 'text-red-900', 'border-red-200')
    })

    it('renders warning severity with amber styling', () => {
      const { container } = render(<IssueChip label="Too Fast" severity="warning" />)

      const chip = container.querySelector('[data-testid="issue-chip-warning"]')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveClass('bg-amber-100', 'text-amber-900', 'border-amber-200')
    })

    it('renders info severity with blue styling', () => {
      const { container } = render(<IssueChip label="Review Needed" severity="info" />)

      const chip = container.querySelector('[data-testid="issue-chip-info"]')
      expect(chip).toBeInTheDocument()
      expect(chip).toHaveClass('bg-blue-100', 'text-blue-900', 'border-blue-200')
    })
  })

  describe('label display', () => {
    it('renders the label text', () => {
      render(<IssueChip label="Missing Milestone" severity="error" />)

      expect(screen.getByText('Missing Milestone')).toBeInTheDocument()
    })

    it('renders label without count when count is undefined', () => {
      const { container } = render(<IssueChip label="Timeout" severity="warning" />)

      expect(container.textContent).toBe('Timeout')
    })

    it('renders label without count when count is 1', () => {
      const { container } = render(<IssueChip label="Timeout" severity="warning" count={1} />)

      expect(container.textContent).toBe('Timeout')
    })

    it('renders label WITH count when count > 1', () => {
      const { container } = render(<IssueChip label="Timeout" severity="warning" count={3} />)

      expect(container.textContent).toBe('Timeout (3)')
    })

    it('renders count for count of 2', () => {
      render(<IssueChip label="Missing" severity="error" count={2} />)

      expect(screen.getByText(/Missing \(2\)/)).toBeInTheDocument()
    })
  })

  describe('styling consistency', () => {
    it('applies consistent base classes regardless of severity', () => {
      const { container: container1 } = render(<IssueChip label="Test" severity="error" />)
      const { container: container2 } = render(<IssueChip label="Test" severity="warning" />)
      const { container: container3 } = render(<IssueChip label="Test" severity="info" />)

      const chip1 = container1.querySelector('[data-testid="issue-chip-error"]')
      const chip2 = container2.querySelector('[data-testid="issue-chip-warning"]')
      const chip3 = container3.querySelector('[data-testid="issue-chip-info"]')

      // All should have the same base structure
      for (const chip of [chip1, chip2, chip3]) {
        expect(chip).toHaveClass('inline-flex', 'items-center', 'gap-1', 'px-2', 'py-0.5', 'rounded', 'text-[11px]', 'font-semibold', 'tracking-wide', 'border')
      }
    })
  })
})
