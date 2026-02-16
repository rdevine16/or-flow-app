// components/settings/phases/ArchivedPhasesSection.tsx
'use client'

import { useState } from 'react'
import { resolveColorKey } from '@/lib/milestone-phase-config'

interface ArchivedPhase {
  id: string
  display_name: string
  color_key: string | null
  deleted_at: string | null
}

interface ArchivedPhasesSectionProps {
  phases: ArchivedPhase[]
  saving: boolean
  onRestore: (phase: ArchivedPhase) => void
}

function formatDeletedDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

export function ArchivedPhasesSection({
  phases,
  saving,
  onRestore,
}: ArchivedPhasesSectionProps) {
  const [showArchived, setShowArchived] = useState(false)

  if (phases.length === 0) return null

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowArchived(!showArchived)}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>&#x25B6;</span>
        Archived ({phases.length})
      </button>
      {showArchived && (
        <div className="mt-3 space-y-2">
          {phases.map(phase => {
            const colorConfig = resolveColorKey(phase.color_key)
            return (
              <div
                key={phase.id}
                className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${colorConfig.swatch} ring-1 ring-black/10`} />
                  <div>
                    <span className="text-sm font-medium text-slate-500 line-through">
                      {phase.display_name}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Archived {phase.deleted_at ? formatDeletedDate(phase.deleted_at) : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRestore(phase)}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
