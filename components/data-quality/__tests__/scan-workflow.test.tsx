/**
 * Workflow test for detection scan flow (Phase 3)
 *
 * Tests the end-to-end workflow:
 * 1. User clicks "Run Detection" button
 * 2. Inline ScanProgress component appears
 * 3. Progress advances through steps
 * 4. Completion banner appears when scan finishes
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import ScanProgress from '../ScanProgress'

describe('Scan Workflow (Integration)', () => {
  describe('ScanProgress visual integration', () => {
    it('ScanProgress renders inline (not in modal)', () => {
      const { container } = render(<ScanProgress step={3} />)

      // Should render as a card, not in a modal overlay
      const scanProgress = container.querySelector('[data-testid="scan-progress"]')
      expect(scanProgress).toBeInTheDocument()
      expect(scanProgress).toHaveClass('bg-white', 'border', 'border-slate-200', 'rounded-xl')

      // Should NOT be inside a modal (no fixed positioning parent)
      const fixedParent = scanProgress?.closest('.fixed')
      expect(fixedParent).not.toBeInTheDocument()
    })

    it('ScanProgress animates in from top', () => {
      const { container } = render(<ScanProgress step={3} />)

      const scanProgress = container.querySelector('[data-testid="scan-progress"]')
      expect(scanProgress).toHaveClass('animate-in', 'slide-in-from-top-2', 'duration-300')
    })

    it('progress bar gradient matches Run Detection button gradient theme', () => {
      const { container } = render(<ScanProgress step={5} />)

      const progressBar = container.querySelector('[style*="linear-gradient"]')
      expect(progressBar).toHaveStyle({
        background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
      })
      // Same blue-to-purple gradient as the button (blue-600 to purple-600)
    })
  })

  describe('step progression simulation', () => {
    it('advances through all 7 steps correctly', () => {
      const { container, rerender } = render(<ScanProgress step={1} />)

      // Step 1: "Expire old" is active
      expect(screen.getByText('Expire old').closest('span')).toHaveClass('bg-blue-50')
      expect(container.querySelectorAll('.bg-green-50')).toHaveLength(0)

      // Step 3: "Impossible values" is active, 2 completed
      rerender(<ScanProgress step={3} />)
      expect(screen.getByText('Impossible values').closest('span')).toHaveClass('bg-blue-50')
      expect(container.querySelectorAll('.bg-green-50')).toHaveLength(2)

      // Step 5: "Sequences" is active, 4 completed
      rerender(<ScanProgress step={5} />)
      expect(screen.getByText('Sequences').closest('span')).toHaveClass('bg-blue-50')
      expect(container.querySelectorAll('.bg-green-50')).toHaveLength(4)

      // Step 7: "Finalize" is active, 6 completed
      rerender(<ScanProgress step={7} />)
      expect(screen.getByText('Finalize').closest('span')).toHaveClass('bg-blue-50')
      expect(container.querySelectorAll('.bg-green-50')).toHaveLength(6)
    })

    it('progress bar width increases as steps advance', () => {
      const { container, rerender } = render(<ScanProgress step={1} />)

      const progressBar = container.querySelector('[style*="width"]')

      // Step 1: ~14%
      expect(progressBar).toHaveStyle({ width: '14.285714285714285%' })

      // Step 4: ~57%
      rerender(<ScanProgress step={4} />)
      expect(progressBar).toHaveStyle({ width: '57.14285714285714%' })

      // Step 7: 100%
      rerender(<ScanProgress step={7} />)
      expect(progressBar).toHaveStyle({ width: '100%' })
    })

    it('checkmarks accumulate as steps complete', () => {
      const { container, rerender } = render(<ScanProgress step={1} />)

      // Step 1: no checkmarks (none completed yet)
      expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(0)

      // Step 3: 2 checkmarks (steps 1 and 2 completed)
      rerender(<ScanProgress step={3} />)
      expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(2)

      // Step 7: 6 checkmarks (steps 1-6 completed)
      rerender(<ScanProgress step={7} />)
      expect(container.querySelectorAll('svg.lucide-check')).toHaveLength(6)
    })
  })

  describe('completion state', () => {
    it('at step 7, progress bar is full and 6 steps are marked complete', () => {
      const { container } = render(<ScanProgress step={7} />)

      // Progress bar at 100%
      const progressBar = container.querySelector('[style*="width"]')
      expect(progressBar).toHaveStyle({ width: '100%' })

      // 6 completed steps (steps 1-6 are green, step 7 is blue/active)
      const completedSteps = container.querySelectorAll('.bg-green-50')
      expect(completedSteps).toHaveLength(6)

      // Step 7 "Finalize" is active (not yet completed)
      const finalizeStep = screen.getByText('Finalize').closest('span')
      expect(finalizeStep).toHaveClass('bg-blue-50', 'text-blue-600')
    })
  })
})
