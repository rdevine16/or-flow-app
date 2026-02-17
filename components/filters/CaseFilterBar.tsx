'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ClipboardList, Search, User, X } from 'lucide-react'

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

interface SearchResult {
  type: 'case' | 'surgeon' | 'room' | 'procedure' | 'filter'
  id: string
  title: string
  subtitle?: string
  action: () => void
}

interface CasesFilterBarProps {
  surgeons: Surgeon[]
  rooms: Room[]
  procedureTypes: ProcedureType[]
  cases?: Array<{
    id: string
    case_number: string
    procedure_name?: string
    surgeon_name?: string
    room_name?: string
  }>
  totalCount: number
  filteredCount: number
  onFiltersChange: (filters: FilterState) => void
  onCaseSelect?: (caseId: string) => void
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
  { value: 'draft', label: 'Drafts' },
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
        <ChevronDown 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
        {hasSelection && multiSelect && (
          <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold bg-blue-600 text-white rounded-full">
            {selected.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-[100] py-2 max-h-64 overflow-y-auto">
          {multiSelect && selected.length > 0 && (
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
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  )}
                  <span>{option.label}</span>
                </div>
                {showCounts && option.count !== undefined && (
                  <span className="text-xs text-slate-400">{option.count}</span>
                )}
                {!multiSelect && isSelected && (
                  <Check className="w-4 h-4 text-blue-600" />
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
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

// ============================================================================
// INLINE SEARCH WITH DROPDOWN
// ============================================================================

interface InlineSearchProps {
  value: string
  onChange: (value: string) => void
  surgeons: Surgeon[]
  rooms: Room[]
  procedureTypes: ProcedureType[]
  cases?: CasesFilterBarProps['cases']
  onSurgeonSelect: (id: string) => void
  onRoomSelect: (id: string) => void
  onProcedureSelect: (id: string) => void
  onCaseSelect?: (id: string) => void
}

function InlineSearch({
  value,
  onChange,
  surgeons,
  rooms,
  procedureTypes,
  cases = [],
  onSurgeonSelect,
  onRoomSelect,
  onProcedureSelect,
  onCaseSelect,
}: InlineSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Build search results
  const getResults = useCallback((): SearchResult[] => {
    if (!value.trim()) return []
    
    const q = value.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search cases
    cases.forEach(c => {
      if (
        c.case_number.toLowerCase().includes(q) ||
        c.procedure_name?.toLowerCase().includes(q) ||
        c.surgeon_name?.toLowerCase().includes(q) ||
        c.room_name?.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'case',
          id: c.id,
          title: c.case_number,
          subtitle: [c.procedure_name, c.surgeon_name].filter(Boolean).join(' • '),
          action: () => onCaseSelect?.(c.id),
        })
      }
    })

    // Search surgeons
    surgeons.forEach(s => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (name.includes(q) || s.last_name.toLowerCase().includes(q)) {
        results.push({
          type: 'surgeon',
          id: s.id,
          title: `Dr. ${s.last_name}`,
          subtitle: 'Filter by surgeon',
          action: () => {
            onSurgeonSelect(s.id)
            onChange('')
            setIsOpen(false)
          },
        })
      }
    })

    // Search rooms
    rooms.forEach(r => {
      if (r.name.toLowerCase().includes(q)) {
        results.push({
          type: 'room',
          id: r.id,
          title: r.name,
          subtitle: 'Filter by room',
          action: () => {
            onRoomSelect(r.id)
            onChange('')
            setIsOpen(false)
          },
        })
      }
    })

    // Search procedures
    procedureTypes.forEach(p => {
      if (p.name.toLowerCase().includes(q)) {
        results.push({
          type: 'procedure',
          id: p.id,
          title: p.name,
          subtitle: 'Filter by procedure',
          action: () => {
            onProcedureSelect(p.id)
            onChange('')
            setIsOpen(false)
          },
        })
      }
    })

    return results.slice(0, 8) // Limit results
  }, [value, cases, surgeons, rooms, procedureTypes, onSurgeonSelect, onRoomSelect, onProcedureSelect, onCaseSelect, onChange])

  const results = getResults()

  // Reset selected index when results change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0)
  }, [results.length])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      results[selectedIndex].action()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'case':
        return (
          <ClipboardList className="w-4 h-4 text-blue-500" />
        )
      case 'surgeon':
        return (
          <User className="w-4 h-4 text-violet-500" />
        )
      case 'room':
        return (
          <Building2 className="w-4 h-4 text-green-500" />
        )
      case 'procedure':
        return (
          <ClipboardList className="w-4 h-4 text-amber-500" />
        )
      default:
        return null
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
        onFocus={() => value && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-[100] py-2 max-h-80 overflow-y-auto">
          {results.map((result, idx) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => result.action()}
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
                {getIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${idx === selectedIndex ? 'text-blue-900' : 'text-slate-900'}`}>
                  {result.title}
                </p>
                {result.subtitle && (
                  <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                )}
              </div>
              {result.type !== 'case' && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {result.type === 'surgeon' ? 'Filter' : result.type === 'room' ? 'Filter' : 'Filter'}
                </span>
              )}
              {idx === selectedIndex && (
                <kbd className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">↵</kbd>
              )}
            </button>
          ))}
          
          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-slate-100 mt-1">
            <p className="text-xs text-slate-400">
              <span className="font-medium">↑↓</span> navigate • <span className="font-medium">↵</span> select • <span className="font-medium">esc</span> close
            </p>
          </div>
        </div>
      )}

      {/* No results state */}
      {isOpen && value && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-[100] py-6 px-4 text-center">
          <p className="text-sm text-slate-500">No results for &quot;{value}&quot;</p>
          <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN FILTER BAR COMPONENT
// ============================================================================

export default function CasesFilterBar({
  surgeons,
  rooms,
  procedureTypes,
  cases = [],
  totalCount,
  filteredCount,
  onFiltersChange,
  onCaseSelect,
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

  // Use History API to update URL without triggering server navigation
  window.history.replaceState(null, '', newUrl)

  // Notify parent
  onFiltersChange(filters)
}, [filters, onFiltersChange, router])

  // Initialize search input from URL
  useEffect(() => {
    setSearchInput(filters.search)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search (for filtering the list, not the dropdown)
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

  // Handlers for search selections
  const handleSurgeonSelect = (id: string) => {
    if (!filters.surgeonIds.includes(id)) {
      setFilters(prev => ({ ...prev, surgeonIds: [...prev.surgeonIds, id] }))
    }
  }

  const handleRoomSelect = (id: string) => {
    if (!filters.roomIds.includes(id)) {
      setFilters(prev => ({ ...prev, roomIds: [...prev.roomIds, id] }))
    }
  }

  const handleProcedureSelect = (id: string) => {
    if (!filters.procedureIds.includes(id)) {
      setFilters(prev => ({ ...prev, procedureIds: [...prev.procedureIds, id] }))
    }
  }

  const handleCaseSelect = (id: string) => {
    if (onCaseSelect) {
      onCaseSelect(id)
    } else {
      router.push(`/cases/${id}`)
    }
  }

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

  // Transform cases for search
  const searchableCases = cases.map(c => ({
    id: c.id,
    case_number: c.case_number,
    procedure_name: c.procedure_name,
    surgeon_name: c.surgeon_name,
    room_name: c.room_name,
  }))

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
      {/* Main Filter Row */}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Inline Search with Dropdown */}
          <InlineSearch
            value={searchInput}
            onChange={setSearchInput}
            surgeons={surgeons}
            rooms={rooms}
            procedureTypes={procedureTypes}
            cases={searchableCases}
            onSurgeonSelect={handleSurgeonSelect}
            onRoomSelect={handleRoomSelect}
            onProcedureSelect={handleProcedureSelect}
            onCaseSelect={handleCaseSelect}
          />

          {/* Divider */}
          <div className="h-8 w-px bg-slate-200" />

          {/* Date Range */}
          <FilterDropdown
            label="Date Range"
            icon={
              <CalendarDays className="w-4 h-4" />
            }
            options={DATE_OPTIONS}
            selected={[filters.dateRange]}
            onChange={(values) => setFilters(prev => ({ ...prev, dateRange: values[0] || 'week' }))}
          />

          {/* Status */}
          <FilterDropdown
            label="Status"
            icon={
              <CheckCircle2 className="w-4 h-4" />
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
              <User className="w-4 h-4" />
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
              <Building2 className="w-4 h-4" />
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
              <ClipboardList className="w-4 h-4" />
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
                <X className="w-4 h-4" />
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