'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ============================================================================
// TYPES
// ============================================================================

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface Surgeon {
  id: string
  first_name: string
  last_name: string
}

interface Room {
  id: string
  name: string
}

interface ProcedureType {
  id: string
  name: string
}

interface CasesFilterBarProps {
  surgeons: Surgeon[]
  rooms: Room[]
  procedureTypes: ProcedureType[]
  totalCount: number
  filteredCount: number
  onFiltersChange: (filters: FilterState) => void
}

export interface FilterState {
  dateRange: string
  status: string[]
  surgeonIds: string[]
  roomIds: string[]
  procedureIds: string[]
  search: string
}

// ============================================================================
// DATE RANGE OPTIONS
// ============================================================================

const DATE_OPTIONS: FilterOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'all', label: 'All Time' },
]

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// ============================================================================
// DROPDOWN COMPONENT (Reusable)
// ============================================================================

interface FilterDropdownProps {
  label: string
  icon: React.ReactNode
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  multiSelect?: boolean
  showCounts?: boolean
}

function FilterDropdown({ 
  label, 
  icon, 
  options, 
  selected, 
  onChange, 
  multiSelect = false,
  showCounts = false 
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (value: string) => {
    if (multiSelect) {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value))
      } else {
        onChange([...selected, value])
      }
    } else {
      onChange([value])
      setIsOpen(false)
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
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {hasSelection && multiSelect && (
          <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
            {selected.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-2 max-h-64 overflow-y-auto">
          {multiSelect && selected.length > 0 && (
            <>
              <button
                onClick={() => onChange([])}
                className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full px-4 py-2 text-left text-sm flex items-center justify-between
                  ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}
                `}
              >
                <div className="flex items-center gap-3">
                  {multiSelect && (
                    <div className={`
                      w-4 h-4 rounded border flex items-center justify-center
                      ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}
                    `}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                  <span>{option.label}</span>
                </div>
                {showCounts && option.count !== undefined && (
                  <span className="text-xs text-slate-400">{option.count}</span>
                )}
                {!multiSelect && isSelected && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// ACTIVE FILTER PILL
// ============================================================================

interface FilterPillProps {
  label: string
  onRemove: () => void
}

function FilterPill({ label, onRemove }: FilterPillProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:bg-blue-200 rounded p-0.5 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

// ============================================================================
// MAIN FILTER BAR COMPONENT
// ============================================================================

export default function CasesFilterBar({
  surgeons,
  rooms,
  procedureTypes,
  totalCount,
  filteredCount,
  onFiltersChange,
}: CasesFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState('')

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterState>(() => ({
    dateRange: searchParams.get('date') || 'week',
    status: searchParams.getAll('status'),
    surgeonIds: searchParams.getAll('surgeon'),
    roomIds: searchParams.getAll('room'),
    procedureIds: searchParams.getAll('procedure'),
    search: searchParams.get('q') || '',
  }))

  // Sync URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (filters.dateRange !== 'week') params.set('date', filters.dateRange)
    filters.status.forEach(s => params.append('status', s))
    filters.surgeonIds.forEach(s => params.append('surgeon', s))
    filters.roomIds.forEach(r => params.append('room', r))
    filters.procedureIds.forEach(p => params.append('procedure', p))
    if (filters.search) params.set('q', filters.search)
    
    const queryString = params.toString()
    const newUrl = queryString ? `/cases?${queryString}` : '/cases'
    
    // Use replace to avoid polluting browser history
    router.replace(newUrl, { scroll: false })
    
    // Notify parent
    onFiltersChange(filters)
  }, [filters, router, onFiltersChange])

  // Initialize search input from URL
  useEffect(() => {
    setSearchInput(filters.search)
  }, [])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }))
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // Convert data to options
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

  // Get active filter pills
  const getActivePills = () => {
    const pills: { key: string; label: string; onRemove: () => void }[] = []

    // Status pills
    filters.status.forEach(statusValue => {
      const option = STATUS_OPTIONS.find(o => o.value === statusValue)
      if (option) {
        pills.push({
          key: `status-${statusValue}`,
          label: option.label,
          onRemove: () => setFilters(prev => ({
            ...prev,
            status: prev.status.filter(s => s !== statusValue)
          }))
        })
      }
    })

    // Surgeon pills
    filters.surgeonIds.forEach(id => {
      const surgeon = surgeons.find(s => s.id === id)
      if (surgeon) {
        pills.push({
          key: `surgeon-${id}`,
          label: `Dr. ${surgeon.last_name}`,
          onRemove: () => setFilters(prev => ({
            ...prev,
            surgeonIds: prev.surgeonIds.filter(s => s !== id)
          }))
        })
      }
    })

    // Room pills
    filters.roomIds.forEach(id => {
      const room = rooms.find(r => r.id === id)
      if (room) {
        pills.push({
          key: `room-${id}`,
          label: room.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            roomIds: prev.roomIds.filter(r => r !== id)
          }))
        })
      }
    })

    // Procedure pills
    filters.procedureIds.forEach(id => {
      const proc = procedureTypes.find(p => p.id === id)
      if (proc) {
        pills.push({
          key: `procedure-${id}`,
          label: proc.name,
          onRemove: () => setFilters(prev => ({
            ...prev,
            procedureIds: prev.procedureIds.filter(p => p !== id)
          }))
        })
      }
    })

    return pills
  }

  const activePills = getActivePills()
  const hasActiveFilters = activePills.length > 0 || filters.dateRange !== 'week' || filters.search

  const clearAllFilters = () => {
    setFilters({
      dateRange: 'week',
      status: [],
      surgeonIds: [],
      roomIds: [],
      procedureIds: [],
      search: '',
    })
    setSearchInput('')
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Main Filter Row */}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search cases..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-slate-200" />

          {/* Date Range */}
          <FilterDropdown
            label="Date Range"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            options={DATE_OPTIONS}
            selected={[filters.dateRange]}
            onChange={(values) => setFilters(prev => ({ ...prev, dateRange: values[0] || 'week' }))}
          />

          {/* Status */}
          <FilterDropdown
            label="Status"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            options={STATUS_OPTIONS}
            selected={filters.status}
            onChange={(values) => setFilters(prev => ({ ...prev, status: values }))}
            multiSelect
          />

          {/* Surgeon */}
          <FilterDropdown
            label="Surgeon"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            options={surgeonOptions}
            selected={filters.surgeonIds}
            onChange={(values) => setFilters(prev => ({ ...prev, surgeonIds: values }))}
            multiSelect
          />

          {/* Room */}
          <FilterDropdown
            label="Room"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            options={roomOptions}
            selected={filters.roomIds}
            onChange={(values) => setFilters(prev => ({ ...prev, roomIds: values }))}
            multiSelect
          />

          {/* Procedure */}
          <FilterDropdown
            label="Procedure"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            options={procedureOptions}
            selected={filters.procedureIds}
            onChange={(values) => setFilters(prev => ({ ...prev, procedureIds: values }))}
            multiSelect
          />

          {/* Clear All */}
          {hasActiveFilters && (
            <>
              <div className="h-8 w-px bg-slate-200" />
              <button
                onClick={clearAllFilters}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active Filters Pills */}
      {activePills.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap items-center gap-2">
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

      {/* Results Count Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filteredCount}</span> of{' '}
          <span className="font-semibold text-slate-700">{totalCount}</span> cases
        </span>
        {hasActiveFilters && filteredCount < totalCount && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Show all {totalCount} cases
          </button>
        )}
      </div>
    </div>
  )
}