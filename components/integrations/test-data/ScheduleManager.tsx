'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { ehrTestDataDAL } from '@/lib/dal/ehr-test-data'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Loading'
import ScheduleEntryForm from './ScheduleEntryForm'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  CalendarClock,
  ArrowUpDown,
  Link2,
} from 'lucide-react'
import type {
  EhrTestScheduleWithEntities,
  EhrTestTriggerEvent,
} from '@/lib/integrations/shared/integration-types'

// -- Trigger event badge config -----------------------------------------------

function getTriggerBadgeVariant(event: EhrTestTriggerEvent): 'success' | 'info' | 'warning' | 'error' {
  switch (event) {
    case 'S12': return 'success'
    case 'S13': return 'info'
    case 'S14': return 'warning'
    case 'S15': return 'error'
    case 'S16': return 'error'
  }
}

function getTriggerLabel(event: EhrTestTriggerEvent): string {
  switch (event) {
    case 'S12': return 'New'
    case 'S13': return 'Resched'
    case 'S14': return 'Modify'
    case 'S15': return 'Cancel'
    case 'S16': return 'Discont'
  }
}

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr || '00'
  if (h === 0) return `12:${m} AM`
  if (h < 12) return `${h}:${m} AM`
  if (h === 12) return `12:${m} PM`
  return `${h - 12}:${m} PM`
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// -- Props --------------------------------------------------------------------

interface ScheduleManagerProps {
  facilityId: string
}

// -- Component ----------------------------------------------------------------

