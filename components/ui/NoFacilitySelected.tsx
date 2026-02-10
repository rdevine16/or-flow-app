// components/ui/NoFacilitySelected.tsx
// Empty state shown to global admins who haven't selected a facility to impersonate.
// Used across cases, dashboard, analytics, and other facility-scoped pages.
//
// Usage:
//   const { effectiveFacilityId, isGlobalAdmin, isImpersonating } = useUser()
//   if (isGlobalAdmin && !isImpersonating) return <NoFacilitySelected />

'use client'

import Link from 'next/link'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'

interface NoFacilitySelectedProps {
  /** Optional custom message */
  message?: string
  /** Optional custom link destination */
  href?: string
  /** Optional custom link label */
  linkLabel?: string
  className?: string
}

export function NoFacilitySelected({
  message = 'Select a facility from the Admin panel to view its data.',
  href = '/admin/facilities',
  linkLabel = 'View Facilities',
  className = '',
}: NoFacilitySelectedProps) {
  return (
    <div className={`min-h-[60vh] flex items-center justify-center ${className}`}>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BuildingOffice2Icon className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          No Facility Selected
        </h2>
        <p className="text-slate-500 mb-6">{message}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <BuildingOffice2Icon className="w-4 h-4" />
          {linkLabel}
        </Link>
      </div>
    </div>
  )
}
