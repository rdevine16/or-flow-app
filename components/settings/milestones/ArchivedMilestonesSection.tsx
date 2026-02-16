// components/settings/milestones/ArchivedMilestonesSection.tsx
'use client'

import { useState } from 'react'

interface ArchivedMilestone {
  id: string
  display_name: string
  source_milestone_type_id: string | null
  deleted_at: string | null
}

interface ArchivedMilestonesSectionProps {
  milestones: ArchivedMilestone[]
  saving: boolean
  onRestore: (milestone: ArchivedMilestone) => void
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

export function ArchivedMilestonesSection({
  milestones,
  saving,
  onRestore,
}: ArchivedMilestonesSectionProps) {
  const [showArchived, setShowArchived] = useState(false)

  if (milestones.length === 0) return null

  return (
    <div className="mt-6">
      <button
        onClick={() => setShowArchived(!showArchived)}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <span className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}>&#x25B6;</span>
        Archived ({milestones.length})
      </button>
      {showArchived && (
        <div className="mt-3 space-y-2">
          {milestones.map(milestone => (
            <div
              key={milestone.id}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <div>
                <span className="text-sm font-medium text-slate-500 line-through">
                  {milestone.display_name}
                </span>
                {!milestone.source_milestone_type_id && (
                  <span className="ml-2 text-indigo-400 text-xs">&#x25C6;</span>
                )}
                <p className="text-xs text-slate-400 mt-0.5">
                  Archived {milestone.deleted_at ? formatDeletedDate(milestone.deleted_at) : ''}
                </p>
              </div>
              <button
                onClick={() => onRestore(milestone)}
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
