'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { extractName } from '@/lib/formatters'
import { useToast } from '@/components/ui/Toast/ToastProvider'

// ============================================================================
// TYPES
// ============================================================================

interface SearchResult {
  type: 'case' | 'surgeon' | 'room' | 'page' | 'action'
  id: string
  title: string
  subtitle?: string
  href?: string
  meta?: {
    status?: string
    date?: string
    room?: string
  }
}

interface Case {
  id: string
  case_number: string
  scheduled_date: string
  or_rooms: { name: string }[] | { name: string } | null
  procedure_types: { name: string }[] | { name: string } | null
  case_statuses: { name: string }[] | { name: string } | null
  surgeon: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
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

interface GlobalSearchProps {
  facilityId: string | null
}

// ============================================================================
// STATIC PAGES & ACTIONS
// ============================================================================

const STATIC_PAGES: SearchResult[] = [
  { type: 'page', id: 'dashboard', title: 'Dashboard', subtitle: 'Overview and metrics', href: '/dashboard' },
  { type: 'page', id: 'cases', title: 'Cases', subtitle: 'All surgical cases', href: '/cases' },
  { type: 'page', id: 'rooms', title: 'Rooms', subtitle: 'OR room status', href: '/rooms' },
  { type: 'page', id: 'analytics', title: 'Analytics', subtitle: 'Performance metrics', href: '/analytics' },
  { type: 'page', id: 'settings', title: 'Settings', subtitle: 'Facility configuration', href: '/settings' },
]

const STATIC_ACTIONS: SearchResult[] = [
  { type: 'action', id: 'new-case', title: 'Create New Case', subtitle: 'Add a surgical case', href: '/cases/new' },
  { type: 'action', id: 'active-cases', title: 'View Active Cases', subtitle: 'Cases in progress', href: '/cases?status=in_progress&status=scheduled&status=delayed' },
  { type: 'action', id: 'today-cases', title: "View Today's Cases", subtitle: 'All cases for today', href: '/cases?date=today' },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getSurgeonName = (data: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null): string => {
  if (!data) return 'Unassigned'
  const surgeon = Array.isArray(data) ? data[0] : data
  if (!surgeon) return 'Unassigned'
  return `Dr. ${surgeon.last_name}`
}

const formatDate = (dateString: string): string => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const caseDate = new Date(year, month - 1, day)
  
  if (caseDate.getTime() === today.getTime()) return 'Today'
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (caseDate.getTime() === yesterday.getTime()) return 'Yesterday'
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (caseDate.getTime() === tomorrow.getTime()) return 'Tomorrow'
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================================================
// ICONS
// ============================================================================

function ResultIcon({ type }: { type: SearchResult['type'] }) {
  switch (type) {
    case 'case':
      return (
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    case 'surgeon':
      return (
        <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'room':
      return (
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    case 'page':
      return (
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    case 'action':
      return (
        <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
  }
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    in_progress: 'bg-emerald-500',
    scheduled: 'bg-blue-500',
    delayed: 'bg-amber-500',
    completed: 'bg-slate-400',
    cancelled: 'bg-red-500',
  }
  return <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-slate-300'}`} />
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GlobalSearch({ facilityId }: GlobalSearchProps) {
  const router = useRouter()
  const supabase = createClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // Cache for data
  const [cases, setCases] = useState<Case[]>([])
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

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

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open/focus with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      
      // Also open with / when not in an input
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Load data when focused
  const loadData = async () => {
    if (!facilityId || dataLoaded) return
    
    setIsLoading(true)
    
    try {
      // Load recent cases (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      // Get surgeon role
      const { data: surgeonRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('name', 'surgeon')
        .single()
      
      const [casesRes, surgeonsRes, roomsRes] = await Promise.all([
        supabase
          .from('cases')
          .select(`
            id,
            case_number,
            scheduled_date,
            or_rooms (name),
            procedure_types (name),
            case_statuses (name),
            surgeon:users!cases_surgeon_id_fkey (first_name, last_name)
          `)
          .eq('facility_id', facilityId)
          .gte('scheduled_date', thirtyDaysAgo.toISOString().split('T')[0])
          .order('scheduled_date', { ascending: false })
          .limit(100),
        
        supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('facility_id', facilityId)
          .eq('role_id', surgeonRole?.id || ''),
        
        supabase
          .from('or_rooms')
          .select('id, name')
          .eq('facility_id', facilityId)
          .order('name'),
      ])

      setCases((casesRes.data as unknown as Case[]) || [])
      setSurgeons((surgeonsRes.data as Surgeon[]) || [])
      setRooms((roomsRes.data as Room[]) || [])
      setDataLoaded(true)
    } catch (error) {
showToast({
  type: 'error',
  title: 'Error loading search data:',
  message: error instanceof Error ? error.message : 'Error loading search data:'
})    }
    
    setIsLoading(false)
  }

  // Search logic
  const performSearch = useCallback((searchQuery: string) => {
    const q = searchQuery.toLowerCase().trim()
    
    if (!q) {
      // Show suggestions when empty
      setResults([
        ...STATIC_ACTIONS.slice(0, 2),
        ...STATIC_PAGES.slice(0, 3),
      ])
      return
    }

    const searchResults: SearchResult[] = []

    // Search cases
    cases.forEach(c => {
      const caseNumber = c.case_number.toLowerCase()
      const procedure = extractName(c.procedure_types)?.toLowerCase() || ''
      const surgeon = getSurgeonName(c.surgeon).toLowerCase()
      const room = extractName(c.or_rooms)?.toLowerCase() || ''
      
      if (
        caseNumber.includes(q) ||
        procedure.includes(q) ||
        surgeon.includes(q) ||
        room.includes(q)
      ) {
        searchResults.push({
          type: 'case',
          id: c.id,
          title: c.case_number,
          subtitle: `${extractName(c.procedure_types) || 'No procedure'} • ${getSurgeonName(c.surgeon)}`,
          href: `/cases/${c.id}`,
          meta: {
            status: extractName(c.case_statuses) || 'scheduled',
            date: formatDate(c.scheduled_date),
            room: extractName(c.or_rooms) || undefined,
          }
        })
      }
    })

    // Search surgeons → link to filtered cases
    surgeons.forEach(s => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (name.includes(q) || s.last_name.toLowerCase().includes(q)) {
        searchResults.push({
          type: 'surgeon',
          id: s.id,
          title: `Dr. ${s.last_name}`,
          subtitle: 'View all cases',
          href: `/cases?surgeon=${s.id}`,
        })
      }
    })

    // Search rooms
    rooms.forEach(r => {
      if (r.name.toLowerCase().includes(q)) {
        searchResults.push({
          type: 'room',
          id: r.id,
          title: r.name,
          subtitle: 'View room cases',
          href: `/cases?room=${r.id}`,
        })
      }
    })

    // Search static pages
    STATIC_PAGES.forEach(page => {
      if (
        page.title.toLowerCase().includes(q) ||
        page.subtitle?.toLowerCase().includes(q)
      ) {
        searchResults.push(page)
      }
    })

    // Search actions
    STATIC_ACTIONS.forEach(action => {
      if (
        action.title.toLowerCase().includes(q) ||
        action.subtitle?.toLowerCase().includes(q)
      ) {
        searchResults.push(action)
      }
    })

    // Sort: cases first, then surgeons, then pages/actions
    searchResults.sort((a, b) => {
      const order = { case: 0, surgeon: 1, room: 2, action: 3, page: 4 }
      return order[a.type] - order[b.type]
    })

    setResults(searchResults.slice(0, 8))
    setSelectedIndex(0)
  }, [cases, surgeons, rooms])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => performSearch(query), 150)
    return () => clearTimeout(timeout)
  }, [query, performSearch])

  // Handle selection
  const handleSelect = (result: SearchResult) => {
    if (result.href) {
      router.push(result.href)
    }
    setIsOpen(false)
    setQuery('')
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Search Input */}
      <div className="relative">
        <svg 
          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search cases, surgeons..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
            loadData()
          }}
          onKeyDown={handleKeyDown}
          className="w-64 pl-10 pr-12 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-400"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
          ⌘K
        </kbd>
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-[200] overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-6 text-center">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-500 mt-2">Loading...</p>
            </div>
          ) : results.length === 0 && query ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-500">No results for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try a case number, surgeon name, or procedure</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {/* Group results */}
              {['case', 'surgeon', 'room', 'action', 'page'].map(type => {
                const typeResults = results.filter(r => r.type === type)
                if (typeResults.length === 0) return null
                
                const labels: Record<string, string> = {
                  case: 'Cases',
                  surgeon: 'Surgeons',
                  room: 'Rooms',
                  action: 'Quick Actions',
                  page: 'Pages',
                }
                
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {labels[type]}
                      </span>
                    </div>
                    {typeResults.map((result) => {
                      const globalIndex = results.findIndex(r => r.id === result.id && r.type === result.type)
                      const isSelected = globalIndex === selectedIndex
                      
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`
                            w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors
                            ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                          `}
                        >
                          <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                            ${isSelected ? 'bg-blue-100' : 'bg-slate-100'}
                          `}>
                            <ResultIcon type={result.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                {result.title}
                              </span>
                              {result.meta?.status && (
                                <StatusDot status={result.meta.status} />
                              )}
                            </div>
                            {result.subtitle && (
                              <p className="text-xs text-slate-500 truncate">{result.subtitle}</p>
                            )}
                          </div>
                          {result.meta?.date && (
                            <span className="text-xs text-slate-400 flex-shrink-0">{result.meta.date}</span>
                          )}
                          {result.meta?.room && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                              {result.meta.room}
                            </span>
                          )}
                          {isSelected && (
                            <kbd className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                              ↵
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">↵</kbd> select</span>
            </div>
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded">esc</kbd> close</span>
          </div>
        </div>
      )}
    </div>
  )
}