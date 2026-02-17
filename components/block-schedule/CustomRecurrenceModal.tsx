// components/block-schedule/CustomRecurrenceModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface CustomRecurrenceModalProps {
  open: boolean
  onClose: () => void
  onSave: (config: CustomRecurrenceConfig) => void
  initialConfig?: CustomRecurrenceConfig
  initialDayOfWeek?: number
}

export interface CustomRecurrenceConfig {
  repeatEvery: number
  repeatUnit: 'week' | 'month'
  repeatOnDays: number[] // 0-6 for days of week
  endType: 'never' | 'on' | 'after'
  endDate?: string
  endAfterOccurrences?: number
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function CustomRecurrenceModal({
  open,
  onClose,
  onSave,
  initialConfig,
  initialDayOfWeek = 1,
}: CustomRecurrenceModalProps) {
  const [repeatEvery, setRepeatEvery] = useState(1)
  const [repeatUnit, setRepeatUnit] = useState<'week' | 'month'>('week')
  const [repeatOnDays, setRepeatOnDays] = useState<number[]>([initialDayOfWeek])
  const [endType, setEndType] = useState<'never' | 'on' | 'after'>('never')
  const [endDate, setEndDate] = useState('')
  const [endAfterOccurrences, setEndAfterOccurrences] = useState(13)

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return

    if (initialConfig) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRepeatEvery(initialConfig.repeatEvery)
      setRepeatUnit(initialConfig.repeatUnit)
      setRepeatOnDays(initialConfig.repeatOnDays)
      setEndType(initialConfig.endType)
      const defaultEndDate = initialConfig.endDate || (() => {
        const date = new Date()
        date.setMonth(date.getMonth() + 3)
        return date.toISOString().split('T')[0]
      })()
      setEndDate(defaultEndDate)
      setEndAfterOccurrences(initialConfig.endAfterOccurrences || 13)
    } else {
      setRepeatEvery(1)
      setRepeatUnit('week')
      setRepeatOnDays([initialDayOfWeek])
      setEndType('never')
      const date = new Date()
      date.setMonth(date.getMonth() + 3)
      setEndDate(date.toISOString().split('T')[0])
      setEndAfterOccurrences(13)
    }
  }, [open, initialConfig, initialDayOfWeek])

  const toggleDay = (day: number) => {
    setRepeatOnDays(prev => {
      if (prev.includes(day)) {
        // Don't allow removing all days
        if (prev.length === 1) return prev
        return prev.filter(d => d !== day)
      }
      return [...prev, day].sort((a, b) => a - b)
    })
  }

  const handleSave = () => {
    onSave({
      repeatEvery,
      repeatUnit,
      repeatOnDays,
      endType,
      endDate: endType === 'on' ? endDate : undefined,
      endAfterOccurrences: endType === 'after' ? endAfterOccurrences : undefined,
    })
  }

  const incrementRepeatEvery = () => setRepeatEvery(prev => Math.min(prev + 1, 52))
  const decrementRepeatEvery = () => setRepeatEvery(prev => Math.max(prev - 1, 1))
  const incrementOccurrences = () => setEndAfterOccurrences(prev => Math.min(prev + 1, 99))
  const decrementOccurrences = () => setEndAfterOccurrences(prev => Math.max(prev - 1, 1))


  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-2">
          <h2 className="text-2xl font-normal text-slate-900">Custom recurrence</h2>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-8">
          {/* Repeat every */}
          <div className="flex items-center gap-4">
            <span className="text-base text-slate-700">Repeat every</span>
            <div className="flex items-center">
              <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden">
                <input
                  type="number"
                  value={repeatEvery}
                  onChange={e => setRepeatEvery(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                  className="w-14 px-3 py-2.5 text-center bg-transparent border-0 focus:ring-0 text-base font-medium"
                  min={1}
                  max={52}
                />
                <div className="flex flex-col border-l border-slate-200">
                  <button
                    onClick={incrementRepeatEvery}
                    className="px-2 py-0.5 hover:bg-slate-200 transition-colors"
                  >
                    <ChevronUp className="h-4 w-4 text-slate-500" />
                  </button>
                  <button
                    onClick={decrementRepeatEvery}
                    className="px-2 py-0.5 hover:bg-slate-200 transition-colors"
                  >
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>
              <select
                value={repeatUnit}
                onChange={e => setRepeatUnit(e.target.value as 'week' | 'month')}
                className="ml-2 px-4 py-2.5 bg-slate-100 border-0 rounded-lg text-base font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">week{repeatEvery > 1 ? 's' : ''}</option>
                <option value="month">month{repeatEvery > 1 ? 's' : ''}</option>
              </select>
            </div>
          </div>

          {/* Repeat on (only for weekly) */}
          {repeatUnit === 'week' && (
            <div>
              <span className="text-base text-slate-700 block mb-4">Repeat on</span>
              <div className="flex gap-2">
                {DAY_LABELS.map((label, index) => {
                  const isSelected = repeatOnDays.includes(index)
                  return (
                    <button
                      key={index}
                      onClick={() => toggleDay(index)}
                      title={DAY_NAMES[index]}
                      className={`w-11 h-11 rounded-full text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ends */}
          <div>
            <span className="text-base text-slate-700 block mb-4">Ends</span>
            <div className="space-y-3">
              {/* Never */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  endType === 'never' ? 'border-blue-600' : 'border-slate-300 group-hover:border-slate-400'
                }`}>
                  {endType === 'never' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <input
                  type="radio"
                  name="endType"
                  value="never"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="sr-only"
                />
                <span className="text-base text-slate-700">Never</span>
              </label>

              {/* On date */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  endType === 'on' ? 'border-blue-600' : 'border-slate-300 group-hover:border-slate-400'
                }`}>
                  {endType === 'on' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <input
                  type="radio"
                  name="endType"
                  value="on"
                  checked={endType === 'on'}
                  onChange={() => setEndType('on')}
                  className="sr-only"
                />
                <span className="text-base text-slate-700">On</span>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    disabled={endType !== 'on'}
                    className={`px-4 py-2 bg-slate-100 border-0 rounded-lg text-base focus:ring-2 focus:ring-blue-500 ${
                      endType !== 'on' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </label>

              {/* After occurrences */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  endType === 'after' ? 'border-blue-600' : 'border-slate-300 group-hover:border-slate-400'
                }`}>
                  {endType === 'after' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <input
                  type="radio"
                  name="endType"
                  value="after"
                  checked={endType === 'after'}
                  onChange={() => setEndType('after')}
                  className="sr-only"
                />
                <span className="text-base text-slate-700">After</span>
                <div className="flex items-center">
                  <div className={`flex items-center bg-slate-100 rounded-lg overflow-hidden ${
                    endType !== 'after' ? 'opacity-50' : ''
                  }`}>
                    <input
                      type="number"
                      value={endAfterOccurrences}
                      onChange={e => setEndAfterOccurrences(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                      disabled={endType !== 'after'}
                      className="w-12 px-2 py-2 text-center bg-transparent border-0 focus:ring-0 text-base font-medium disabled:cursor-not-allowed"
                      min={1}
                      max={99}
                    />
                    <div className="flex flex-col border-l border-slate-200">
                      <button
                        onClick={incrementOccurrences}
                        disabled={endType !== 'after'}
                        className="px-1.5 py-0.5 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="h-3 w-3 text-slate-500" />
                      </button>
                      <button
                        onClick={decrementOccurrences}
                        disabled={endType !== 'after'}
                        className="px-1.5 py-0.5 hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-3 w-3 text-slate-500" />
                      </button>
                    </div>
                  </div>
                  <span className={`ml-2 text-base text-slate-500 ${endType !== 'after' ? 'opacity-50' : ''}`}>
                    occurrences
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper function to generate recurrence description
export function getCustomRecurrenceDescription(config: CustomRecurrenceConfig): string {
  const { repeatEvery, repeatUnit, repeatOnDays, endType, endDate, endAfterOccurrences } = config

  let desc = `Every ${repeatEvery > 1 ? repeatEvery + ' ' : ''}${repeatUnit}${repeatEvery > 1 ? 's' : ''}`

  if (repeatUnit === 'week' && repeatOnDays.length > 0) {
    const dayNames = repeatOnDays.map(d => DAY_NAMES[d].slice(0, 3))
    if (repeatOnDays.length === 7) {
      desc += ' on all days'
    } else if (repeatOnDays.length === 5 && !repeatOnDays.includes(0) && !repeatOnDays.includes(6)) {
      desc += ' on weekdays'
    } else {
      desc += ` on ${dayNames.join(', ')}`
    }
  }

  if (endType === 'on' && endDate) {
    const date = new Date(endDate + 'T00:00:00')
    desc += `, until ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  } else if (endType === 'after' && endAfterOccurrences) {
    desc += `, ${endAfterOccurrences} times`
  }

  return desc
}