// app/admin/facilities/new/FacilityStep.tsx
// Step 1: Facility details — name, type, address, timezone, subscription

'use client'

import type { FacilityStepProps } from './types'

export default function FacilityStep({ data, onChange }: FacilityStepProps) {
  return (
    <div className="p-6 sm:p-8" data-testid="facility-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Facility Details</h2>
      <p className="text-sm text-slate-500 mb-6">
        Basic information about the surgery center
      </p>
      <div className="text-sm text-slate-400 italic">
        Step 1 content — will be implemented in Phase 3
      </div>
    </div>
  )
}
