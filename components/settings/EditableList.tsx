// components/settings/EditableList.tsx
'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'

interface Item {
  id: string
  name: string
  display_name?: string
}

interface EditableListProps {
  items: Item[]
  onAdd: (name: string) => Promise<void>
  onUpdate: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  placeholder?: string
  showDisplayName?: boolean
}

export default function EditableList({
  items,
  onAdd,
  onUpdate,
  onDelete,
  placeholder = 'Enter name...',
  showDisplayName = false,
}: EditableListProps) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [loading, setLoading] = useState(false)
const { showToast } = useToast()
  const handleAdd = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      await onAdd(newName.trim())
      setNewName('')
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to add item',
        message: error instanceof Error ? error.message : 'Failed to add item'
      })
    }
    setLoading(false)
  }

  const handleUpdate = async (id: string) => {
    if (!editValue.trim()) return
    setLoading(true)
    try {
      await onUpdate(id, editValue.trim())
      setEditingId(null)
      setEditValue('')
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update item'
      })
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    setLoading(true)
    try {
      await onDelete(id)
      setDeleteTarget(null)
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'This item may be in use by existing cases'
      })
    }
    setLoading(false)
  }

  const startEditing = (item: Item) => {
    setEditingId(item.id)
    setEditValue(item.name)
    setDeleteTarget(null)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div className="space-y-3">
      {/* Add New Item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || loading}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <p className="text-sm text-slate-500">No items yet</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 group">
              <span className="text-xs text-slate-400 w-6">{index + 1}.</span>
              
              {editingId === item.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item.id)
                      if (e.key === 'Escape') cancelEditing()
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdate(item.id)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    {showDisplayName && item.display_name && (
                      <p className="text-xs text-slate-500">{item.display_name}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditing(item)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Count */}
      {items.length > 0 && (
        <p className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
      )}
      <DeleteConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id)
        }}
        itemName={deleteTarget?.display_name || deleteTarget?.name || ''}
        itemType="item"
        loading={loading}
      />
    </div>
  )
}