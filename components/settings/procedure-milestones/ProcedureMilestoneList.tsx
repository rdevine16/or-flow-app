// components/settings/procedure-milestones/ProcedureMilestoneList.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { PhaseSection } from './PhaseSection'
import { ProcedureMilestoneRow } from './ProcedureMilestoneRow'
import { ExternalLink } from 'lucide-react'

// ── Types ────────────────────────────────────────────

export interface FacilityMilestoneWithPhase {
  id: string
  name: string
  display_name: string
  display_order: number
  pair_position: 'start' | 'end' | null
  pair_with_id: string | null
  phase_group: string | null
}

export interface PhaseInfo {
  name: string
  display_name: string
  display_order: number
  color_key: string | null
  start_milestone_id: string
  end_milestone_id: string
}

export interface ProcedureMilestoneConfigItem {
  id: string
  procedure_type_id: string
  facility_milestone_id: string
  display_order: number
  is_enabled: boolean
}

interface ProcedureMilestoneListProps {
  procedureId: string
  milestones: FacilityMilestoneWithPhase[]
  configs: ProcedureMilestoneConfigItem[]
  phases: PhaseInfo[]
  boundaryMilestoneIds: Set<string>
  savingKeys: Set<string>
  isAnySaving: boolean
  onToggle: (procedureId: string, milestoneId: string) => void
  onTogglePaired: (procedureId: string, startMilestoneId: string) => void
  onReorder: (procedureId: string, phaseGroup: string, orderedMilestoneIds: string[]) => void
  onEnableAll: (procedureId: string) => void
  onDisableAll: (procedureId: string) => void
}

// ── Component ────────────────────────────────────────

export function ProcedureMilestoneList({
  procedureId,
  milestones,
  configs,
  phases,
  boundaryMilestoneIds,
  savingKeys,
  isAnySaving,
  onToggle,
  onTogglePaired,
  onReorder,
  onEnableAll,
  onDisableAll,
}: ProcedureMilestoneListProps) {
  // Track expanded phase sections (default: all expanded)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())

  const togglePhase = useCallback((phaseName: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseName)) {
        next.delete(phaseName)
      } else {
        next.add(phaseName)
      }
      return next
    })
  }, [])

  // Build enabled lookup
  const enabledSet = useMemo(() => {
    const s = new Set<string>()
    for (const c of configs) {
      if (c.procedure_type_id === procedureId && c.is_enabled) {
        s.add(c.facility_milestone_id)
      }
    }
    return s
  }, [configs, procedureId])

  // Config display_order lookup for ordering within phases
  const configOrderMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of configs) {
      if (c.procedure_type_id === procedureId) {
        map.set(c.facility_milestone_id, c.display_order)
      }
    }
    return map
  }, [configs, procedureId])

  // Visible milestones (hide pair_position='end')
  const visibleMilestones = useMemo(
    () => milestones.filter(m => m.pair_position !== 'end'),
    [milestones]
  )

  // Group milestones by phase
  const phaseGroups = useMemo(() => {
    const sortedPhases = [...phases].sort((a, b) => a.display_order - b.display_order)
    const groups: {
      phase: PhaseInfo
      milestones: FacilityMilestoneWithPhase[]
    }[] = []

    const usedMilestoneIds = new Set<string>()

    for (const phase of sortedPhases) {
      const phaseMs = visibleMilestones
        .filter(m => m.phase_group === phase.name && !usedMilestoneIds.has(m.id))
        .sort((a, b) => {
          // Sort by procedure config display_order, then facility display_order
          const aOrder = configOrderMap.get(a.id) ?? a.display_order
          const bOrder = configOrderMap.get(b.id) ?? b.display_order
          return aOrder - bOrder
        })

      phaseMs.forEach(m => usedMilestoneIds.add(m.id))

      if (phaseMs.length > 0) {
        groups.push({ phase, milestones: phaseMs })
      }
    }

    // Unassigned milestones (no matching phase)
    const unassigned = visibleMilestones.filter(m => !usedMilestoneIds.has(m.id))
    if (unassigned.length > 0) {
      groups.push({
        phase: {
          name: '_unassigned',
          display_name: 'Other',
          display_order: 999,
          color_key: 'slate',
          start_milestone_id: '',
          end_milestone_id: '',
        },
        milestones: unassigned,
      })
    }

    return groups
  }, [phases, visibleMilestones, configOrderMap])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((phaseGroup: string) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const group = phaseGroups.find(g => g.phase.name === phaseGroup)
    if (!group) return

    const ids = group.milestones.map(m => m.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const newIds = [...ids]
    const [moved] = newIds.splice(oldIndex, 1)
    newIds.splice(newIndex, 0, moved)

    onReorder(procedureId, phaseGroup, newIds)
  }, [phaseGroups, onReorder, procedureId])

  const isSaving = useCallback((milestoneId: string) => {
    return savingKeys.has(`${procedureId}:${milestoneId}`)
  }, [savingKeys, procedureId])

  return (
    <div className="border-t border-slate-100 p-4 bg-slate-50">
      <p className="text-sm text-slate-600 mb-3">
        Milestones grouped by phase. Boundary milestones (lock icon) cannot be disabled.
      </p>

      {phaseGroups.map((group) => {
        const phaseName = group.phase.name
        const isExpanded = !collapsedPhases.has(phaseName)
        const enabledCount = group.milestones.filter(m =>
          boundaryMilestoneIds.has(m.id) || enabledSet.has(m.id)
        ).length

        return (
          <PhaseSection
            key={phaseName}
            phaseName={phaseName}
            phaseDisplayName={group.phase.display_name}
            colorKey={group.phase.color_key}
            milestoneCount={group.milestones.length}
            enabledCount={enabledCount}
            isExpanded={isExpanded}
            onToggle={() => togglePhase(phaseName)}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd(phaseName)}
            >
              <SortableContext
                items={group.milestones.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {group.milestones.map((milestone) => {
                  const isBoundary = boundaryMilestoneIds.has(milestone.id)
                  const isEnabled = isBoundary || enabledSet.has(milestone.id)
                  const isPaired = milestone.pair_position === 'start' && !!milestone.pair_with_id

                  return (
                    <ProcedureMilestoneRow
                      key={milestone.id}
                      id={milestone.id}
                      milestoneId={milestone.id}
                      displayName={milestone.display_name}
                      isEnabled={isEnabled}
                      isBoundary={isBoundary}
                      isPaired={isPaired}
                      isSaving={isSaving(milestone.id)}
                      onToggle={() => {
                        if (isPaired) {
                          onTogglePaired(procedureId, milestone.id)
                        } else {
                          onToggle(procedureId, milestone.id)
                        }
                      }}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          </PhaseSection>
        )
      })}

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
        <button
          onClick={() => onEnableAll(procedureId)}
          disabled={isAnySaving}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          Select All
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={() => onDisableAll(procedureId)}
          disabled={isAnySaving}
          className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          Clear All
        </button>
        <div className="flex-1" />
        <a
          href="/settings/milestones"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          Need a new milestone? Create one in Milestones settings
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
