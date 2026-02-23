// components/settings/milestones/TemplateTimelinePreview.tsx
// Read-only visual timeline preview of a milestone template.
// Renders the same visual as the builder canvas but without
// drag-and-drop, remove buttons, or drop zones.
'use client'

import { useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { buildTemplateRenderList } from '@/lib/utils/buildTemplateRenderList'
import type {
  TemplateItemData,
  PhaseLookup,
  MilestoneLookup,
  EdgeMilestoneItem,
  InteriorMilestoneItem,
  SharedBoundaryItem,
  SubPhaseItem,
  UnassignedMilestoneItem,
} from '@/lib/utils/buildTemplateRenderList'

// ─── Props ─────────────────────────────────────────────────

interface TemplateTimelinePreviewProps {
  items: TemplateItemData[]
  phases: PhaseLookup[]
  milestones: MilestoneLookup[]
}

// ─── Main Component ────────────────────────────────────────

export function TemplateTimelinePreview({
  items,
  phases,
  milestones,
}: TemplateTimelinePreviewProps) {
  const renderList = useMemo(
    () => buildTemplateRenderList(items, phases, milestones),
    [items, phases, milestones],
  )

  if (renderList.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {renderList.map((item, idx) => {
        switch (item.type) {
          case 'phase-header':
            return (
              <ReadOnlyPhaseHeader
                key={`ph-${item.phase.id}-${idx}`}
                phase={item.phase}
                hex={item.color.hex}
                itemCount={item.itemCount}
                isFirst={idx === 0}
              />
            )
          case 'edge-milestone':
            return <ReadOnlyEdgeMilestone key={`em-${item.templateItem.id}`} item={item} />
          case 'interior-milestone':
            return <ReadOnlyInteriorMilestone key={`im-${item.templateItem.id}`} item={item} />
          case 'shared-boundary':
            return <ReadOnlySharedBoundary key={`sb-${item.templateItemId}`} item={item} />
          case 'sub-phase':
            return <ReadOnlySubPhase key={`sp-${item.phase.id}`} item={item} />
          case 'unassigned-header':
            return (
              <div key="uh" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border-t border-slate-200">
                <div className="w-2 h-2 rounded bg-slate-400" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Unassigned</span>
                <span className="text-[10px] text-slate-400 ml-auto">{item.count}</span>
              </div>
            )
          case 'unassigned-milestone':
            return <ReadOnlyUnassignedMilestone key={`um-${item.templateItem.id}`} item={item} />
          case 'drop-zone':
            return null // No drop zones in read-only mode
          default:
            return null
        }
      })}
    </div>
  )
}

// ─── Phase Header ──────────────────────────────────────────

function ReadOnlyPhaseHeader({
  phase,
  hex,
  itemCount,
  isFirst,
}: {
  phase: PhaseLookup
  hex: string
  itemCount: number
  isFirst: boolean
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5"
      style={{
        background: `${hex}0a`,
        borderLeft: `3px solid ${hex}`,
        borderTop: !isFirst ? `1px solid ${hex}15` : undefined,
      }}
    >
      <div className="w-2 h-2 rounded-sm" style={{ background: hex }} />
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: hex }}>
        {phase.display_name}
      </span>
      <span className="text-[10px] ml-auto" style={{ color: `${hex}70` }}>
        {itemCount}
      </span>
    </div>
  )
}

// ─── Edge Milestone ────────────────────────────────────────

function ReadOnlyEdgeMilestone({ item }: { item: EdgeMilestoneItem }) {
  const { milestone, color, edge } = item
  const hex = color.hex

  return (
    <div className="flex items-center gap-0 py-1 pl-3 pr-2 relative" data-phase-id={item.phase.id}>
      {/* Phase rail */}
      <div
        className="absolute left-[26px] w-0.5"
        style={{
          background: `${hex}30`,
          top: edge === 'start' ? '50%' : 0,
          bottom: edge === 'end' ? '50%' : 0,
        }}
      />

      {/* Marker — filled dot */}
      <div
        className="w-4 h-4 rounded-full flex-shrink-0 relative z-[2]"
        style={{ background: hex, boxShadow: '0 0 0 2px #fff' }}
      />

      {/* Name */}
      <span className="text-[12.5px] font-semibold text-slate-900 ml-1.5 flex-1 truncate">
        {milestone.display_name}
      </span>

      {/* Edge badge */}
      <span
        className="inline-flex items-center gap-0.5 text-[8.5px] font-bold tracking-wide px-1 py-[1px] rounded"
        style={{ background: `${hex}10`, color: hex, border: `1px solid ${hex}20` }}
      >
        {edge === 'start' ? (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        ) : (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
        )}
        {edge === 'start' ? 'STARTS' : 'ENDS'} {item.phase.display_name.toUpperCase()}
      </span>

      {/* Pair badge */}
      {milestone.pair_position && <PairBadge position={milestone.pair_position} />}
    </div>
  )
}

// ─── Interior Milestone ────────────────────────────────────

function ReadOnlyInteriorMilestone({ item }: { item: InteriorMilestoneItem }) {
  const { milestone, color } = item
  const hex = color.hex

  return (
    <div className="flex items-center gap-0 py-[3px] pl-3 pr-2 relative" data-phase-id={item.phase.id}>
      {/* Phase rail */}
      <div className="absolute left-[26px] top-0 bottom-0 w-0.5" style={{ background: `${hex}25` }} />

      {/* Marker — filled dot */}
      <div
        className="w-3.5 h-3.5 rounded-full flex-shrink-0 relative z-[1]"
        style={{ background: hex }}
      />

      {/* Name */}
      <span className="text-xs font-medium text-slate-700 ml-1.5 flex-1 truncate">
        {milestone.display_name}
      </span>

      {/* Pair badge */}
      {milestone.pair_position && <PairBadge position={milestone.pair_position} />}
    </div>
  )
}