export default function ScheduleManager({ facilityId }: ScheduleManagerProps) {
  const supabase = createClient()
  const { showToast } = useToast()

  // UI state
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EhrTestScheduleWithEntities | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<EhrTestScheduleWithEntities | null>(null)
  const [deleteRefCount, setDeleteRefCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  // Fetch all schedules with joined entities
  const { data: schedules, loading, refetch } = useSupabaseQuery<EhrTestScheduleWithEntities[]>(
    async (sb) => {
      const { data, error } = await ehrTestDataDAL.listSchedules(sb, facilityId)
      if (error) throw error
      return data
    },
    { enabled: !!facilityId, deps: [facilityId] }
  )

  // Filter by search
  const filteredSchedules = (schedules || []).filter((s) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const patientName = s.patient ? `${s.patient.last_name} ${s.patient.first_name}`.toLowerCase() : ''
    const surgeonName = s.surgeon?.name?.toLowerCase() || ''
    const procName = s.procedure?.name?.toLowerCase() || ''
    const roomName = s.room?.name?.toLowerCase() || ''
    const caseId = s.external_case_id?.toLowerCase() || ''
    const noteText = s.notes?.toLowerCase() || ''
    return (
      patientName.includes(term) ||
      surgeonName.includes(term) ||
      procName.includes(term) ||
      roomName.includes(term) ||
      caseId.includes(term) ||
      noteText.includes(term) ||
      s.trigger_event.toLowerCase().includes(term)
    )
  })

  // Add handler
  const handleAdd = () => {
    setEditingSchedule(null)
    setShowForm(true)
  }

  // Edit handler
  const handleEdit = (schedule: EhrTestScheduleWithEntities) => {
    setEditingSchedule(schedule)
    setShowForm(true)
  }

  // Delete click — count references first
  const handleDeleteClick = async (schedule: EhrTestScheduleWithEntities) => {
    // Count how many other schedules reference this one (only relevant for S12 entries)
    if (schedule.trigger_event === 'S12') {
      const { count, error } = await supabase
        .from('ehr_test_schedules')
        .select('id', { count: 'exact', head: true })
        .eq('references_schedule_id', schedule.id)

      if (!error) {
        setDeleteRefCount(count ?? 0)
      }
    } else {
      setDeleteRefCount(0)
    }
    setDeleteTarget(schedule)
  }

  // Execute delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await ehrTestDataDAL.deleteSchedule(supabase, deleteTarget.id)
      if (error) throw error
      showToast({ type: 'success', title: 'Schedule entry deleted' })
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      showToast({ type: 'error', title: err instanceof Error ? err.message : 'Failed to delete schedule entry' })
    } finally {
      setDeleting(false)
    }
  }

  // On form saved
  const handleSaved = () => {
    showToast({ type: 'success', title: editingSchedule ? 'Schedule entry updated' : 'Schedule entry added' })
    refetch()
  }

  if (!facilityId) {
    return (
      <Card>
        <div className="py-12 text-center text-slate-500">
          <CalendarClock className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">Select a facility above</p>
          <p className="text-xs text-slate-400 mt-1">Schedule data is scoped per facility</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Schedule Entries</h3>
              <Badge variant="default" size="sm">{schedules?.length ?? 0}</Badge>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient, surgeon, procedure, room, case ID, or notes..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredSchedules.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              {searchTerm
                ? 'No schedule entries match your search'
                : 'No schedule entries yet. Click "Add Entry" to build your test scenario.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-12" title="Sequence #">
                      <ArrowUpDown className="w-3.5 h-3.5 inline" />
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-20">Event</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">Patient</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">Surgeon</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">Procedure</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">Room</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500">Time</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-14">Dur</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-500 w-14">Ref</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-500 w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 group">
                      <td className="py-2 px-2 text-slate-500 font-mono text-xs">
                        {s.sequence_order}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={getTriggerBadgeVariant(s.trigger_event)} size="sm">
                          {s.trigger_event} {getTriggerLabel(s.trigger_event)}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-slate-900">
                        <div className="font-medium truncate max-w-[120px]">
                          {s.patient ? `${s.patient.last_name}, ${s.patient.first_name}` : '—'}
                        </div>
                        {s.patient?.mrn && (
                          <div className="text-xs text-slate-400 font-mono">{s.patient.mrn}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-700 truncate max-w-[100px]">
                        {s.surgeon?.name || '—'}
                      </td>
                      <td className="py-2 px-2 text-slate-700">
                        <div className="truncate max-w-[120px]">{s.procedure?.name || '—'}</div>
                        {s.procedure?.cpt_code && (
                          <div className="text-xs text-slate-400 font-mono">{s.procedure.cpt_code}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-700 truncate max-w-[80px]">
                        {s.room?.name || '—'}
                      </td>
                      <td className="py-2 px-2 text-slate-700 whitespace-nowrap">
                        {formatDate(s.scheduled_date)}
                      </td>
                      <td className="py-2 px-2 text-slate-700 whitespace-nowrap font-mono text-xs">
                        {formatTime12h(s.start_time)}
                      </td>
                      <td className="py-2 px-2 text-slate-600 text-xs">
                        {s.duration_min}m
                      </td>
                      <td className="py-2 px-2">
                        {s.referenced_schedule ? (
                          <span
                            className="inline-flex items-center gap-0.5 text-xs text-blue-600"
                            title={`References ${s.referenced_schedule.external_case_id || s.referenced_schedule.id.slice(0, 8)}`}
                          >
                            <Link2 className="w-3 h-3" />
                            {s.referenced_schedule.external_case_id?.replace('TEST-', '') || '...'}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(s)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(s)}
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

          {/* Notes column (shown below table if any entries have notes) */}
          {filteredSchedules.some((s) => s.notes) && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-1">Notes</p>
              <div className="space-y-1">
                {filteredSchedules
                  .filter((s) => s.notes)
                  .map((s) => (
                    <div key={s.id} className="text-xs text-slate-500 flex gap-2">
                      <Badge variant={getTriggerBadgeVariant(s.trigger_event)} size="sm">
                        {s.trigger_event}
                      </Badge>
                      <span className="font-mono text-slate-400">{s.external_case_id || '—'}</span>
                      <span>{s.notes}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Form Modal */}
      <ScheduleEntryForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={handleSaved}
        facilityId={facilityId}
        editingSchedule={editingSchedule}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        title="Delete schedule entry?"
        message={
          deleteRefCount > 0
            ? `This S12 entry is referenced by ${deleteRefCount} other schedule ${deleteRefCount === 1 ? 'entry' : 'entries'}. Deleting it will remove those references (entries will remain but lose their link).`
            : `Delete this ${deleteTarget?.trigger_event || ''} schedule entry for ${
                deleteTarget?.patient
                  ? `${deleteTarget.patient.last_name}, ${deleteTarget.patient.first_name}`
                  : 'unknown patient'
              }?`
        }
        loading={deleting}
      />
    </>
  )
}
