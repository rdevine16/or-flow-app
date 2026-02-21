/**
 * Unit tests for ScanProgress component
 *
 * Tests the inline progress bar with gradient track, step labels,
 * and visual states (completed/active/pending).
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ScanProgress from '../ScanProgress'

describe('ScanProgress', () => {
  describe('rendering and structure', () => {
    it('renders with data-testid for integration testing', () => {
      const { container } = render(<ScanProgress step={3} />)
      expect(container.querySelector('[data-testid="scan-progress"]')).toBeInTheDocument()
    })

    it('renders with correct header text', () => {
      render(<ScanProgress step={3} />)
      expect(screen.getByText('Running detection scan...')).toBeInTheDocument()
    })

    it('displays current step counter in header', () => {
      render(<ScanProgress step={3} totalSteps={7} />)
      expect(screen.getByText('3/7')).toBeInTheDocument()
    })

    it('uses default totalSteps of 7 when not provided', () => {
      render(<ScanProgress step={2} />)
      expect(screen.getByText('2/7')).toBeInTheDocument()
    })

    it('renders all 7 step labels', () => {
      render(<ScanProgress step={1} />)
      expect(screen.getByText('Expire old')).toBeInTheDocument()
      expect(screen.getByText('Load cases')).toBeInTheDocument()
      expect(screen.getByText('Impossible values')).toBeInTheDocument()
      expect(screen.getByText('Negative durations')).toBeInTheDocument()
      expect(screen.getByText('Sequences')).toBeInTheDocument()
      expect(screen.getByText('Missing milestones')).toBeInTheDocument()
      expect(screen.getByText('Finalize')).toBeInTheDocument()
    })
  })

  describe('progress bar width calculation', () => {
    it('shows 0% width at step 0', () => {
      const { container } = render(<ScanProgress step={0} totalSteps={7} />)
      const progressBar = container.querySelector('[style*="width"]')
      expect(progressBar).toHaveStyle({ width: '0%' })
    })

    it('shows ~14% width at step 1 of 7', () => {
      const { container } = render(<ScanProgress step={1} totalSteps={7} />)
      const progressBar = container.querySelector('[style*="width"]')
      // 1/7 = 0.142857... ≈ 14.29%
      expect(progressBar).toHaveStyle({ width: '14.285714285714285%' })
    })

    it('shows ~43% width at step 3 of 7', () => {
      const { container } = render(<ScanProgress step={3} totalSteps={7} />)
      const progressBar = container.querySelector('[style*="width"]')
      // 3/7 = 0.428571... ≈ 42.86%
      expect(progressBar).toHaveStyle({ width: '42.857142857142854%' })
    })

    it('shows 100% width at step 7 of 7', () => {
      const { container } = render(<ScanProgress step={7} totalSteps={7} />)
      const progressBar = container.querySelector('[style*="width"]')
      expect(progressBar).toHaveStyle({ width: '100%' })
    })

    it('applies gradient background to progress bar', () => {
      const { container } = render(<ScanProgress step={3} />)
      const progressBar = container.querySelector('[style*="background"]')
      expect(progressBar).toHaveStyle({
        background: 'linear-gradient(90deg, #2563EB, #7C3AED)',
      })
    })
  })

  describe('step label states', () => {
    it('shows completed state for steps BEFORE current step', () => {
      const { container } = render(<ScanProgress step={4} />)

      // Steps 1, 2, 3 should be completed (step > stepNum)
      const expireOld = screen.getByText('Expire old').closest('span')
      expect(expireOld).toHaveClass('bg-green-50', 'text-green-600', 'border-green-200')

      const loadCases = screen.getByText('Load cases').closest('span')
      expect(loadCases).toHaveClass('bg-green-50', 'text-green-600', 'border-green-200')

      const impossibleValues = screen.getByText('Impossible values').closest('span')
      expect(impossibleValues).toHaveClass('bg-green-50', 'text-green-600', 'border-green-200')
    })

    it('shows active state for current step', () => {
      render(<ScanProgress step={4} />)

      // Step 4 is "Negative durations" (0-indexed step 3)
      const currentStep = screen.getByText('Negative durations').closest('span')
      expect(currentStep).toHaveClass('bg-blue-50', 'text-blue-600', 'border-blue-200')
    })

    it('shows pending state for steps AFTER current step', () => {
      render(<ScanProgress step={4} />)

      // Steps 5, 6, 7 should be pending
      const sequences = screen.getByText('Sequences').closest('span')
      expect(sequences).toHaveClass('bg-slate-50', 'text-slate-400', 'border-slate-100')

      const missingMilestones = screen.getByText('Missing milestones').closest('span')
      expect(missingMilestones).toHaveClass('bg-slate-50', 'text-slate-400', 'border-slate-100')

      const finalize = screen.getByText('Finalize').closest('span')
      expect(finalize).toHaveClass('bg-slate-50', 'text-slate-400', 'border-slate-100')
    })

    it('shows checkmark icon ONLY on completed steps', () => {
      const { container } = render(<ScanProgress step={3} />)

      // Steps 1, 2 should have checkmarks (step > stepNum)
      const completedSteps = container.querySelectorAll('.bg-green-50')
      expect(completedSteps).toHaveLength(2) // "Expire old" and "Load cases"

      // Each completed step should have a Check icon
      completedSteps.forEach((stepEl) => {
        const svg = stepEl.querySelector('svg')
        expect(svg).toBeInTheDocument()
        expect(svg).toHaveClass('w-3', 'h-3')
      })
    })

    it('does NOT show checkmark on active step', () => {
      render(<ScanProgress step={3} />)

      // Step 3 is "Impossible values" (active, not completed)
      const activeStep = screen.getByText('Impossible values').closest('span')
      const svg = activeStep?.querySelector('svg')
      expect(svg).not.toBeInTheDocument()
    })

    it('does NOT show checkmark on pending steps', () => {
      render(<ScanProgress step={3} />)

      // Steps 4+ are pending
      const pendingStep = screen.getByText('Sequences').closest('span')
      const svg = pendingStep?.querySelector('svg')
      expect(svg).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles step 1 correctly (first step active, none completed)', () => {
      const { container } = render(<ScanProgress step={1} />)

      // No completed steps
      const completedSteps = container.querySelectorAll('.bg-green-50')
      expect(completedSteps).toHaveLength(0)

      // First step is active
      const activeStep = screen.getByText('Expire old').closest('span')
      expect(activeStep).toHaveClass('bg-blue-50', 'text-blue-600')
    })

    it('handles step 7 correctly (all completed except last is active)', () => {
      const { container } = render(<ScanProgress step={7} />)

      // 6 completed steps (steps 1-6)
      const completedSteps = container.querySelectorAll('.bg-green-50')
      expect(completedSteps).toHaveLength(6)

      // Step 7 is active
      const activeStep = screen.getByText('Finalize').closest('span')
      expect(activeStep).toHaveClass('bg-blue-50', 'text-blue-600')
    })

    it('handles step 0 correctly (all pending)', () => {
      const { container } = render(<ScanProgress step={0} />)

      // No completed steps
      const completedSteps = container.querySelectorAll('.bg-green-50')
      expect(completedSteps).toHaveLength(0)

      // No active steps (step 0 means nothing is active)
      const activeSteps = container.querySelectorAll('.bg-blue-50')
      expect(activeSteps).toHaveLength(0)

      // All 7 steps are pending
      const pendingSteps = container.querySelectorAll('.bg-slate-50')
      expect(pendingSteps).toHaveLength(7)
    })

    it('handles mid-scan step correctly', () => {
      render(<ScanProgress step={4} />)

      // 3 completed (steps 1-3)
      expect(screen.getByText('Expire old').closest('span')).toHaveClass('bg-green-50')
      expect(screen.getByText('Load cases').closest('span')).toHaveClass('bg-green-50')
      expect(screen.getByText('Impossible values').closest('span')).toHaveClass('bg-green-50')

      // 1 active (step 4)
      expect(screen.getByText('Negative durations').closest('span')).toHaveClass('bg-blue-50')

      // 3 pending (steps 5-7)
      expect(screen.getByText('Sequences').closest('span')).toHaveClass('bg-slate-50')
      expect(screen.getByText('Missing milestones').closest('span')).toHaveClass('bg-slate-50')
      expect(screen.getByText('Finalize').closest('span')).toHaveClass('bg-slate-50')
    })
  })

  describe('visual styling', () => {
    it('applies animation classes for slide-in effect', () => {
      const { container } = render(<ScanProgress step={3} />)
      const wrapper = container.querySelector('[data-testid="scan-progress"]')
      expect(wrapper).toHaveClass('animate-in', 'slide-in-from-top-2', 'duration-300')
    })

    it('applies border and padding styling', () => {
      const { container } = render(<ScanProgress step={3} />)
      const wrapper = container.querySelector('[data-testid="scan-progress"]')
      expect(wrapper).toHaveClass('border', 'border-slate-200', 'rounded-xl', 'p-5', 'mb-5')
    })

    it('applies transition classes to progress bar', () => {
      const { container } = render(<ScanProgress step={3} />)
      const progressBar = container.querySelector('[style*="width"]')
      expect(progressBar).toHaveClass('transition-all', 'duration-400', 'ease-out')
    })

    it('applies transition classes to step labels', () => {
      render(<ScanProgress step={3} />)
      const stepLabel = screen.getByText('Expire old').closest('span')
      expect(stepLabel).toHaveClass('transition-all', 'duration-300')
    })
  })
})
