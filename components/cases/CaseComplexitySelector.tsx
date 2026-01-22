// components/cases/CaseComplexitySelector.tsx
// Multi-select for case complexities - works with simplified 2-table schema

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

interface Complexity {
  id: string
  display_name: string
  description: string | null
  procedure_category_ids: string[]
}

interface Props {
  facilityId: string
  procedureCategoryId?: string | null  // Filter by procedure category
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export default function CaseComplexitySelector({
  facilityId,
  procedureCategoryId,
  selectedIds,
  onChange,
  disabled = false
}: Props) {
  const supabase = createClient()
  const [complexities, setComplexities] = useState<Complexity[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (facilityId) fetchComplexities()
  }, [facilityId])

  const fetchComplexities = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('complexities')
        .select('id, display_name, description, procedure_category_ids')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('display_order')

      if (data) setComplexities(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter by procedure category
  const filtered = complexities.filter(c => {
    const cats = c.procedure_category_ids || []
    // Empty array = show for all procedures
    if (cats.length === 0) return true
    // If we have a procedure category, check if it matches
    if (procedureCategoryId) return cats.includes(procedureCategoryId)
    return true
  })

  const toggle = (id: string) => {
    if (disabled) return
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const selected = complexities.filter(c => selectedIds.includes(c.id))

  if (loading) {
    return <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
  }

  if (filtered.length === 0) return null

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        Case Complexities
      </label>

      {/* Trigger / Selected */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[42px] px-3 py-2 border rounded-lg ${
          disabled ? 'bg-slate-50 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-slate-300'
        } ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-500' : 'border-slate-200'}`}
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-sm font-medium rounded-full"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {c.display_name}
                {!disabled && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(c.id) }}
                    className="hover:text-orange-900"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400 text-sm">
            {disabled ? 'None' : 'Click to add complexities...'}
          </span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filtered.map(c => {
              const isSelected = selectedIds.includes(c.id)
              return (
                <label
                  key={c.id}
                  className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer ${
                    isSelected ? 'bg-orange-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(c.id)}
                    className="mt-0.5 w-4 h-4 text-orange-600 rounded"
                  />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-orange-700' : 'text-slate-700'}`}>
                      {c.display_name}
                    </p>
                    {c.description && (
                      <p className="text-xs text-slate-500">{c.description}</p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
          <div className="mt-2 pt-2 border-t flex justify-between items-center">
            <span className="text-xs text-slate-400">{selectedIds.length} selected</span>
            <button onClick={() => setIsOpen(false)} className="text-xs text-blue-600 font-medium">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Badge display for case lists
export function CaseComplexityBadges({ complexities }: { complexities: Array<{ display_name: string }> }) {
  if (!complexities?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {complexities.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {c.display_name}
        </span>
      ))}
    </div>
  )
}

// Small indicator for case rows
export function CaseComplexityIndicator({ count }: { count: number }) {
  if (!count) return null
  return (
    <div
      className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center"
      title={`${count} complexity factor${count > 1 ? 's' : ''}`}
    >
      {count}
    </div>
  )
}