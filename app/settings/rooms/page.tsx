// app/settings/rooms/page.tsx
// app/settings/rooms/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import SettingsLayout from '@/components/settings/SettingsLayout'
import { roomAudit } from '@/lib/audit-logger'
import { useUser } from '@/lib/UserContext'
import {
  useRoomSchedules,
  RoomDaySchedule,
  DAY_LABELS,
  DAY_LABELS_SHORT,
  getDefaultWeekSchedule,
} from '@/hooks/useRoomSchedules'
import { formatTime12Hour } from '@/types/block-scheduling'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// ============================================
// TYPES
// ============================================

interface ORRoom {
  id: string
  name: string
  available_hours: number | null
  deleted_at: string | null
  deleted_by: string | null
}

interface DeleteModalState {
  isOpen: boolean
  room: ORRoom | null
  dependencies: {
    cases: number
    blockSchedules: number
  }
  loading: boolean
}

interface ModalState {
  isOpen: boolean
  mode: 'add' | 'edit'
  room: ORRoom | null
}

// ============================================
// TIME OPTIONS (30-min increments)
// ============================================

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minutes = (i % 2) * 30
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
})


// ============================================
// ROOM SCHEDULE EDITOR COMPONENT
// ============================================

function RoomScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: RoomDaySchedule[]
  onChange: (schedule: RoomDaySchedule[]) => void
}) {
  const updateDay = (dayOfWeek: number, updates: Partial<RoomDaySchedule>) => {
    onChange(schedule.map(d =>
      d.dayOfWeek === dayOfWeek ? { ...d, ...updates } : d
    ))
  }

  // Apply one day's schedule to all weekdays
  const applyToWeekdays = (sourceDayOfWeek: number) => {
    const source = schedule.find(d => d.dayOfWeek === sourceDayOfWeek)
    if (!source) return

    onChange(schedule.map(d => {
      // Apply to Mon-Fri (1-5), skip the source day and weekends
      if (d.dayOfWeek >= 1 && d.dayOfWeek <= 5) {
        return { ...d, openTime: source.openTime, closeTime: source.closeTime, isClosed: source.isClosed }
      }
      return d
    }))
  }

  // Check if all weekdays have the same schedule
  const weekdays = schedule.filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 5)
  const allWeekdaysSame = weekdays.every(
    d => d.openTime === weekdays[0].openTime &&
         d.closeTime === weekdays[0].closeTime &&
         d.isClosed === weekdays[0].isClosed
  )

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="grid grid-cols-[100px_1fr_1fr_60px] gap-2 px-2 pb-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Day</span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Opens</span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Closes</span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Open?</span>
      </div>

      {/* Day rows — weekdays first, then weekend */}
      {[1, 2, 3, 4, 5, 6, 0].map(dayOfWeek => {
        const day = schedule.find(d => d.dayOfWeek === dayOfWeek)!
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        return (
          <div
            key={dayOfWeek}
            className={`grid grid-cols-[100px_1fr_1fr_60px] gap-2 items-center px-2 py-1.5 rounded-lg transition-colors ${
              day.isClosed
                ? 'bg-slate-50 opacity-60'
                : isWeekend
                  ? 'bg-blue-50/50'
                  : 'hover:bg-slate-50'
            }`}
          >
            {/* Day name */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${day.isClosed ? 'text-slate-400' : 'text-slate-700'}`}>
                {DAY_LABELS[dayOfWeek]}
              </span>
            </div>

            {/* Open time */}
            <select
              value={day.openTime}
              onChange={e => updateDay(dayOfWeek, { openTime: e.target.value })}
              disabled={day.isClosed}
              className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {TIME_OPTIONS.map(t => (
                <option key={t} value={t}>{formatTime12Hour(t)}</option>
              ))}
            </select>

            {/* Close time */}
            <select
              value={day.closeTime}
              onChange={e => updateDay(dayOfWeek, { closeTime: e.target.value })}
              disabled={day.isClosed}
              className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {TIME_OPTIONS.filter(t => t > day.openTime).map(t => (
                <option key={t} value={t}>{formatTime12Hour(t)}</option>
              ))}
            </select>

            {/* Open toggle */}
            <div className="flex justify-center">
              <button
                onClick={() => updateDay(dayOfWeek, { isClosed: !day.isClosed })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  day.isClosed ? 'bg-slate-300' : 'bg-blue-500'
                }`}
              >
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  day.isClosed ? 'left-0.5' : 'left-[22px]'
                }`} />
              </button>
            </div>
          </div>
        )
      })}

      {/* Apply to all weekdays button */}
      {!allWeekdaysSame && (
        <div className="pt-2">
          <button
            onClick={() => applyToWeekdays(1)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2"
          >
            Apply Monday's hours to all weekdays
          </button>
        </div>
      )}

      {/* Weekly summary */}
      <div className="pt-3 px-2 border-t border-slate-100 mt-2">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-slate-700">
              {schedule.filter(d => !d.isClosed).length}
            </span> days open
          </span>
          <span>
            <span className="font-semibold text-slate-700">
              {(() => {
                const openDays = schedule.filter(d => !d.isClosed)
                if (openDays.length === 0) return '0h'
                const totalMins = openDays.reduce((sum, d) => {
                  const [oh, om] = d.openTime.split(':').map(Number)
                  const [ch, cm] = d.closeTime.split(':').map(Number)
                  return sum + (ch * 60 + cm) - (oh * 60 + om)
                }, 0)
                return `${(totalMins / 60).toFixed(1)}h`
              })()}
            </span> total weekly hours
          </span>
        </div>
      </div>
    </div>
  )
}


// ============================================
// MAIN PAGE
// ============================================

export default function RoomsSettingsPage() {
  const supabase = createClient()
  const { showToast } = useToast()
  const { effectiveFacilityId, loading: userLoading } = useUser()

  const [rooms, setRooms] = useState<ORRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [showDeleted, setShowDeleted] = useState(false)
  const [modal, setModal] = useState<ModalState>({ isOpen: false, mode: 'add', room: null })
  const [formData, setFormData] = useState({ name: '' })
  const [formSchedule, setFormSchedule] = useState<RoomDaySchedule[]>(getDefaultWeekSchedule())
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    room: null,
    dependencies: { cases: 0, blockSchedules: 0 },
    loading: false,
  })

  const {
    fetchRoomSchedule,
    saveRoomSchedule,
    loading: scheduleLoading,
  } = useRoomSchedules({ facilityId: effectiveFacilityId })

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

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
      .select('id, name, available_hours, deleted_at, deleted_by')
      .eq('facility_id', effectiveFacilityId)
      .order('name')

    setRooms(data || [])
    setLoading(false)
  }

  // Show toast with auto-dismiss

  const openAddModal = () => {
    setFormData({ name: '' })
    setFormSchedule(getDefaultWeekSchedule())
    setModal({ isOpen: true, mode: 'add', room: null })
  }

  const openEditModal = async (room: ORRoom) => {
    setFormData({ name: room.name })
    // Load this room's current schedule
    const schedule = await fetchRoomSchedule(room.id)
    setFormSchedule(schedule)
    setModal({ isOpen: true, mode: 'edit', room })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', room: null })
    setFormData({ name: '' })
    setFormSchedule(getDefaultWeekSchedule())
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !effectiveFacilityId) return

    setSaving(true)

    if (modal.mode === 'add') {
      // Calculate legacy available_hours from schedule
      const openDays = formSchedule.filter(d => !d.isClosed)
      const avgHours = openDays.length > 0
        ? openDays.reduce((sum, d) => {
            const [oh, om] = d.openTime.split(':').map(Number)
            const [ch, cm] = d.closeTime.split(':').map(Number)
            return sum + (ch + cm / 60) - (oh + om / 60)
          }, 0) / openDays.length
        : 10

      const { data, error } = await supabase
        .from('or_rooms')
        .insert({
          name: formData.name.trim(),
          facility_id: effectiveFacilityId,
          available_hours: Math.round(avgHours * 10) / 10,
        })
        .select('id, name, available_hours, deleted_at, deleted_by')
        .single()

      if (!error && data) {
        // Save room schedule
        await saveRoomSchedule(data.id, formSchedule, undefined, data.name)

        setRooms([...rooms, data].sort((a, b) => a.name.localeCompare(b.name)))
        closeModal()
        showToast({ type: 'success', title: `${data.name} created` })
        await roomAudit.created(supabase, formData.name.trim(), data.id)
      } else {
        showToast({ type: 'error', title: 'Failed to create room' })
      }
    } else if (modal.mode === 'edit' && modal.room) {
      const oldName = modal.room.name

      const openDays = formSchedule.filter(d => !d.isClosed)
      const avgHours = openDays.length > 0
        ? openDays.reduce((sum, d) => {
            const [oh, om] = d.openTime.split(':').map(Number)
            const [ch, cm] = d.closeTime.split(':').map(Number)
            return sum + (ch + cm / 60) - (oh + om / 60)
          }, 0) / openDays.length
        : 10

      const { error } = await supabase
        .from('or_rooms')
        .update({
          name: formData.name.trim(),
          available_hours: Math.round(avgHours * 10) / 10,
        })
        .eq('id', modal.room.id)

      if (!error) {
        // Save room schedule
        await saveRoomSchedule(modal.room.id, formSchedule, undefined, formData.name.trim())

        setRooms(
          rooms
            .map(r => r.id === modal.room!.id
              ? { ...r, name: formData.name.trim(), available_hours: Math.round(avgHours * 10) / 10 }
              : r
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        closeModal()
        showToast({ type: 'success', title: `${formData.name.trim()} updated` })

        if (oldName !== formData.name.trim()) {
          await roomAudit.updated(supabase, modal.room.id, oldName, formData.name.trim())
        }
      } else {
        showToast({ type: 'error', title: 'Failed to update room' })
      }
    }

    setSaving(false)
  }

  const openDeleteModal = async (room: ORRoom) => {
    setDeleteModal({
      isOpen: true,
      room,
      dependencies: { cases: 0, blockSchedules: 0 },
      loading: true,
    })

    const [casesResult, blocksResult] = await Promise.all([
      supabase
        .from('cases')
        .select('id', { count: 'exact', head: true })
        .eq('or_room_id', room.id),
      supabase
        .from('block_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('or_room_id', room.id),
    ])

    setDeleteModal(prev => ({
      ...prev,
      dependencies: {
        cases: casesResult.count || 0,
        blockSchedules: blocksResult.count || 0,
      },
      loading: false,
    }))
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      room: null,
      dependencies: { cases: 0, blockSchedules: 0 },
      loading: false,
    })
  }

  const handleDelete = async () => {
    if (!deleteModal.room || !currentUserId) return

    setSaving(true)
    const { error } = await supabase
      .from('or_rooms')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId,
      })
      .eq('id', deleteModal.room.id)

    if (!error) {
      setRooms(rooms.map(r =>
        r.id === deleteModal.room!.id
          ? { ...r, deleted_at: new Date().toISOString(), deleted_by: currentUserId }
          : r
      ))
      closeDeleteModal()
      showToast({ type: 'success', title: `${deleteModal.room.name} archived` })
      await roomAudit.deleted(supabase, deleteModal.room.id, deleteModal.room.name)
    }
    setSaving(false)
  }

  const handleRestore = async (room: ORRoom) => {
    const { error } = await supabase
      .from('or_rooms')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', room.id)

    if (!error) {
      setRooms(rooms.map(r =>
        r.id === room.id ? { ...r, deleted_at: null, deleted_by: null } : r
      ))
      showToast({ type: 'success', title: `${room.name} restored` })
      await roomAudit.restored(supabase, room.id, room.name)
    }
  }

  // Separate active vs deleted rooms
  const activeRooms = rooms.filter(r => !r.deleted_at)
  const deletedRooms = rooms.filter(r => r.deleted_at)

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="OR Rooms"
          description="Manage the operating rooms and their daily schedules at your facility."
        >
          {loading || userLoading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <div className="max-w-3xl">
              {/* Add Room button */}
              <div className="flex justify-end mb-6">
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Room
                </button>
              </div>

              {/* Active Rooms */}
              {activeRooms.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-slate-500 font-medium">No rooms configured</p>
                  <p className="text-sm text-slate-400 mt-1">Add your first operating room to get started</p>
                  <button
                    onClick={openAddModal}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    + Add Room
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRooms.map(room => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900">{room.name}</span>
                          <p className="text-xs text-slate-500">
                            {room.available_hours ? `~${room.available_hours}h avg/day` : 'No hours set'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(room)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit room & schedule"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteModal(room)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Archive room"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Archived Rooms */}
              {deletedRooms.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowDeleted(!showDeleted)}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
                  >
                    <svg className={`w-4 h-4 transition-transform ${showDeleted ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {deletedRooms.length} archived room{deletedRooms.length !== 1 ? 's' : ''}
                  </button>
                  {showDeleted && (
                    <div className="mt-3 space-y-2">
                      {deletedRooms.map(room => (
                        <div
                          key={room.id}
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg opacity-60"
                        >
                          <span className="text-sm text-slate-500 line-through">{room.name}</span>
                          <button
                            onClick={() => handleRestore(room)}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Modal with Schedule Editor */}
          {modal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl z-10">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {modal.mode === 'add' ? 'Add Room' : 'Edit Room'}
                  </h3>
                </div>
                <div className="p-6 space-y-6">
                  {/* Room Name */}
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

                  {/* Weekly Schedule */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Operating Hours
                    </label>
                    <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                      <RoomScheduleEditor
                        schedule={formSchedule}
                        onChange={setFormSchedule}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Define when this room is available for cases — used for utilization analytics
                    </p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
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

          {/* Delete Confirmation Modal */}
          {deleteModal.isOpen && deleteModal.room && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900">Archive Room</h3>
                </div>
                <div className="p-6">
                  {deleteModal.loading ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-600 mb-4">
                        Are you sure you want to archive <span className="font-semibold text-slate-900">"{deleteModal.room.name}"</span>?
                      </p>
                      {(deleteModal.dependencies.cases > 0 || deleteModal.dependencies.blockSchedules > 0) && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                          <div className="flex gap-3">
                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                              <p className="font-medium text-amber-800">This room is in use:</p>
                              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                                {deleteModal.dependencies.cases > 0 && (
                                  <li>{deleteModal.dependencies.cases} case{deleteModal.dependencies.cases !== 1 ? 's' : ''}</li>
                                )}
                                {deleteModal.dependencies.blockSchedules > 0 && (
                                  <li>{deleteModal.dependencies.blockSchedules} block schedule{deleteModal.dependencies.blockSchedules !== 1 ? 's' : ''}</li>
                                )}
                              </ul>
                              <p className="mt-2 text-sm text-amber-700">
                                Archiving will hide it from new cases but existing data will be preserved.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-slate-500">You can restore archived rooms at any time.</p>
                    </>
                  )}
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                  <button onClick={closeDeleteModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={saving || deleteModal.loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Archiving...' : 'Archive Room'}
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