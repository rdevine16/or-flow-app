'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Clock, ChevronUp, ChevronDown } from 'lucide-react'

interface TimePickerProps {
  value: string // "HH:mm" 24-hour format
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  label?: string
  required?: boolean
}

// Common OR start times for quick selection
const QUICK_TIMES = [
  '06:00', '06:30', '07:00', '07:30',
  '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
]

function to12Hour(h24: number): { hour: number; period: 'AM' | 'PM' } {
  if (h24 === 0) return { hour: 12, period: 'AM' }
  if (h24 < 12) return { hour: h24, period: 'AM' }
  if (h24 === 12) return { hour: 12, period: 'PM' }
  return { hour: h24 - 12, period: 'PM' }
}

function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

function formatDisplay(value: string): string {
  const [hStr, mStr] = value.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const { hour, period } = to12Hour(h)
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function formatQuickTime(value: string): string {
  return formatDisplay(value)
}

export default function TimePicker({
  value,
  onChange,
  onBlur,
  error,
  label,
  required,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse current value
  const [hStr, mStr] = value.split(':')
  const h24 = parseInt(hStr, 10) || 0
  const minute = parseInt(mStr, 10) || 0
  const { hour: hour12, period } = to12Hour(h24)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        onBlur?.()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onBlur])

  const emit = useCallback(
    (h: number, m: number, p: 'AM' | 'PM') => {
      const h24Val = to24Hour(h, p)
      onChange(`${String(h24Val).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    },
    [onChange]
  )

  const adjustHour = (delta: number) => {
    let next = hour12 + delta
    if (next > 12) next = 1
    if (next < 1) next = 12
    emit(next, minute, period)
  }

  const adjustMinute = (delta: number) => {
    let next = minute + delta
    if (next >= 60) next = 0
    if (next < 0) next = 55
    emit(hour12, next, period)
  }

  const togglePeriod = () => {
    emit(hour12, minute, period === 'AM' ? 'PM' : 'AM')
  }

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 text-left bg-white border rounded-xl flex items-center justify-between transition-all duration-200 ${
          error
            ? 'border-red-400 ring-2 ring-red-500/20'
            : isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="text-slate-900 font-medium tabular-nums">
          {formatDisplay(value)}
        </span>
        <Clock className="w-4 h-4 text-slate-400" />
      </button>

      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Quick presets */}
          <div className="p-3 border-b border-slate-100">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
              Quick Select
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChange(t)
                    setIsOpen(false)
                    onBlur?.()
                  }}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    value === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {formatQuickTime(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Hour / Minute / Period spinners */}
          <div className="p-4">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3">
              Custom Time
            </p>
            <div className="flex items-center justify-center gap-2">
              {/* Hour spinner */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => adjustHour(1)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="w-14 h-12 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xl font-semibold text-slate-900 tabular-nums">
                    {String(hour12).padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustHour(-1)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-slate-400 mt-0.5">Hour</span>
              </div>

              {/* Colon separator */}
              <span className="text-2xl font-bold text-slate-300 mb-5">:</span>

              {/* Minute spinner */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => adjustMinute(5)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div className="w-14 h-12 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xl font-semibold text-slate-900 tabular-nums">
                    {String(minute).padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustMinute(-5)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-slate-400 mt-0.5">Min</span>
              </div>

              {/* AM/PM toggle */}
              <div className="flex flex-col items-center ml-2">
                <button
                  type="button"
                  onClick={togglePeriod}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <div
                  className="w-14 h-12 flex items-center justify-center bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
                  onClick={togglePeriod}
                >
                  <span className="text-lg font-semibold text-blue-700">
                    {period}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={togglePeriod}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <span className="text-[10px] text-slate-400 mt-0.5">Period</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
