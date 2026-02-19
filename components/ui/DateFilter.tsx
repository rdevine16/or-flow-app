'use client'

import { useState } from 'react'
import { getLocalDateString } from '@/lib/date-utils'

interface DateFilterProps {
  selectedFilter: string
  onFilterChange: (filter: string, startDate?: string, endDate?: string) => void
}

const quickFilters = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
]

export default function DateFilter({ selectedFilter, onFilterChange }: DateFilterProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const handleQuickFilter = (filterId: string) => {
    setShowCustom(false)
    const today = new Date()
    let startDate: string | undefined
    let endDate: string | undefined

    switch (filterId) {
      case 'today':
        startDate = getLocalDateString(today)
        endDate = startDate
        break
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = getLocalDateString(yesterday)
        endDate = startDate
        break
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        startDate = getLocalDateString(weekStart)
        endDate = getLocalDateString(today)
        break
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        startDate = getLocalDateString(monthStart)
        endDate = getLocalDateString(today)
        break
      case 'all':
        startDate = undefined
        endDate = undefined
        break
    }

    onFilterChange(filterId, startDate, endDate)
  }

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onFilterChange('custom', customStart, customEnd)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {quickFilters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => handleQuickFilter(filter.id)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            selectedFilter === filter.id
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {filter.label}
        </button>
      ))}
      
      <button
        onClick={() => setShowCustom(!showCustom)}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
          selectedFilter === 'custom'
            ? 'bg-slate-900 text-white'
            : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        Custom Range
      </button>

      {showCustom && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          <button
            onClick={handleCustomApply}
            className="px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}