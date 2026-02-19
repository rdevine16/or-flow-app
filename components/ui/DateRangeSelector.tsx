// components/ui/DateRangeSelector.tsx
// Shared date range selector used across all analytics pages.
// Provides preset ranges + custom date picker with unified onChange API.

'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'

export interface DateRangeSelectorProps {
  value: string
  onChange: (range: string, startDate: string, endDate: string) => void
}

// ============================================
// DATE HELPERS
// ============================================

export function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getPresetDates(preset: string): { start: string; end: string; label: string } {
  const today = startOfDay(new Date())
  const end = toDateStr(today)

  switch (preset) {
    case 'today': {
      return { start: end, end, label: 'Today' }
    }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const d = toDateStr(yesterday)
      return { start: d, end: d, label: 'Yesterday' }
    }
    case 'wtd': {
      // Week to date (Monday start)
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const monday = new Date(today)
      monday.setDate(monday.getDate() - mondayOffset)
      return { start: toDateStr(monday), end, label: 'This Week' }
    }
    case 'last_week': {
      const dayOfWeek = today.getDay()
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const thisMonday = new Date(today)
      thisMonday.setDate(thisMonday.getDate() - mondayOffset)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(lastMonday.getDate() - 7)
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(lastSunday.getDate() - 1)
      return { start: toDateStr(lastMonday), end: toDateStr(lastSunday), label: 'Last Week' }
    }
    case 'mtd': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toDateStr(monthStart), end, label: 'This Month' }
    }
    case 'last_month': {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastOfPrevMonth = new Date(firstOfThisMonth)
      lastOfPrevMonth.setDate(lastOfPrevMonth.getDate() - 1)
      const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1)
      return { start: toDateStr(firstOfPrevMonth), end: toDateStr(lastOfPrevMonth), label: 'Last Month' }
    }
    case 'qtd': {
      const currentQuarter = Math.floor(today.getMonth() / 3)
      const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1)
      return { start: toDateStr(quarterStart), end, label: 'This Quarter' }
    }
    case 'last_quarter': {
      const currentQuarter = Math.floor(today.getMonth() / 3)
      const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
      const prevYear = currentQuarter === 0 ? today.getFullYear() - 1 : today.getFullYear()
      const quarterStart = new Date(prevYear, prevQuarter * 3, 1)
      const quarterEnd = new Date(prevYear, prevQuarter * 3 + 3, 0)
      return { start: toDateStr(quarterStart), end: toDateStr(quarterEnd), label: 'Last Quarter' }
    }
    case 'ytd': {
      const yearStart = new Date(today.getFullYear(), 0, 1)
      return { start: toDateStr(yearStart), end, label: 'Year to Date' }
    }
    case 'last_30': {
      const thirtyAgo = new Date(today)
      thirtyAgo.setDate(thirtyAgo.getDate() - 30)
      return { start: toDateStr(thirtyAgo), end, label: 'Last 30 Days' }
    }
    case 'last_90': {
      const ninetyAgo = new Date(today)
      ninetyAgo.setDate(ninetyAgo.getDate() - 90)
      return { start: toDateStr(ninetyAgo), end, label: 'Last 90 Days' }
    }
    case 'last_year': {
      const yearAgo = new Date(today)
      yearAgo.setFullYear(yearAgo.getFullYear() - 1)
      return { start: toDateStr(yearAgo), end, label: 'Last 12 Months' }
    }
    case 'all': {
      return { start: '2020-01-01', end, label: 'All Time' }
    }
    default: {
      // Default to MTD
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toDateStr(monthStart), end, label: 'This Month' }
    }
  }
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Given a start/end date, compute the equivalent previous period for comparison.
 * E.g., if current = Jan 15 - Jan 30 (15 days), prev = Dec 31 - Jan 14
 */
export function getPrevPeriodDates(startDate: string, endDate: string): { prevStart: string; prevEnd: string } {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const periodMs = end.getTime() - start.getTime()
  const periodDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24))

  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - periodDays)

  return {
    prevStart: toDateStr(prevStart),
    prevEnd: toDateStr(prevEnd),
  }
}

// ============================================
// PRESETS CONFIG
// ============================================

const presetGroups = [
  {
    label: 'Quick',
    presets: [
      { id: 'today', label: 'Today' },
      { id: 'yesterday', label: 'Yesterday' },
      { id: 'wtd', label: 'This Week' },
      { id: 'last_week', label: 'Last Week' },
    ],
  },
  {
    label: 'Monthly',
    presets: [
      { id: 'mtd', label: 'This Month' },
      { id: 'last_month', label: 'Last Month' },
      { id: 'last_30', label: 'Last 30 Days' },
    ],
  },
  {
    label: 'Longer',
    presets: [
      { id: 'qtd', label: 'This Quarter' },
      { id: 'last_quarter', label: 'Last Quarter' },
      { id: 'last_90', label: 'Last 90 Days' },
      { id: 'ytd', label: 'Year to Date' },
      { id: 'last_year', label: 'Last 12 Months' },
      { id: 'all', label: 'All Time' },
    ],
  },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'presets' | 'custom'>('presets')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Derive current display label
  const displayLabel = useMemo(() => {
    if (value === 'custom' && customStart && customEnd) {
      return `${formatDisplayDate(customStart)} – ${formatDisplayDate(customEnd)}`
    }
    return getPresetDates(value).label
  }, [value, customStart, customEnd])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePresetClick = (presetId: string) => {
    const { start, end } = getPresetDates(presetId)
    onChange(presetId, start, end)
    setIsOpen(false)
    setMode('presets')
  }

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange('custom', customStart, customEnd)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
      >
        <CalendarDays className="w-4 h-4 text-slate-400" />
        <span>{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl border border-slate-200 shadow-xl min-w-[320px] overflow-hidden">
          {/* Tab Toggle: Presets vs Custom */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setMode('presets')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                mode === 'presets'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                mode === 'custom'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Custom Range
            </button>
          </div>

          {mode === 'presets' ? (
            <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
              {presetGroups.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.presets.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetClick(preset.id)}
                        className={`px-3 py-2 text-sm text-left rounded-lg transition-colors ${
                          value === preset.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    max={customEnd || undefined}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    min={customStart || undefined}
                    max={toDateStr(new Date())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quick shortcuts within custom */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '7d', days: 7 },
                  { label: '14d', days: 14 },
                  { label: '30d', days: 30 },
                  { label: '60d', days: 60 },
                  { label: '90d', days: 90 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const end = new Date()
                      const start = new Date()
                      start.setDate(start.getDate() - days)
                      setCustomStart(toDateStr(start))
                      setCustomEnd(toDateStr(end))
                    }}
                    className="px-2.5 py-1 text-xs font-medium text-slate-500 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Range
              </button>

              {customStart && customEnd && customStart > customEnd && (
                <p className="text-xs text-red-600 text-center">Start date must be before end date</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}