'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

// Transformed preference for display
interface SurgeonPreference {
  id: string
  procedure_type_id: string
  procedure_name: string
  companies: { id: string; name: string }[]
}

interface SurgeonPreferenceSelectProps {
  surgeonId: string | null
  facilityId: string
  onSelect: (preference: {
    procedureTypeId: string
    implantCompanyIds: string[]
  }) => void
}

// Helper to extract first item from Supabase joined array
function getFirst<T>(arr: T[] | T | null | undefined): T | null {
  if (Array.isArray(arr)) return arr[0] || null
  return arr || null
}

export default function SurgeonPreferenceSelect({
  surgeonId,
  facilityId,
  onSelect,
}: SurgeonPreferenceSelectProps) {
  const supabase = createClient()
  const [preferences, setPreferences] = useState<SurgeonPreference[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (surgeonId) {
      fetchPreferences()
    } else {
      setPreferences([])
      setSelectedId(null)
    }
  }, [surgeonId])

  const fetchPreferences = async () => {
    if (!surgeonId) return

    setLoading(true)
    const { data } = await supabase
      .from('surgeon_preferences')
      .select(`
        id,
        procedure_type_id,
        procedure_types (id, name),
        surgeon_preference_companies (
          implant_company_id,
          implant_companies (id, name)
        )
      `)
      .eq('surgeon_id', surgeonId)
      .eq('facility_id', facilityId)
      .order('created_at')

    // Transform data - Supabase returns joined tables as arrays
    const transformed: SurgeonPreference[] = (data || []).map((pref: any) => {
      const procedure = getFirst(pref.procedure_types)
      const companies = (pref.surgeon_preference_companies || []).map((spc: any) => {
        const company = getFirst(spc.implant_companies)
        return company ? { id: company.id, name: company.name } : null
      }).filter(Boolean)

      return {
        id: pref.id,
        procedure_type_id: pref.procedure_type_id,
        procedure_name: procedure?.name || 'Unknown Procedure',
        companies,
      }
    })

    setPreferences(transformed)
    setLoading(false)
  }

  const handleSelect = (pref: SurgeonPreference) => {
    setSelectedId(pref.id)
    onSelect({
      procedureTypeId: pref.procedure_type_id,
      implantCompanyIds: pref.companies.map(c => c.id),
    })
  }

  if (!surgeonId) {
    return null
  }

  if (loading) {
    return (
      <div className="mb-4">
        <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (preferences.length === 0) {
    return null
  }

  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm font-medium text-blue-900">Quick Fill from Preferences</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {preferences.map((pref) => {
          const companyNames = pref.companies.map(c => c.name).join(', ')

          return (
            <button
              key={pref.id}
              type="button"
              onClick={() => handleSelect(pref)}
              className={`group relative px-3 py-2 rounded-lg text-left transition-all ${
                selectedId === pref.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:shadow-md'
              }`}
            >
              <p className={`text-sm font-medium ${selectedId === pref.id ? 'text-white' : 'text-slate-900'}`}>
                {pref.procedure_name}
              </p>
              {companyNames && (
                <p className={`text-xs mt-0.5 ${selectedId === pref.id ? 'text-blue-100' : 'text-slate-500'}`}>
                  {companyNames}
                </p>
              )}
              
              {/* Checkmark indicator */}
              {selectedId === pref.id && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-blue-600 mt-3">
        Click a preference to auto-fill procedure and implant companies
      </p>
    </div>
  )
}
