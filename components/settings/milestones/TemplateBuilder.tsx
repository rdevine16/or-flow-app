// components/settings/milestones/TemplateBuilder.tsx
// Main 3-column template builder: Template List | Builder Canvas | Library Panel.
// Phase 3b: full @dnd-kit integration — drag from library, reorder within phases.
'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { UseTemplateBuilderReturn } from '@/hooks/useTemplateBuilder'
import { buildTemplateRenderList, type RenderItem } from '@/lib/utils/buildTemplateRenderList'
import { resolveColorKey } from '@/lib/milestone-phase-config'
import { TemplateList } from './TemplateList'
import { SharedBoundary } from './SharedBoundary'
import { EdgeMilestone, InteriorMilestone, UnassignedMilestone } from './FlowNode'
import { SubPhaseIndicator } from './SubPhaseIndicator'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { SearchInput } from '@/components/ui/SearchInput'
import {
  Copy,
  GripVertical,
  X,
  Check,
  Plus,
  Layers,
} from 'lucide-react'

// ─── DnD ID helpers ─────────────────────────────────────────

const LIB_MILESTONE_PREFIX = 'lib-ms:'
const LIB_PHASE_PREFIX = 'lib-ph:'
const DROP_PHASE_PREFIX = 'drop-phase:'
const DROP_BUILDER_BOTTOM = 'drop-builder-bottom'

function parseLibMilestoneId(id: string): string | null {
  return id.startsWith(LIB_MILESTONE_PREFIX) ? id.slice(LIB_MILESTONE_PREFIX.length) : null
}
function parseLibPhaseId(id: string): string | null {
  return id.startsWith(LIB_PHASE_PREFIX) ? id.slice(LIB_PHASE_PREFIX.length) : null
}
function parseDropPhaseId(id: string): string | null {
  return id.startsWith(DROP_PHASE_PREFIX) ? id.slice(DROP_PHASE_PREFIX.length) : null
}

// ─── Active drag state type ─────────────────────────────────

interface ActiveDrag {
  type: 'library-milestone' | 'library-phase' | 'builder-item'
  id: string
  label: string
  color?: string
}

// ─── Main Component ─────────────────────────────────────────

