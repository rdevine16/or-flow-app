'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import EditableList from '../../../components/settings/EditableList'
import { roomAudit } from '../../../lib/audit-logger'
import { useUser } from '../../../lib/UserContext'


interface ORRoom {
  id: string
  name: string
  deleted_at: string | null
}


export default function RoomsSettingsPage() {
  const supabase = createClient()
  
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()
  
  const [rooms, setRooms] = useState<ORRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleted, setShowDeleted] = useState(false)

  useEffect(() => {
    if (!userLoading && effectiveFacilityId) {
      fetchRooms()
    } else if (!userLoading && !effectiveFacilityId) {
      setLoading(false)
    }
  }, [userLoading, effectiveFacilityId])

  const fetchRooms = async () => {
    if (!effectiveFacilityId) return
    setLoading(true)
    const { data } = await supabase
      .from('or_rooms')
      .select('id, name, deleted_at')
      .eq('facility_id', effectiveFacilityId)
      .order('name')
    
    setRooms(data || [])
    setLoading(false)
  }

  const handleAdd = async (name: string) => {
    if (!effectiveFacilityId) return

    const { data, error } = await supabase
      .from('or_rooms')
      .insert({ name, facility_id: effectiveFacilityId })
      .select('id, name, deleted_at')
      .single()

    if (!error && data) {
      setRooms([...rooms, data].sort((a, b) => a.name.localeCompare(b.name)))
      
      // Audit log
      await roomAudit.created(supabase, name, data.id)
    }
  }

  const handleEdit = async (id: string, name: string) => {
    // Get old name for audit log
    const oldRoom = rooms.find(r => r.id === id)
    const oldName = oldRoom?.name || ''

    const { error } = await supabase
      .from('or_rooms')
      .update({ name })
      .eq('id', id)

    if (!error) {
      setRooms(
        rooms
          .map(r => r.id === id ? { ...r, name } : r)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      
      // Audit log
      if (oldName !== name) {
        await roomAudit.updated(supabase, id, oldName, name)
      }
    }
  }

const handleDelete = async (id: string) => {
    // Get room name for audit log
    const room = rooms.find(r => r.id === id)
    const roomName = room?.name || ''

    // Soft delete - set deleted_at timestamp
    const { error } = await supabase
      .from('or_rooms')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setRooms(rooms.map(r => 
        r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r
      ))
      
      // Audit log
      await roomAudit.deleted(supabase, roomName, id)
    }
  }

  const handleRestore = async (id: string) => {
    const room = rooms.find(r => r.id === id)
    const roomName = room?.name || ''

    const { error } = await supabase
      .from('or_rooms')
      .update({ deleted_at: null })
      .eq('id', id)

    if (!error) {
      setRooms(rooms.map(r => 
        r.id === id ? { ...r, deleted_at: null } : r
      ))
      
      // You could add an audit log for restore if desired
      // await roomAudit.restored(supabase, roomName, id)
    }
  }

  // Filter rooms based on showDeleted toggle
  const activeRooms = rooms.filter(r => !r.deleted_at)
  const deletedRooms = rooms.filter(r => r.deleted_at)
  const displayRooms = showDeleted ? rooms : activeRooms

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="OR Rooms"
          description="Manage the operating rooms available at your facility."
        >
          {loading || userLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : !effectiveFacilityId ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-500">No facility selected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Show deleted toggle */}
              {deletedRooms.length > 0 && (
                <div className="flex items-center justify-end">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDeleted}
                      onChange={(e) => setShowDeleted(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    Show deleted rooms ({deletedRooms.length})
                  </label>
                </div>
              )}

              {/* Room list */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Add new room input */}
                <div className="p-4 border-b border-slate-200">
                  <AddRoomInput onAdd={handleAdd} />
                </div>

                {/* Rooms list */}
                <div className="divide-y divide-slate-100">
                  {displayRooms.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      No rooms configured yet. Add your first room above.
                    </div>
                  ) : (
                    displayRooms.map((room, index) => (
                      <RoomRow
                        key={room.id}
                        room={room}
                        index={index + 1}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                      />
                    ))
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    {activeRooms.length} active room{activeRooms.length !== 1 ? 's' : ''}
                    {deletedRooms.length > 0 && (
                      <span className="text-slate-400"> · {deletedRooms.length} deleted</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}

// Add Room Input Component
function AddRoomInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onAdd(name.trim())
    setName('')
    setSaving(false)
  }

  return (
    <div className="flex gap-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="Enter room name (e.g., OR 1, OR 2)"
        className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || saving}
        className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Adding...' : 'Add'}
      </button>
    </div>
  )
}

// Room Row Component
function RoomRow({ 
  room, 
  index, 
  onEdit, 
  onDelete, 
  onRestore 
}: { 
  room: ORRoom
  index: number
  onEdit: (id: string, name: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(room.name)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isDeleted = !!room.deleted_at

  const handleSave = () => {
    if (editName.trim() && editName !== room.name) {
      onEdit(room.id, editName.trim())
    }
    setIsEditing(false)
  }

  return (
    <div className={`flex items-center gap-4 px-4 py-3 ${isDeleted ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'} transition-colors`}>
      <span className="text-sm text-slate-400 w-8">{index}.</span>
      
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          autoFocus
        />
      ) : (
        <span className={`flex-1 font-medium ${isDeleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
          {room.name}
        </span>
      )}

      {isDeleted ? (
        <button
          onClick={() => onRestore(room.id)}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Restore
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setEditName(room.name)
              setIsEditing(true)
            }}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onDelete(room.id)
                  setShowDeleteConfirm(false)
                }}
                className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}