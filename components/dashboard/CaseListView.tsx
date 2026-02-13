// components/cases/CaseListView.tsx
// UPDATED: Added Side column for operative_side

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SurgeonAvatar from '../ui/SurgeonAvatar'
import { extractName } from '@/lib/formatters'

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  start_time: string | null
  operative_side: string | null  // NEW
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
}

interface CaseListViewProps {
  cases: Case[]
  selectedDate?: string // YYYY-MM-DD format
  showFilters?: boolean
}

type FilterType = 'all' | 'in_progress' | 'scheduled' | 'completed' | 'delayed'

const getSurgeon = (data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null): { name: string; fullName: string } => {
  if (!data) return { name: 'Unassigned', fullName: 'Unassigned' }
  const surgeon = Array.isArray(data) ? data[0] : data
  if (!surgeon) return { name: 'Unassigned', fullName: 'Unassigned' }
  return { 
    name: `Dr. ${surgeon.last_name}`,
    fullName: `${surgeon.first_name} ${surgeon.last_name}`
  }
}

const formatTime = (time: string | null): string => {
  if (!time) return '--:--'
  const parts = time.split(':')
  const hour = parseInt(parts[0])
  const minutes = parts[1]
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// NEW: Format operative side for display
const formatSide = (side: string | null): { label: string; color: string } | null => {
  if (!side || side === 'n/a') return null
  
  const config: Record<string, { label: string; color: string }> = {
    left: { label: 'Left', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    right: { label: 'Right', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    bilateral: { label: 'Bilateral', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  }
  
  return config[side] || null
}

const getStatusConfig = (status: string | null) => {
  switch (status) {
    case 'in_progress':
      return {
        label: 'In Progress',
        bgColor: 'bg-green-50',
        textColor: 'text-green-600',
        borderColor: 'border-green-200',
        dotColor: 'bg-green-500',
        lineColor: 'bg-green-500'
      }
    case 'completed':
      return {
        label: 'Completed',
        bgColor: 'bg-slate-50',
        textColor: 'text-slate-600',
        borderColor: 'border-slate-200',
        dotColor: 'bg-slate-400',
        lineColor: 'bg-slate-400'
      }
    case 'delayed':
      return {
        label: 'Delayed',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-200',
        dotColor: 'bg-amber-500',
        lineColor: 'bg-amber-500'
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500',
        lineColor: 'bg-red-500'
      }
    case 'scheduled':
    default:
      return {
        label: 'Scheduled',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        dotColor: 'bg-blue-500',
        lineColor: 'bg-blue-500'
      }
  }
}

// Filter cases to hide completed cases from previous days
function filterVisibleCases(cases: Case[], selectedDate?: string): Case[] {
  const today = new Date().toISOString().split('T')[0]
  
  return cases.filter(caseItem => {
    const status = extractName(caseItem.case_statuses)
    const caseDate = caseItem.scheduled_date
    
    // Always show non-completed cases
    if (status !== 'completed') return true
    
    // For completed cases, only show if:
    // 1. Viewing today and case is from today
    // 2. Viewing a specific past date and case is from that date
    if (selectedDate) {
      return caseDate === selectedDate
    }
    
    // Default: only show completed cases from today
    return caseDate === today
  })
}

export default function CaseListView({ cases, selectedDate, showFilters = true }: CaseListViewProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  
  // Filter visible cases (auto-hide old completed)
  const visibleCases = filterVisibleCases(cases, selectedDate)
  
  // Apply status filter
  const filteredCases = visibleCases.filter(c => {
    if (filter === 'all') return true
    return extractName(c.case_statuses) === filter
  })
  
  // Count by status for filter badges
  const statusCounts = {
    all: visibleCases.length,
    in_progress: visibleCases.filter(c => extractName(c.case_statuses) === 'in_progress').length,
    scheduled: visibleCases.filter(c => extractName(c.case_statuses) === 'scheduled').length,
    completed: visibleCases.filter(c => extractName(c.case_statuses) === 'completed').length,
    delayed: visibleCases.filter(c => extractName(c.case_statuses) === 'delayed').length,
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All Cases' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'completed', label: 'Completed' },
    { key: 'delayed', label: 'Delayed' },
  ]

  if (visibleCases.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">No cases scheduled</h3>
        <p className="text-slate-500">There are no cases scheduled for this date.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      {showFilters && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {filters.map(({ key, label }) => {
            const count = statusCounts[key]
            const isActive = filter === key
            
            // Don't show filter if count is 0 (except "All")
            if (count === 0 && key !== 'all') return null
            
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {label}
                <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Case List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        {/* Table Header - UPDATED: Added Side column */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/80 border-b border-slate-200/80">
          <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Time</div>
          <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Case</div>
          <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Room</div>
          <div className="col-span-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Side</div>
          <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surgeon</div>
          <div className="col-span-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Procedure</div>
          <div className="col-span-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</div>
        </div>

        {/* Case Rows */}
        <div className="divide-y divide-slate-100">
          {filteredCases.map((caseItem) => {
            const roomName = extractName(caseItem.or_rooms)
            const procedureName = extractName(caseItem.procedure_types)
            const statusName = extractName(caseItem.case_statuses)
            const surgeon = getSurgeon(caseItem.surgeon)
            const statusConfig = getStatusConfig(statusName)
            const sideConfig = formatSide(caseItem.operative_side)  // NEW

            return (
              <Link 
                key={caseItem.id} 
                href={`/cases/${caseItem.id}`}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-all duration-200 cursor-pointer group relative"
              >
                {/* Status Line Indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusConfig.lineColor} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                
                {/* Time */}
                <div className="col-span-1">
                  <span className="text-sm font-semibold text-slate-900 font-mono">
                    {formatTime(caseItem.start_time)}
                  </span>
                </div>
                
                {/* Case Number */}
                <div className="col-span-2">
                  <span className="text-sm font-semibold text-slate-900">{caseItem.case_number}</span>
                </div>
                
                {/* Room */}
                <div className="col-span-1">
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-xs font-medium text-slate-600">{roomName || '-'}</span>
                  </div>
                </div>
                
                {/* NEW: Side */}
                <div className="col-span-1">
                  {sideConfig ? (
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg border text-xs font-medium ${sideConfig.color}`}>
                      {sideConfig.label}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
                
                {/* Surgeon with Avatar */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2.5">
                    <SurgeonAvatar name={surgeon.fullName} size="sm" />
                    <span className="text-sm font-medium text-slate-700 truncate">{surgeon.name}</span>
                  </div>
                </div>
                
                {/* Procedure */}
                <div className="col-span-3">
                  <span className="text-sm text-slate-600 truncate block">{procedureName || 'Not specified'}</span>
                </div>
                
                {/* Status Badge */}
                <div className="col-span-2 flex items-center justify-between">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`}></div>
                    <span className={`text-xs font-semibold ${statusConfig.textColor}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  
                  {/* Chevron */}
                  <svg 
                    className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Empty filter state */}
        {filteredCases.length === 0 && visibleCases.length > 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No cases match the selected filter.</p>
            <button 
              onClick={() => setFilter('all')}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Show all cases
            </button>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <span>
          Showing {filteredCases.length} of {visibleCases.length} cases
        </span>
        {statusCounts.completed > 0 && selectedDate && (
          <span className="text-xs text-slate-400">
            Completed cases from previous days are hidden
          </span>
        )}
      </div>
    </div>
  )
}
