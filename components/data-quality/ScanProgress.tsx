// ScanProgress — inline progress bar with step labels (Phase 3)
// Placeholder: will be implemented in Phase 3

interface ScanProgressProps {
  step: number
  totalSteps: number
}

export default function ScanProgress({ step, totalSteps }: ScanProgressProps) {
  return (
    <div data-testid="scan-progress">
      Step {step} of {totalSteps}
    </div>
  )
}
