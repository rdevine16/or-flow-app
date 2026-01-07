'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import DashboardLayout from '../../components/layouts/DashboardLayout'
import Container from '../../components/ui/Container'
import Badge from '../../components/ui/Badge'
import DateFilter from '../../components/ui/DateFilter'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  or_rooms: { name: string } | null
  procedure_types: { name: string } | null
  case_statuses: { name: string } | null
  surgeon: { first_name: string; last_name: string } | null
}

export default function CasesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchCases = async (startDate?: string, endDate?: string) => {
    setLoading(true)

    let query = supabase
      .from('cases')
      .select(`
        id,
        case_number,
        scheduled_date,
        or_rooms (name),
        procedure_types (name),
        case_statuses (name),
        surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
      `)
      .eq('facility_id', 'a1111111-1111-1111-1111-111111111111')
      .order('scheduled_date', { ascending: false })

    if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

    const { data } = await query
    setCases(data as Case[] || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCases()
  }, [])

  const handleFilterChange = (filter: string, startDate?: string, endDate?: string) => {
    setDateFilter(filter)
    fetchCases(startDate, endDate)
  }

  const handleDelete = async (caseId: string) => {
    await supabase.from('cases').delete().eq('id', caseId)
    setCases(cases.filter(c => c.id !== caseId))
    setDeleteConfirm(null)
  }

  const getStatusVariant = (status: string | undefined): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    switch (status) {
      case 'completed': return 'success'
      case 'in_progress': return 'warning'
      case 'delayed': return 'error'
      case 'cancelled': return 'error'
      default: return 'info'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">All Cases</h1>
            <p className="text-slate-500 mt-1">{cases.length} cases found</p>
          </div>
          <button
            onClick={() => router.push('/cases/new')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Case
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <DateFilter selectedFilter={dateFilter} onFilterChange={handleFilterChange} />
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No cases found</h3>
              <p className="text-slate-500 mb-4">Try adjusting your date filter or create a new case.</p>
              <button
                onClick={() => router.push('/cases/new')}
                className="text-teal-600 hover:text-teal-700 font-medium"
              >
                Create your first case →
              </button>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
                <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Case #</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</div>
                <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</div>
                <div className="col-span-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedure</div>
                <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Surgeon</div>
                <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</div>
                <div className="col-span-1 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <div key={c.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-colors">
                    <div className="col-span-2">
                      <a 
                        href={`/cases/${c.id}`}
                        className="font-semibold text-slate-900 hover:text-teal-600 transition-colors"
                      >
                        {c.case_number}
                      </a>
                    </div>
                    <div className="col-span-2 text-sm text-slate-600">
                      {formatDate(c.scheduled_date)}
                    </div>
                    <div className="col-span-1 text-sm text-slate-600">
                      {c.or_rooms?.name || '—'}
                    </div>
                    <div className="col-span-3 text-sm text-slate-700">
                      {c.procedure_types?.name || 'Not specified'}
                    </div>
                    <div className="col-span-2 text-sm text-slate-600">
                      {c.surgeon ? `Dr. ${c.surgeon.first_name} ${c.surgeon.last_name}` : '—'}
                    </div>
                    <div className="col-span-1">
                      <Badge variant={getStatusVariant(c.case_statuses?.name)} size="sm">
                        {c.case_statuses?.name?.replace('_', ' ') || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      <button
                        onClick={() => router.push(`/cases/${c.id}/edit`)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {deleteConfirm === c.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Confirm Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(c.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Container>
    </DashboardLayout>
  )
}