// components/settings/milestones/MilestoneRow.tsx
'use client'

import { Archive, Pencil } from 'lucide-react'
import { PairIndicator } from './PairIndicator'

export interface MilestoneRowData {
  id: string
  display_name: string
  display_order: number
  source_milestone_type_id: string | null
  pair_with_id: string | null
  pair_position: 'start' | 'end' | null
  min_minutes: number | null
  max_minutes: number | null
  is_active: boolean
  phase_group: string | null
}

interface MilestoneRowProps {
  milestone: MilestoneRowData
  index: number
  pairedName: string | null
  onEdit: (milestone: MilestoneRowData) => void
  onArchive: (milestone: MilestoneRowData) => void
  onScrollToPair?: (id: string) => void
}

export function MilestoneRow({
  milestone,
  index,
  pairedName,
  onEdit,
  onArchive,
  onScrollToPair,
}: MilestoneRowProps) {
  const isCustom = !milestone.source_milestone_type_id
  const validRange =
    milestone.min_minutes != null && milestone.max_minutes != null
      ? `${milestone.min_minutes}\u2013${milestone.max_minutes} min`
      : '\u2014'

  return (
    <tr
      id={`milestone-${milestone.id}`}
      className="group border-b border-slate-100 last:border-b-0 hover:bg-indigo-50/40 transition-colors"
    >
      {/* # */}
      <td className="px-4 py-3 w-12">
        <span className="font-mono text-xs text-slate-400">{index + 1}</span>
      </td>

      {/* Milestone name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isCustom && (
            <span className="text-indigo-400 text-xs" title="Custom milestone">
              &#x25C6;
            </span>
          )}
          <span className="font-medium text-slate-900 text-sm">
            {milestone.display_name}
          </span>
          {milestone.pair_position && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                milestone.pair_position === 'start'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {milestone.pair_position}
            </span>
          )}
        </div>
      </td>

      {/* Pair */}
      <td className="px-4 py-3">
        <PairIndicator
          pairPosition={milestone.pair_position}
          pairedName={pairedName}
          pairedId={milestone.pair_with_id}
          onScrollToPair={onScrollToPair}
        />
      </td>

      {/* Valid Range */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-500">{validRange}</span>
      </td>

      {/* Actions (hover reveal) */}
      <td className="px-4 py-3 w-24">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(milestone)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="Edit milestone"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {isCustom && (
            <button
              onClick={() => onArchive(milestone)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Archive milestone"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
