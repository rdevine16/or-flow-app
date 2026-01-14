'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

interface ImplantCompany {
  id: string
  name: string
  facility_id: string | null
}

interface ImplantCompanySelectProps {
  facilityId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export default function ImplantCompanySelect({
  facilityId,
  selectedIds,
  onChange,
  disabled = false,
}: ImplantCompanySelectProps) {
  const supabase = createClient()
  const [companies, setCompanies] = useState<ImplantCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchCompanies()
  }, [facilityId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('implant_companies')
      .select('id, name, facility_id')
      .or(`facility_id.is.null,facility_id.eq.${facilityId}`)
      .order('name')

    setCompanies(data || [])
    setLoading(false)
  }

  const toggleCompany = (companyId: string) => {
    if (selectedIds.includes(companyId)) {
      onChange(selectedIds.filter(id => id !== companyId))
    } else {
      onChange([...selectedIds, companyId])
    }
  }

  const removeCompany = (companyId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedIds.filter(id => id !== companyId))
  }

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const globalCompanies = filteredCompanies.filter(c => c.facility_id === null)
  const customCompanies = filteredCompanies.filter(c => c.facility_id !== null)

  const selectedCompanies = companies.filter(c => selectedIds.includes(c.id))

  if (loading) {
    return (
      <div className="w-full h-11 bg-slate-100 rounded-lg animate-pulse" />
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected Items Display / Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`min-h-[44px] w-full px-3 py-2 border rounded-lg transition-colors cursor-pointer ${
          disabled
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {selectedCompanies.length === 0 ? (
          <span className="text-slate-400">Select implant companies...</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedCompanies.map(company => (
              <span
                key={company.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-md"
              >
                {company.name}
                {!disabled && (
                  <button
                    onClick={(e) => removeCompany(company.id, e)}
                    className="hover:bg-blue-200 rounded p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search companies..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {filteredCompanies.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                No companies found
              </div>
            ) : (
              <>
                {/* Global Companies */}
                {globalCompanies.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Standard
                    </div>
                    {globalCompanies.map(company => (
                      <div
                        key={company.id}
                        onClick={() => toggleCompany(company.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          selectedIds.includes(company.id)
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          selectedIds.includes(company.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300'
                        }`}>
                          {selectedIds.includes(company.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-slate-900">{company.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Companies */}
                {customCompanies.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Custom
                    </div>
                    {customCompanies.map(company => (
                      <div
                        key={company.id}
                        onClick={() => toggleCompany(company.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          selectedIds.includes(company.id)
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          selectedIds.includes(company.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300'
                        }`}>
                          {selectedIds.includes(company.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-slate-900">{company.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {selectedIds.length} selected
            </span>
            {selectedIds.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
