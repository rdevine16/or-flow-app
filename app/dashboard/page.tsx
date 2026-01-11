'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import CaseListView from '../../components/dashboard/CaseListView'
import RoomGridView from '../../components/dashboard/RoomGridView'
import { getLocalDateString, formatDateWithWeekday } from '../../lib/date-utils'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
}

interface Room {
  id: string
  name: string
}

const getValue = (data: { name: string }[] | { name: string } | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0]?.name || null
  return data.name
}

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [todayDate, setTodayDate] = useState('')
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null)
  const [roomsCollapsed, setRoomsCollapsed] = useState(false)
  const supabase = createClient()

  // Initialize with today's date and fetch user's facility
  useEffect(() => {
    const today = getLocalDateString()
    setTodayDate(today)
    setSelectedDate(today)
    fetchCurrentUser()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('facility_id')
        .eq('id', user.id)
        .single()

      if (userData?.facility_id) {
        setUserFacilityId(userData.facility_id)
      }
    }
  }

  // Fetch cases when date or facility changes
  useEffect(() => {
    async function fetchData() {
      if (!selectedDate || !userFacilityId) return

      setLoading(true)

      const { data: casesData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          scheduled_date,
          start_time,
          or_rooms (name),
          procedure_types (name),
          case_statuses (name),
          surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
        `)
        .eq('facility_id', userFacilityId)
        .eq('scheduled_date', selectedDate)
        .order('start_time', { ascending: true, nullsFirst: false })

      const { data: roomsData } = await supabase
        .from('or_rooms')
        .select('id, name')
        .eq('facility_id', userFacilityId)
        .order('name')

      setCases((casesData as Case[]) || [])
      setRooms(roomsData || [])
      setLoading(false)
    }

    fetchData()
  }, [selectedDate, userFacilityId])

  const getStatusCount = (statusName: string) => {
    return cases.filter(c => getValue(c.case_statuses) === statusName).length
  }

  const goToPreviousDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() - 1)
    setSelectedDate(getLocalDateString(date))
  }

  const goToNextDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + 1)
    setSelectedDate(getLocalDateString(date))
  }

  const goToToday = () => {
    setSelectedDate(todayDate)
  }

  const isToday = selectedDate === todayDate

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousDay}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Previous day"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-900">
                    {selectedDate ? formatDateWithWeekday(selectedDate) : 'Select date'}
                  </span>
                </div>
              </div>

              {!isToday && (
                <button
                  onClick={goToToday}
                  className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Today
                </button>
              )}

              {isToday && (
                <span className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                  Today
                </span>
              )}
            </div>

            <button
              onClick={goToNextDay}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Next day"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{cases.length}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-semibold text-amber-600 mt-1">{getStatusCount('in_progress')}</p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-semibold text-emerald-600 mt-1">{getStatusCount('completed')}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Scheduled</p>
              <p className="text-2xl font-semibold text-blue-600 mt-1">{getStatusCount('scheduled')}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Room Grid Section */}
          {rooms.length > 0 && (
            <div>
              <div 
                className="flex items-center justify-between mb-4 cursor-pointer group"
                onClick={() => setRoomsCollapsed(!roomsCollapsed)}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">OR Rooms</h2>
                  <span className="text-sm text-slate-500">
                    {rooms.length} room{rooms.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button 
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title={roomsCollapsed ? 'Expand rooms' : 'Collapse rooms'}
                >
                  <svg 
                    className={`w-5 h-5 transition-transform ${roomsCollapsed ? '' : 'rotate-180'}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {!roomsCollapsed && (
                <RoomGridView rooms={rooms} cases={cases} />
              )}
            </div>
          )}

          {/* Case List Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-slate-900">All Cases</h2>
                <span className="text-sm text-slate-500">
                  {cases.length} case{cases.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            <CaseListView cases={cases} />
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
