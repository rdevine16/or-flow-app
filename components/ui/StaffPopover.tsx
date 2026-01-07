'use client'

import { useState, useRef, useEffect } from 'react'

interface Staff {
  id: string
  name: string
  role: string
}

interface StaffOption {
  id: string
  label: string
  subtitle: string
}

interface StaffPopoverProps {
  staff: Staff[]
  availableStaff: StaffOption[]
  onAdd: (userId: string) => void
  onRemove: (staffId: string) => void
}

export default function StaffPopover({ staff, availableStaff, onAdd, onRemove }: StaffPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowAdd(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredStaff = availableStaff.filter(
    (s) =>
      !staff.some((existing) => existing.id === s.id) &&
      (s.label.toLowerCase().includes(search.toLowerCase()) ||
        s.subtitle.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
      >
        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-semibold text-slate-700">{staff.length} Staff</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <span className="font-semibold text-slate-900">Case Staff</span>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>

          {/* Add Staff Search */}
          {showAdd && (
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                autoFocus
              />
              {search && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {filteredStaff.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">No results</p>
                  ) : (
                    filteredStaff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          onAdd(s.id)
                          setSearch('')
                          setShowAdd(false)
                        }}
                        className="w-full flex items-center gap-3 p-2 hover:bg-white rounded-lg text-left transition-colors"
                      >
                        <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-xs font-semibold">
                          {s.label.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.label}</p>
                          <p className="text-xs text-slate-500">{s.subtitle}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Staff List */}
          <div className="max-h-64 overflow-y-auto">
            {staff.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-slate-500">No staff assigned</p>
              </div>
            ) : (
              <div className="p-2">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">
                        {s.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{s.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(s.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}