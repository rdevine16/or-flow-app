'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  id: string
  label: string
  subtitle?: string
}

interface SearchableDropdownProps {
  options: Option[]
  value?: string
  onChange: (id: string) => void
  placeholder?: string
  label?: string
  disabled?: boolean
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  disabled = false,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find((o) => o.id === value)

  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.subtitle?.toLowerCase().includes(search.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (id: string) => {
    onChange(id)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      )}
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen)
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
        disabled={disabled}
        className={`w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-xl flex items-center justify-between transition-all duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500'
        }`}
      >
        <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                    value === option.id ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{option.label}</div>
                  {option.subtitle && (
                    <div className="text-xs text-slate-500">{option.subtitle}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}