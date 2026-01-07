'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Container from '../../components/ui/Container'
import ViewToggle from '../../components/ui/ViewToggle'
import CaseListView from '../../components/dashboard/CaseListView'
import RoomGridView from '../../components/dashboard/RoomGridView'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  or_rooms: { name: string } | null
  procedure_types: { name: string } | null
  case_statuses: { name: string } | null
}

interface Room {
  id: string
  name: string
}

const viewOptions = [
  {
    id: 'cases',
    label: 'All Cases',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    id: 'rooms',
    label: 'Room View',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
  },
]

export default function DashboardPage() {
  const [activeView, setActiveView] = useState('cases')
  const [cases, setCases] = useState<Case[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      // Fetch today's cases
      const today = new Date().toISOString().split('T')[0]
      const { data: casesData } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          scheduled_date,
          or_rooms (name),
          procedure_types (name),
          case_statuses (name)
        `)
        .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
        .eq('scheduled_date', today)
        .order('case_number')

      // Fetch rooms
      const { data: roomsData } = await supabase
        .from('or_rooms')
        .select('id, name')
        .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
        .order('name')

      setCases(casesData || [])
      setRooms(roomsData || [])
      setLoading(false)
    }

    fetchData()
  }, [])

  // Get today's date formatted nicely
  const today = new Date()
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Today's Schedule</h1>
            <p className="text-slate-500 mt-1">{formattedDate}</p>
          </div>
          <ViewToggle 
            options={viewOptions} 
            activeView={activeView} 
            onChange={setActiveView} 
          />
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500 mb-1">Total Cases</p>
            <p className="text-2xl font-bold text-slate-900">{cases.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-amber-600">
              {cases.filter(c => c.case_statuses?.name === 'in_progress').length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500 mb-1">Completed</p>
            <p className="text-2xl font-bold text-emerald-600">
              {cases.filter(c => c.case_statuses?.name === 'completed').length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500 mb-1">Scheduled</p>
            <p className="text-2xl font-bold text-sky-600">
              {cases.filter(c => c.case_statuses?.name === 'scheduled').length}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Case List View */}
            {activeView === 'cases' && <CaseListView cases={cases} />}

            {/* Room Grid View */}
            {activeView === 'rooms' && <RoomGridView rooms={rooms} cases={cases} />}
          </>
        )}
      </Container>
    </DashboardLayout>
  )
}