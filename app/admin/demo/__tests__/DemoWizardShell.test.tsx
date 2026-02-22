// app/admin/demo/__tests__/DemoWizardShell.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DemoWizardShell from '../DemoWizardShell'
import type { DemoWizardStep } from '../types'

describe('DemoWizardShell', () => {
  const mockOnStepChange = vi.fn()
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  const defaultProps = {
    currentStep: 1 as DemoWizardStep,
    completedSteps: new Set<DemoWizardStep>(),
    onStepChange: mockOnStepChange,
    canAdvance: true,
    onNext: mockOnNext,
    onBack: mockOnBack,
    summaryItems: [],
    children: <div>Step content</div>,
  }

  it('renders the step content (children)', () => {
    render(<DemoWizardShell {...defaultProps} />)
    expect(screen.getByText('Step content')).toBeInTheDocument()
  })

  it('renders all 6 step labels in the sidebar', () => {
    render(<DemoWizardShell {...defaultProps} />)
    expect(screen.getByText('Facility')).toBeInTheDocument()
    expect(screen.getByText('Surgeon Profiles')).toBeInTheDocument()
    expect(screen.getByText('Room Schedule')).toBeInTheDocument()
    expect(screen.getByText('Outlier Config')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('highlights the current step with blue background', () => {
    render(<DemoWizardShell {...defaultProps} currentStep={2} />)
    const stepButton = screen.getByTestId('demo-step-2')
    expect(stepButton).toHaveClass('bg-blue-50')
  })

  it('does not highlight non-current steps', () => {
    render(<DemoWizardShell {...defaultProps} currentStep={1} />)
    const stepButton = screen.getByTestId('demo-step-2')
    expect(stepButton).not.toHaveClass('bg-blue-50')
  })

  it('renders step descriptions below labels', () => {
    render(<DemoWizardShell {...defaultProps} />)
    expect(screen.getByText('Select facility and review config')).toBeInTheDocument()
    expect(screen.getByText('Speed profiles, specialties, procedures')).toBeInTheDocument()
  })

  it('renders the generation summary panel when summaryItems provided', () => {
    const summaryItems = [
      { label: 'Estimated Cases', value: '450' },
      { label: 'Est. Duration', value: '12 min' },
    ]
    render(<DemoWizardShell {...defaultProps} summaryItems={summaryItems} />)
    expect(screen.getByText('Generation Summary')).toBeInTheDocument()
  })

  it('displays summary items in the panel', () => {
    const summaryItems = [
      { label: 'Estimated Cases', value: '450' },
      { label: 'Est. Duration', value: '12 min' },
    ]
    render(<DemoWizardShell {...defaultProps} summaryItems={summaryItems} />)
    expect(screen.getByText('450')).toBeInTheDocument()
    expect(screen.getByText('Estimated Cases')).toBeInTheDocument()
    expect(screen.getByText('12 min')).toBeInTheDocument()
    expect(screen.getByText('Est. Duration')).toBeInTheDocument()
  })

  it('does not show summary panel when summaryItems is empty', () => {
    render(<DemoWizardShell {...defaultProps} summaryItems={[]} />)
    expect(screen.queryByText('Generation Summary')).not.toBeInTheDocument()
  })

  it('allows clicking on step 2 when on step 1', async () => {
    render(<DemoWizardShell {...defaultProps} currentStep={1} />)
    const step2Button = screen.getByTestId('demo-step-2')
    step2Button.click()
    expect(mockOnStepChange).toHaveBeenCalledWith(2)
  })

  it('disables steps beyond maxAccessibleStep', () => {
    render(<DemoWizardShell {...defaultProps} currentStep={1} completedSteps={new Set()} />)
    const step5Button = screen.getByTestId('demo-step-5')
    expect(step5Button).toBeDisabled()
  })

  it('renders all 6 steps in the navigation', () => {
    render(<DemoWizardShell {...defaultProps} />)
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByTestId(`demo-step-${i}`)).toBeInTheDocument()
    }
  })

  it('uses blue text for current step label', () => {
    render(<DemoWizardShell {...defaultProps} currentStep={3} />)
    const step3Button = screen.getByTestId('demo-step-3')
    const labelDiv = step3Button.querySelector('.text-blue-600')
    expect(labelDiv).toBeInTheDocument()
  })

  it('shows check icon for completed steps', () => {
    render(<DemoWizardShell {...defaultProps} currentStep={3} completedSteps={new Set([1, 2])} />)
    const step1Button = screen.getByTestId('demo-step-1')
    const checkIcon = step1Button.querySelector('svg.lucide-check')
    expect(checkIcon).toBeInTheDocument()
  })

  it('shows Continue button when not on review step', () => {
    render(<DemoWizardShell {...defaultProps} currentStep={1} />)
    expect(screen.getByText('Continue')).toBeInTheDocument()
  })

  it('hides footer when hideFooter is true', () => {
    render(<DemoWizardShell {...defaultProps} hideFooter={true} />)
    expect(screen.queryByText('Continue')).not.toBeInTheDocument()
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })
})
