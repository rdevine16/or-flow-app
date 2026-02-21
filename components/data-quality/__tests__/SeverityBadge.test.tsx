import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SeverityBadge from '../SeverityBadge'

describe('SeverityBadge', () => {
  describe('rendering', () => {
    it('renders count and label', () => {
      render(<SeverityBadge severity="error" count={5} label="Critical" />)
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('renders with zero count', () => {
      render(<SeverityBadge severity="info" count={0} label="Info" />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('renders with large count', () => {
      render(<SeverityBadge severity="warning" count={9999} label="Warning" />)
      expect(screen.getByText('9999')).toBeInTheDocument()
    })

    it('has correct testid for each severity', () => {
      const { container: errorContainer } = render(
        <SeverityBadge severity="error" count={1} label="Critical" />
      )
      expect(errorContainer.querySelector('[data-testid="severity-error"]')).toBeInTheDocument()

      const { container: warningContainer } = render(
        <SeverityBadge severity="warning" count={1} label="Warning" />
      )
      expect(warningContainer.querySelector('[data-testid="severity-warning"]')).toBeInTheDocument()

      const { container: infoContainer } = render(
        <SeverityBadge severity="info" count={1} label="Info" />
      )
      expect(infoContainer.querySelector('[data-testid="severity-info"]')).toBeInTheDocument()
    })
  })

  describe('severity-specific styling', () => {
    it('applies error (red) styling for error severity', () => {
      const { container } = render(<SeverityBadge severity="error" count={3} label="Critical" />)
      const badge = container.querySelector('[data-testid="severity-error"]')

      expect(badge).toHaveClass('bg-red-50', 'border-red-200')

      const dot = badge?.querySelector('.bg-red-600')
      expect(dot).toBeInTheDocument()
    })

    it('applies warning (amber) styling for warning severity', () => {
      const { container } = render(<SeverityBadge severity="warning" count={2} label="Warning" />)
      const badge = container.querySelector('[data-testid="severity-warning"]')

      expect(badge).toHaveClass('bg-amber-50', 'border-amber-200')

      const dot = badge?.querySelector('.bg-amber-600')
      expect(dot).toBeInTheDocument()
    })

    it('applies info (blue) styling for info severity', () => {
      const { container } = render(<SeverityBadge severity="info" count={1} label="Info" />)
      const badge = container.querySelector('[data-testid="severity-info"]')

      expect(badge).toHaveClass('bg-blue-50', 'border-blue-200')

      const dot = badge?.querySelector('.bg-blue-600')
      expect(dot).toBeInTheDocument()
    })
  })

  describe('layout structure', () => {
    it('renders dot, count, and label in correct order', () => {
      const { container } = render(<SeverityBadge severity="error" count={5} label="Critical" />)
      const badge = container.querySelector('[data-testid="severity-error"]')

      const children = badge?.children
      expect(children).toHaveLength(3)

      // First child: dot (div with rounded-full)
      expect(children?.[0]).toHaveClass('rounded-full')

      // Second child: count (span with font-mono)
      expect(children?.[1]).toHaveClass('font-mono')
      expect(children?.[1].textContent).toBe('5')

      // Third child: label (span with text)
      expect(children?.[2].textContent).toBe('Critical')
    })

    it('uses inline-flex layout with gap', () => {
      const { container } = render(<SeverityBadge severity="warning" count={2} label="Warning" />)
      const badge = container.querySelector('[data-testid="severity-warning"]')

      expect(badge).toHaveClass('inline-flex', 'items-center', 'gap-1.5')
    })

    it('applies padding and border radius', () => {
      const { container } = render(<SeverityBadge severity="info" count={1} label="Info" />)
      const badge = container.querySelector('[data-testid="severity-info"]')

      expect(badge).toHaveClass('px-2.5', 'py-1', 'rounded-md', 'border')
    })
  })

  describe('text styling consistency', () => {
    it('uses font-mono for count across all severities', () => {
      const severities: Array<'error' | 'warning' | 'info'> = ['error', 'warning', 'info']

      severities.forEach((severity) => {
        const { container } = render(
          <SeverityBadge severity={severity} count={5} label="Test" />
        )
        const badge = container.querySelector(`[data-testid="severity-${severity}"]`)
        const countSpan = badge?.querySelector('.font-mono')

        expect(countSpan).toBeInTheDocument()
        expect(countSpan).toHaveClass('text-[13px]', 'font-semibold')
      })
    })

    it('applies consistent label text size', () => {
      const { container } = render(<SeverityBadge severity="error" count={1} label="Critical" />)
      const badge = container.querySelector('[data-testid="severity-error"]')
      const labelSpan = badge?.querySelector('.text-\\[11px\\]')

      expect(labelSpan).toBeInTheDocument()
      expect(labelSpan?.textContent).toBe('Critical')
    })
  })
})
