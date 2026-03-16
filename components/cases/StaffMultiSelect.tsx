'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getRoleColors } from '@/lib/design-tokens'

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
  fromRoomSchedule?: boolean
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
const ROLE_SECTIONS: { key: string; label: string; icon: string }[] = [
  { key: 'nurse', label: 'Nurses', icon: 'N' },
  { key: 'tech', label: 'Techs', icon: 'T' },
  { key: 'anesthesiologist', label: 'Anesthesiologists', icon: 'A' },
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
  const [activeRole, setActiveRole] = useState<string>(ROLE_SECTIONS[0].key)

  const fetchStaff = useCallback(async () => {
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
  }, [facilityId, supabase])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  const selectedIds = selectedStaff.map(s => s.user_id)

  const toggleStaff = (user: StaffUser) => {
    if (disabled) return
    if (selectedIds.includes(user.id)) {
      onChange(selectedStaff.filter(s => s.user_id !== user.id))
    } else {
      onChange([...selectedStaff, { user_id: user.id, role_id: user.role_id }])
    }
  }

  const removeStaff = (userId: string) => {
    if (disabled) return
    onChange(selectedStaff.filter(s => s.user_id !== userId))
  }

  // Filter out excluded users and surgeons
  const availableStaff = staff.filter(s => {
    if (excludeUserIds.includes(s.id)) return false
    if (s.role_name === 'surgeon') return false
    return true
  })

  // Build role sections with counts
  const knownRoles = ROLE_SECTIONS.map(s => s.key)
  const otherStaff = availableStaff.filter(s => !knownRoles.includes(s.role_name))

  const allSections = [
    ...ROLE_SECTIONS.map(section => ({
      ...section,
      staff: availableStaff.filter(s => s.role_name === section.key),
      selectedCount: availableStaff.filter(s => s.role_name === section.key && selectedIds.includes(s.id)).length,
    })),
    ...(otherStaff.length > 0 ? [{
      key: 'other',
      label: 'Other',
      icon: 'O',
      staff: otherStaff,
      selectedCount: otherStaff.filter(s => selectedIds.includes(s.id)).length,
    }] : []),
  ].filter(s => s.staff.length > 0)

  // Staff in the active role
  const activeStaff = allSections.find(s => s.key === activeRole)?.staff || []

  // All selected users for the right column
  const selectedUsers = staff.filter(s => selectedIds.includes(s.id))

  const getRoleBadge = (roleName: string) => {
    const colors = getRoleColors(roleName)
    return `${colors.bg} ${colors.text}`
  }

  if (loading) {
    return (
      <div className="w-full h-48 bg-slate-100 rounded-xl animate-pulse" />
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="grid grid-cols-1 md:grid-cols-3 min-h-[240px]">
        {/* Column 1: Role Types */}
        <div className="border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50">
          <div className="px-3 py-2 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff Type</span>
          </div>
          <div className="py-1">
            {allSections.map(section => {
              const isActive = activeRole === section.key
              const roleColors = getRoleColors(section.key)
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveRole(section.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50 border-l-2 border-blue-600'
                      : 'hover:bg-slate-100 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${roleColors.bg} ${roleColors.text}`}>
                      {section.icon}
                    </span>
                    <span className={`text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>
                      {section.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {section.selectedCount > 0 && (
                      <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                        {section.selectedCount}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{section.staff.length}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Column 2: Staff Members for Active Role */}
        <div className="border-b md:border-b-0 md:border-r border-slate-200">
          <div className="px-3 py-2 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {allSections.find(s => s.key === activeRole)?.label || 'Staff'}
            </span>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {activeStaff.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400 text-center">
                No staff in this role
              </div>
            ) : (
              activeStaff.map(user => {
                const isSelected = selectedIds.includes(user.id)
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleStaff(user)}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${isSelected ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>
                      {user.first_name} {user.last_name}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Column 3: Selected Staff */}
        <div>
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Selected ({selectedUsers.length})
            </span>
            {selectedUsers.length > 0 && !disabled && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-slate-500 hover:text-red-600 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {selectedUsers.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-xs text-slate-400">No staff selected</p>
                <p className="text-xs text-slate-400 mt-0.5">Pick a role and check names</p>
              </div>
            ) : (
              <div className="py-1">
                {selectedUsers.map(user => {
                  const isFromRoomSchedule = selectedStaff.find(s => s.user_id === user.id)?.fromRoomSchedule
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between px-3 py-2 group hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded ${getRoleBadge(user.role_name)}`}>
                          {user.role_name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm text-slate-800 truncate">
                          {user.first_name} {user.last_name}
                        </span>
                        {isFromRoomSchedule && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded flex-shrink-0">
                            Sched
                          </span>
                        )}
                      </div>
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => removeStaff(user.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
