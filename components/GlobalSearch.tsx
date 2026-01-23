'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

// ============================================================================
// TYPES
// ============================================================================

interface SearchResult {
  type: 'case' | 'surgeon' | 'room' | 'page' | 'action'
  id: string
  title: string
  subtitle?: string
  icon: 'case' | 'person' | 'room' | 'page' | 'action'
  href?: string
  action?: () => void
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
  { type: 'page', id: 'dashboard', title: 'Dashboard', subtitle: 'Overview and metrics', icon: 'page', href: '/dashboard' },
  { type: 'page', id: 'cases', title: 'Cases', subtitle: 'All surgical cases', icon: 'page', href: '/cases' },
  { type: 'page', id: 'rooms', title: 'Rooms', subtitle: 'OR room status', icon: 'room', href: '/rooms' },
  { type: 'page', id: 'analytics', title: 'Analytics', subtitle: 'Performance metrics', icon: 'page', href: '/analytics' },
  { type: 'page', id: 'settings', title: 'Settings', subtitle: 'Facility configuration', icon: 'page', href: '/settings' },
]

const STATIC_ACTIONS: SearchResult[] = [
  { type: 'action', id: 'new-case', title: 'Create New Case', subtitle: 'Add a surgical case', icon: 'action', href: '/cases/new' },
  { type: 'action', id: 'active-cases', title: 'View Active Cases', subtitle: 'Cases in progress', icon: 'action', href: '/cases?status=in_progress&status=scheduled&status=delayed' },
  { type: 'action', id: 'today-cases', title: "View Today's Cases", subtitle: 'All cases for today', icon: 'action', href: '/cases?date=today' },
  { type: 'action', id: 'completed-cases', title: 'View Completed Cases', subtitle: 'Finished cases', icon: 'action', href: '/cases?status=completed' },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getValue = (data: { name: string }[] | { name: string } | null): string | null => {
  if (!data) return null
  if (Array.isArray(data)) return data[0]?.name || null
  return data.name
}

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
// ICON COMPONENTS
// ============================================================================

function ResultIcon({ type }: { type: SearchResult['icon'] }) {
  const baseClass = "w-5 h-5"
  
  switch (type) {
    case 'case':
      return (
        <svg className={`${baseClass} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    case 'person':
      return (
        <svg className={`${baseClass} text-violet-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'room':
      return (
        <svg className={`${baseClass} text-emerald-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    case 'page':
      return (
        <svg className={`${baseClass} text-slate-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    case 'action':
      return (
        <svg className={`${baseClass} text-amber-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  // Cache for data
  const [cases, setCases] = useState<Case[]>([])
  const [surgeons, setSurgeons] = useState<Surgeon[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      
      // Also open with /
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        setIsOpen(true)
      }
      
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0)
      loadInitialData()
    } else {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadInitialData = async () => {
    if (!facilityId || cases.length > 0) return // Already loaded
    
    setIsLoading(true)
    
    try {
      // Load recent cases (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
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
          .eq('role_id', (await supabase.from('user_roles').select('id').eq('name', 'surgeon').single()).data?.id),
        
        supabase
          .from('or_rooms')
          .select('id, name')
          .eq('facility_id', facilityId)
          .order('name'),
      ])

      setCases((casesRes.data as unknown as Case[]) || [])
      setSurgeons((surgeonsRes.data as Surgeon[]) || [])
      setRooms((roomsRes.data as Room[]) || [])
    } catch (error) {
      console.error('Error loading search data:', error)
    }
    
    setIsLoading(false)
  }

  // ============================================================================
  // SEARCH LOGIC
  // ============================================================================

  const performSearch = useCallback((searchQuery: string) => {
    const q = searchQuery.toLowerCase().trim()
    
    if (!q) {
      // Show recent/suggested items when no query
      setResults([
        ...STATIC_ACTIONS.slice(0, 3),
        ...STATIC_PAGES.slice(0, 3),
      ])
      return
    }

    const searchResults: SearchResult[] = []

    // Search cases
    cases.forEach(c => {
      const caseNumber = c.case_number.toLowerCase()
      const procedure = getValue(c.procedure_types)?.toLowerCase() || ''
      const surgeon = getSurgeonName(c.surgeon).toLowerCase()
      const room = getValue(c.or_rooms)?.toLowerCase() || ''
      
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
          subtitle: `${getValue(c.procedure_types) || 'No procedure'} • ${getSurgeonName(c.surgeon)}`,
          icon: 'case',
          href: `/cases/${c.id}`,
          meta: {
            status: getValue(c.case_statuses) || 'scheduled',
            date: formatDate(c.scheduled_date),
            room: getValue(c.or_rooms) || undefined,
          }
        })
      }
    })

    // Search surgeons → link to filtered cases
    surgeons.forEach(s => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase()
      if (name.includes(q) || s.last_name.toLowerCase().includes(q)) {
        const surgeonCaseCount = cases.filter(c => {
          const cSurgeon = Array.isArray(c.surgeon) ? c.surgeon[0] : c.surgeon
          return cSurgeon?.last_name === s.last_name
        }).length
        
        searchResults.push({
          type: 'surgeon',
          id: s.id,
          title: `Dr. ${s.last_name}`,
          subtitle: `${surgeonCaseCount} recent cases • View all cases`,
          icon: 'person',
          href: `/cases?surgeon=${s.id}`,
        })
      }
    })

    // Search rooms → link to rooms page or filtered cases
    rooms.forEach(r => {
      if (r.name.toLowerCase().includes(q)) {
        searchResults.push({
          type: 'room',
          id: r.id,
          title: r.name,
          subtitle: 'View room cases',
          icon: 'room',
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

    setResults(searchResults.slice(0, 10))
    setSelectedIndex(0)
  }, [cases, surgeons, rooms])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => performSearch(query), 150)
    return () => clearTimeout(timeout)
  }, [query, performSearch])

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const handleSelect = (result: SearchResult) => {
    if (result.action) {
      result.action()
    } else if (result.href) {
      router.push(result.href)
    }
    setIsOpen(false)
  }

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
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!isOpen) {
    // Render just the trigger button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors group"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="text-sm text-slate-500">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white rounded border border-slate-200">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
        <div 
          className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200">
            <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search cases, surgeons, or type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-base text-slate-900 placeholder-slate-400 outline-none"
            />
            {isLoading && (
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            )}
            <kbd className="px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {results.length === 0 && query ? (
              <div className="px-4 py-8 text-center">
                <p className="text-slate-500">No results found for "{query}"</p>
                <p className="text-sm text-slate-400 mt-1">Try searching for a case number, surgeon, or procedure</p>
              </div>
            ) : (
              <div className="py-2">
                {/* Group results by type */}
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
                      <div className="px-4 py-2">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          {labels[type]}
                        </span>
                      </div>
                      {typeResults.map((result, idx) => {
                        const globalIndex = results.findIndex(r => r.id === result.id)
                        const isSelected = globalIndex === selectedIndex
                        
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`
                              w-full px-4 py-3 flex items-center gap-3 text-left transition-colors
                              ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                            `}
                          >
                            <div className={`
                              w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                              ${isSelected ? 'bg-blue-100' : 'bg-slate-100'}
                            `}>
                              <ResultIcon type={result.icon} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                  {result.title}
                                </span>
                                {result.meta?.status && (
                                  <StatusDot status={result.meta.status} />
                                )}
                              </div>
                              {result.subtitle && (
                                <p className="text-sm text-slate-500 truncate">{result.subtitle}</p>
                              )}
                            </div>
                            {result.meta?.date && (
                              <span className="text-xs text-slate-400 flex-shrink-0">{result.meta.date}</span>
                            )}
                            {result.meta?.room && (
                              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                                {result.meta.room}
                              </span>
                            )}
                            {isSelected && (
                              <kbd className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
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
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↓</kbd>
                to navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">↵</kbd>
                to select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded">esc</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </>
  )
}