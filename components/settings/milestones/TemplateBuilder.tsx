// components/settings/milestones/TemplateBuilder.tsx
// Main 3-column template builder: Template List | Builder Canvas | Library Panel.
// Phase 3a: rendering + template CRUD + click-to-add/remove. DnD added in Phase 3b.
'use client'

import { useState, useMemo } from 'react'
import { useTemplateBuilder } from '@/hooks/useTemplateBuilder'
import { buildTemplateRenderList } from '@/lib/utils/buildTemplateRenderList'
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

export function TemplateBuilder() {
  const builder = useTemplateBuilder()

  if (builder.loading) {
    return <BuilderSkeleton />
  }

  if (builder.error) {
    return <ErrorBanner message={builder.error} />
  }

  return (
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
        itemsLoading={builder.itemsLoading}
        saving={builder.saving}
        onRemoveMilestone={builder.removeMilestone}
        onRemovePhase={builder.removePhaseFromTemplate}
        onDuplicate={() => builder.selectedTemplateId && builder.duplicateTemplate(builder.selectedTemplateId)}
        onRename={builder.renameTemplate}
        procedureCount={builder.selectedTemplateId ? (builder.procedureCounts[builder.selectedTemplateId] || 0) : 0}
      />

      {/* Column 3: Library Panel */}
      <LibraryPanel
        availableMilestones={builder.availableMilestones}
        availablePhases={builder.availablePhases}
        assignedPhaseIds={builder.assignedPhaseIds}
        selectedTemplateId={builder.selectedTemplateId}
        onAddMilestone={builder.addMilestoneToPhase}
        onAddPhase={(phaseId) => {
          // For Phase 3a: add phase by creating a placeholder item.
          // In Phase 3b this will be drag-to-add.
          // For now we just show a toast that DnD is coming.
          // Actually, let's add a quick click-to-add.
          builder.addMilestoneToPhase(phaseId, '')
        }}
        phases={builder.phases}
      />
    </div>
  )
}

// ─── Builder Canvas ─────────────────────────────────────

interface BuilderCanvasProps {
  template: ReturnType<typeof useTemplateBuilder>['selectedTemplate']
  items: ReturnType<typeof useTemplateBuilder>['items']
  phases: ReturnType<typeof useTemplateBuilder>['phases']
  milestones: ReturnType<typeof useTemplateBuilder>['milestones']
  itemsLoading: boolean
  saving: boolean
  onRemoveMilestone: (itemId: string) => void
  onRemovePhase: (phaseId: string) => void
  onDuplicate: () => void
  onRename: (templateId: string, name: string) => void
  procedureCount: number
}

function BuilderCanvas({
  template,
  items,
  phases,
  milestones,
  itemsLoading,
  saving,
  onRemoveMilestone,
  onRemovePhase,
  onDuplicate,
  onRename,
  procedureCount,
}: BuilderCanvasProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const renderList = useMemo(
    () => buildTemplateRenderList(items, phases, milestones),
    [items, phases, milestones],
  )

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
          <div className="w-2.5 h-2.5 rounded-[2px] rotate-45" style={{ background: 'linear-gradient(135deg, #F59E0B, #22C55E)' }} />
          <span className="text-[10px] text-slate-500">Shared boundary</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-400 flex items-center justify-center">
            <Check className="w-2 h-2 text-white" />
          </div>
          <span className="text-[10px] text-slate-500">First/last in phase show their role</span>
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
              Add milestones from the library panel on the right
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {renderList.map((item, idx) => {
              switch (item.type) {
                case 'phase-header':
                  return (
                    <PhaseHeader
                      key={`ph-${item.phase.id}`}
                      item={item}
                      isFirst={idx === 0}
                      onRemove={() => onRemovePhase(item.phase.id)}
                    />
                  )
                case 'shared-boundary':
                  return (
                    <SharedBoundary
                      key={`sb-${item.templateItemId}`}
                      item={item}
                    />
                  )
                case 'edge-milestone':
                  return (
                    <EdgeMilestone
                      key={`em-${item.templateItem.id}`}
                      item={item}
                      onRemove={onRemoveMilestone}
                    />
                  )
                case 'interior-milestone':
                  return (
                    <InteriorMilestone
                      key={`im-${item.templateItem.id}`}
                      item={item}
                      onRemove={onRemoveMilestone}
                    />
                  )
                case 'sub-phase':
                  return (
                    <SubPhaseIndicator
                      key={`sp-${item.phase.id}`}
                      item={item}
                    />
                  )
                case 'drop-zone':
                  return (
                    <div
                      key={`dz-${item.phaseId}`}
                      className="mx-2 my-0.5 ml-9 py-[3px] border-[1.5px] border-dashed rounded text-[10px] text-center font-medium transition-colors"
                      style={{
                        borderColor: `${item.color.hex}30`,
                        color: `${item.color.hex}50`,
                      }}
                    >
                      Drop milestone into {item.phaseName}
                    </div>
                  )
                case 'unassigned-header':
                  return (
                    <div
                      key="unassigned-header"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border-t border-slate-200"
                    >
                      <div className="w-2 h-2 rounded bg-slate-400" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Unassigned
                      </span>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {item.count}
                      </span>
                    </div>
                  )
                case 'unassigned-milestone':
                  return (
                    <UnassignedMilestone
                      key={`um-${item.templateItem.id}`}
                      item={item}
                      onRemove={onRemoveMilestone}
                    />
                  )
                default:
                  return null
              }
            })}
          </div>
        )}

        {/* Bottom drop zone for phases (visual placeholder for Phase 3b DnD) */}
        <div className="mt-1.5 py-2 border-[1.5px] border-dashed border-slate-200 rounded-md text-center text-[11px] text-slate-400 font-medium">
          Drop a phase here to add it
        </div>
      </div>
    </div>
  )
}

