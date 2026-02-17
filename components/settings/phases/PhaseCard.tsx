// components/settings/phases/PhaseCard.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, GripVertical, ArrowRight } from 'lucide-react'
import { resolveColorKey, COLOR_KEY_PALETTE } from '@/lib/milestone-phase-config'

export interface PhaseCardData {
  id: string
  name: string
  display_name: string
  display_order: number
  start_milestone_id: string
  end_milestone_id: string
  color_key: string | null
  is_active: boolean
  parent_phase_id: string | null
}

interface FacilityMilestoneOption {
  id: string
  display_name: string
}

interface PhaseCardProps {
  phase: PhaseCardData
  milestones: FacilityMilestoneOption[]
  /** All active phases (for parent phase dropdown). Phase can't be its own parent or a parent of another phase. */
  activePhases?: PhaseCardData[]
  onEdit: (phase: PhaseCardData, field: string, value: string) => void
  onArchive: (phase: PhaseCardData) => void
}

export function PhaseCard({ phase, milestones, activePhases, onEdit, onArchive }: PhaseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const colorConfig = resolveColorKey(phase.color_key)

  // Phases that can be this phase's parent:
  // - Not itself
  // - Not already a child of another phase (1-level nesting only)
  // - Not a phase that lists THIS phase as its parent (prevents cycles)
  const parentPhaseOptions = (activePhases || []).filter((p) => {
    if (p.id === phase.id) return false
    if (p.parent_phase_id) return false // already a child, can't be a parent
    // Don't offer phases that are children of THIS phase
    const isChildOfThis = (activePhases || []).some(
      (c) => c.parent_phase_id === phase.id && c.id === p.id
    )
    return !isChildOfThis
  })

  // Local state for name editing (blur-commit pattern)
  const [localName, setLocalName] = useState(phase.display_name)
  const nameRef = useRef<HTMLInputElement>(null)

  // Sync local state when parent state changes (e.g., after reorder)
  useEffect(() => {
    setLocalName(phase.display_name)
  }, [phase.display_name])

  const commitName = () => {
    const trimmed = localName.trim()
    if (trimmed && trimmed !== phase.display_name) {
      onEdit(phase, 'display_name', trimmed)
    } else {
      setLocalName(phase.display_name)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 px-4 py-3 bg-white border rounded-lg
        ${isDragging ? 'shadow-lg ring-2 ring-indigo-200 z-50 opacity-90' : 'border-slate-200'}
      `}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none text-slate-400 hover:text-slate-600"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Color swatch */}
      <div className="relative group">
        <div className={`w-4 h-4 rounded-full ${colorConfig.swatch} ring-1 ring-black/10`} />
        {/* Color picker popover */}
        <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white border border-slate-200 rounded-lg shadow-lg z-20 w-[120px]">
          {COLOR_KEY_PALETTE.map((c) => (
            <button
              key={c.key}
              onClick={() => onEdit(phase, 'color_key', c.key)}
              className={`w-6 h-6 rounded-full ${c.swatch} ring-1 ring-black/10 hover:ring-2 hover:ring-offset-1 transition-all ${
                phase.color_key === c.key ? 'ring-2 ring-offset-1 ring-slate-900' : ''
              }`}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Phase name (editable inline, commits on blur/enter) */}
      <input
        ref={nameRef}
        type="text"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') nameRef.current?.blur()
          if (e.key === 'Escape') { setLocalName(phase.display_name); nameRef.current?.blur() }
        }}
        className="text-sm font-medium text-slate-900 bg-transparent border border-transparent focus:border-slate-300 focus:outline-none focus:ring-0 w-[140px] px-1 py-0.5 rounded hover:bg-slate-50 focus:bg-white"
      />

      {/* Start milestone dropdown */}
      <select
        value={phase.start_milestone_id}
        onChange={(e) => onEdit(phase, 'start_milestone_id', e.target.value)}
        className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
      >
        <option value="" disabled>Start milestone...</option>
        {milestones.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />

      {/* End milestone dropdown */}
      <select
        value={phase.end_milestone_id}
        onChange={(e) => onEdit(phase, 'end_milestone_id', e.target.value)}
        className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
      >
        <option value="" disabled>End milestone...</option>
        {milestones.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      {/* Parent phase dropdown */}
      {activePhases && activePhases.length > 1 && (
        <select
          value={phase.parent_phase_id || ''}
          onChange={(e) => onEdit(phase, 'parent_phase_id', e.target.value)}
          className="text-xs text-slate-600 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[130px]"
          title="Parent phase (makes this a subphase)"
        >
          <option value="">No parent</option>
          {parentPhaseOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Archive button */}
      <button
        onClick={() => onArchive(phase)}
        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
        title="Archive phase"
      >
        <Archive className="w-4 h-4" />
      </button>
    </div>
  )
}
