'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Loading'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import type { EhrTestRoom, EhrTestRoomInsert, EhrTestRoomUpdate, EhrTestRoomType } from '@/lib/integrations/shared/integration-types'

const ROOM_TYPES: { value: EhrTestRoomType; label: string }[] = [
  { value: 'operating_room', label: 'Operating Room' },
  { value: 'endo_suite', label: 'Endo Suite' },
  { value: 'cath_lab', label: 'Cath Lab' },
  { value: 'minor_procedure_room', label: 'Minor Procedure Room' },
]

interface RoomPoolProps {
  facilityId: string
}

export default function RoomPool({ facilityId }: RoomPoolProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<EhrTestRoom | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<EhrTestRoom | null>(null)
  const [deleteRefCount, setDeleteRefCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const [formName, setFormName] = useState('')
  const [formLocationCode, setFormLocationCode] = useState('')
  const [formRoomType, setFormRoomType] = useState<EhrTestRoomType | ''>('')

  const { data: rooms, loading, refetch } = useSupabaseQuery<EhrTestRoom[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listRooms(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId, deps: [facilityId] }
  )

  const filteredRooms = (rooms || []).filter((r) =>
    !searchTerm ||
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.location_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoomTypeLabel = (type: string | null) => {
    if (!type) return '—'
    return ROOM_TYPES.find((t) => t.value === type)?.label || type
  }

  const handleAdd = () => {
    setEditingRoom(null)
    setFormName('')
    setFormLocationCode('')
    setFormRoomType('')
    setShowForm(true)
  }

  const handleEdit = (room: EhrTestRoom) => {
    setEditingRoom(room)
    setFormName(room.name)
    setFormLocationCode(room.location_code || '')
    setFormRoomType(room.room_type || '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)

    try {
      if (editingRoom) {
        const updates: EhrTestRoomUpdate = {
          name: formName.trim(),
          location_code: formLocationCode.trim() || null,
          room_type: (formRoomType as EhrTestRoomType) || null,
        }
        const { error } = await ehrTestDataDAL.updateRoom(supabase, editingRoom.id, updates)
        if (error) throw error
        showToast({ type: 'success', title: 'Room updated' })
      } else {
        const insert: EhrTestRoomInsert = {
          facility_id: facilityId,
          name: formName.trim(),
          location_code: formLocationCode.trim() || undefined,
          room_type: (formRoomType as EhrTestRoomType) || undefined,
        }
        const { error } = await ehrTestDataDAL.createRoom(supabase, insert)
        if (error) throw error
        showToast({ type: 'success', title: 'Room added' })
      }
      setShowForm(false)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to save room' })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = async (room: EhrTestRoom) => {
    const { data: count } = await ehrTestDataDAL.countRoomScheduleRefs(supabase, room.id)
    setDeleteRefCount(count ?? 0)
    setDeleteTarget(room)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await ehrTestDataDAL.deleteRoom(supabase, deleteTarget.id)
      if (error) throw error
      showToast({ type: 'success', title: 'Room deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete room' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Rooms</h3>
              <Badge variant="default" size="sm">{rooms?.length ?? 0}</Badge>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or location code..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {searchTerm ? 'No rooms match your search' : 'No rooms yet. Click "Add Room" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Location Code</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-500">Type</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-500 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRooms.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{r.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{r.location_code || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{getRoomTypeLabel(r.room_type)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(r)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(r)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingRoom ? 'Edit Room' : 'Add Room'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="OR-3"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location Code</label>
            <input
              type="text"
              value={formLocationCode}
              onChange={(e) => setFormLocationCode(e.target.value)}
              placeholder="OR3 (Epic AIL segment value)"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
            <select
              value={formRoomType}
              onChange={(e) => setFormRoomType(e.target.value as EhrTestRoomType | '')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select type...</option>
              {ROOM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <Modal.Footer>
          <Modal.Cancel onClick={() => setShowForm(false)} />
          <Modal.Action onClick={handleSave} loading={saving} disabled={!formName.trim()}>
            {editingRoom ? 'Save Changes' : 'Add Room'}
          </Modal.Action>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        title="Delete room?"
        message={
          deleteRefCount > 0
            ? `This will also delete ${deleteRefCount} schedule ${deleteRefCount === 1 ? 'entry' : 'entries'} that reference "${deleteTarget?.name}".`
            : `Are you sure you want to delete "${deleteTarget?.name}"?`
        }
        loading={deleting}
      />
    </>
  )
}
