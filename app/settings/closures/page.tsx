// app/settings/closures/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { useFacilityClosures } from '@/hooks/useFacilityClosures'
import {
  FacilityHoliday,
  FacilityClosure,
  CreateHolidayInput,
  CreateClosureInput,
  getHolidayDateDescription,
  MONTH_LABELS,
  DAY_OF_WEEK_LABELS,
} from '@/types/block-scheduling'
import {
  Plus,
  Calendar,
  CalendarX,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Check,
  ChevronRight,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { DeleteConfirm } from '@/components/ui/ConfirmDialog'
import { PageLoader } from '@/components/ui/Loading'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { logger } from '@/lib/logger'

const log = logger('page')

// Week options for dynamic holidays
const WEEK_OPTIONS = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: 5, label: 'Last' },
]

export default function FacilityClosuresPage() {
  const router = useRouter()
  const supabase = createClient()

  // Auth & facility
  const [facilityId, setFacilityId] = useState<string | null>(null)
  const [facilityName, setFacilityName] = useState<string>('')
  const [pageLoading, setPageLoading] = useState(true)

  // Dialog state
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false)
  const [closureDialogOpen, setClosureDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<FacilityHoliday | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'holiday' | 'closure', id: string, name: string } | null>(null)

  // Hook
  const {
    holidays,
    closures,
    loading,
    error,
    fetchHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    toggleHoliday,
    fetchClosures,
    createClosure,
    deleteClosure,
  } = useFacilityClosures({ facilityId })

  // Load user and facility
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('facility_id, facilities(name)')
          .eq('id', user.id)
          .single()

        if (userErr) throw userErr

        if (userData?.facility_id) {
          setFacilityId(userData.facility_id)
          const facilityData = userData.facilities as any
          setFacilityName(facilityData?.name || '')
        }
      } catch (err) {
        log.error('Failed to load user:', err)
      } finally {
        setPageLoading(false)
      }
    }
    loadUser()
  }, [supabase, router])

  // Load data when facility is set
  useEffect(() => {
    if (facilityId) {
      fetchHolidays()
      fetchClosures()
    }
  }, [facilityId, fetchHolidays, fetchClosures])

  // Handlers
  const handleCreateHoliday = async (input: CreateHolidayInput) => {
    const result = await createHoliday(input)
    if (result) {
      setHolidayDialogOpen(false)
    }
  }

  const handleUpdateHoliday = async (input: CreateHolidayInput) => {
    if (!editingHoliday) return
    const result = await updateHoliday(editingHoliday.id, input, editingHoliday)
    if (result) {
      setEditingHoliday(null)
      setHolidayDialogOpen(false)
    }
  }

  const handleDeleteHoliday = async (id: string, name: string) => {
    await deleteHoliday(id, name)
    setDeleteTarget(null)
  }

  const handleCreateClosure = async (input: CreateClosureInput) => {
    const result = await createClosure(input)
    if (result) {
      setClosureDialogOpen(false)
    }
  }

  const handleDeleteClosure = async (id: string, date: string) => {
    await deleteClosure(id, date)
    setDeleteTarget(null)
  }

  // Get next occurrence of a holiday
  const getNextOccurrence = (holiday: FacilityHoliday): string => {
    const now = new Date()
    const currentYear = now.getFullYear()

    for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
      const year = currentYear + yearOffset
      let date: Date | null = null

      if (holiday.day !== null) {
        // Fixed date
        date = new Date(year, holiday.month - 1, holiday.day)
      } else if (holiday.week_of_month !== null && holiday.day_of_week !== null) {
        // Dynamic date
        date = getNthWeekdayOfMonth(year, holiday.month - 1, holiday.day_of_week, holiday.week_of_month)
      }

      if (date && date >= now) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    }

    return 'N/A'
  }

  // Helper to get nth weekday of month
  const getNthWeekdayOfMonth = (year: number, month: number, dayOfWeek: number, week: number): Date | null => {
    if (week === 5) {
      // Last occurrence
      const lastDay = new Date(year, month + 1, 0)
      let date = lastDay.getDate()
      while (new Date(year, month, date).getDay() !== dayOfWeek) {
        date--
      }
      return new Date(year, month, date)
    }

    const firstDay = new Date(year, month, 1)
    let firstOccurrence = 1 + ((dayOfWeek - firstDay.getDay() + 7) % 7)
    const targetDate = firstOccurrence + (week - 1) * 7

    if (targetDate > new Date(year, month + 1, 0).getDate()) {
      return null
    }

    return new Date(year, month, targetDate)
  }

  // Separate active and inactive holidays
  const activeHolidays = holidays.filter(h => h.is_active)
  const inactiveHolidays = holidays.filter(h => !h.is_active)

  // Separate past and future closures
  const today = new Date().toISOString().split('T')[0]
  const upcomingClosures = closures.filter(c => c.closure_date >= today)
  const pastClosures = closures.filter(c => c.closure_date < today)

  return (
    <DashboardLayout>
      {pageLoading ? (
        <PageLoader message="Loading closures..." />
      ) : (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Facility Closures</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage recurring holidays and one-off closures for {facilityName}
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recurring Holidays Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Recurring Holidays</h2>
                    <p className="text-sm text-slate-500">Annual closures that repeat every year</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setEditingHoliday(null)
                    setHolidayDialogOpen(true)
                  }}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Holiday
                </Button>
              </div>

              <div className="divide-y divide-slate-100">
                {holidays.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No holidays defined yet</p>
                    <button
                      onClick={() => {
                        setEditingHoliday(null)
                        setHolidayDialogOpen(true)
                      }}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Add your first holiday
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Active Holidays */}
                    {activeHolidays.map(holiday => (
                      <HolidayRow
                        key={holiday.id}
                        holiday={holiday}
                        nextOccurrence={getNextOccurrence(holiday)}
                        onEdit={() => {
                          setEditingHoliday(holiday)
                          setHolidayDialogOpen(true)
                        }}
                        onToggle={() => toggleHoliday(holiday.id, holiday.name, false)}
                        onDelete={() => setDeleteTarget({ type: 'holiday', id: holiday.id, name: holiday.name })}
                        loading={loading}
                      />
                    ))}

                    {/* Inactive Holidays */}
                    {inactiveHolidays.length > 0 && (
                      <>
                        <div className="px-6 py-2 bg-slate-50">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Inactive
                          </span>
                        </div>
                        {inactiveHolidays.map(holiday => (
                          <HolidayRow
                            key={holiday.id}
                            holiday={holiday}
                            nextOccurrence={getNextOccurrence(holiday)}
                            onEdit={() => {
                              setEditingHoliday(holiday)
                              setHolidayDialogOpen(true)
                            }}
                            onToggle={() => toggleHoliday(holiday.id, holiday.name, true)}
                            onDelete={() => setDeleteTarget({ type: 'holiday', id: holiday.id, name: holiday.name })}
                            loading={loading}
                            inactive
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* One-Off Closures Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <CalendarX className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">One-Off Closures</h2>
                    <p className="text-sm text-slate-500">Specific dates the facility is closed</p>
                  </div>
                </div>
                <Button
                  onClick={() => setClosureDialogOpen(true)}
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Closure
                </Button>
              </div>

              <div className="divide-y divide-slate-100">
                {closures.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <CalendarX className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No closures scheduled</p>
                    <button
                      onClick={() => setClosureDialogOpen(true)}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Add a closure date
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Upcoming Closures */}
                    {upcomingClosures.map(closure => (
                      <ClosureRow
                        key={closure.id}
                        closure={closure}
                        onDelete={() => setDeleteTarget({ type: 'closure', id: closure.id, name: closure.closure_date })}
                        loading={loading}
                      />
                    ))}

                    {/* Past Closures */}
                    {pastClosures.length > 0 && (
                      <>
                        <div className="px-6 py-2 bg-slate-50">
                          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Past
                          </span>
                        </div>
                        {pastClosures.slice(0, 5).map(closure => (
                          <ClosureRow
                            key={closure.id}
                            closure={closure}
                            onDelete={() => setDeleteTarget({ type: 'closure', id: closure.id, name: closure.closure_date })}
                            loading={loading}
                            past
                          />
                        ))}
                        {pastClosures.length > 5 && (
                          <div className="px-6 py-3 text-center">
                            <span className="text-sm text-slate-500">
                              + {pastClosures.length - 5} more past closures
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Holiday Dialog */}
          <HolidayDialog
            open={holidayDialogOpen}
            onClose={() => {
              setHolidayDialogOpen(false)
              setEditingHoliday(null)
            }}
            onSave={editingHoliday ? handleUpdateHoliday : handleCreateHoliday}
            editingHoliday={editingHoliday}
            loading={loading}
          />

          {/* Closure Dialog */}
          <ClosureDialog
            open={closureDialogOpen}
            onClose={() => setClosureDialogOpen(false)}
            onSave={handleCreateClosure}
            loading={loading}
          />
        </div>
      )}
      <DeleteConfirm
            open={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={async () => {
              if (!deleteTarget) return
              if (deleteTarget.type === 'holiday') {
                await handleDeleteHoliday(deleteTarget.id, deleteTarget.name)
              } else {
                await handleDeleteClosure(deleteTarget.id, deleteTarget.name)
              }
            }}
            itemName={deleteTarget?.name || ''}
            itemType={deleteTarget?.type === 'holiday' ? 'holiday' : 'closure date'}
          />
    </DashboardLayout>
  )
}

// ============================================================
// HOLIDAY ROW COMPONENT
// ============================================================

interface HolidayRowProps {
  holiday: FacilityHoliday
  nextOccurrence: string
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  loading: boolean
  inactive?: boolean
}

function HolidayRow({
  holiday,
  nextOccurrence,
  onEdit,
  onToggle,
  onDelete,
  loading,
  inactive,
}: HolidayRowProps) {

  return (
    <div className={`px-6 py-4 ${inactive ? 'bg-slate-50/50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Toggle */}
          <Toggle
            checked={holiday.is_active}
            onChange={onToggle}
            disabled={loading}
            size="sm"
            aria-label={`Toggle ${holiday.name}`}
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${inactive ? 'text-slate-500' : 'text-slate-900'}`}>
              {holiday.name}
            </p>
            <p className="text-sm text-slate-500 truncate">
              {getHolidayDateDescription(holiday)}
            </p>
          </div>

          {/* Next occurrence */}
          {!inactive && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-slate-400">Next</p>
              <p className="text-sm font-medium text-slate-700">{nextOccurrence}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-4">
            <>
              <button
                onClick={onEdit}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CLOSURE ROW COMPONENT
// ============================================================

interface ClosureRowProps {
  closure: FacilityClosure
  onDelete: () => void
  loading: boolean
  past?: boolean
}

function ClosureRow({
  closure,
  onDelete,
  loading,
  past,
}: ClosureRowProps) {
  const date = new Date(closure.closure_date + 'T00:00:00')
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  // Days until closure
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const closureDate = new Date(closure.closure_date + 'T00:00:00')
  const daysUntil = Math.ceil((closureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className={`px-6 py-4 ${past ? 'bg-slate-50/50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Date badge */}
          <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg ${
            past ? 'bg-slate-100' : 'bg-red-50'
          }`}>
            <span className={`text-xs font-medium ${past ? 'text-slate-500' : 'text-red-600'}`}>
              {date.toLocaleDateString('en-US', { month: 'short' })}
            </span>
            <span className={`text-lg font-bold ${past ? 'text-slate-600' : 'text-red-700'}`}>
              {date.getDate()}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${past ? 'text-slate-500' : 'text-slate-900'}`}>
              {formattedDate}
            </p>
            {closure.reason && (
              <p className="text-sm text-slate-500 truncate">{closure.reason}</p>
            )}
          </div>

          {/* Days until */}
          {!past && (
            <div className="hidden sm:block">
              {daysUntil === 0 ? (
                <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                  Today
                </span>
              ) : daysUntil === 1 ? (
                <span className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                  Tomorrow
                </span>
              ) : daysUntil <= 7 ? (
                <span className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">
                  In {daysUntil} days
                </span>
              ) : (
                <span className="text-sm text-slate-500">In {daysUntil} days</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-4">
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HOLIDAY DIALOG
// ============================================================

interface HolidayDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: CreateHolidayInput) => void
  editingHoliday: FacilityHoliday | null
  loading: boolean
}

function HolidayDialog({ open, onClose, onSave, editingHoliday, loading }: HolidayDialogProps) {
  const [name, setName] = useState('')
  const [dateType, setDateType] = useState<'fixed' | 'dynamic'>('fixed')
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [weekOfMonth, setWeekOfMonth] = useState(1)
  const [dayOfWeek, setDayOfWeek] = useState(0)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingHoliday) {
        setName(editingHoliday.name)
        setMonth(editingHoliday.month)
        if (editingHoliday.day !== null) {
          setDateType('fixed')
          setDay(editingHoliday.day)
        } else {
          setDateType('dynamic')
          setWeekOfMonth(editingHoliday.week_of_month || 1)
          setDayOfWeek(editingHoliday.day_of_week || 0)
        }
      } else {
        setName('')
        setDateType('fixed')
        setMonth(1)
        setDay(1)
        setWeekOfMonth(1)
        setDayOfWeek(0)
      }
    }
  }, [open, editingHoliday])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const input: CreateHolidayInput = {
      name: name.trim(),
      month,
      day: dateType === 'fixed' ? day : null,
      week_of_month: dateType === 'dynamic' ? weekOfMonth : null,
      day_of_week: dateType === 'dynamic' ? dayOfWeek : null,
    }

    onSave(input)
  }

  // Get days in selected month
  const daysInMonth = new Date(2024, month, 0).getDate()

  // Preview text
  const previewText = dateType === 'fixed'
    ? `${MONTH_LABELS[month]} ${day}`
    : `${WEEK_OPTIONS.find(w => w.value === weekOfMonth)?.label} ${DAY_OF_WEEK_LABELS[dayOfWeek]} of ${MONTH_LABELS[month]}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
    >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Holiday Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Thanksgiving, Christmas"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Date Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={dateType === 'fixed'}
                    onChange={() => setDateType('fixed')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Fixed date (same day every year)</span>
                </label>
              </div>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={dateType === 'dynamic'}
                    onChange={() => setDateType('dynamic')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Dynamic (e.g., 4th Thursday)</span>
                </label>
              </div>
            </div>

            {/* Month */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Month
              </label>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {(Object.entries(MONTH_LABELS) as [string, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Fixed Date: Day */}
            {dateType === 'fixed' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Day
                </label>
                <select
                  value={day}
                  onChange={e => setDay(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic Date: Week + Day of Week */}
            {dateType === 'dynamic' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Week
                  </label>
                  <select
                    value={weekOfMonth}
                    onChange={e => setWeekOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {WEEK_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Day
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={e => setDayOfWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {(Object.entries(DAY_OF_WEEK_LABELS) as [string, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500 mb-1">Preview</p>
              <p className="text-sm font-medium text-slate-700">{previewText}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl -mx-6 -mb-6 mt-6">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!name.trim()}>
              {editingHoliday ? 'Save Changes' : 'Add Holiday'}
            </Button>
          </div>
        </form>
    </Modal>
  )
}

// ============================================================
// CLOSURE DIALOG
// ============================================================

interface ClosureDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: CreateClosureInput) => void
  loading: boolean
}

function ClosureDialog({ open, onClose, onSave, loading }: ClosureDialogProps) {
  const [closureDate, setClosureDate] = useState('')
  const [reason, setReason] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setClosureDate('')
      setReason('')
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!closureDate) return

    onSave({
      closure_date: closureDate,
      reason: reason.trim() || undefined,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Closure">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Closure Date
              </label>
              <input
                type="date"
                value={closureDate}
                onChange={e => setClosureDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Equipment maintenance, Staff training"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl -mx-6 -mb-6 mt-6">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!closureDate}>
              Add Closure
            </Button>
          </div>
        </form>
    </Modal>
  )
}