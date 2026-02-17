// components/dashboard/RoomOrderModal.tsx
// Modal for reordering OR rooms with drag-and-drop

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRoomOrdering, OrderableRoom } from '@/hooks/useRoomOrdering'
import { AlertCircle, AlertTriangle, ArrowUpDown, Building2, Loader2, X } from 'lucide-react'

interface RoomOrderModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string | null
  onSaved?: () => void
}

// Sortable Room Item Component
function SortableRoomItem({ room, index }: { room: OrderableRoom; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 bg-white border rounded-xl
        ${isDragging 
          ? 'border-blue-500 shadow-lg ring-2 ring-blue-500/20 z-50' 
          : 'border-slate-200 hover:border-slate-300'
        }
        transition-colors
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Position Badge */}
      <span className="w-7 h-7 flex items-center justify-center bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg">
        {index + 1}
      </span>

      {/* Room Icon */}
      <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Building2 className="w-4.5 h-4.5 text-green-600" />
      </div>

      {/* Room Name */}
      <span className="font-medium text-slate-900 flex-1">{room.name}</span>

      {/* Drag Hint Icon */}
      <div className="text-slate-300">
        <ArrowUpDown className="w-5 h-5" />
      </div>
    </div>
  )
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl animate-pulse">
          <div className="w-8 h-8 bg-slate-200 rounded" />
          <div className="w-7 h-7 bg-slate-200 rounded-lg" />
          <div className="w-9 h-9 bg-slate-200 rounded-lg" />
          <div className="h-4 bg-slate-200 rounded flex-1" />
        </div>
      ))}
    </div>
  )
}

// Main Modal Component
export default function RoomOrderModal({ isOpen, onClose, facilityId, onSaved }: RoomOrderModalProps) {
  const { rooms, loading, saving, error, reorderRooms, refreshRooms } = useRoomOrdering({ facilityId })
  const [localRooms, setLocalRooms] = useState<OrderableRoom[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sync local state with fetched rooms
  useEffect(() => {
    if (rooms.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalRooms(rooms)
      setHasChanges(false)
    }
  }, [rooms])

  // Refresh rooms when modal opens
  useEffect(() => {
    if (isOpen && facilityId) {
      refreshRooms()
    }
  }, [isOpen, facilityId, refreshRooms])

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalRooms((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        setHasChanges(true)
        return newItems
      })
    }
  }

  // Handle save
  const handleSave = async () => {
    const success = await reorderRooms(localRooms)
    if (success) {
      setHasChanges(false)
      onSaved?.()
      onClose()
    }
  }

  // Handle cancel
  const handleCancel = useCallback(() => {
    setLocalRooms(rooms) // Reset to original order
    setHasChanges(false)
    onClose()
  }, [rooms, onClose])

  // Reset order to alphabetical
  const handleResetAlphabetical = () => {
    const sorted = [...localRooms].sort((a, b) => a.name.localeCompare(b.name))
    setLocalRooms(sorted)
    setHasChanges(true)
  }

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, handleCancel])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reorder OR Rooms</h2>
            <p className="text-sm text-slate-500 mt-0.5">Drag rooms to change display order on dashboard</p>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <LoadingSkeleton />
          ) : localRooms.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No rooms configured</p>
              <p className="text-sm text-slate-400 mt-1">Add rooms in Settings to get started</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={localRooms.map(r => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {localRooms.map((room, index) => (
                    <SortableRoomItem key={room.id} room={room} index={index} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex-shrink-0 bg-slate-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <button
              onClick={handleResetAlphabetical}
              disabled={loading || saving || localRooms.length === 0}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Reset A-Z
            </button>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving || loading}
                className={`
                  px-4 py-2.5 rounded-xl font-medium transition-all
                  ${hasChanges
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Order'
                )}
              </button>
            </div>
          </div>
          
          {/* Unsaved Changes Hint */}
          {hasChanges && (
            <p className="text-xs text-amber-700 mt-3 text-center flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              You have unsaved changes
            </p>
          )}
        </div>
      </div>
    </div>
  )
}