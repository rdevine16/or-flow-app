'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, User, Building2, ClipboardList, ChevronDown, Check, X } from 'lucide-react'
import DateRangeSelector from '@/components/ui/DateRangeSelector'

// ============================================================================
// TYPES
// ============================================================================

interface FilterOption {
  value: string
  label: string
}

interface CasesFilterBarProps {
  // Search
  searchInput: string
  onSearchChange: (value: string) => void

  // Date range
  dateRangePreset: string
  onDateRangeChange: (range: string, startDate: string, endDate: string) => void

  // Filters
  surgeonIds: string[]
  onSurgeonIdsChange: (ids: string[]) => void
  roomIds: string[]
  onRoomIdsChange: (ids: string[]) => void
  procedureIds: string[]
  onProcedureIdsChange: (ids: string[]) => void

  // Lookup data for dropdowns
  surgeons: Array<{ id: string; first_name: string; last_name: string }>
  rooms: Array<{ id: string; name: string }>
  procedureTypes: Array<{ id: string; name: string }>

  // Clear all
  hasActiveFilters: boolean
  onClearAll: () => void
}

// ============================================================================
// FILTER DROPDOWN (reusable multi-select)
// ============================================================================

interface FilterDropdownProps {
  label: string
  icon: React.ReactNode
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
}

function FilterDropdown({ label, icon, options, selected, onChange }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const getDisplayLabel = () => {
    if (selected.length === 0) return label
    if (selected.length === 1) {
      const option = options.find(o => o.value === selected[0])
      return option?.label || label
    }
    return `${selected.length} selected`
  }

  const hasSelection = selected.length > 0

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg
          border transition-all duration-200
          ${hasSelection
            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }
        `}
      >
        {icon}
        <span>{getDisplayLabel()}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
        {hasSelection && (
          <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
            {selected.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-[100] py-2 max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <>
              <button
                onClick={() => onChange([])}
                className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear selection
              </button>
              <div className="border-t border-slate-100 my-1" />
            </>
          )}
          {options.map((option) => {
            const isSelected = selected.includes(option.value)
            return (
              <button
                key={option.value}
                onClick={() => handleToggle(option.value)}
                className={`
                  w-full px-4 py-2 text-left text-sm flex items-center gap-3
                  ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}
                `}
              >
                <div className={`
                  w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                  ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}
                `}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
          {options.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-400">No options available</p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// FILTER PILL (dismissible active filter chip)
// ============================================================================

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:bg-blue-200 rounded p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

// ============================================================================
// SEARCH WITH ENTITY SUGGESTIONS
// ============================================================================

interface SearchSuggestion {
  type: 'surgeon' | 'room' | 'procedure'
  id: string
  label: string
}

function SearchInput({
  value,
  onChange,
  surgeons,
  rooms,
  procedureTypes,
  onSurgeonSelect,
  onRoomSelect,
  onProcedureSelect,
}: {
  value: string
  onChange: (value: string) => void
  surgeons: CasesFilterBarProps['surgeons']
  rooms: CasesFilterBarProps['rooms']
  procedureTypes: CasesFilterBarProps['procedureTypes']
  onSurgeonSelect: (id: string) => void
  onRoomSelect: (id: string) => void
  onProcedureSelect: (id: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const suggestions = useCallback((): SearchSuggestion[] => {
    if (!value.trim() || value.trim().length < 2) return []
    const q = value.toLowerCase().trim()
    const results: SearchSuggestion[] = []

    for (const s of surgeons) {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (name.includes(q) || s.last_name.toLowerCase().includes(q)) {
        results.push({ type: 'surgeon', id: s.id, label: `Dr. ${s.last_name}` })
      }
    }
    for (const r of rooms) {
      if (r.name.toLowerCase().includes(q)) {
        results.push({ type: 'room', id: r.id, label: r.name })
      }
    }
    for (const p of procedureTypes) {
      if (p.name.toLowerCase().includes(q)) {
        results.push({ type: 'procedure', id: p.id, label: p.name })
      }
    }
    return results.slice(0, 6)
  }, [value, surgeons, rooms, procedureTypes])

  const items = suggestions()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0)
  }, [items.length])

  const handleSelect = (item: SearchSuggestion) => {
    if (item.type === 'surgeon') onSurgeonSelect(item.id)
    else if (item.type === 'room') onRoomSelect(item.id)
    else if (item.type === 'procedure') onProcedureSelect(item.id)
    onChange('')
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || items.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault()
      handleSelect(items[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const getTypeIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'surgeon': return <User className="w-4 h-4 text-violet-500" />
      case 'room': return <Building2 className="w-4 h-4 text-green-500" />
      case 'procedure': return <ClipboardList className="w-4 h-4 text-amber-500" />
    }
  }

  const getTypeLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'surgeon': return 'Surgeon'
      case 'room': return 'Room'
      case 'procedure': return 'Procedure'
    }
  }

  return (
    <div className="relative flex-1 min-w-[200px] max-w-md" ref={containerRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search cases, surgeons, rooms..."
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => value.trim().length >= 2 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={() => { onChange(''); setIsOpen(false) }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isOpen && items.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-[100] py-2 max-h-72 overflow-y-auto">
          <p className="px-4 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
            Filter by
          </p>
          {items.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`
                w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors
                ${idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${idx === selectedIndex ? 'bg-blue-100' : 'bg-slate-100'}
              `}>
                {getTypeIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${idx === selectedIndex ? 'text-blue-900' : 'text-slate-900'}`}>
                  {item.label}
                </p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {getTypeLabel(item.type)}
              </span>
            </button>
          ))}
          <div className="px-4 py-2 border-t border-slate-100 mt-1">
            <p className="text-xs text-slate-400">
              <span className="font-medium">↑↓</span> navigate
              {' '}<span className="font-medium">↵</span> select
              {' '}<span className="font-medium">esc</span> close
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN FILTER BAR COMPONENT
// ============================================================================

