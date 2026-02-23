// components/settings/milestones/SharedBoundary.tsx
// Pure CSS gradient boundary connector between two adjacent phases.
// Renders once when the last milestone of phase A equals the first of phase B.
'use client'

import type { SharedBoundaryItem } from '@/lib/utils/buildTemplateRenderList'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface SharedBoundaryProps {
  item: SharedBoundaryItem
}

export function SharedBoundary({ item }: SharedBoundaryProps) {
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
              style={{
                background: `${topHex}12`,
                color: topHex,
                border: `1px solid ${topHex}25`,
              }}
            >
              <ChevronUp className="w-2 h-2" />
              ENDS {endsPhase.display_name.toUpperCase()}
            </span>
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-bold tracking-wide px-1.5 py-[1px] rounded"
              style={{
                background: `${bottomHex}12`,
                color: bottomHex,
                border: `1px solid ${bottomHex}25`,
              }}
            >
              <ChevronDown className="w-2 h-2" />
              STARTS {startsPhase.display_name.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Pair badge */}
        {milestone.pair_position && (
          <PairBadge position={milestone.pair_position} />
        )}
      </div>
    </div>
  )
}

function PairBadge({ position }: { position: 'start' | 'end' }) {
  return (
    <span
      className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase flex-shrink-0 ${
        position === 'start'
          ? 'bg-green-50 text-green-600'
          : 'bg-amber-50 text-amber-600'
      }`}
    >
      {position}
    </span>
  )
}
