// app/admin/facilities/new/ClinicalTemplatesStep.tsx
// Step 3: Clinical template selection — milestones, procedures, delay types, etc.

'use client'

import type { ClinicalTemplatesStepProps } from './types'

export default function ClinicalTemplatesStep({ config, counts, loadingCounts, onChange }: ClinicalTemplatesStepProps) {
  return (
    <div className="p-6 sm:p-8" data-testid="clinical-templates-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Clinical Templates</h2>
      <p className="text-sm text-slate-500 mb-6">
        Select which clinical data templates to seed for this facility
      </p>
      <div className="text-sm text-slate-400 italic">
        Step 3 content — will be implemented in Phase 4
      </div>
    </div>
  )
}
