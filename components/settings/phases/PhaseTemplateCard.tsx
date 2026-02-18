// components/settings/phases/PhaseTemplateCard.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, GripVertical, ArrowRight } from 'lucide-react'
import { resolveColorKey, COLOR_KEY_PALETTE } from '@/lib/milestone-phase-config'

export interface PhaseTemplateCardData {
  id: string
  name: string
  display_name: string
  display_order: number
  start_milestone_type_id: string
  end_milestone_type_id: string
  color_key: string | null
  is_active: boolean
}

interface MilestoneTypeOption {
  id: string
  display_name: string
}

interface PhaseTemplateCardProps {
  template: PhaseTemplateCardData
  milestoneTypes: MilestoneTypeOption[]
  onEdit: (template: PhaseTemplateCardData, field: string, value: string) => void
  onArchive: (template: PhaseTemplateCardData) => void
}

export function PhaseTemplateCard({ template, milestoneTypes, onEdit, onArchive }: PhaseTemplateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: template.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const colorConfig = resolveColorKey(template.color_key)

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
              onClick={() => onEdit(template, 'color_key', c.key)}
              className={`w-6 h-6 rounded-full ${c.swatch} ring-1 ring-black/10 hover:ring-2 hover:ring-offset-1 transition-all ${
                template.color_key === c.key ? 'ring-2 ring-offset-1 ring-slate-900' : ''
              }`}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Template name (editable inline) */}
      <input
        type="text"
        value={template.display_name}
        onChange={(e) => onEdit(template, 'display_name', e.target.value)}
        className="text-sm font-medium text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 w-[140px] px-1 py-0.5 rounded hover:bg-slate-50 focus:bg-slate-50"
      />

      {/* Start milestone type dropdown */}
      <select
        value={template.start_milestone_type_id}
        onChange={(e) => onEdit(template, 'start_milestone_type_id', e.target.value)}
        className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
      >
        <option value="" disabled>Start milestone type...</option>
        {milestoneTypes.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />

      {/* End milestone type dropdown */}
      <select
        value={template.end_milestone_type_id}
        onChange={(e) => onEdit(template, 'end_milestone_type_id', e.target.value)}
        className="text-sm text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
      >
        <option value="" disabled>End milestone type...</option>
        {milestoneTypes.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Archive button */}
      <button
        onClick={() => onArchive(template)}
        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
        title="Archive template"
      >
        <Archive className="w-4 h-4" />
      </button>
    </div>
  )
}
