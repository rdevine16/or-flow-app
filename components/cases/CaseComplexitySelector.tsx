// components/cases/CaseComplexitySelector.tsx
// Toggle-badge style complexity selector - click badges to turn on/off
// Only shows after procedure type is selected

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface Complexity {
  id: string
  display_name: string
  description: string | null
  procedure_category_ids: string[]
}

interface CaseComplexitySelectorProps {
  facilityId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  procedureCategoryId?: string | null // Required to show complexities
}

export default function CaseComplexitySelector({
  facilityId,
  selectedIds,
  onChange,
  procedureCategoryId
}: CaseComplexitySelectorProps) {
  const supabase = createClient()
  const [allComplexities, setAllComplexities] = useState<Complexity[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  const fetchComplexities = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('complexities')
        .select('id, display_name, description, procedure_category_ids')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setAllComplexities(data || [])
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to Fetch Complexities',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    } finally {
      setLoading(false)
    }
  }, [facilityId, supabase, showToast])

  useEffect(() => {
    fetchComplexities()
  }, [fetchComplexities])

  // Filter complexities based on procedure category
  const filteredComplexities = allComplexities.filter(c => {
    const cats = c.procedure_category_ids || []
    // Show if no categories assigned (applies to all) OR matches selected category
    return cats.length === 0 || (procedureCategoryId && cats.includes(procedureCategoryId))
  })

  const toggleComplexity = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(cid => cid !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  // Show message if no procedure type selected
  if (!procedureCategoryId) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Case Complexities
        </label>
        <p className="text-sm text-slate-400 italic">
          Select a procedure type to see available complexities
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Case Complexities
        </label>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 w-24 bg-slate-100 rounded-full animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (filteredComplexities.length === 0) {
    return null // No complexities for this procedure category
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        Case Complexities
      </label>
      <div className="flex flex-wrap gap-2">
        {filteredComplexities.map((complexity) => {
          const isSelected = selectedIds.includes(complexity.id)
          return (
            <button
              key={complexity.id}
              type="button"
              onClick={() => toggleComplexity(complexity.id)}
              title={complexity.description || undefined}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-150 border
                ${isSelected
                  ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}
            >
              {isSelected && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {!isSelected && (
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {complexity.display_name}
            </button>
          )
        })}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {selectedIds.length} complexit{selectedIds.length === 1 ? 'y' : 'ies'} selected
        </p>
      )}
    </div>
  )
}