// ─── Phase Header ───────────────────────────────────────

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

// ─── Library Panel ──────────────────────────────────────

interface LibraryPanelProps {
  availableMilestones: ReturnType<typeof useTemplateBuilder>['availableMilestones']
  availablePhases: ReturnType<typeof useTemplateBuilder>['availablePhases']
  assignedPhaseIds: Set<string>
  selectedTemplateId: string | null
  onAddMilestone: (phaseId: string, milestoneId: string) => void
  onAddPhase: (phaseId: string) => void
  phases: ReturnType<typeof useTemplateBuilder>['phases']
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
                <div key={m.id} className="relative">
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 mb-[2px] rounded border border-slate-200 bg-white text-[11.5px] font-medium text-slate-700 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => {
                      if (assignedPhasesList.length === 1) {
                        handleQuickAdd(m.id, assignedPhasesList[0].id)
                      } else if (assignedPhasesList.length > 1) {
                        setAddingMilestoneId(addingMilestoneId === m.id ? null : m.id)
                      }
                    }}
                    title={assignedPhasesList.length === 0 ? 'Add phases to the template first' : 'Click to add to template'}
                  >
                    <GripVertical className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
                    <span className="flex-1 truncate">{m.display_name}</span>
                    {m.pair_position && (
                      <span className={`text-[7.5px] font-bold px-[3px] py-[1px] rounded uppercase ${
                        m.pair_position === 'start'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {m.pair_position}
                      </span>
                    )}
                    {assignedPhasesList.length > 0 && (
                      <Plus className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Phase picker dropdown */}
                  {addingMilestoneId === m.id && assignedPhasesList.length > 1 && (
                    <div className="absolute right-0 top-full mt-0.5 z-10 bg-white border border-slate-200 rounded-md shadow-lg py-0.5 min-w-[140px]">
                      <p className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        Add to phase:
                      </p>
                      {assignedPhasesList.map(p => {
                        const pColor = resolveColorKey(p.color_key)
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleQuickAdd(m.id, p.id)}
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
              filteredPhases.map(p => {
                const pColor = resolveColorKey(p.color_key)
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 mb-[2px] rounded border text-[11.5px] font-semibold cursor-grab"
                    style={{
                      borderColor: `${pColor.hex}30`,
                      background: `${pColor.hex}06`,
                      color: pColor.hex,
                    }}
                  >
                    <GripVertical className="w-2.5 h-2.5 flex-shrink-0" style={{ color: `${pColor.hex}60` }} />
                    <div className="w-[7px] h-[7px] rounded-[1.5px] flex-shrink-0" style={{ background: pColor.hex }} />
                    <span className="truncate">{p.display_name}</span>
                  </div>
                )
              })
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

// ─── Skeleton ───────────────────────────────────────────

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