export default function CasesFilterBar({
  searchInput,
  onSearchChange,
  dateRangePreset,
  onDateRangeChange,
  surgeonIds,
  onSurgeonIdsChange,
  roomIds,
  onRoomIdsChange,
  procedureIds,
  onProcedureIdsChange,
  surgeons,
  rooms,
  procedureTypes,
  hasActiveFilters,
  onClearAll,
}: CasesFilterBarProps) {
  // Convert lookup data to dropdown options
  const surgeonOptions: FilterOption[] = surgeons.map(s => ({
    value: s.id,
    label: `Dr. ${s.last_name}`,
  }))

  const roomOptions: FilterOption[] = rooms.map(r => ({
    value: r.id,
    label: r.name,
  }))

  const procedureOptions: FilterOption[] = procedureTypes.map(p => ({
    value: p.id,
    label: p.name,
  }))

  // Handle adding a filter from search suggestions (avoid duplicates)
  const handleSurgeonSelect = (id: string) => {
    if (!surgeonIds.includes(id)) {
      onSurgeonIdsChange([...surgeonIds, id])
    }
  }

  const handleRoomSelect = (id: string) => {
    if (!roomIds.includes(id)) {
      onRoomIdsChange([...roomIds, id])
    }
  }

  const handleProcedureSelect = (id: string) => {
    if (!procedureIds.includes(id)) {
      onProcedureIdsChange([...procedureIds, id])
    }
  }

  // Build active filter pills
  const activePills: Array<{ key: string; label: string; onRemove: () => void }> = []

  surgeonIds.forEach(id => {
    const surgeon = surgeons.find(s => s.id === id)
    if (surgeon) {
      activePills.push({
        key: `surgeon-${id}`,
        label: `Dr. ${surgeon.last_name}`,
        onRemove: () => onSurgeonIdsChange(surgeonIds.filter(s => s !== id)),
      })
    }
  })

  roomIds.forEach(id => {
    const room = rooms.find(r => r.id === id)
    if (room) {
      activePills.push({
        key: `room-${id}`,
        label: room.name,
        onRemove: () => onRoomIdsChange(roomIds.filter(r => r !== id)),
      })
    }
  })

  procedureIds.forEach(id => {
    const proc = procedureTypes.find(p => p.id === id)
    if (proc) {
      activePills.push({
        key: `procedure-${id}`,
        label: proc.name,
        onRemove: () => onProcedureIdsChange(procedureIds.filter(p => p !== id)),
      })
    }
  })

  return (
    <div className="space-y-0">
      {/* Main Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <SearchInput
          value={searchInput}
          onChange={onSearchChange}
          surgeons={surgeons}
          rooms={rooms}
          procedureTypes={procedureTypes}
          onSurgeonSelect={handleSurgeonSelect}
          onRoomSelect={handleRoomSelect}
          onProcedureSelect={handleProcedureSelect}
        />

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200" />

        {/* Date Range Filter */}
        <DateRangeSelector
          value={dateRangePreset}
          onChange={onDateRangeChange}
        />

        {/* Surgeon Filter */}
        <FilterDropdown
          label="Surgeon"
          icon={<User className="w-4 h-4" />}
          options={surgeonOptions}
          selected={surgeonIds}
          onChange={onSurgeonIdsChange}
        />

        {/* Room Filter */}
        <FilterDropdown
          label="Room"
          icon={<Building2 className="w-4 h-4" />}
          options={roomOptions}
          selected={roomIds}
          onChange={onRoomIdsChange}
        />

        {/* Procedure Filter */}
        <FilterDropdown
          label="Procedure"
          icon={<ClipboardList className="w-4 h-4" />}
          options={procedureOptions}
          selected={procedureIds}
          onChange={onProcedureIdsChange}
        />

        {/* Clear All */}
        {hasActiveFilters && (
          <>
            <div className="h-8 w-px bg-slate-200" />
            <button
              onClick={onClearAll}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Active Filter Pills */}
      {activePills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active:</span>
          {activePills.map((pill) => (
            <FilterPill
              key={pill.key}
              label={pill.label}
              onRemove={pill.onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
