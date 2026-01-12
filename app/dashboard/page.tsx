// app/dashboard/page.tsx
// Enhanced dashboard with pace tracking and polished room cards

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import CaseListView from '../../components/dashboard/CaseListView'
import EnhancedRoomGridView from '../../components/dashboard/EnhancedRoomGridView'
import { getLocalDateString, formatDateWithWeekday } from '../../lib/date-utils'
import { 
  RoomWithCase, 
  EnhancedCase, 
  CasePaceData, 
  CasePhase,
  MilestoneWithType,
  SurgeonProcedureAverage,
  SurgeonMilestoneAverage
} from '../../types/pace'
import { determinePhase, parseISODate, parseScheduledStartTime } from '../../lib/pace-utils'

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
  const [cases, setCases] = useState<EnhancedCase[]>([])
  const [roomsWithCases, setRoomsWithCases] = useState<RoomWithCase[]>([])
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

  // Fetch pace data for a specific case
  const fetchPaceData = useCallback(async (
    surgeonId: string,
    procedureTypeId: string,
    currentMilestoneName: string,
    scheduledStart: Date
  ): Promise<CasePaceData | null> => {
    try {
      // Fetch procedure average
      const { data: procAverages } = await supabase
        .from('surgeon_procedure_averages')
        .select('*')
        .eq('surgeon_id', surgeonId)
        .eq('procedure_type_id', procedureTypeId)
        .single()
      
      if (!procAverages) return null
      
      // Get milestone type ID
      const { data: milestoneType } = await supabase
        .from('milestone_types')
        .select('id, name')
        .eq('name', currentMilestoneName)
        .single()
      
      if (!milestoneType) return null
      
      // Fetch milestone average
      const { data: msAverage } = await supabase
        .from('surgeon_milestone_averages')
        .select('*')
        .eq('surgeon_id', surgeonId)
        .eq('procedure_type_id', procedureTypeId)
        .eq('milestone_type_id', milestoneType.id)
        .single()
      
      if (!msAverage) return null
      
      return {
        scheduledStart,
        avgMinutesToMilestone: msAverage.avg_minutes_from_start,
        avgTotalMinutes: procAverages.avg_total_minutes,
        sampleSize: Math.min(procAverages.sample_size, msAverage.sample_size),
        currentMilestoneName
      }
    } catch (error) {
      console.error('Error fetching pace data:', error)
      return null
    }
  }, [supabase])

  // Main data fetch
  useEffect(() => {
    async function fetchData() {
      if (!selectedDate || !userFacilityId) return

      setLoading(true)

      try {
        // Fetch cases
        const { data: casesData } = await supabase
          .from('cases')
          .select(`
            id,
            case_number,
            scheduled_date,
            start_time,
            facility_id,
            or_room_id,
            procedure_type_id,
            surgeon_id,
            or_rooms (name),
            procedure_types (name),
            case_statuses (name),
            surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
          `)
          .eq('facility_id', userFacilityId)
          .eq('scheduled_date', selectedDate)
          .order('start_time', { ascending: true, nullsFirst: false })

        // Fetch rooms
        const { data: roomsData } = await supabase
          .from('or_rooms')
          .select('id, name')
          .eq('facility_id', userFacilityId)
          .order('name')

        const fetchedCases = (casesData as EnhancedCase[]) || []
        const rooms = (roomsData as Room[]) || []

        setCases(fetchedCases)

        // Fetch milestones for all cases
        const allCaseIds = fetchedCases.map(c => c.id)
        
        const caseStartTimes: Record<string, Date> = {}
        const casePhases: Record<string, CasePhase> = {}
        const caseMilestoneNames: Record<string, string[]> = {}
        const caseCurrentMilestone: Record<string, string> = {}

        if (allCaseIds.length > 0) {
          const { data: milestones } = await supabase
            .from('case_milestones')
            .select('case_id, recorded_at, milestone_types(name)')
            .in('case_id', allCaseIds)
            .order('recorded_at', { ascending: true })

          if (milestones) {
            for (const milestone of milestones as MilestoneWithType[]) {
              const caseId = milestone.case_id
              
              // First milestone = patient in time (actual case start)
              if (!caseStartTimes[caseId]) {
                const date = parseISODate(milestone.recorded_at)
                if (date) {
                  caseStartTimes[caseId] = date
                }
              }
              
              if (milestone.milestone_types?.name) {
                const name = milestone.milestone_types.name.toLowerCase()
                if (!caseMilestoneNames[caseId]) {
                  caseMilestoneNames[caseId] = []
                }
                caseMilestoneNames[caseId].push(name)
                caseCurrentMilestone[caseId] = name
              }
            }
            
            // Determine phase for each case
            for (const [caseId, names] of Object.entries(caseMilestoneNames)) {
              casePhases[caseId] = determinePhase(names)
            }
          }
        }

        // Build rooms with cases and fetch pace data for active cases
        const roomsWithCasesPromises = rooms.map(async (room) => {
          const roomCases = fetchedCases.filter(c => {
            const roomName = c.or_rooms?.name
            return roomName === room.name
          }).sort((a, b) => {
            if (!a.start_time) return 1
            if (!b.start_time) return -1
            return a.start_time.localeCompare(b.start_time)
          })

          const currentCase = roomCases.find(c => getValue(c.case_statuses) === 'in_progress') || null
          const nextCase = roomCases.find(c => getValue(c.case_statuses) === 'scheduled') || null

          const displayCase = currentCase || nextCase
          const isActive = !!currentCase

          // Get start time and phase for active case
          const startTime = currentCase ? caseStartTimes[currentCase.id] || null : null
          const phase = currentCase ? casePhases[currentCase.id] || null : null

          // Fetch pace data for active cases
          let paceData: CasePaceData | null = null
          if (currentCase && currentCase.surgeon_id && currentCase.procedure_type_id) {
            const currentMilestone = caseCurrentMilestone[currentCase.id]
            const scheduledStart = parseScheduledStartTime(
              currentCase.scheduled_date,
              currentCase.start_time
            )
            
            if (currentMilestone && scheduledStart) {
              paceData = await fetchPaceData(
                currentCase.surgeon_id,
                currentCase.procedure_type_id,
                currentMilestone,
                scheduledStart
              )
            }
          }

          return {
            room,
            currentCase,
            nextCase: currentCase ? null : nextCase,
            caseStartTime: startTime,
            currentPhase: phase,
            paceData
          } as RoomWithCase
        })

        const roomsWithCasesData = await Promise.all(roomsWithCasesPromises)
        setRoomsWithCases(roomsWithCasesData)

      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedDate, userFacilityId, supabase, fetchPaceData])

  const getStatusCount = (statusName: string) => {
    return cases.filter(c => getValue(c.case_statuses) === statusName).length
  }

  const activeCount = roomsWithCases.filter(r => r.currentCase !== null).length

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
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{cases.length}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{getStatusCount('in_progress')}</p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-slate-600 mt-1">{getStatusCount('completed')}</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Scheduled</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{getStatusCount('scheduled')}</p>
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
      <div className="space-y-6">
        {/* Room Grid Section */}
        <div>
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer group"
            onClick={() => setRoomsCollapsed(!roomsCollapsed)}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900">OR Rooms</h2>
              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  {activeCount} Active
                </span>
              )}
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
            <EnhancedRoomGridView 
              roomsWithCases={roomsWithCases} 
              loading={loading}
            />
          )}
        </div>

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
          
          <CaseListView cases={cases as any} />
        </div>
      </div>
    </DashboardLayout>
  )
}
