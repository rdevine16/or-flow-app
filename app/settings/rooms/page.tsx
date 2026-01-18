'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import { roomAudit } from '../../../lib/audit-logger'
import { useUser } from '../../../lib/UserContext'

interface ORRoom {
  id: string
  name: string
  deleted_at: string | null
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  room: ORRoom | null
}

export default function RoomsSettingsPage() {
  const supabase = createClient()
  
  // Use the context - this automatically handles impersonation!
  const { effectiveFacilityId, loading: userLoading } = useUser()
  
  const [rooms, setRooms] = useState<ORRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleted, setShowDeleted] = useState(false)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', room: null })
  const [formData, setFormData] = useState({ name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

  const openAddModal = () => {
    setFormData({ name: '' })
    setModal({ isOpen: true, mode: 'add', room: null })
  }

  const openEditModal = (room: ORRoom) => {
    setFormData({ name: room.name })
    setModal({ isOpen: true, mode: 'edit', room })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', room: null })
    setFormData({ name: '' })
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !effectiveFacilityId) return
    
    setSaving(true)

    if (modal.mode === 'add') {
      const { data, error } = await supabase
        .from('or_rooms')
        .insert({ name: formData.name.trim(), facility_id: effectiveFacilityId })
        .select('id, name, deleted_at')
        .single()

      if (!error && data) {
        setRooms([...rooms, data].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        
        // Audit log
        await roomAudit.created(supabase, formData.name.trim(), data.id)
      }
    } else if (modal.mode === 'edit' && modal.room) {
      const oldName = modal.room.name

      const { error } = await supabase
        .from('or_rooms')
        .update({ name: formData.name.trim() })
        .eq('id', modal.room.id)

      if (!error) {
        setRooms(
          rooms
            .map(r => r.id === modal.room!.id ? { ...r, name: formData.name.trim() } : r)
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        closeModal()
        
        // Audit log
        if (oldName !== formData.name.trim()) {
          await roomAudit.updated(supabase, modal.room.id, oldName, formData.name.trim())
        }
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
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
      setDeleteConfirm(null)
      
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
      
      // Audit log
      await roomAudit.restored(supabase, roomName, id)
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

              {/* Main Card */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-slate-900">Operating Rooms</h3>
                    <p className="text-sm text-slate-500">
                      {activeRooms.length} active room{activeRooms.length !== 1 ? 's' : ''}
                      {deletedRooms.length > 0 && (
                        <span className="text-slate-400"> · {deletedRooms.length} deleted</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={openAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Room
                  </button>
                </div>

                {/* Table */}
                {displayRooms.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <p className="text-slate-500">No rooms configured yet.</p>
                    <button
                      onClick={openAddModal}
                      className="mt-2 text-blue-600 hover:underline text-sm"
                    >
                      Add your first room
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-1">#</div>
                      <div className="col-span-7">Room Name</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                      {displayRooms.map((room, index) => {
                        const isDeleted = !!room.deleted_at

                        return (
                          <div 
                            key={room.id} 
                            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors ${
                              isDeleted ? 'bg-slate-50' : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Index */}
                            <div className="col-span-1">
                              <span className="text-sm text-slate-400">{index + 1}</span>
                            </div>

                            {/* Room Name */}
                            <div className="col-span-7">
                              <p className={`font-medium ${isDeleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {room.name}
                              </p>
                            </div>

                            {/* Status */}
                            <div className="col-span-2">
                              {isDeleted ? (
                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
                                  Deleted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Active
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex items-center justify-end gap-1">
                              {isDeleted ? (
                                <button
                                  onClick={() => handleRestore(room.id)}
                                  className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  Restore
                                </button>
                              ) : deleteConfirm === room.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(room.id)}
                                    className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => openEditModal(room)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(room.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal */}
          {modal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modal.mode === 'add' ? 'Add Room' : 'Edit Room'}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Room Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g., OR 1, OR 2, Main OR"
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Use a short, recognizable name for your OR staff
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.name.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Room' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}