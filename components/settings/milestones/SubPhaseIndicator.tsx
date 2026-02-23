// components/settings/milestones/SubPhaseIndicator.tsx
// Renders a nested sub-phase card within the parent phase block.
// Shows phase name, SUB-PHASE badge, milestone count, and listed milestones.
'use client'

import type { SubPhaseItem } from '@/lib/utils/buildTemplateRenderList'

interface SubPhaseIndicatorProps {
  item: SubPhaseItem
}

export function SubPhaseIndicator({ item }: SubPhaseIndicatorProps) {
  const { phase, color, milestones } = item
  const hex = color.hex

  return (
    <div
      className="ml-[30px] mr-2 my-[1px] rounded-[5px] overflow-hidden"
      style={{
        border: `1.5px solid ${hex}30`,
        background: `${hex}05`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-1 px-2 py-[3px]"
        style={{
          background: `${hex}0a`,
          borderBottom: `1px solid ${hex}15`,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-[1.5px]" style={{ background: hex }} />
        <span
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color: hex }}
        >
          {phase.display_name}
        </span>
        <span className="text-[8px] font-semibold text-slate-400 bg-slate-100 px-1 py-[1px] rounded ml-0.5">
          SUB-PHASE
        </span>
        <span
          className="text-[9.5px] ml-auto"
          style={{ color: `${hex}70` }}
        >
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
            style={{
              borderBottom: idx < milestones.length - 1 ? `1px solid ${hex}10` : 'none',
            }}
          >
            {/* Marker */}
            <div
              className="w-3 h-3 rounded-[2px] flex items-center justify-center"
              style={{ background: hex }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            {/* Name */}
            <span className="text-[11.5px] font-medium text-slate-700 flex-1 truncate">
              {milestone.display_name}
            </span>

            {/* Position badge */}
            {milestones.length > 1 && (isFirst || isLast) && (
              <span
                className="text-[7.5px] font-bold px-1 py-[1px] rounded tracking-wide"
                style={{
                  background: `${hex}10`,
                  color: hex,
                }}
              >
                {isFirst ? 'START' : 'END'}
              </span>
            )}

            {/* Pair badge */}
            {milestone.pair_position && (
              <span
                className={`text-[7.5px] font-bold px-[3px] py-[1px] rounded uppercase ${
                  milestone.pair_position === 'start'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {milestone.pair_position}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
