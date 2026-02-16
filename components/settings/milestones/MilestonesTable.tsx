// components/settings/milestones/MilestonesTable.tsx
'use client'

import { useMemo, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { Clock } from 'lucide-react'
import { PHASE_ORDER, UNASSIGNED_PHASE, type PhaseConfig } from '@/lib/milestone-phase-config'
import type { PhaseGroup } from '@/lib/utils/inferPhaseGroup'
import { PhaseGroupHeader } from './PhaseGroupHeader'
import { MilestoneRow, type MilestoneRowData } from './MilestoneRow'
import { SkeletonTable } from '@/components/ui/Skeleton'

interface MilestonesTableProps {
  milestones: MilestoneRowData[]
  loading: boolean
  onEdit: (milestone: MilestoneRowData) => void
  onArchive: (milestone: MilestoneRowData) => void
}

/** Group milestones by phase_group, preserving display_order within each group */
function groupByPhase(milestones: MilestoneRowData[]) {
  const groups = new Map<PhaseGroup | 'unassigned', MilestoneRowData[]>()

  // Initialize all phase groups in order
  for (const phase of PHASE_ORDER) {
    groups.set(phase.key, [])
  }
  groups.set('unassigned', [])

  // Distribute milestones into groups
  for (const m of milestones) {
    const key = (m.phase_group as PhaseGroup) || 'unassigned'
    const group = groups.get(key)
    if (group) {
      group.push(m)
    } else {
      // Unknown phase_group — treat as unassigned
      groups.get('unassigned')!.push(m)
    }
  }

  return groups
}

/** Build an ordered list of { config, milestones } for rendering */
function buildPhaseGroups(milestones: MilestoneRowData[]) {
  const grouped = groupByPhase(milestones)
  const result: { config: PhaseConfig; milestones: MilestoneRowData[] }[] = []

  for (const phase of PHASE_ORDER) {
    result.push({ config: phase, milestones: grouped.get(phase.key) || [] })
  }

  // Add unassigned group only if it has milestones
  const unassigned = grouped.get('unassigned') || []
  if (unassigned.length > 0) {
    result.push({ config: UNASSIGNED_PHASE, milestones: unassigned })
  }

  return result
}

const COLUMN_COUNT = 5

/** Dummy column definitions for @tanstack/react-table — actual rendering is in MilestoneRow */
const columns: ColumnDef<MilestoneRowData, unknown>[] = [
  { id: 'order', header: '#', size: 48 },
  { id: 'milestone', header: 'Milestone', size: 280 },
  { id: 'pair', header: 'Pair', size: 180 },
  { id: 'validRange', header: 'Valid Range', size: 120 },
  { id: 'actions', header: '', size: 96 },
]

export function MilestonesTable({
  milestones,
  loading,
  onEdit,
  onArchive,
}: MilestonesTableProps) {
  const phaseGroups = useMemo(() => buildPhaseGroups(milestones), [milestones])

  // Lookup map for paired milestone names
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of milestones) {
      map.set(m.id, m.display_name)
    }
    return map
  }, [milestones])

  const scrollToPair = useCallback((id: string) => {
    const el = document.getElementById(`milestone-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Brief highlight flash
      el.classList.add('bg-indigo-100')
      setTimeout(() => el.classList.remove('bg-indigo-100'), 1500)
    }
  }, [])

  const table = useReactTable({
    data: milestones,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (loading) {
    return <SkeletonTable rows={8} columns={COLUMN_COUNT} />
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        {/* Column headers */}
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-slate-200 bg-slate-50/80"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                  style={{ width: header.getSize() }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        {/* Phase-grouped body sections */}
        {phaseGroups.map(({ config, milestones: groupMilestones }) => (
          <tbody key={config.label}>
            {/* Phase group header row */}
            <PhaseGroupHeader
              phase={config}
              count={groupMilestones.length}
              colSpan={COLUMN_COUNT}
            />

            {/* Milestone rows */}
            {groupMilestones.length > 0 ? (
              groupMilestones.map((milestone, idx) => (
                <MilestoneRow
                  key={milestone.id}
                  milestone={milestone}
                  index={idx}
                  pairedName={
                    milestone.pair_with_id
                      ? nameById.get(milestone.pair_with_id) ?? null
                      : null
                  }
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onScrollToPair={scrollToPair}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={COLUMN_COUNT}
                  className="px-4 py-6 text-center text-sm text-slate-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>No milestones in this phase</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
    </div>
  )
}
