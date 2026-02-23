// components/settings/milestones/SharedBoundary.tsx
// Pure CSS gradient boundary connector between two adjacent phases.
// Renders once when the last milestone of phase A equals the first of phase B.
// Interactive: hover reveals drag handle + remove button with confirmation dialog.
'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Dialog from '@radix-ui/react-dialog'
import type { SharedBoundaryItem } from '@/lib/utils/buildTemplateRenderList'
import { ChevronUp, ChevronDown, GripVertical, X } from 'lucide-react'

interface SharedBoundaryProps {
  item: SharedBoundaryItem
  onRemove?: (itemId: string) => void
  sortableId?: string
}

export function SharedBoundary({ item, onRemove, sortableId }: SharedBoundaryProps) {
  const [hover, setHover] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { milestone, endsPhase, startsPhase, endsColor, startsColor, templateItemId } = item
  const topHex = endsColor.hex
  const bottomHex = startsColor.hex

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId ?? templateItemId, disabled: !sortableId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const handleRemoveClick = () => {
    if (!onRemove) return
    setConfirmOpen(true)
  }

  const handleConfirmRemove = () => {
    setConfirmOpen(false)
    onRemove?.(templateItemId)
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          background: `linear-gradient(to right, ${topHex}06, transparent 30%, transparent 70%, ${bottomHex}06)`,
          borderTop: `1px solid ${topHex}25`,
          borderBottom: `1px solid ${bottomHex}25`,
        }}
        className="relative py-1.5 px-1 transition-colors"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Center gradient rail */}
        <div
          className="absolute left-[26px] top-0 bottom-0 w-0.5"
          style={{ background: `linear-gradient(to bottom, ${topHex}50, ${bottomHex}50)` }}
        />

        <div className="flex items-center">
          {/* Drag handle */}
          {sortableId ? (
            <div
              className="w-5 flex items-center justify-center flex-shrink-0 relative z-[1] touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical
                className="w-2.5 h-2.5 transition-colors cursor-grab active:cursor-grabbing"
                style={{ color: hover || isDragging ? '#94a3b8' : 'transparent' }}
              />
            </div>
          ) : (
            <div className="w-2" />
          )}

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

          {/* Remove button (on hover) */}
          {onRemove && hover && !isDragging && (
            <button
              onClick={handleRemoveClick}
              className="p-0.5 ml-1 text-red-500 hover:text-red-700 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Removal confirmation dialog */}
      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Remove shared boundary?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-600">
              Removing <strong>{milestone.display_name}</strong> will break the shared boundary
              between <strong>{endsPhase.display_name}</strong> and <strong>{startsPhase.display_name}</strong>.
              The two phases will no longer be connected at this milestone.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
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
