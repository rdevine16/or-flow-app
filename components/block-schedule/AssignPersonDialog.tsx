// components/block-schedule/AssignPersonDialog.tsx
// Click-to-assign dialog — keyboard-accessible fallback for drag-and-drop

'use client'

import { useState, useEffect } from 'react'
import { X, Search, UserPlus } from 'lucide-react'
import type { Surgeon } from '@/hooks/useLookups'
import type { StaffMember } from '@/types/staff-assignment'

interface AssignPersonDialogProps {
  isOpen: boolean
  onClose: () => void
  roomName: string
  date: string
  surgeons: Surgeon[]
  staff: StaffMember[]
  onAssignSurgeon: (surgeonId: string) => void
  onAssignStaff: (userId: string, roleId: string) => void
  /** Surgeon IDs already assigned on this date (any room) */
  assignedSurgeonIds: Set<string>
  /** Staff user IDs already assigned on this date (any room) */
  assignedStaffIds: Set<string>
}

export function AssignPersonDialog({
  isOpen,
  onClose,
  roomName,
  date,
  surgeons,
  staff,
  onAssignSurgeon,
  onAssignStaff,
  assignedSurgeonIds,
  assignedStaffIds,
}: AssignPersonDialogProps) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'surgeons' | 'staff'>('surgeons')

  // Reset search when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setTab('surgeons')
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const filteredSurgeons = surgeons.filter((s) => {
    const name = `Dr. ${s.first_name} ${s.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const filteredStaff = staff.filter((s) => {
    if (s.user_roles?.name?.toLowerCase() === 'surgeon') return false
    const name = `${s.first_name} ${s.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Assign person to ${roomName}`}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[340px] max-h-[480px] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-500" />
              Assign to {roomName}
            </h3>
            <p className="text-xs text-slate-500">{dayLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'surgeons'}
            onClick={() => setTab('surgeons')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'surgeons'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Surgeons ({filteredSurgeons.length})
          </button>
          <button
            role="tab"
            aria-selected={tab === 'staff'}
            onClick={() => setTab('staff')}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab === 'staff'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Staff ({filteredStaff.length})
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto px-2 py-1 min-h-[200px]" role="tabpanel">
          {tab === 'surgeons' ? (
            filteredSurgeons.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No surgeons found</p>
            ) : (
              filteredSurgeons.map((s) => {
                const isAssigned = assignedSurgeonIds.has(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onAssignSurgeon(s.id)
                      onClose()
                    }}
                    disabled={isAssigned}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors ${
                      isAssigned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {(s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')}
                    </div>
                    <span className="text-slate-700 truncate">Dr. {s.last_name}</span>
                    {isAssigned && (
                      <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Assigned today
                      </span>
                    )}
                  </button>
                )
              })
            )
          ) : filteredStaff.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No staff found</p>
          ) : (
            filteredStaff.map((s) => {
              const isAssigned = assignedStaffIds.has(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onAssignStaff(s.id, s.role_id)
                    onClose()
                  }}
                  disabled={isAssigned}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors ${
                    isAssigned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {(s.first_name?.[0] ?? '') + (s.last_name?.[0] ?? '')}
                  </div>
                  <div className="truncate flex-1">
                    <span className="text-slate-700">
                      {s.first_name} {s.last_name}
                    </span>
                    {s.user_roles?.name && (
                      <span className="ml-1.5 text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                        {s.user_roles.name}
                      </span>
                    )}
                  </div>
                  {isAssigned && (
                    <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                      Assigned today
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
