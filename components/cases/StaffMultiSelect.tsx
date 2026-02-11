'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

interface StaffUser {
  id: string
  first_name: string
  last_name: string
  role_id: string
  role_name: string
}

interface StaffSelection {
  user_id: string
  role_id: string
}

interface StaffMultiSelectProps {
  facilityId: string
  selectedStaff: StaffSelection[]
  onChange: (staff: StaffSelection[]) => void
  /** Exclude these user IDs (e.g., the already-selected surgeon) */
  excludeUserIds?: string[]
  disabled?: boolean
}

/** Role display config — order determines section order */
const ROLE_SECTIONS: { key: string; label: string; color: string }[] = [
  { key: 'nurse', label: 'Nurses', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'tech', label: 'Techs', color: 'bg-purple-100 text-purple-700' },
  { key: 'anesthesiologist', label: 'Anesthesiologists', color: 'bg-orange-100 text-orange-700' },
]

export default function StaffMultiSelect({
  facilityId,
  selectedStaff,
  onChange,
  excludeUserIds = [],
  disabled = false,
}: StaffMultiSelectProps) {
  const supabase = createClient()
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStaff()
  }, [facilityId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, role_id, user_roles(name)')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('last_name')

    if (data) {
      const mapped: StaffUser[] = data.map((u: Record<string, unknown>) => ({
        id: u.id as string,
        first_name: u.first_name as string,
        last_name: u.last_name as string,
        role_id: u.role_id as string,
        role_name: ((u.user_roles as { name: string } | null)?.name || 'other').toLowerCase(),
      }))
      setStaff(mapped)
    }

    setLoading(false)
  }

  const selectedIds = selectedStaff.map(s => s.user_id)

  const toggleStaff = (user: StaffUser) => {
    if (selectedIds.includes(user.id)) {
      onChange(selectedStaff.filter(s => s.user_id !== user.id))
    } else {
      onChange([...selectedStaff, { user_id: user.id, role_id: user.role_id }])
    }
  }

  const removeStaff = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selectedStaff.filter(s => s.user_id !== userId))
  }

  // Filter out excluded users (e.g., selected surgeon) and apply search
  const availableStaff = staff.filter(s => {
    if (excludeUserIds.includes(s.id)) return false
    // Exclude surgeons — primary surgeon is a dedicated form field
    if (s.role_name === 'surgeon') return false
    if (!searchQuery) return true
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase())
  })

  // Group by role section
  const groupedStaff: Record<string, StaffUser[]> = {}
  for (const section of ROLE_SECTIONS) {
    groupedStaff[section.key] = availableStaff.filter(s => s.role_name === section.key)
  }
  // Catch-all for roles not in ROLE_SECTIONS
  const knownRoles = ROLE_SECTIONS.map(s => s.key)
  const otherStaff = availableStaff.filter(s => !knownRoles.includes(s.role_name))
  if (otherStaff.length > 0) {
    groupedStaff['other'] = otherStaff
  }

  const selectedUsers = staff.filter(s => selectedIds.includes(s.id))

  const getRoleBadge = (roleName: string) => {
    const section = ROLE_SECTIONS.find(s => s.key === roleName)
    return section?.color || 'bg-slate-100 text-slate-700'
  }

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
        {selectedUsers.length === 0 ? (
          <span className="text-slate-400">Select staff members...</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedUsers.map(user => (
              <span
                key={user.id}
                className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md ${getRoleBadge(user.role_name)}`}
              >
                {user.first_name} {user.last_name}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => removeStaff(user.id, e)}
                    className="hover:opacity-70 rounded p-0.5"
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
                placeholder="Search staff..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Options grouped by role */}
          <div className="max-h-60 overflow-y-auto">
            {availableStaff.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                No staff found
              </div>
            ) : (
              <>
                {ROLE_SECTIONS.map(section => {
                  const sectionStaff = groupedStaff[section.key]
                  if (!sectionStaff || sectionStaff.length === 0) return null

                  return (
                    <div key={section.key}>
                      <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                        {section.label}
                      </div>
                      {sectionStaff.map(user => (
                        <div
                          key={user.id}
                          onClick={() => toggleStaff(user)}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            selectedIds.includes(user.id)
                              ? 'bg-blue-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            selectedIds.includes(user.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-slate-300'
                          }`}>
                            {selectedIds.includes(user.id) && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-slate-900">
                            {user.first_name} {user.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Other roles */}
                {groupedStaff['other'] && groupedStaff['other'].length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Other
                    </div>
                    {groupedStaff['other'].map(user => (
                      <div
                        key={user.id}
                        onClick={() => toggleStaff(user)}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          selectedIds.includes(user.id)
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          selectedIds.includes(user.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300'
                        }`}>
                          {selectedIds.includes(user.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-slate-900">
                          {user.first_name} {user.last_name}
                        </span>
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
              {selectedStaff.length} selected
            </span>
            {selectedStaff.length > 0 && (
              <button
                type="button"
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
