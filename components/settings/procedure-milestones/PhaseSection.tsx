// components/settings/procedure-milestones/PhaseSection.tsx
'use client'

import { ChevronDown } from 'lucide-react'
import { resolveColorKey } from '@/lib/milestone-phase-config'

interface PhaseSectionProps {
  phaseName: string
  phaseDisplayName: string
  colorKey: string | null
  milestoneCount: number
  enabledCount: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function PhaseSection({
  phaseDisplayName,
  colorKey,
  milestoneCount,
  enabledCount,
  isExpanded,
  onToggle,
  children,
}: PhaseSectionProps) {
  const color = resolveColorKey(colorKey)

  return (
    <div className="mb-2 last:mb-0">
      {/* Phase group header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${color.headerBg} hover:opacity-90`}
      >
        <div className={`w-1 h-5 rounded-full ${color.accentBg}`} />
        <span className={`text-sm font-semibold ${color.accentText}`}>
          {phaseDisplayName}
        </span>
        <span className="text-xs text-slate-500 ml-1">
          {enabledCount}/{milestoneCount}
        </span>
        <div className="flex-1" />
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Milestone rows */}
      {isExpanded && (
        <div className="mt-1 space-y-0.5 pl-2">
          {children}
        </div>
      )}
    </div>
  )
}
