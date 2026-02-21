// app/admin/facilities/new/OperationalTemplatesStep.tsx
// Step 4: Operational template selection — cost categories, payers, analytics, flags, etc.

'use client'

import type { OperationalTemplatesStepProps } from './types'

export default function OperationalTemplatesStep({ config, counts, loadingCounts, onChange }: OperationalTemplatesStepProps) {
  return (
    <div className="p-6 sm:p-8" data-testid="operational-templates-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Operational Templates</h2>
      <p className="text-sm text-slate-500 mb-6">
        Select which operational and analytics templates to seed for this facility
      </p>
      <div className="text-sm text-slate-400 italic">
        Step 4 content — will be implemented in Phase 4
      </div>
    </div>
  )
}