export function TemplateBuilder({ builder }: { builder: UseTemplateBuilderReturn }) {
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const id = String(active.id)

    // Library milestone
    const msId = parseLibMilestoneId(id)
    if (msId) {
      const ms = builder.milestones.find(m => m.id === msId)
      setActiveDrag({ type: 'library-milestone', id: msId, label: ms?.display_name ?? 'Milestone' })
      return
    }

    // Library phase
    const phId = parseLibPhaseId(id)
    if (phId) {
      const ph = builder.phases.find(p => p.id === phId)
      const color = ph?.color_key ? resolveColorKey(ph.color_key).hex : undefined
      setActiveDrag({ type: 'library-phase', id: phId, label: ph?.display_name ?? 'Phase', color })
      return
    }

    // Builder item (sortable within phase)
    const item = builder.items.find(i => i.id === id)
    if (item) {
      const ms = builder.milestones.find(m => m.id === item.facility_milestone_id)
      setActiveDrag({ type: 'builder-item', id, label: ms?.display_name ?? 'Item' })
    }
  }, [builder.milestones, builder.phases, builder.items])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Library milestone → phase drop zone
    const libMsId = parseLibMilestoneId(activeId)
    const dropPhaseId = parseDropPhaseId(overId)
    if (libMsId && dropPhaseId) {
      builder.addMilestoneToPhase(dropPhaseId, libMsId)
      return
    }

    // Library phase → builder bottom
    const libPhId = parseLibPhaseId(activeId)
    if (libPhId && overId === DROP_BUILDER_BOTTOM) {
      builder.addPhaseToTemplate(libPhId)
      return
    }
    // Also allow library phase → any phase drop zone area (adds the phase)
    if (libPhId && dropPhaseId) {
      builder.addPhaseToTemplate(libPhId)
      return
    }

    // Builder item reorder (both active and over are template item IDs)
    if (!activeId.startsWith(LIB_MILESTONE_PREFIX) && !activeId.startsWith(LIB_PHASE_PREFIX)) {
      const activeItem = builder.items.find(i => i.id === activeId)
      const overItem = builder.items.find(i => i.id === overId)
      if (activeItem && overItem && activeId !== overId) {
        const activePhase = activeItem.facility_phase_id ?? 'unassigned'
        const overPhase = overItem.facility_phase_id ?? 'unassigned'
        if (activePhase === overPhase) {
          builder.reorderItemsInPhase(activePhase, activeId, overId)
        }
      }
    }
  }, [builder])

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null)
  }, [])

  if (builder.loading) {
    return <BuilderSkeleton />
  }

  if (builder.error) {
    return <ErrorBanner message={builder.error} />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        {/* Column 1: Template List */}
        <TemplateList
          templates={builder.templates}
          selectedTemplateId={builder.selectedTemplateId}
          procedureCounts={builder.procedureCounts}
          saving={builder.saving}
          onSelect={builder.setSelectedTemplateId}
          onCreate={builder.createTemplate}
          onDuplicate={builder.duplicateTemplate}
          onSetDefault={builder.setDefaultTemplate}
          onArchive={builder.archiveTemplate}
        />

        {/* Column 2: Builder Canvas */}
        <BuilderCanvas
          template={builder.selectedTemplate}
          items={builder.items}
          phases={builder.phases}
          milestones={builder.milestones}
          emptyPhaseIds={builder.emptyPhaseIds}
          itemsLoading={builder.itemsLoading}
          saving={builder.saving}
          onRemoveMilestone={builder.removeMilestone}
          onRemovePhase={builder.removePhaseFromTemplate}
          onDuplicate={() => builder.selectedTemplateId && builder.duplicateTemplate(builder.selectedTemplateId)}
          onRename={builder.renameTemplate}
          procedureCount={builder.selectedTemplateId ? (builder.procedureCounts[builder.selectedTemplateId] || 0) : 0}
          activeDrag={activeDrag}
        />

        {/* Column 3: Library Panel */}
        <LibraryPanel
          availableMilestones={builder.availableMilestones}
          availablePhases={builder.availablePhases}
          assignedPhaseIds={builder.assignedPhaseIds}
          selectedTemplateId={builder.selectedTemplateId}
          onAddMilestone={builder.addMilestoneToPhase}
          phases={builder.phases}
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && <DragOverlayContent drag={activeDrag} />}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Drag Overlay Content ───────────────────────────────────

function DragOverlayContent({ drag }: { drag: ActiveDrag }) {
  if (drag.type === 'library-phase') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11.5px] font-semibold shadow-lg bg-white"
        style={{
          borderColor: `${drag.color ?? '#64748b'}40`,
          color: drag.color ?? '#64748b',
        }}
      >
        <div
          className="w-[7px] h-[7px] rounded-[1.5px] flex-shrink-0"
          style={{ background: drag.color ?? '#64748b' }}
        />
        {drag.label}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-200 bg-white shadow-lg text-[11.5px] font-medium text-slate-700">
      <GripVertical className="w-2.5 h-2.5 text-slate-400" />
      {drag.label}
    </div>
  )
}

// ─── Builder Canvas ─────────────────────────────────────────

interface BuilderCanvasProps {
  template: UseTemplateBuilderReturn['selectedTemplate']
  items: UseTemplateBuilderReturn['items']
  phases: UseTemplateBuilderReturn['phases']
  milestones: UseTemplateBuilderReturn['milestones']
  emptyPhaseIds: Set<string>
  itemsLoading: boolean
  saving: boolean
  onRemoveMilestone: (itemId: string) => void
  onRemovePhase: (phaseId: string) => void
  onDuplicate: () => void
  onRename: (templateId: string, name: string) => void
  procedureCount: number
  activeDrag: ActiveDrag | null
}

