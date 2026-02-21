// app/admin/facilities/new/ReviewStep.tsx
// Step 5: Review all selections before creating the facility

'use client'

import type { ReviewStepProps } from './types'

export default function ReviewStep({
  facilityData,
  adminData,
  templateConfig,
  templateCounts,
  sendWelcomeEmail,
  onEditStep,
}: ReviewStepProps) {
  return (
    <div className="p-6 sm:p-8" data-testid="review-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Review & Create</h2>
      <p className="text-sm text-slate-500 mb-6">
        Confirm the details before creating the facility
      </p>
      <div className="text-sm text-slate-400 italic">
        Step 5 content — will be implemented in Phase 5
      </div>
    </div>
  )
}
