// components/settings/SortableList.tsx
'use client'

import { useState } from 'react'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Item {
  id: string
  name: string
  display_name: string
  display_order: number
}

interface SortableItemProps {
  item: Item
  index: number
  editingId: string | null
  editingName: string
  onStartEdit: (item: Item) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  onEditingNameChange: (name: string) => void
  onDelete: (item: Item) => void
  showDisplayName?: boolean
}

function SortableItem({
  item,
  index,
  editingId,
  editingName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditingNameChange,
  onDelete,
  showDisplayName = false,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 px-4 py-3 bg-white border-b border-slate-100 last:border-b-0 group ${
        isDragging ? 'shadow-lg ring-2 ring-teal-500/20 z-50 rounded-lg' : ''
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </button>

      {/* Order Number */}
      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-semibold text-slate-500">
        {index + 1}
      </div>

      {/* Content */}
      {editingId === item.id ? (
        <div className="flex-1 flex items-center gap-3">
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit(item.id)
              if (e.key === 'Escape') onCancelEdit()
            }}
            autoFocus
            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          <button
            onClick={() => onSaveEdit(item.id)}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={onCancelEdit}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <span className="text-slate-900 font-medium">
              {showDisplayName ? item.display_name || item.name : item.name}
            </span>
            {showDisplayName && item.name && (
              <span className="ml-2 text-xs text-slate-400 font-mono">({item.name})</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onStartEdit(item)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(item)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
          </div>
        </>
      )}
    </div>
  )
}

interface SortableListProps {
  items: Item[]
  onAdd: (name: string, displayName: string) => Promise<void>
  onEdit: (id: string, name: string, displayName: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReorder: (items: Item[]) => Promise<void>
  itemLabel: string
  placeholder?: string
  showDisplayName?: boolean
}

export default function SortableList({
  items,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  itemLabel,
  placeholder = 'Enter name...',
  showDisplayName = false,
}: SortableListProps) {
  const [newItemName, setNewItemName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        display_order: index + 1,
      }))
      await onReorder(newItems)
    }
  }

  const handleAdd = async () => {
    if (!newDisplayName.trim()) return
    setAddLoading(true)
    const name = newItemName.trim() || newDisplayName.trim().toLowerCase().replace(/\s+/g, '_')
    await onAdd(name, newDisplayName.trim())
    setNewItemName('')
    setNewDisplayName('')
    setAddLoading(false)
  }

  const handleEdit = async (id: string) => {
    if (!editingName.trim()) return
    const item = items.find((i) => i.id === id)
    await onEdit(id, item?.name || '', editingName.trim())
    setEditingId(null)
    setEditingName('')
  }

  const startEditing = (item: Item) => {
    setEditingId(item.id)
    setEditingName(showDisplayName ? item.display_name || item.name : item.name)
    setDeleteTarget(null)
  }

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      {/* Add New Item */}
      <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-300">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {showDisplayName && (
            <div className="flex-1">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Internal name (e.g., patient_in)"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
              />
            </div>
          )}
          <div className="flex-1">
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={showDisplayName ? 'Display name (e.g., Patient In Room)' : placeholder}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={addLoading || !newDisplayName.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {addLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Add {itemLabel}
          </button>
        </div>
        {showDisplayName && (
          <p className="text-xs text-slate-500 mt-2">
            Internal name is used in code/reports. Display name is shown to users.
          </p>
        )}
      </div>

      {/* Drag & Drop Hint */}
      {items.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Drag items to reorder
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">No {itemLabel.toLowerCase()}s yet</p>
          <p className="text-slate-400 text-xs mt-1">Add your first one above</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {items.map((item, index) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  index={index}
                  editingId={editingId}
                  editingName={editingName}
                  onStartEdit={startEditing}
                  onSaveEdit={handleEdit}
                  onCancelEdit={() => {
                    setEditingId(null)
                    setEditingName('')
                  }}
                  onEditingNameChange={setEditingName}
                  onDelete={(item) => setDeleteTarget(item)}
                  showDisplayName={showDisplayName}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Count */}
      {items.length > 0 && (
        <p className="text-sm text-slate-400">
          {items.length} {itemLabel.toLowerCase()}{items.length !== 1 ? 's' : ''} total
        </p>
      )}

      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id)
        }}
        itemName={deleteTarget?.display_name || deleteTarget?.name || ''}
        itemType={itemLabel.toLowerCase()}
      />
    </div>
  )
}