function BuilderCanvas({
  template,
  items,
  phases,
  milestones,
  emptyPhaseIds,
  itemsLoading,
  saving,
  onRemoveMilestone,
  onRemovePhase,
  onDuplicate,
  onRename,
  procedureCount,
  activeDrag,
}: BuilderCanvasProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const renderList = useMemo(
    () => buildTemplateRenderList(items, phases, milestones, emptyPhaseIds),
    [items, phases, milestones, emptyPhaseIds],
  )

  // Group the render list into phase segments for SortableContext
  const phaseSegments = useMemo(() => groupByPhase(renderList), [renderList])

  const totalMilestones = items.length

  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">Select a template to edit</p>
          <p className="text-xs text-slate-400 mt-1">Or create a new one from the left panel</p>
        </div>
      </div>
    )
  }

  const startEditingName = () => {
    setNameValue(template.name)
    setEditingName(true)
  }

  const saveName = () => {
    if (nameValue.trim() && nameValue.trim() !== template.name) {
      onRename(template.id, nameValue)
    }
    setEditingName(false)
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  className="text-[15px] font-semibold text-slate-900 border border-blue-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  autoFocus
                />
                <button onClick={saveName} className="p-0.5 text-blue-500 hover:text-blue-700">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h2
                onClick={startEditingName}
                className="text-[15px] font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                title="Click to rename"
              >
                {template.name}
              </h2>
            )}
            {template.is_default && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-[2px] rounded">
                DEFAULT
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            {procedureCount > 0 && (
              <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-[2px] rounded font-medium">
                {procedureCount} procedure{procedureCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-[2px] rounded">
              {totalMilestones} milestone{totalMilestones !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <button
          onClick={onDuplicate}
          disabled={saving}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-slate-200 rounded bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <Copy className="w-3 h-3" />
          Duplicate
        </button>
      </div>

      {/* Legend */}
      <div className="mx-3 mt-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-slate-400" />
          <span className="text-[10px] text-slate-500">Milestone</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-[2px] rotate-45" style={{ background: 'linear-gradient(135deg, #F59E0B, #22C55E)' }} />
          <span className="text-[10px] text-slate-500">Shared boundary (removable)</span>
        </div>
        <div className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] text-slate-500">Drag to reorder</span>
        </div>
      </div>

      {/* Builder content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {itemsLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        ) : renderList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Layers className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">Empty template</p>
            <p className="text-xs text-slate-400 mt-1">
              Drag milestones and phases from the library panel on the right
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {phaseSegments.map((segment) => {
              if (segment.type === 'phase-group') {
                return (
                  <PhaseGroupSegment
                    key={`pg-${segment.phaseId}`}
                    segment={segment}
                    onRemoveMilestone={onRemoveMilestone}
                    onRemovePhase={onRemovePhase}
                    activeDrag={activeDrag}
                  />
                )
              }
              if (segment.type === 'unassigned-group') {
                return (
                  <UnassignedSegment
                    key="unassigned"
                    segment={segment}
                    onRemoveMilestone={onRemoveMilestone}
                  />
                )
              }
              return null
            })}
          </div>
        )}

        {/* Bottom drop zone for phases */}
        <BottomPhaseDropZone activeDrag={activeDrag} />
      </div>
    </div>
  )
}

// ─── Phase Group Segment ────────────────────────────────────

interface PhaseGroupSegmentData {
  type: 'phase-group'
  phaseId: string
  header: RenderItem & { type: 'phase-header' }
  sortableItems: RenderItem[]
  sortableIds: string[]
  dropZone: (RenderItem & { type: 'drop-zone' }) | null
  subPhases: RenderItem[]
}

function PhaseGroupSegment({
  segment,
  onRemoveMilestone,
  onRemovePhase,
  activeDrag,
}: {
  segment: PhaseGroupSegmentData
  onRemoveMilestone: (itemId: string) => void
  onRemovePhase: (phaseId: string) => void
  activeDrag: ActiveDrag | null
}) {
  const isFirst = true // Let CSS handle top border
  return (
    <div>
      <PhaseHeader
        item={segment.header}
        isFirst={isFirst}
        onRemove={() => onRemovePhase(segment.phaseId)}
      />

      <SortableContext
        items={segment.sortableIds}
        strategy={verticalListSortingStrategy}
      >
        {segment.sortableItems.map((renderItem) => {
          switch (renderItem.type) {
            case 'edge-milestone':
              return (
                <EdgeMilestone
                  key={`em-${renderItem.templateItem.id}`}
                  item={renderItem}
                  onRemove={onRemoveMilestone}
                  sortableId={renderItem.templateItem.id}
                />
              )
            case 'interior-milestone':
              return (
                <InteriorMilestone
                  key={`im-${renderItem.templateItem.id}`}
                  item={renderItem}
                  onRemove={onRemoveMilestone}
                  sortableId={renderItem.templateItem.id}
                />
              )
            case 'shared-boundary':
              return (
                <SharedBoundary
                  key={`sb-${renderItem.templateItemId}`}
                  item={renderItem}
                  onRemove={onRemoveMilestone}
                  sortableId={renderItem.templateItemId}
                />
              )
            case 'sub-phase':
              return (
                <SubPhaseIndicator
                  key={`sp-${renderItem.phase.id}`}
                  item={renderItem}
                />
              )
            default:
              return null
          }
        })}
      </SortableContext>

      {segment.dropZone && (
        <DroppablePhaseZone
          phaseId={segment.dropZone.phaseId}
          phaseName={segment.dropZone.phaseName}
          color={segment.dropZone.color}
          activeDrag={activeDrag}
        />
      )}
    </div>
  )
}

// ─── Unassigned Segment ─────────────────────────────────────

interface UnassignedSegmentData {
  type: 'unassigned-group'
  header: RenderItem & { type: 'unassigned-header' }
  items: RenderItem[]
  sortableIds: string[]
}

function UnassignedSegment({
  segment,
  onRemoveMilestone,
}: {
  segment: UnassignedSegmentData
  onRemoveMilestone: (itemId: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border-t border-slate-200">
        <div className="w-2 h-2 rounded bg-slate-400" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
          Unassigned
        </span>
        <span className="text-[10px] text-slate-400 ml-auto">
          {segment.header.count}
        </span>
      </div>

      <SortableContext items={segment.sortableIds} strategy={verticalListSortingStrategy}>
        {segment.items.map((renderItem) => {
          if (renderItem.type === 'unassigned-milestone') {
            return (
              <UnassignedMilestone
                key={`um-${renderItem.templateItem.id}`}
                item={renderItem}
                onRemove={onRemoveMilestone}
                sortableId={renderItem.templateItem.id}
              />
            )
          }
          return null
        })}
      </SortableContext>
    </div>
  )
}

// ─── Droppable Phase Zone ───────────────────────────────────

function DroppablePhaseZone({
  phaseId,
  phaseName,
  color,
  activeDrag,
}: {
  phaseId: string
  phaseName: string
  color: { hex: string }
  activeDrag: ActiveDrag | null
}) {
  const droppableId = `${DROP_PHASE_PREFIX}${phaseId}`
  const { isOver, setNodeRef } = useDroppable({ id: droppableId })

  const isDraggingMilestone = activeDrag?.type === 'library-milestone'
  const isHighlighted = isOver && isDraggingMilestone

  return (
    <div
      ref={setNodeRef}
      className="mx-2 my-0.5 ml-9 py-[3px] border-[1.5px] border-dashed rounded text-[10px] text-center font-medium transition-all"
      style={{
        borderColor: isHighlighted ? color.hex : `${color.hex}30`,
        color: isHighlighted ? color.hex : `${color.hex}50`,
        background: isHighlighted ? `${color.hex}08` : 'transparent',
        transform: isHighlighted ? 'scale(1.01)' : undefined,
      }}
    >
      {isDraggingMilestone
        ? (isOver ? `Release to add to ${phaseName}` : `Drop into ${phaseName}`)
        : `Drop milestone into ${phaseName}`
      }
    </div>
  )
}

// ─── Bottom Phase Drop Zone ─────────────────────────────────

function BottomPhaseDropZone({ activeDrag }: { activeDrag: ActiveDrag | null }) {
  const { isOver, setNodeRef } = useDroppable({ id: DROP_BUILDER_BOTTOM })
  const isDraggingPhase = activeDrag?.type === 'library-phase'

  return (
    <div
      ref={setNodeRef}
      className="mt-1.5 py-2 border-[1.5px] border-dashed rounded-md text-center text-[11px] font-medium transition-all"
      style={{
        borderColor: isOver && isDraggingPhase ? '#3b82f6' : '#e2e8f0',
        color: isOver && isDraggingPhase ? '#3b82f6' : '#94a3b8',
        background: isOver && isDraggingPhase ? '#eff6ff' : 'transparent',
        transform: isOver && isDraggingPhase ? 'scale(1.01)' : undefined,
      }}
    >
      {isDraggingPhase
        ? (isOver ? 'Release to add phase' : 'Drop a phase here to add it')
        : 'Drop a phase here to add it'
      }
    </div>
  )
}

// ─── Phase Header ───────────────────────────────────────────

function PhaseHeader({
  item,
  isFirst,
  onRemove,
}: {
  item: { phase: { id: string; display_name: string; color_key: string | null }; color: ReturnType<typeof resolveColorKey>; itemCount: number }
  isFirst: boolean
  onRemove: () => void
}) {
  const hex = item.color.hex

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5"
      style={{
        background: `${hex}0a`,
        borderLeft: `3px solid ${hex}`,
        borderTop: !isFirst ? `1px solid ${hex}15` : undefined,
      }}
    >
      <div className="cursor-grab text-slate-300">
        <GripVertical className="w-2.5 h-2.5" />
      </div>
      <div className="w-2 h-2 rounded-sm" style={{ background: hex }} />
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: hex }}>
        {item.phase.display_name}
      </span>
      <span className="text-[10px] ml-auto" style={{ color: `${hex}70` }}>
        {item.itemCount}
      </span>
      <button
        onClick={onRemove}
        className="p-[1px] text-slate-400 hover:text-red-500 transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  )
}

// ─── Library Panel ──────────────────────────────────────────

interface LibraryPanelProps {
  availableMilestones: UseTemplateBuilderReturn['availableMilestones']
  availablePhases: UseTemplateBuilderReturn['availablePhases']
  assignedPhaseIds: Set<string>
  selectedTemplateId: string | null
  onAddMilestone: (phaseId: string, milestoneId: string) => void
  phases: UseTemplateBuilderReturn['phases']
}

function LibraryPanel({
  availableMilestones,
  availablePhases,
  assignedPhaseIds,
  selectedTemplateId,
  onAddMilestone,
  phases,
}: LibraryPanelProps) {
  const [libTab, setLibTab] = useState<'milestones' | 'phases'>('milestones')
  const [search, setSearch] = useState('')

  const filteredMilestones = useMemo(() => {
    if (!search.trim()) return availableMilestones
    const q = search.toLowerCase()
    return availableMilestones.filter(m =>
      m.display_name.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q)
    )
  }, [availableMilestones, search])

  const filteredPhases = useMemo(() => {
    if (!search.trim()) return availablePhases
    const q = search.toLowerCase()
    return availablePhases.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    )
  }, [availablePhases, search])

  // For click-to-add: which phases are available as targets
  const assignedPhasesList = useMemo(
    () => phases.filter(p => assignedPhaseIds.has(p.id)),
    [phases, assignedPhaseIds],
  )

  // Quick-add milestone: show a popover to pick target phase
  const [addingMilestoneId, setAddingMilestoneId] = useState<string | null>(null)

  const handleQuickAdd = (milestoneId: string, phaseId: string) => {
    if (!selectedTemplateId) return
    onAddMilestone(phaseId, milestoneId)
    setAddingMilestoneId(null)
  }

  return (
    <div className="w-[220px] min-w-[220px] border-l border-slate-200 flex flex-col bg-white">
      {/* Search + Tab switcher */}
      <div className="p-2 pb-1 space-y-1.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search library..."
          className="h-8 text-xs"
        />
        <div className="flex gap-[2px] bg-slate-100 rounded p-[2px]">
          {(['milestones', 'phases'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setLibTab(tab); setAddingMilestoneId(null) }}
              className={`
                flex-1 py-[3px] text-[10.5px] font-medium rounded capitalize transition-all
                ${libTab === tab
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-slate-400 text-center">
          Drag items into the builder, or click to add
        </p>
      </div>

      {/* Library items */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5">
        {libTab === 'milestones' && (
          <>
            {filteredMilestones.length === 0 ? (
              <div className="py-8 text-center">
                <Check className="w-5 h-5 text-green-500 mx-auto mb-1.5" />
                <div className="text-[11px] font-medium text-slate-500">
                  {search ? 'No matches' : 'All milestones assigned'}
                </div>
              </div>
            ) : (
              filteredMilestones.map(m => (
                <DraggableLibraryMilestone
                  key={m.id}
                  milestone={m}
                  assignedPhasesList={assignedPhasesList}
                  addingMilestoneId={addingMilestoneId}
                  setAddingMilestoneId={setAddingMilestoneId}
                  onQuickAdd={handleQuickAdd}
                />
              ))
            )}
          </>
        )}

        {libTab === 'phases' && (
          <>
            {filteredPhases.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-[11px] font-medium text-slate-500">
                  {search ? 'No matches' : 'All phases in template'}
                </div>
              </div>
            ) : (
              filteredPhases.map(p => (
                <DraggableLibraryPhase key={p.id} phase={p} />
              ))
            )}

            {/* Boundary instructions */}
            <div className="mt-3 px-1 space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  How boundaries work
                </p>
                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  The <strong>first</strong> milestone in a phase starts it. The <strong>last</strong> milestone ends it. Place the same milestone at the end of one phase and start of the next to create a shared boundary.
                </p>
              </div>

              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">Example: &ldquo;Incision&rdquo;</p>
                <div className="space-y-[2px]">
                  <div className="flex items-center gap-1">
                    <div className="w-[5px] h-[5px] rounded-[1px] bg-blue-500" />
                    <span className="text-[10px] text-slate-500">Pre-Op &rarr; ... &rarr; <strong>Incision</strong></span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <div className="w-2 h-2 rounded-[1px] rotate-45" style={{ background: 'linear-gradient(135deg, #3b82f6, #f59e0b)' }} />
                    <span className="text-[9px] font-semibold text-slate-600">Ends Pre-Op &middot; Starts Surgical</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-[5px] h-[5px] rounded-[1px] bg-amber-500" />
                    <span className="text-[10px] text-slate-500"><strong>Incision</strong> &rarr; Array Start &rarr; ...</span>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-slate-50 border border-slate-200 rounded">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">Sub-phases</p>
                <p className="text-[10.5px] text-slate-500 leading-relaxed">
                  Drag a phase onto an existing phase in the builder to nest it as a sub-phase.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Draggable Library Milestone ────────────────────────────

function DraggableLibraryMilestone({
  milestone,
  assignedPhasesList,
  addingMilestoneId,
  setAddingMilestoneId,
  onQuickAdd,
}: {
  milestone: { id: string; name: string; display_name: string; pair_position: 'start' | 'end' | null }
  assignedPhasesList: { id: string; display_name: string; color_key: string | null }[]
  addingMilestoneId: string | null
  setAddingMilestoneId: (id: string | null) => void
  onQuickAdd: (milestoneId: string, phaseId: string) => void
}) {
  const draggableId = `${LIB_MILESTONE_PREFIX}${milestone.id}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: draggableId })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div key={milestone.id} className="relative" ref={setNodeRef} style={style}>
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 mb-[2px] rounded border border-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:shadow-sm transition-shadow"
      >
        {/* Drag handle */}
        <div className="touch-none" {...attributes} {...listeners}>
          <GripVertical className="w-2.5 h-2.5 text-slate-300 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        </div>

        {/* Clickable area for quick-add */}
        <div
          className="flex-1 flex items-center gap-1.5 cursor-pointer truncate"
          onClick={() => {
            if (assignedPhasesList.length === 1) {
              onQuickAdd(milestone.id, assignedPhasesList[0].id)
            } else if (assignedPhasesList.length > 1) {
              setAddingMilestoneId(addingMilestoneId === milestone.id ? null : milestone.id)
            }
          }}
          title={assignedPhasesList.length === 0 ? 'Add phases to the template first' : 'Click to add or drag into builder'}
        >
          <span className="flex-1 truncate">{milestone.display_name}</span>
          {milestone.pair_position && (
            <span className={`text-[7.5px] font-bold px-[3px] py-[1px] rounded uppercase ${
              milestone.pair_position === 'start'
                ? 'bg-green-50 text-green-600'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {milestone.pair_position}
            </span>
          )}
          {assignedPhasesList.length > 0 && (
            <Plus className="w-3 h-3 text-slate-400 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Phase picker dropdown */}
      {addingMilestoneId === milestone.id && assignedPhasesList.length > 1 && (
        <div className="absolute right-0 top-full mt-0.5 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-0.5 min-w-[140px]">
          <p className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            Add to phase:
          </p>
          {assignedPhasesList.map(p => {
            const pColor = resolveColorKey(p.color_key)
            return (
              <button
                key={p.id}
                onClick={() => onQuickAdd(milestone.id, p.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: pColor.hex }} />
                {p.display_name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Draggable Library Phase ────────────────────────────────

function DraggableLibraryPhase({ phase }: { phase: { id: string; name: string; display_name: string; color_key: string | null } }) {
  const draggableId = `${LIB_PHASE_PREFIX}${phase.id}`
  const pColor = resolveColorKey(phase.color_key)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: draggableId })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 px-2 py-1.5 mb-[2px] rounded border text-[11.5px] font-semibold touch-none"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-2.5 h-2.5 flex-shrink-0 cursor-grab active:cursor-grabbing" style={{ color: `${pColor.hex}60` }} />
      <div className="w-[7px] h-[7px] rounded-[1.5px] flex-shrink-0" style={{
        background: pColor.hex,
        borderColor: `${pColor.hex}30`,
      }} />
      <span className="truncate" style={{ color: pColor.hex }}>{phase.display_name}</span>
    </div>
  )
}

// ─── groupByPhase helper ────────────────────────────────────

type PhaseSegment = PhaseGroupSegmentData | UnassignedSegmentData

function groupByPhase(renderList: RenderItem[]): PhaseSegment[] {
  const segments: PhaseSegment[] = []
  let currentPhaseGroup: PhaseGroupSegmentData | null = null

  for (const item of renderList) {
    switch (item.type) {
      case 'phase-header': {
        // Flush previous group
        if (currentPhaseGroup) {
          segments.push(currentPhaseGroup)
        }
        currentPhaseGroup = {
          type: 'phase-group',
          phaseId: item.phase.id,
          header: item,
          sortableItems: [],
          sortableIds: [],
          dropZone: null,
          subPhases: [],
        }
        break
      }
      case 'edge-milestone':
      case 'interior-milestone': {
        if (currentPhaseGroup) {
          currentPhaseGroup.sortableItems.push(item)
          currentPhaseGroup.sortableIds.push(item.templateItem.id)
        }
        break
      }
      case 'sub-phase': {
        if (currentPhaseGroup) {
          currentPhaseGroup.sortableItems.push(item)
          currentPhaseGroup.subPhases.push(item)
        }
        break
      }
      case 'drop-zone': {
        if (currentPhaseGroup) {
          currentPhaseGroup.dropZone = item
        }
        break
      }
      case 'shared-boundary': {
        // Include shared boundary as the last sortable item in the ending phase group
        if (currentPhaseGroup) {
          currentPhaseGroup.sortableItems.push(item)
          currentPhaseGroup.sortableIds.push(item.templateItemId)
          segments.push(currentPhaseGroup)
          currentPhaseGroup = null
        }
        break
      }
      case 'unassigned-header': {
        // Flush current group
        if (currentPhaseGroup) {
          segments.push(currentPhaseGroup)
          currentPhaseGroup = null
        }
        // Collect all unassigned items that follow
        const unassignedItems: RenderItem[] = []
        const unassignedIds: string[] = []
        // We'll handle this by looking ahead in the next iterations
        segments.push({
          type: 'unassigned-group',
          header: item,
          items: unassignedItems,
          sortableIds: unassignedIds,
        })
        break
      }
      case 'unassigned-milestone': {
        // Add to the last unassigned group
        const lastSeg = segments[segments.length - 1]
        if (lastSeg && lastSeg.type === 'unassigned-group') {
          lastSeg.items.push(item)
          lastSeg.sortableIds.push(item.templateItem.id)
        }
        break
      }
    }
  }

  // Flush final group
  if (currentPhaseGroup) {
    segments.push(currentPhaseGroup)
  }

  return segments
}

// ─── Skeleton ───────────────────────────────────────────────

function BuilderSkeleton() {
  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
      <div className="w-[200px] border-r border-slate-200 p-2 space-y-2">
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-8 w-full rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
      <div className="flex-1 p-4 space-y-3">
        <Skeleton className="h-12 w-full rounded" />
        <Skeleton className="h-6 w-48 rounded" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
      <div className="w-[220px] border-l border-slate-200 p-2 space-y-2">
        <Skeleton className="h-8 w-full rounded" />
        <Skeleton className="h-7 w-full rounded" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded" />
        ))}
      </div>
    </div>
  )
}
