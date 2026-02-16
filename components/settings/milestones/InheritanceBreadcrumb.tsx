// components/settings/milestones/InheritanceBreadcrumb.tsx
'use client'

import { ArrowRight } from 'lucide-react'

export interface InheritanceLevel {
  label: string
  active: boolean
}

interface InheritanceBreadcrumbProps {
  levels: InheritanceLevel[]
}

/**
 * Horizontal chain showing the active inheritance level in the
 * Facility → Procedure → Surgeon hierarchy.
 * Active level is highlighted blue with a border.
 */
export function InheritanceBreadcrumb({ levels }: InheritanceBreadcrumbProps) {
  return (
    <div className="flex items-center gap-0 text-[10px] text-slate-400 px-2.5 py-1.5 bg-slate-50 rounded-[5px] border border-slate-100 mb-2.5">
      <span className="font-semibold text-slate-500 text-[9px] mr-1.5 uppercase tracking-wide">
        Inheritance:
      </span>
      {levels.map((level, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span
            className={`px-1.5 py-0.5 rounded ${
              level.active
                ? 'bg-blue-50 border border-blue-200 font-semibold text-blue-700'
                : 'border border-transparent font-normal text-slate-400'
            }`}
          >
            {level.label}
          </span>
          {i < levels.length - 1 && (
            <span className="mx-0.5 text-slate-300">
              <ArrowRight className="w-2.5 h-2.5" />
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
