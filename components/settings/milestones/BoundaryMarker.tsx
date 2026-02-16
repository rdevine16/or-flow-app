// components/settings/milestones/BoundaryMarker.tsx
'use client'

import { Lock } from 'lucide-react'

export interface BoundaryMarkerProps {
  /** Display name of the boundary milestone */
  name: string
  /** Hex color of the phase above this boundary (or the single phase if solid) */
  topColor: string
  /** Hex color of the phase below this boundary */
  bottomColor: string
  /** If true, the dot and line use a single color (bottomColor). If false, uses a gradient. */
  solid?: boolean
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
}: BoundaryMarkerProps) {
  const dotBackground = solid
    ? bottomColor
    : `linear-gradient(135deg, ${topColor} 50%, ${bottomColor} 50%)`
  const lineBackground = solid
    ? bottomColor
    : `linear-gradient(to bottom, ${topColor}, ${bottomColor})`

  return (
    <div className="relative flex items-center z-[2] ml-[11px]">
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
        <span className="text-[11px] font-semibold text-slate-800 whitespace-nowrap">
          {name}
        </span>
        <span className="text-slate-400 flex items-center">
          <Lock className="w-[9px] h-[9px]" />
        </span>
      </div>
    </div>
  )
}
