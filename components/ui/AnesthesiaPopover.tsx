'use client'

import { useState, useRef, useEffect } from 'react'

interface AnesthesiologistOption {
  id: string
  label: string
}

interface AnesthesiaPopoverProps {
  currentAnesthesiologist: { id: string; first_name: string; last_name: string } | null
  availableAnesthesiologists: AnesthesiologistOption[]
  onChange: (anesthesiologistId: string) => void
}

export default function AnesthesiaPopover({ 
  currentAnesthesiologist, 
  availableAnesthesiologists, 
  onChange 
}: AnesthesiaPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredAnesthesiologists = availableAnesthesiologists.filter(
    (a) => a.label.toLowerCase().includes(search.toLowerCase())
  )

  const count = currentAnesthesiologist ? 1 : 0

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
      >
        {/* Single person icon for anesthesia */}
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="text-sm font-semibold text-amber-700">{count} Anesthesia</span>
        <svg className={`w-4 h-4 text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
            <span className="font-semibold text-amber-900">Anesthesiologist</span>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anesthesiologists..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              autoFocus
            />
          </div>

          {/* Current Selection */}
          {currentAnesthesiologist && (
            <div className="p-2 border-b border-slate-100">
              <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg">
                <div className="w-9 h-9 bg-amber-200 rounded-full flex items-center justify-center text-sm font-semibold text-amber-700">
                  {currentAnesthesiologist.first_name[0]}{currentAnesthesiologist.last_name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    {currentAnesthesiologist.first_name} {currentAnesthesiologist.last_name}
                  </p>
                  <p className="text-xs text-amber-600">Currently assigned</p>
                </div>
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}

          {/* Available List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredAnesthesiologists.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-slate-500">No anesthesiologists found</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredAnesthesiologists.map((a) => {
                  const isSelected = currentAnesthesiologist?.id === a.id
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        onChange(a.id)
                        setIsOpen(false)
                        setSearch('')
                      }}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        isSelected 
                          ? 'bg-amber-50 cursor-default' 
                          : 'hover:bg-slate-50'
                      }`}
                      disabled={isSelected}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                        isSelected 
                          ? 'bg-amber-200 text-amber-700' 
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {a.label.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isSelected ? 'text-amber-900' : 'text-slate-900'}`}>
                          {a.label}
                        </p>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
