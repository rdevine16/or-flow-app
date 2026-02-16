'use client'

import { Clock, X } from 'lucide-react'

export interface DelayNodeProps {
  id: string
  delayTypeName: string
  durationMinutes: number | null
  note: string | null
  canRemove: boolean
  onRemove?: (flagId: string) => void
}

export default function DelayNode({
  id,
  delayTypeName,
  durationMinutes,
  note,
  canRemove,
  onRemove,
}: DelayNodeProps) {
  return (
    <div className="flex gap-3 relative group">
      {/* Left column: amber node + dashed connecting lines */}
      <div className="flex flex-col items-center w-8 flex-shrink-0">
        <div className="w-0.5 h-2 border-l-2 border-dashed border-amber-300" />
        <div className="w-6 h-6 rounded-full bg-amber-100 border-2 border-dashed border-amber-400 flex items-center justify-center flex-shrink-0 z-10">
          <Clock className="w-3 h-3 text-amber-600" />
        </div>
        <div className="w-0.5 flex-1 min-h-[8px] border-l-2 border-dashed border-amber-300" />
      </div>

      {/* Right column: delay info */}
      <div className="flex-1 flex items-center gap-2 py-1 min-h-[32px]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs min-w-0">
          <span className="font-semibold text-amber-800 truncate">{delayTypeName}</span>
          {durationMinutes !== null && (
            <span className="text-amber-600 font-mono tabular-nums flex-shrink-0">{durationMinutes}m</span>
          )}
          {note && (
            <span className="text-amber-500 italic truncate max-w-[140px]" title={note}>
              &ldquo;{note}&rdquo;
            </span>
          )}
        </div>

        {/* Remove button */}
        {canRemove && onRemove && (
          <button
            onClick={() => onRemove(id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all flex-shrink-0"
            title="Remove delay"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
