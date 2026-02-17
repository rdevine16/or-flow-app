// components/settings/milestones/BoundaryMarker.tsx
'use client'

import { Lock, Pencil } from 'lucide-react'

export interface BoundaryMarkerProps {
  /** Display name of the boundary milestone */
  name: string
  /** Hex color of the phase above this boundary (or the single phase if solid) */
  topColor: string
  /** Hex color of the phase below this boundary */
  bottomColor: string
  /** If true, the dot and line use a single color (bottomColor). If false, uses a gradient. */
  solid?: boolean
  /** Min minutes for interval badge */
  minMinutes?: number | null
  /** Max minutes for interval badge */
  maxMinutes?: number | null
  /** Called when the edit icon is clicked */
  onEdit?: () => void
}

/**
 * Pill-shaped marker rendered between phase blocks.
 * Shows a colored dot (solid or split-gradient), a vertical color line,
 * the boundary milestone name, and a lock icon indicating immutability.
 */
export function BoundaryMarker({
  name,
  topColor,
  bottomColor,
  solid = false,
  minMinutes,
  maxMinutes,
  onEdit,
}: BoundaryMarkerProps) {
  const dotBackground = solid
    ? bottomColor
    : `linear-gradient(135deg, ${topColor} 50%, ${bottomColor} 50%)`
  const lineBackground = solid
    ? bottomColor
    : `linear-gradient(to bottom, ${topColor}, ${bottomColor})`

  const hasInterval = minMinutes != null || maxMinutes != null

  return (
    <div className="relative flex items-center z-[2] ml-[11px] group/bm">
      {/* Vertical color line */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[2.5px]"
        style={{ background: lineBackground }}
      />
      {/* Pill content */}
      <div className="flex items-center gap-[5px] ml-2 px-2.5 pr-2.5 pl-[7px] py-1 bg-white border-[1.5px] border-slate-200 rounded-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] relative z-[3]">
        {/* Colored dot */}
        <div
          className="w-[13px] h-[13px] rounded-full shrink-0"
          style={{ background: dotBackground }}
        />
        <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
          {name}
        </span>

        {/* Interval badge */}
        {hasInterval && (
          <span className="text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-[1px] shrink-0">
            {minMinutes != null && maxMinutes != null
              ? `${minMinutes}\u2013${maxMinutes} min`
              : maxMinutes != null
                ? `\u2264${maxMinutes} min`
                : `\u2265${minMinutes} min`}
          </span>
        )}

        <span className="text-slate-400 flex items-center">
          <Lock className="w-[9px] h-[9px]" />
        </span>

        {/* Edit button (hover-reveal) */}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="border-none bg-transparent cursor-pointer text-slate-300 hover:text-blue-500 flex items-center p-0.5 rounded transition-opacity opacity-0 group-hover/bm:opacity-100"
          >
            <Pencil className="w-[10px] h-[10px]" />
          </button>
        )}
      </div>
    </div>
  )
}
