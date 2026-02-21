import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SummaryRow from '../SummaryRow'
import type { DataQualitySummary } from '@/lib/dataQuality'

describe('SummaryRow', () => {
  const mockSummary: DataQualitySummary = {
    qualityScore: 85,
    totalUnresolved: 12,
    expiringThisWeek: 3,
    byType: { stale_in_progress: 5, abandoned_scheduled: 4, no_activity: 3 },
    bySeverity: { error: 2, warning: 7, info: 3 },
  }

  describe('layout structure', () => {
    it('renders summary row container', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const row = container.querySelector('[data-testid="summary-row"]')
      expect(row).toBeInTheDocument()
    })

    it('uses grid layout with auto and 1fr columns', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const row = container.querySelector('[data-testid="summary-row"]')
      expect(row).toHaveClass('grid', 'grid-cols-[auto_1fr]', 'gap-5')
    })

    it('renders quality gauge card and stats grid', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const cards = container.querySelectorAll('.bg-white.border.border-stone-200.rounded-xl')

      // Should have 4 cards: 1 gauge card + 3 stat cards
      expect(cards.length).toBeGreaterThanOrEqual(4)
    })

    it('stats grid has 3 columns', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const statsGrid = container.querySelector('.grid-cols-3')
      expect(statsGrid).toBeInTheDocument()
    })
  })

  describe('quality gauge card', () => {
    it('renders Quality Score heading', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('Quality Score')).toBeInTheDocument()
    })

    it('passes quality score to QualityGauge component', () => {
      render(<SummaryRow summary={mockSummary} />)
      // QualityGauge displays score as text
      expect(screen.getByText('85')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /Quality score: 85%/i })).toBeInTheDocument()
    })

    it('renders with different quality scores', () => {
      const highScore: DataQualitySummary = { ...mockSummary, qualityScore: 95 }
      const { rerender } = render(<SummaryRow summary={highScore} />)
      expect(screen.getByText('95')).toBeInTheDocument()

      const lowScore: DataQualitySummary = { ...mockSummary, qualityScore: 45 }
      rerender(<SummaryRow summary={lowScore} />)
      expect(screen.getByText('45')).toBeInTheDocument()
    })
  })

  describe('open issues card', () => {
    it('renders Open Issues heading', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('Open Issues')).toBeInTheDocument()
    })

    it('displays total unresolved count', () => {
      render(<SummaryRow summary={mockSummary} />)
      const count = screen.getByText('12')
      expect(count).toBeInTheDocument()
      expect(count).toHaveClass('font-mono', 'text-[32px]', 'font-bold')
    })

    it('renders alert icon', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const iconWrapper = container.querySelector('.bg-amber-50')
      expect(iconWrapper).toBeInTheDocument()
    })

    it('shows "Requires attention" subtitle', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('Requires attention')).toBeInTheDocument()
    })

    it('handles zero unresolved issues', () => {
      const noIssues: DataQualitySummary = { ...mockSummary, totalUnresolved: 0 }
      render(<SummaryRow summary={noIssues} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('expiring soon card', () => {
    it('renders Expiring Soon heading', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument()
    })

    it('displays expiring this week count', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      // Find the expiring count by looking for the large font size (32px) with text-amber-600
      const expiringCards = container.querySelectorAll('.font-mono.text-\\[32px\\].font-bold')
      const expiringCount = Array.from(expiringCards).find((el) => el.textContent === '3')
      expect(expiringCount).toBeInTheDocument()
    })

    it('renders clock icon with red background', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const iconWrapper = container.querySelector('.bg-red-50')
      expect(iconWrapper).toBeInTheDocument()
    })

    it('shows "within 7 days" subtitle', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('within 7 days')).toBeInTheDocument()
    })

    it('applies amber color when count > 0', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      // Find the expiring count specifically (large font, amber color)
      const expiringCount = container.querySelector('.font-mono.text-\\[32px\\].font-bold.text-amber-600')
      expect(expiringCount).toBeInTheDocument()
      expect(expiringCount?.textContent).toBe('3')
    })

    it('applies default color when count = 0', () => {
      const noExpiring: DataQualitySummary = { ...mockSummary, expiringThisWeek: 0 }
      const { container } = render(<SummaryRow summary={noExpiring} />)
      const count = screen.getByText('0')
      expect(count).toHaveClass('text-stone-900')
    })
  })

  describe('by severity card', () => {
    it('renders By Severity heading', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('By Severity')).toBeInTheDocument()
    })

    it('renders all three severity badges', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      expect(container.querySelector('[data-testid="severity-error"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="severity-warning"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="severity-info"]')).toBeInTheDocument()
    })

    it('displays correct counts for each severity', () => {
      render(<SummaryRow summary={mockSummary} />)

      // Error: 2, Warning: 7, Info: 3
      const counts = screen.getAllByText(/^[0-9]+$/)
      const countValues = counts.map((el) => el.textContent)

      expect(countValues).toContain('2') // error
      expect(countValues).toContain('7') // warning
      expect(countValues).toContain('3') // info
    })

    it('displays severity labels', () => {
      render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Info')).toBeInTheDocument()
    })

    it('handles zero counts in bySeverity', () => {
      const zeroSeverity: DataQualitySummary = {
        ...mockSummary,
        bySeverity: { error: 0, warning: 0, info: 0 },
      }
      render(<SummaryRow summary={zeroSeverity} />)

      const zeroCounts = screen.getAllByText('0')
      expect(zeroCounts.length).toBeGreaterThanOrEqual(3)
    })

    it('handles missing severity keys with fallback to 0', () => {
      const missingSeverity: DataQualitySummary = {
        ...mockSummary,
        bySeverity: {}, // empty object
      }
      render(<SummaryRow summary={missingSeverity} />)

      // Should display 0 for all missing keys due to || 0 fallback
      const zeroCounts = screen.getAllByText('0')
      expect(zeroCounts.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('integration with child components', () => {
    it('QualityGauge receives correct score prop', () => {
      render(<SummaryRow summary={mockSummary} />)
      const svg = screen.getByRole('img', { name: /Quality score: 85%/i })
      expect(svg).toBeInTheDocument()
    })

    it('SeverityBadges receive correct severity props', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      const errorBadge = container.querySelector('[data-testid="severity-error"]')
      expect(errorBadge).toHaveClass('bg-red-50')

      const warningBadge = container.querySelector('[data-testid="severity-warning"]')
      expect(warningBadge).toHaveClass('bg-amber-50')

      const infoBadge = container.querySelector('[data-testid="severity-info"]')
      expect(infoBadge).toHaveClass('bg-blue-50')
    })
  })

  describe('responsive design classes', () => {
    it('applies min-width to gauge card', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const gaugeCard = container.querySelector('.min-w-\\[180px\\]')
      expect(gaugeCard).toBeInTheDocument()
    })

    it('stats grid uses gap-3 spacing', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const statsGrid = container.querySelector('.grid-cols-3')
      expect(statsGrid).toHaveClass('gap-3')
    })

    it('severity badges stack vertically with gap-2', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)
      const severityContainer = container.querySelector('.flex-col.gap-2')
      expect(severityContainer).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles very large numbers', () => {
      const largeCounts: DataQualitySummary = {
        qualityScore: 100,
        totalUnresolved: 9999,
        expiringThisWeek: 888,
        byType: {},
        bySeverity: { error: 999, warning: 8888, info: 7777 },
      }
      render(<SummaryRow summary={largeCounts} />)

      expect(screen.getByText('9999')).toBeInTheDocument()
      expect(screen.getByText('888')).toBeInTheDocument()
    })

    it('handles all zero summary', () => {
      const allZero: DataQualitySummary = {
        qualityScore: 0,
        totalUnresolved: 0,
        expiringThisWeek: 0,
        byType: {},
        bySeverity: { error: 0, warning: 0, info: 0 },
      }
      render(<SummaryRow summary={allZero} />)

      const zeroCounts = screen.getAllByText('0')
      expect(zeroCounts.length).toBeGreaterThanOrEqual(4) // score + 3 severity badges + potentially more
    })
  })
})
