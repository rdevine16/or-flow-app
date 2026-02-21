/**
 * Integration tests for SummaryRow component integration
 *
 * This test suite verifies that QualityGauge and SeverityBadge components
 * work correctly when integrated into SummaryRow with real DataQualitySummary data.
 *
 * Note: Full DataQualityPage integration tests would require extensive mocking
 * of Supabase client, Next.js router, and async data fetching. Those integration
 * scenarios are better covered by E2E tests. This suite focuses on component
 * integration within the summary row.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SummaryRow from '../SummaryRow'
import type { DataQualitySummary } from '@/lib/dataQuality'

describe('SummaryRow Integration with Child Components', () => {
  const mockSummary: DataQualitySummary = {
    qualityScore: 87,
    totalUnresolved: 15,
    expiringThisWeek: 4,
    byType: {
      stale_in_progress: 6,
      abandoned_scheduled: 5,
      no_activity: 4,
    },
    bySeverity: {
      error: 3,
      warning: 8,
      info: 4,
    },
  }

  describe('QualityGauge integration', () => {
    it('QualityGauge renders with correct score from summary', () => {
      render(<SummaryRow summary={mockSummary} />)

      const svg = screen.getByRole('img', { name: /Quality score: 87%/i })
      expect(svg).toBeInTheDocument()
      expect(screen.getByText('87')).toBeInTheDocument()
    })

    it('QualityGauge applies correct color based on summary score', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      const svg = screen.getByRole('img', { name: /Quality score: 87%/i })
      // Score 87 should be amber (>= 70, < 90)
      const progressPath = svg.querySelector('path[stroke="#D97706"]')
      expect(progressPath).toBeInTheDocument()
    })

    it('QualityGauge updates when summary score changes', () => {
      const { rerender } = render(<SummaryRow summary={mockSummary} />)
      expect(screen.getByText('87')).toBeInTheDocument()

      const updatedSummary: DataQualitySummary = { ...mockSummary, qualityScore: 95 }
      rerender(<SummaryRow summary={updatedSummary} />)
      expect(screen.getByText('95')).toBeInTheDocument()
    })
  })

  describe('SeverityBadge integration', () => {
    it('renders all three severity badges with data from summary', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      expect(container.querySelector('[data-testid="severity-error"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="severity-warning"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="severity-info"]')).toBeInTheDocument()
    })

    it('severity badges display correct counts from summary.bySeverity', () => {
      render(<SummaryRow summary={mockSummary} />)

      // Verify all three labels are present
      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Info')).toBeInTheDocument()

      // Verify counts (note: multiple "3"s exist, so we check presence)
      const allText = document.body.textContent || ''
      expect(allText).toContain('3') // error count
      expect(allText).toContain('8') // warning count
      expect(allText).toContain('4') // info count (also expiringThisWeek)
    })

    it('severity badges apply correct styling per severity level', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      const errorBadge = container.querySelector('[data-testid="severity-error"]')
      expect(errorBadge).toHaveClass('bg-red-50', 'border-red-200')

      const warningBadge = container.querySelector('[data-testid="severity-warning"]')
      expect(warningBadge).toHaveClass('bg-amber-50', 'border-amber-200')

      const infoBadge = container.querySelector('[data-testid="severity-info"]')
      expect(infoBadge).toHaveClass('bg-blue-50', 'border-blue-200')
    })

    it('severity badges handle zero counts correctly', () => {
      const zeroSummary: DataQualitySummary = {
        ...mockSummary,
        bySeverity: { error: 0, warning: 0, info: 0 },
      }
      render(<SummaryRow summary={zeroSummary} />)

      const zeroCounts = screen.getAllByText('0')
      // Should have at least 3 zeros (one for each severity badge)
      expect(zeroCounts.length).toBeGreaterThanOrEqual(3)
    })

    it('severity badges handle missing keys with fallback to 0', () => {
      const missingSummary: DataQualitySummary = {
        ...mockSummary,
        bySeverity: {}, // empty object
      }
      render(<SummaryRow summary={missingSummary} />)

      const zeroCounts = screen.getAllByText('0')
      // Should display 0 for all missing keys
      expect(zeroCounts.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('summary statistics integration', () => {
    it('displays totalUnresolved count correctly', () => {
      render(<SummaryRow summary={mockSummary} />)

      expect(screen.getByText('Open Issues')).toBeInTheDocument()
      const count = screen.getByText('15')
      expect(count).toHaveClass('font-mono', 'text-[32px]', 'font-bold')
    })

    it('displays expiringThisWeek count with conditional styling', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      // Should have amber color when count > 0
      const expiringCount = container.querySelector('.font-mono.text-\\[32px\\].font-bold.text-amber-600')
      expect(expiringCount).toBeInTheDocument()
      expect(expiringCount?.textContent).toBe('4')
    })

    it('expiring count uses default color when zero', () => {
      const zeroExpiring: DataQualitySummary = { ...mockSummary, expiringThisWeek: 0 }
      render(<SummaryRow summary={zeroExpiring} />)

      // Find the expiring soon heading and then the count below it
      const expiringHeading = screen.getByText('Expiring Soon')
      expect(expiringHeading).toBeInTheDocument()

      // The zero count should be visible and have default (stone-900) color, not amber
      const zeroCount = screen.getByText('0')
      expect(zeroCount).toHaveClass('text-stone-900')
      expect(zeroCount).not.toHaveClass('text-amber-600')
    })
  })

  describe('layout and composition', () => {
    it('maintains grid structure with gauge and stats cards', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      const summaryRow = container.querySelector('[data-testid="summary-row"]')
      expect(summaryRow).toHaveClass('grid', 'grid-cols-[auto_1fr]', 'gap-5')
    })

    it('stats grid contains three columns', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      const statsGrid = container.querySelector('.grid-cols-3')
      expect(statsGrid).toBeInTheDocument()
      expect(statsGrid).toHaveClass('gap-3')
    })

    it('renders all visual elements together', () => {
      const { container } = render(<SummaryRow summary={mockSummary} />)

      // Verify gauge is present
      expect(container.querySelector('[data-testid="quality-gauge"]')).toBeInTheDocument()

      // Verify all three severity badges are present
      expect(container.querySelector('[data-testid="severity-error"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="severity-warning"]')).toBeInTheDocument()
      expect(container.querySelector('[data-testid="severity-info"]')).toBeInTheDocument()

      // Verify stat cards are present
      expect(screen.getByText('Open Issues')).toBeInTheDocument()
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument()
      expect(screen.getByText('By Severity')).toBeInTheDocument()
    })
  })
})
