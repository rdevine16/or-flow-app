'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowLeftRight, ChevronDown, Plus, User, X } from 'lucide-react'

interface Anesthesiologist {
  id: string
  first_name: string
  last_name: string
}

interface AnesthesiologistOption {
  id: string
  label: string
}

interface AnesthesiaPopoverProps {
  currentAnesthesiologist: Anesthesiologist | null
  availableAnesthesiologists: AnesthesiologistOption[]
  onChange: (anesthesiologistId: string) => void
  onRemove: () => void
}

export default function AnesthesiaPopover({ 
  currentAnesthesiologist, 
  availableAnesthesiologists, 
  onChange,
  onRemove 
}: AnesthesiaPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showChange, setShowChange] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowChange(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredAnesthesiologists = availableAnesthesiologists.filter(
    (a) =>
      a.id !== currentAnesthesiologist?.id &&
      a.label.toLowerCase().includes(search.toLowerCase())
  )

  const count = currentAnesthesiologist ? 1 : 0

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
      >
        {/* Single person icon */}
        <User className="w-5 h-5 text-amber-600" />
        <span className="text-sm font-semibold text-amber-700">{count} Anesthesia</span>
        <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
            <span className="font-semibold text-amber-900">Anesthesiologist</span>
            <button
              onClick={() => setShowChange(!showChange)}
              className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              {currentAnesthesiologist ? (
                <ArrowLeftRight className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {currentAnesthesiologist ? 'Change' : 'Add'}
            </button>
          </div>

          {/* Change/Add Search */}
          {showChange && (
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search anesthesiologists..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                autoFocus
              />
              {search && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {filteredAnesthesiologists.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">No results</p>
                  ) : (
                    filteredAnesthesiologists.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          onChange(a.id)
                          setSearch('')
                          setShowChange(false)
                        }}
                        className="w-full flex items-center gap-3 p-2 hover:bg-white rounded-lg text-left transition-colors"
                      >
                        <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-semibold">
                          {a.label.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{a.label}</p>
                          <p className="text-xs text-slate-500">Anesthesiologist</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Current Assignment */}
          <div className="max-h-64 overflow-y-auto">
            {!currentAnesthesiologist ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-slate-500">No anesthesiologist assigned</p>
              </div>
            ) : (
              <div className="p-2">
                <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-200 rounded-full flex items-center justify-center text-sm font-semibold text-amber-700">
                      {currentAnesthesiologist.first_name[0]}{currentAnesthesiologist.last_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {currentAnesthesiologist.first_name} {currentAnesthesiologist.last_name}
                      </p>
                      <p className="text-xs text-slate-500">Anesthesiologist</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onRemove()
                      setIsOpen(false)
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