// ─── Shared Boundary ───────────────────────────────────────

function ReadOnlySharedBoundary({ item }: { item: SharedBoundaryItem }) {
  const { milestone, endsPhase, startsPhase, endsColor, startsColor } = item
  const topHex = endsColor.hex
  const bottomHex = startsColor.hex

  return (
    <div
      className="relative py-1.5 px-3"
      style={{
        background: `linear-gradient(to right, ${topHex}06, transparent 30%, transparent 70%, ${bottomHex}06)`,
        borderTop: `1px solid ${topHex}25`,
        borderBottom: `1px solid ${bottomHex}25`,
      }}
    >
      {/* Center gradient rail */}
      <div
        className="absolute left-[26px] top-0 bottom-0 w-0.5"
        style={{ background: `linear-gradient(to bottom, ${topHex}50, ${bottomHex}50)` }}
      />

      <div className="flex items-center">
        {/* Gradient diamond */}
        <div className="w-7 flex items-center justify-center flex-shrink-0 relative z-[2]">
          <div
            className="w-3 h-3 rounded-[2px] rotate-45"
            style={{
              background: `linear-gradient(135deg, ${topHex}, ${bottomHex})`,
              boxShadow: '0 0 0 2.5px #fff, 0 0 0 3.5px #e2e8f0',
            }}
          />
        </div>

        {/* Name + dual badges */}
        <div className="ml-2 flex-1 min-w-0">
          <div className="text-[13px] font-bold text-slate-900 mb-0.5 truncate">
            {milestone.display_name}
          </div>
          <div className="flex gap-1 flex-wrap">
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-1.5 py-[1px] rounded"
              style={{ background: `${topHex}12`, color: topHex, border: `1px solid ${topHex}25` }}
            >
              <ChevronUp className="w-2 h-2" />
              ENDS {endsPhase.display_name.toUpperCase()}
            </span>
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-1.5 py-[1px] rounded"
              style={{ background: `${bottomHex}12`, color: bottomHex, border: `1px solid ${bottomHex}25` }}
            >
              <ChevronDown className="w-2 h-2" />
              STARTS {startsPhase.display_name.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Pair badge */}
        {milestone.pair_position && <PairBadge position={milestone.pair_position} />}
      </div>
    </div>
  )
}

// ─── Sub-Phase ─────────────────────────────────────────────

function ReadOnlySubPhase({ item }: { item: SubPhaseItem }) {
  const { phase, color, milestones } = item
  const hex = color.hex

  return (
    <div
      className="ml-[30px] mr-2 my-[1px] rounded-[5px] overflow-hidden"
      style={{ border: `1.5px solid ${hex}30`, background: `${hex}05` }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1 px-2 py-[3px]"
        style={{ background: `${hex}0a`, borderBottom: `1px solid ${hex}15` }}
      >
        <div className="w-1.5 h-1.5 rounded-[1.5px]" style={{ background: hex }} />
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: hex }}>
          {phase.display_name}
        </span>
        <span className="text-[8px] font-semibold text-slate-400 bg-slate-100 px-1 py-[1px] rounded ml-0.5">
          SUB-PHASE
        </span>
        <span className="text-[9.5px] ml-auto" style={{ color: `${hex}70` }}>
          {milestones.length} ms
        </span>
      </div>

      {/* Milestone rows */}
      {milestones.map(({ milestone, templateItem }, idx) => {
        const isFirst = idx === 0
        const isLast = idx === milestones.length - 1

        return (
          <div
            key={templateItem.id}
            className="flex items-center gap-1.5 px-2 py-[2.5px]"
            style={{ borderBottom: idx < milestones.length - 1 ? `1px solid ${hex}10` : 'none' }}
          >
            {/* Marker — filled dot */}
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: hex }}
            />
            <span className="text-[11.5px] font-medium text-slate-700 flex-1 truncate">
              {milestone.display_name}
            </span>
            {milestones.length > 1 && (isFirst || isLast) && (
              <span
                className="text-[7.5px] font-bold px-1 py-[1px] rounded tracking-wide"
                style={{ background: `${hex}10`, color: hex }}
              >
                {isFirst ? 'START' : 'END'}
              </span>
            )}
            {milestone.pair_position && <PairBadge position={milestone.pair_position} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Unassigned Milestone ──────────────────────────────────

function ReadOnlyUnassignedMilestone({ item }: { item: UnassignedMilestoneItem }) {
  const { milestone } = item

  return (
    <div className="flex items-center gap-0 py-[3px] pl-3 pr-2 relative">
      <div className="absolute left-[26px] top-0 bottom-0 w-0.5 bg-slate-200" />
      {/* Marker — filled dot (slate for unassigned) */}
      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-slate-400 relative z-[1]" />
      <span className="text-xs font-medium text-slate-600 ml-1.5 flex-1 truncate">
        {milestone.display_name}
      </span>
      {milestone.pair_position && <PairBadge position={milestone.pair_position} />}
    </div>
  )
}

// ─── Pair Badge ────────────────────────────────────────────

function PairBadge({ position }: { position: 'start' | 'end' }) {
  return (
    <span
      className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase flex-shrink-0 ml-1 ${
        position === 'start' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
      }`}
    >
      {position}
    </span>
  )
}
