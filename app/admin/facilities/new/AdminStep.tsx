// app/admin/facilities/new/AdminStep.tsx
// Step 2: Administrator — name, email, role, welcome email toggle

'use client'

import type { AdminStepProps } from './types'

export default function AdminStep({ data, onChange }: AdminStepProps) {
  return (
    <div className="p-6 sm:p-8" data-testid="admin-step">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">First Administrator</h2>
      <p className="text-sm text-slate-500 mb-6">
        This person will manage the facility and can invite other staff
      </p>
      <div className="text-sm text-slate-400 italic">
        Step 2 content — will be implemented in Phase 3
      </div>
    </div>
  )
}
