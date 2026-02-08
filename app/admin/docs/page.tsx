'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import {
  fetchPages,
  insertPage,
  updatePage,
  deletePage,
  groupByCategory,
  getPagesByTable,
  generateSlug,
  createEmptyPage,
  detectDrift,
  syncAutoFields,
  exportRegistryJSON,
  exportRegistryMarkdown,
  fetchCategories,
  insertCategory,
  updateCategory,
  deleteCategory,
  generateCategorySlug,
  DEFAULT_CATEGORIES,
  CATEGORY_COLOR_OPTIONS,
  ROLE_OPTIONS,
  type PageEntry,
  type PageEntryInsert,
  type PageCategory,
  type Category,
  type CategoryInsert,
  type DriftResult,
} from '@/lib/pageRegistry'
import {
  getTablesMetadata,
  type TableMetadata,
} from '@/lib/supabaseIntrospection'

// =============================================================================
// Icons
// =============================================================================

const Icon = ({ d, className = 'w-4 h-4' }: { d: string; className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const icons = {
  book: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
  chevron: "M9 5l7 7-7 7",
  plus: "M12 4.5v15m7.5-7.5h-15",
  pencil: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10",
  trash: "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  x: "M6 18L18 6M6 6l12 12",
  cube: "M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9",
  table: "M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375",
  bolt: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  device: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
  check: "M4.5 12.75l6 6 9-13.5",
  search: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  scan: "M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5",
  refresh: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182",
  link: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757",
  download: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3",
  warning: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  tag: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z",
}

// =============================================================================
// Constants
// =============================================================================

const TAG_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  purple: 'bg-violet-50 text-violet-700 border-violet-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
}

// Category color maps — Tailwind JIT-safe (no dynamic interpolation)
const CATEGORY_BADGE_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
}

const DOT_COLORS: Record<string, string> = {
  blue: 'bg-blue-500', amber: 'bg-amber-500', red: 'bg-red-500',
  emerald: 'bg-emerald-500', violet: 'bg-violet-500', cyan: 'bg-cyan-500',
  slate: 'bg-slate-400', rose: 'bg-rose-500', orange: 'bg-orange-500', teal: 'bg-teal-500',
}

function getCategoryColor(categories: Category[], categoryName: string): string {
  const cat = categories.find(c => c.name === categoryName)
  return CATEGORY_BADGE_COLORS[cat?.color || 'slate'] || CATEGORY_BADGE_COLORS.slate
}

const FORM_INPUT = 'w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-400'

type DetailTab = 'overview' | 'database' | 'triggers' | 'platform' | 'dependencies'

const TABS: { id: DetailTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: icons.cube },
  { id: 'database', label: 'Database', icon: icons.table },
  { id: 'triggers', label: 'Triggers & FKs', icon: icons.bolt },
  { id: 'platform', label: 'Platform', icon: icons.device },
  { id: 'dependencies', label: 'Dependencies', icon: icons.link },
]

// =============================================================================
// Toast
// =============================================================================

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all duration-200
            ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Main Page
// =============================================================================

export default function AdminDocsPage() {
  const supabase = createClient()
  const { isGlobalAdmin } = useUser()

  // Data state
  const [pages, setPages] = useState<PageEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [tableMetadata, setTableMetadata] = useState<Record<string, TableMetadata>>({})
  const [isLoadingMeta, setIsLoadingMeta] = useState(false)

  // UI state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingPage, setEditingPage] = useState<PageEntryInsert | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  const toastIdRef = useRef(0)

  // Derived
  const selectedPage = useMemo(
    () => pages.find(p => p.id === selectedPageId) ?? null,
    [pages, selectedPageId]
  )

  const grouped = useMemo(() => groupByCategory(pages, categories), [pages, categories])

  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped
    const q = searchQuery.toLowerCase()
    const result: [string, PageEntry[]][] = []
    for (const [cat, catPages] of grouped) {
      const filtered = catPages.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.route.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.reads.some(t => t.toLowerCase().includes(q)) ||
          p.writes.some(t => t.toLowerCase().includes(q)) ||
          (categories.find(c => c.id === cat)?.name || cat).toLowerCase().includes(q)
      )
      if (filtered.length > 0) result.push([cat, filtered])
    }
    return result
  }, [grouped, searchQuery, categories])

  // ============================================
  // Toast helper
  // ============================================

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  // ============================================
  // Data loading
  // ============================================

  const loadPages = useCallback(async () => {
    const [data, cats] = await Promise.all([
      fetchPages(supabase),
      fetchCategories(supabase),
    ])
    setPages(data)
    setCategories(cats)
    setExpandedCategories(prev => {
      const next = new Set(prev)
      cats.forEach(c => next.add(c.id))
      return next
    })
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    loadPages()
  }, [loadPages])

  // Load table metadata when selection changes
  useEffect(() => {
    if (!selectedPage) return
    const allTables = [...new Set([...selectedPage.reads, ...selectedPage.writes])]
    const missing = allTables.filter(t => !tableMetadata[t])
    if (missing.length === 0) return

    setIsLoadingMeta(true)
    getTablesMetadata(supabase, missing).then(meta => {
      setTableMetadata(prev => ({ ...prev, ...meta }))
      setIsLoadingMeta(false)
    })
  }, [selectedPage, tableMetadata, supabase])

  // ============================================
  // CRUD handlers
  // ============================================

  const handleAdd = () => {
    setEditingPage(createEmptyPage())
    setIsEditMode(false)
    setShowForm(true)
  }

  const handleEdit = () => {
    if (!selectedPage) return
    const { created_at, updated_at, ...rest } = selectedPage
    setEditingPage(rest)
    setIsEditMode(true)
    setShowForm(true)
  }

  const handleSave = async (page: PageEntryInsert) => {
    setIsSaving(true)
    if (isEditMode) {
      const { id, ...updates } = page
      const { error } = await updatePage(supabase, id, updates)
      if (error) {
        addToast(`Error: ${error}`, 'error')
      } else {
        addToast(`${page.name} updated`, 'success')
        await loadPages()
      }
    } else {
      const { error } = await insertPage(supabase, page)
      if (error) {
        addToast(`Error: ${error}`, 'error')
      } else {
        addToast(`${page.name} added`, 'success')
        await loadPages()
        setSelectedPageId(page.id)
      }
    }
    setIsSaving(false)
    setShowForm(false)
    setEditingPage(null)
  }

  const handleDelete = async () => {
    if (!selectedPage) return
    const { error } = await deletePage(supabase, selectedPage.id)
    if (error) {
      addToast(`Error: ${error}`, 'error')
    } else {
      addToast(`${selectedPage.name} deleted`, 'success')
      setSelectedPageId(null)
      await loadPages()
    }
    setShowDeleteConfirm(false)
  }

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // ============================================
  // Scanner import handler
  // ============================================

  const handleScannerImport = (pageData: PageEntryInsert) => {
    setShowScanner(false)
    setEditingPage(pageData)
    setIsEditMode(false)
    setShowForm(true)
  }

  const handleScannerBulkDone = () => {
    setShowScanner(false)
    loadPages()
  }

  // ============================================
  // Export handler
  // ============================================

  const handleExport = (format: 'json' | 'md') => {
    const content = format === 'json'
      ? exportRegistryJSON(pages, categories)
      : exportRegistryMarkdown(pages, categories)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orbit-registry.${format === 'json' ? 'json' : 'md'}`
    a.click()
    URL.revokeObjectURL(url)
    addToast(`Exported as ${format.toUpperCase()}`, 'success')
  }

  // ============================================
  // Access guard
  // ============================================

  if (!isGlobalAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-400 text-sm">Access restricted to global administrators.</p>
        </div>
      </DashboardLayout>
    )
  }

  // ============================================
  // Render
  // ============================================

  return (
    <DashboardLayout>
      {/* Animations handled via Tailwind animate classes */}

      <ToastContainer toasts={toasts} />

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedPage && (
        <Overlay onClose={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Page</h3>
            <p className="text-sm text-slate-500 mb-6">
              Remove <strong>{selectedPage.name}</strong> from the registry? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && editingPage && (
        <PageFormModal
          page={editingPage}
          isEdit={isEditMode}
          isSaving={isSaving}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingPage(null) }}
        />
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <ScannerModal
          supabase={supabase}
          onImport={handleScannerImport}
          onBulkDone={handleScannerBulkDone}
          onClose={() => setShowScanner(false)}
          addToast={addToast}
        />
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManagerModal
          supabase={supabase}
          categories={categories}
          onClose={() => { setShowCategoryManager(false); loadPages() }}
          addToast={addToast}
        />
      )}

      <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* ================================================================ */}
        {/* LEFT PANEL — TOC                                                 */}
        {/* ================================================================ */}
        <aside className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/60">
          <div className="px-4 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon d={icons.book} className="w-5 h-5 text-slate-500" />
                <h1 className="text-base font-semibold text-slate-800 tracking-tight">ORbit Docs</h1>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowCategoryManager(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Manage categories"
                >
                  <Icon d={icons.tag} />
                </button>
                <button
                  onClick={() => setShowScanner(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Scan codebase"
                >
                  <Icon d={icons.scan} />
                </button>
                <button
                  onClick={handleAdd}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="Add page"
                >
                  <Icon d={icons.plus} />
                </button>
              </div>
            </div>
            <div className="relative">
              <Icon d={icons.search} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search pages, tables..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg
                           placeholder-slate-400 text-slate-700
                           focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300
                           transition-colors"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              </div>
            ) : filteredGrouped.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                {searchQuery ? 'No results' : 'No pages documented yet'}
              </p>
            ) : (
              filteredGrouped.map(([categoryName, catPages]) => {
                const catInfo = categories.find(c => c.name === categoryName)
                return (
                  <div key={categoryName}>
                    <button
                      onClick={() => toggleCategory(categoryName)}
                      className="w-full flex items-center gap-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider
                                 text-slate-400 hover:text-slate-600 transition-colors rounded group"
                      title={catInfo?.description || ''}
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedCategories.has(categoryName) ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={icons.chevron} />
                      </svg>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[catInfo?.color || 'slate'] || DOT_COLORS.slate}`} />
                      <span className="truncate">{categoryName}</span>
                      <span className="ml-auto text-slate-300 text-[10px]">{catPages.length}</span>
                    </button>
                    {expandedCategories.has(categoryName) && catInfo?.description && (
                      <p className="px-2 ml-7 mb-1 text-[10px] text-slate-400 leading-tight">{catInfo.description}</p>
                    )}
                    {expandedCategories.has(categoryName) && (
                      <div className="ml-3 space-y-0.5 mb-1">
                        {catPages.map(page => (
                          <button
                            key={page.id}
                            onClick={() => {
                              setSelectedPageId(page.id)
                              setActiveTab('overview')
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150
                              ${selectedPageId === page.id
                                ? 'bg-white text-slate-900 font-medium shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border border-transparent'
                              }`}
                          >
                            <div className="leading-snug">{page.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">{page.route}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </nav>

          <div className="px-4 py-3 border-t border-slate-200 text-[11px] text-slate-400">
            <div className="flex items-center justify-between mb-2">
              <span>{pages.length} entries</span>
              <span>{getAllUniqueTablesCount(pages)} tables</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleExport('json')}
                className="flex-1 px-2 py-1.5 text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors text-center"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExport('md')}
                className="flex-1 px-2 py-1.5 text-[10px] font-medium text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors text-center"
              >
                Export MD
              </button>
            </div>
          </div>
        </aside>

        {/* ================================================================ */}
        {/* RIGHT PANEL — Detail                                             */}
        {/* ================================================================ */}
        <main className="flex-1 overflow-y-auto bg-white">
          {!selectedPage ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Icon d={icons.book} className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-base font-medium text-slate-500">Select a page from the sidebar</p>
              <p className="text-sm mt-1 mb-4">or add a new one to start documenting</p>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Icon d={icons.plus} />
                Add Page
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-8 py-6 transition-all duration-150" key={selectedPage.id}>
              {/* Page Header */}
              <div className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1.5">
                      <h2 className="text-xl font-bold text-slate-800 tracking-tight">{selectedPage.name}</h2>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${getCategoryColor(categories, selectedPage.category)}`}>
                        {selectedPage.category}
                      </span>
                    </div>
                    <p className="text-slate-500 text-sm">{selectedPage.description}</p>
                    <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-400">
                      <code className="px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-slate-600">
                        {selectedPage.route}
                      </code>
                      <span className="text-slate-300">|</span>
                      <span>{selectedPage.roles.join(', ')}</span>
                      {selectedPage.owner && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span>Owner: {selectedPage.owner}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <Icon d={icons.pencil} className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-1.5 text-slate-400 rounded-lg hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete page"
                    >
                      <Icon d={icons.trash} className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 border-b border-slate-200 pb-px">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors
                      ${activeTab === tab.id
                        ? 'text-slate-800 border-b-2 border-slate-700 -mb-px'
                        : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    <Icon d={tab.icon} className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && <OverviewTab page={selectedPage} />}
              {activeTab === 'database' && (
                <DatabaseTab page={selectedPage} allPages={pages} metadata={tableMetadata} isLoading={isLoadingMeta} />
              )}
              {activeTab === 'triggers' && (
                <TriggersTab page={selectedPage} metadata={tableMetadata} isLoading={isLoadingMeta} />
              )}
              {activeTab === 'platform' && <PlatformTab page={selectedPage} />}
              {activeTab === 'dependencies' && <DependenciesTab page={selectedPage} allPages={pages} />}
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function getAllUniqueTablesCount(pages: PageEntry[]): number {
  const tables = new Set<string>()
  for (const p of pages) {
    p.reads.forEach(t => tables.add(t))
    p.writes.forEach(t => tables.add(t))
  }
  return tables.size
}

// =============================================================================
// Page Form Modal
// =============================================================================

function PageFormModal({
  page, isEdit, isSaving, categories, onSave, onClose,
}: {
  page: PageEntryInsert
  isEdit: boolean
  isSaving: boolean
  categories: Category[]
  onSave: (page: PageEntryInsert) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<PageEntryInsert>(page)

  const set = (field: keyof PageEntryInsert, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleNameChange = (name: string) => {
    set('name', name)
    if (!isEdit) set('id', generateSlug(name))
  }

  const handleSubmit = () => {
    if (!form.id || !form.name || !form.route) return
    onSave(form)
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col transition-all duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? 'Edit Page' : 'Add Page'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <Icon d={icons.x} className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Core Info */}
          <FormSection title="Core">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="Surgeon Dashboard"
                  className={FORM_INPUT}
                />
              </FormField>
              <FormField label="ID (slug)" required>
                <input
                  type="text"
                  value={form.id}
                  onChange={e => set('id', e.target.value)}
                  placeholder="surgeon-dashboard"
                  disabled={isEdit}
                  className={`${FORM_INPUT} font-mono text-xs ${isEdit ? 'bg-slate-50 text-slate-400' : ''}`}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Route" required>
                <input
                  type="text"
                  value={form.route}
                  onChange={e => set('route', e.target.value)}
                  placeholder="/dashboard/surgeon"
                  className={`${FORM_INPUT} font-mono text-xs`}
                />
              </FormField>
              <FormField label="Category">
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className={FORM_INPUT}
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Description">
              <input
                type="text"
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="One-line description of what this page does"
                className={FORM_INPUT}
              />
            </FormField>
            <FormField label="Roles">
              <MultiCheckbox
                options={ROLE_OPTIONS as unknown as string[]}
                selected={form.roles}
                onChange={v => set('roles', v)}
              />
            </FormField>
          </FormSection>

          {/* Data Dependencies */}
          <FormSection title="Data Dependencies">
            <TagInput label="Reads (tables)" value={form.reads} onChange={v => set('reads', v)} placeholder="table name" />
            <TagInput label="Writes (tables)" value={form.writes} onChange={v => set('writes', v)} placeholder="table name" />
            <TagInput label="RPC Functions" value={form.rpcs} onChange={v => set('rpcs', v)} placeholder="function name" />
            <TagInput label="Realtime Subscriptions" value={form.realtime} onChange={v => set('realtime', v)} placeholder="table name" />
            <TagInput label="Materialized Views" value={form.materialized_views} onChange={v => set('materialized_views', v)} placeholder="view name" />
            <TagInput label="API Routes" value={form.api_routes} onChange={v => set('api_routes', v)} placeholder="/api/route" />
            {form.category === 'api-routes' && (
              <FormField label="HTTP Methods">
                <MultiCheckbox
                  options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']}
                  selected={form.http_methods || []}
                  onChange={v => set('http_methods', v)}
                />
              </FormField>
            )}
          </FormSection>

          {/* Business Logic */}
          <FormSection title="Business Logic">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Calculation Engine">
                <input
                  type="text"
                  value={form.calculation_engine || ''}
                  onChange={e => set('calculation_engine', e.target.value || null)}
                  placeholder="analyticsV2"
                  className={`${FORM_INPUT} font-mono text-xs`}
                />
              </FormField>
              <FormField label="Timezone Aware">
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.timezone_aware}
                    onChange={e => set('timezone_aware', e.target.checked)}
                    className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
                  />
                  <span className="text-sm text-slate-600">Handles facility timezone</span>
                </label>
              </FormField>
            </div>
            <TagInput label="Key Validations" value={form.key_validations} onChange={v => set('key_validations', v)} placeholder="validation rule" />
          </FormSection>

          {/* Platform Parity */}
          <FormSection title="Platform Parity">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={form.ios_exists}
                onChange={e => set('ios_exists', e.target.checked)}
                className="rounded border-slate-300 text-slate-700 focus:ring-slate-400"
              />
              <span className="text-sm text-slate-600">iOS equivalent exists</span>
            </label>
            {form.ios_exists && (
              <div className="space-y-3 pl-6 border-l-2 border-slate-200">
                <FormField label="SwiftUI View Name">
                  <input
                    type="text"
                    value={form.ios_view_name || ''}
                    onChange={e => set('ios_view_name', e.target.value || null)}
                    placeholder="SurgeonDashboardView"
                    className={`${FORM_INPUT} font-mono text-xs`}
                  />
                </FormField>
                <FormField label="iOS Notes">
                  <input
                    type="text"
                    value={form.ios_notes || ''}
                    onChange={e => set('ios_notes', e.target.value || null)}
                    placeholder="Implementation notes for iOS"
                    className={FORM_INPUT}
                  />
                </FormField>
              </div>
            )}
            <FormField label="Parity Notes">
              <textarea
                value={form.parity_notes || ''}
                onChange={e => set('parity_notes', e.target.value || null)}
                placeholder="Known differences between web and iOS"
                className={`${FORM_INPUT} min-h-[60px] resize-y`}
                rows={2}
              />
            </FormField>
          </FormSection>

          {/* UI Details */}
          <FormSection title="UI Details">
            <TagInput label="Components" value={form.components} onChange={v => set('components', v)} placeholder="ComponentName" />
            <TagInput label="Interactions" value={form.interactions} onChange={v => set('interactions', v)} placeholder="user action" />
            <FormField label="State Management Notes">
              <textarea
                value={form.state_management || ''}
                onChange={e => set('state_management', e.target.value || null)}
                placeholder="Notable state patterns or gotchas"
                className={`${FORM_INPUT} min-h-[60px] resize-y`}
                rows={2}
              />
            </FormField>
          </FormSection>

          {/* Metadata */}
          <FormSection title="Metadata">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Owner">
                <input
                  type="text"
                  value={form.owner || ''}
                  onChange={e => set('owner', e.target.value || null)}
                  placeholder="Developer name"
                  className={FORM_INPUT}
                />
              </FormField>
              <FormField label="Display Order">
                <input
                  type="number"
                  value={form.display_order}
                  onChange={e => set('display_order', parseInt(e.target.value) || 0)}
                  className={FORM_INPUT}
                />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea
                value={form.notes || ''}
                onChange={e => set('notes', e.target.value || null)}
                placeholder="Freeform notes"
                className={`${FORM_INPUT} min-h-[60px] resize-y`}
                rows={2}
              />
            </FormField>
          </FormSection>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || !form.id || !form.name || !form.route}
            className="px-5 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Icon d={icons.check} className="w-4 h-4" />
            )}
            {isEdit ? 'Save Changes' : 'Add Page'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// =============================================================================
// Form Components
// =============================================================================

// =============================================================================
// Scanner Modal
// =============================================================================

interface DiscoveredFile {
  filePath: string
  route: string
  fileName: string
  scope: 'pages' | 'api' | 'lib' | 'components'
  sizeBytes: number
  lastModified: string
}

interface ScannedMetadata {
  id: string
  name: string
  route: string
  category: string
  description: string
  roles: string[]
  reads: string[]
  writes: string[]
  rpcs: string[]
  realtime: string[]
  materialized_views: string[]
  components: string[]
  interactions: string[]
  api_routes: string[]
  http_methods: string[]
  ios_exists: boolean
  ios_view_name: string | null
  calculation_engine: string | null
  timezone_aware: boolean
  key_validations: string[]
  state_management: string | null
  notes: string | null
  _scan_confidence: Record<string, string>
  _source_lines: number
  _scope: string
}

function ScannerModal({
  supabase,
  onImport,
  onBulkDone,
  onClose,
  addToast,
}: {
  supabase: any
  onImport: (page: PageEntryInsert) => void
  onBulkDone: () => void
  onClose: () => void
  addToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [isScanning, setIsScanning] = useState(false)
  const [discoveredFiles, setDiscoveredFiles] = useState<DiscoveredFile[]>([])
  const [registeredRoutes, setRegisteredRoutes] = useState<Set<string>>(new Set())
  const [registeredEntries, setRegisteredEntries] = useState<Map<string, PageEntry>>(new Map())
  const [scanningFile, setScanningFile] = useState<string | null>(null)
  const [scannedMeta, setScannedMeta] = useState<Record<string, ScannedMetadata>>({})
  const [fileDrift, setFileDrift] = useState<Record<string, DriftResult[]>>({})
  const [isBulkImporting, setIsBulkImporting] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [scopeFilter, setScopeFilter] = useState<'all' | 'pages' | 'api' | 'lib' | 'components'>('all')

  // Load registry for comparison
  useEffect(() => {
    fetchPages(supabase).then(pages => {
      setRegisteredRoutes(new Set(pages.map(p => p.route)))
      setRegisteredEntries(new Map(pages.map(p => [p.route, p])))
    })
  }, [supabase])

  const filteredFiles = scopeFilter === 'all'
    ? discoveredFiles
    : discoveredFiles.filter(f => f.scope === scopeFilter)

  const missingCount = filteredFiles.filter(p => !registeredRoutes.has(p.route)).length
  const syncedCount = filteredFiles.filter(p => registeredRoutes.has(p.route)).length
  const driftCount = Object.values(fileDrift).filter(d => d.length > 0).length

  const scopeCounts = {
    all: discoveredFiles.length,
    pages: discoveredFiles.filter(f => f.scope === 'pages').length,
    api: discoveredFiles.filter(f => f.scope === 'api').length,
    lib: discoveredFiles.filter(f => f.scope === 'lib').length,
    components: discoveredFiles.filter(f => f.scope === 'components').length,
  }

  const runScan = async () => {
    setIsScanning(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/scan-pages', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      setDiscoveredFiles(data.files || [])
      setHasScanned(true)
      setScannedMeta({})
      setFileDrift({})
    } catch (err: any) {
      addToast(err.message || 'Scan failed', 'error')
    }
    setIsScanning(false)
  }

  const scanFile = async (filePath: string) => {
    if (scannedMeta[filePath]) return
    setScanningFile(filePath)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/scan-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ filePath }),
      })
      if (!res.ok) throw new Error('Scan failed')
      const data = await res.json()
      const meta = data.metadata as ScannedMetadata
      setScannedMeta(prev => ({ ...prev, [filePath]: meta }))

      // If registered, compute drift
      const existing = registeredEntries.get(meta.route)
      if (existing) {
        const drift = detectDrift(existing, meta)
        setFileDrift(prev => ({ ...prev, [filePath]: drift }))
      }
    } catch (err: any) {
      addToast(`Failed to scan: ${err.message}`, 'error')
    }
    setScanningFile(null)
  }

  const importFromScan = (meta: ScannedMetadata) => {
    const { _scan_confidence, _source_lines, _scope, ...rest } = meta
    const entry: PageEntryInsert = {
      ...rest,
      category: rest.category || 'shared',
      description: rest.description || '',
      materialized_views: rest.materialized_views || [],
      http_methods: rest.http_methods || [],
      ios_exists: rest.ios_exists || false,
      ios_view_name: rest.ios_view_name || null,
      ios_notes: null,
      parity_notes: null,
      owner: null,
      display_order: 0,
    }
    onImport(entry)
  }

  // Smart sync — update only auto-detected fields, preserve manual edits
  const handleSmartSync = async (route: string, meta: ScannedMetadata) => {
    const existing = registeredEntries.get(route)
    if (!existing) return

    const { _scan_confidence, _source_lines, _scope, ...scannedFields } = meta
    const { error } = await syncAutoFields(supabase, existing.id, scannedFields)
    if (error) {
      addToast(`Sync failed: ${error}`, 'error')
    } else {
      addToast(`${existing.name} synced — manual fields preserved`, 'success')
      // Refresh
      const updated = await fetchPages(supabase)
      setRegisteredRoutes(new Set(updated.map(p => p.route)))
      setRegisteredEntries(new Map(updated.map(p => [p.route, p])))
      // Clear drift for this file
      const file = discoveredFiles.find(f => f.route === route)
      if (file) {
        setFileDrift(prev => ({ ...prev, [file.filePath]: [] }))
      }
    }
  }

  // Bulk sync — re-scan + sync all registered entries that have drift
  const bulkSync = async () => {
    setIsBulkImporting(true)
    const registered = filteredFiles.filter(p => registeredRoutes.has(p.route))
    let synced = 0

    for (const file of registered) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/scan-pages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ filePath: file.filePath }),
        })
        if (!res.ok) continue
        const data = await res.json()
        const meta = data.metadata as ScannedMetadata
        const existing = registeredEntries.get(file.route)
        if (!existing) continue
        const drift = detectDrift(existing, meta)
        if (drift.length > 0) {
          const { _scan_confidence, _source_lines, _scope, ...scannedFields } = meta
          await syncAutoFields(supabase, existing.id, scannedFields)
          synced++
        }
      } catch { /* skip */ }
    }

    addToast(`Synced ${synced} entries (manual fields preserved)`, 'success')
    setIsBulkImporting(false)
    onBulkDone()
  }

  const bulkImport = async () => {
    setIsBulkImporting(true)
    const missing = filteredFiles.filter(p => !registeredRoutes.has(p.route))
    let imported = 0

    for (const page of missing) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/admin/scan-pages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ filePath: page.filePath }),
        })
        if (!res.ok) continue
        const data = await res.json()
        const meta = data.metadata as ScannedMetadata
        const { _scan_confidence, _source_lines, _scope, ...rest } = meta

        const entry: PageEntryInsert = {
          ...rest,
          category: rest.category || 'shared',
          description: rest.description || '',
          materialized_views: rest.materialized_views || [],
          http_methods: rest.http_methods || [],
          ios_exists: false,
          ios_view_name: null,
          ios_notes: null,
          parity_notes: null,
          owner: null,
          display_order: 0,
        }
        await insertPage(supabase, entry)
        imported++
      } catch { /* skip failed */ }
    }

    addToast(`Imported ${imported} of ${missing.length} entries`, 'success')
    setIsBulkImporting(false)
    onBulkDone()
  }

  // Stale check: file modified after registry updated_at
  const isStale = (file: DiscoveredFile): boolean => {
    const entry = registeredEntries.get(file.route)
    if (!entry) return false
    return new Date(file.lastModified) > new Date(entry.updated_at)
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Icon d={icons.scan} className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">Codebase Scanner</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <Icon d={icons.x} className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!hasScanned ? (
            <div className="text-center py-12">
              <Icon d={icons.scan} className="w-10 h-10 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base font-medium text-slate-700 mb-2">Scan your codebase</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                Reads every file in your project, extracts table dependencies, components,
                and metadata — then compares against the registry for drift.
              </p>
              <button
                onClick={runScan}
                disabled={isScanning}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {isScanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Icon d={icons.scan} className="w-4 h-4" />
                    Start Scan
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {/* Scope filter tabs */}
              <div className="flex gap-1 mb-4">
                {(['all', 'pages', 'api', 'lib', 'components'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setScopeFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                      ${scopeFilter === s
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    <span className={`ml-1.5 ${scopeFilter === s ? 'text-slate-300' : 'text-slate-400'}`}>
                      {scopeCounts[s]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Summary bar */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex-wrap">
                <div className="text-sm">
                  <span className="font-semibold text-slate-700">{filteredFiles.length}</span>
                  <span className="text-slate-500"> files</span>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div className="text-sm">
                  <span className="font-semibold text-red-600">{missingCount}</span>
                  <span className="text-slate-500"> missing</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-emerald-600">{syncedCount}</span>
                  <span className="text-slate-500"> registered</span>
                </div>
                {driftCount > 0 && (
                  <div className="text-sm">
                    <span className="font-semibold text-amber-600">{driftCount}</span>
                    <span className="text-slate-500"> drifted</span>
                  </div>
                )}
                <div className="ml-auto flex gap-2 flex-wrap">
                  <button
                    onClick={runScan}
                    disabled={isScanning}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Re-scan
                  </button>
                  {syncedCount > 0 && (
                    <button
                      onClick={bulkSync}
                      disabled={isBulkImporting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      {isBulkImporting ? 'Syncing...' : 'Sync All Registered'}
                    </button>
                  )}
                  {missingCount > 0 && (
                    <button
                      onClick={bulkImport}
                      disabled={isBulkImporting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isBulkImporting ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>Import All Missing</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* File list */}
              <div className="space-y-1">
                {filteredFiles.map(file => {
                  const isRegistered = registeredRoutes.has(file.route)
                  const meta = scannedMeta[file.filePath]
                  const drift = fileDrift[file.filePath] || []
                  const stale = isStale(file)
                  const isExpanded = !!meta
                  const isLoadingThis = scanningFile === file.filePath

                  return (
                    <div key={file.filePath} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => scanFile(file.filePath)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors
                          ${isRegistered ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}
                      >
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full flex-shrink-0
                          ${drift.length > 0 ? 'bg-amber-500' : isRegistered ? 'bg-emerald-500' : 'bg-red-400'}`}
                        />

                        {/* Route */}
                        <code className="font-mono text-xs text-slate-600 flex-1 truncate">{file.route}</code>

                        {/* File path */}
                        <span className="text-[11px] text-slate-400 hidden sm:block truncate max-w-[180px]">
                          {file.filePath}
                        </span>

                        {/* Scope badge */}
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border bg-slate-50 text-slate-500 border-slate-200 flex-shrink-0 uppercase tracking-wider">
                          {file.scope}
                        </span>

                        {/* Stale indicator */}
                        {stale && isRegistered && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium flex-shrink-0"
                                title="File modified after last registry update">
                            STALE
                          </span>
                        )}

                        {/* Status badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0
                          ${drift.length > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : isRegistered
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }`}
                        >
                          {drift.length > 0 ? 'DRIFT' : isRegistered ? 'SYNCED' : 'MISSING'}
                        </span>

                        {isLoadingThis && (
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded: scan results + drift details */}
                      {isExpanded && meta && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-100 bg-slate-50/50">
                          {/* Drift details for registered entries */}
                          {isRegistered && drift.length > 0 && (
                            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <Icon d={icons.warning} className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-semibold text-amber-800">
                                  {drift.length} field{drift.length !== 1 ? 's' : ''} drifted from registry
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {drift.map(d => (
                                  <div key={d.field} className="text-xs">
                                    <span className="font-mono font-semibold text-amber-700">{d.field}</span>
                                    <div className="ml-4 mt-0.5 flex gap-4">
                                      <span className="text-red-600">
                                        Registry: {Array.isArray(d.registryValue) ? d.registryValue.join(', ') || '(empty)' : String(d.registryValue ?? 'null')}
                                      </span>
                                      <span className="text-emerald-700">
                                        Code: {Array.isArray(d.scannedValue) ? d.scannedValue.join(', ') || '(empty)' : String(d.scannedValue ?? 'null')}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {isRegistered && drift.length === 0 && (
                            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Icon d={icons.check} className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-700">
                                  Registry matches code — no drift detected
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Scanned data preview */}
                          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name</span>
                              <div className="text-sm text-slate-700">{meta.name}</div>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Category</span>
                              <div className="text-sm text-slate-700">{meta.category}</div>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Reads</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {meta.reads.length > 0 ? meta.reads.map(t => (
                                  <code key={t} className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono">{t}</code>
                                )) : <span className="text-xs text-slate-400">none</span>}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Writes</span>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {meta.writes.length > 0 ? meta.writes.map(t => (
                                  <code key={t} className="text-[11px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono">{t}</code>
                                )) : <span className="text-xs text-slate-400">none</span>}
                              </div>
                            </div>
                            {meta.rpcs.length > 0 && (
                              <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">RPCs</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {meta.rpcs.map(r => (
                                    <code key={r} className="text-[11px] px-1.5 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded font-mono">{r}</code>
                                  ))}
                                </div>
                              </div>
                            )}
                            {meta.http_methods.length > 0 && (
                              <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">HTTP Methods</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {meta.http_methods.map(m => (
                                    <span key={m} className="text-[11px] px-1.5 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded font-semibold">{m}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {meta.components.length > 0 && (
                              <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Components</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {meta.components.map(c => (
                                    <code key={c} className="text-[11px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono">{c}</code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-3">
                            {isRegistered && drift.length > 0 ? (
                              <button
                                onClick={() => handleSmartSync(file.route, meta)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                              >
                                <Icon d={icons.refresh} className="w-3 h-3" />
                                Sync Auto Fields
                              </button>
                            ) : !isRegistered ? (
                              <button
                                onClick={() => importFromScan(meta)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                              >
                                <Icon d={icons.plus} className="w-3 h-3" />
                                Import to Registry
                              </button>
                            ) : null}
                            <span className="text-[11px] text-slate-400">
                              {meta._source_lines} lines
                              {isRegistered && drift.length > 0 && ' • Only code-detected fields will update'}
                              {!isRegistered && ' • Review before saving'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Overlay>
  )
}


// =============================================================================
// Category Manager Modal
// =============================================================================

function CategoryManagerModal({
  supabase,
  categories,
  onClose,
  addToast,
}: {
  supabase: any
  categories: Category[]
  onClose: () => void
  addToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [cats, setCats] = useState<Category[]>(categories)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', color: 'slate', display_order: 0 })
  const [isSaving, setIsSaving] = useState(false)

  const reload = async () => {
    const data = await fetchCategories(supabase)
    setCats(data)
  }

  const startEdit = (cat: Category) => {
    setEditingId(cat.id)
    setForm({ name: cat.name, description: cat.description, color: cat.color, display_order: cat.display_order })
    setIsAdding(false)
  }

  const startAdd = () => {
    setIsAdding(true)
    setEditingId(null)
    setForm({ name: '', description: '', color: 'slate', display_order: cats.length + 1 })
  }

  const cancel = () => {
    setEditingId(null)
    setIsAdding(false)
    setForm({ name: '', description: '', color: 'slate', display_order: 0 })
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setIsSaving(true)

    if (isAdding) {
      const slug = generateSlug(form.name)
      const { error } = await insertCategory(supabase, {
        id: slug,
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        display_order: form.display_order,
      })
      if (error) addToast(`Error: ${error}`, 'error')
      else {
        addToast(`"${form.name}" created`, 'success')
        await reload()
        cancel()
      }
    } else if (editingId) {
      const { error } = await updateCategory(supabase, editingId, {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        display_order: form.display_order,
      })
      if (error) addToast(`Error: ${error}`, 'error')
      else {
        addToast(`"${form.name}" updated`, 'success')
        await reload()
        cancel()
      }
    }

    setIsSaving(false)
  }

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Delete "${cat.name}"? Pages using this category won't be deleted but will show an unrecognized category slug.`)) return
    const { error } = await deleteCategory(supabase, cat.id)
    if (error) addToast(`Error: ${error}`, 'error')
    else {
      addToast(`"${cat.name}" deleted`, 'success')
      await reload()
    }
  }

  // Color picker inline component
  const ColorPicker = () => (
    <div className="flex items-center gap-3">
      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex-shrink-0">Color</label>
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORY_COLOR_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setForm(prev => ({ ...prev, color: opt.id }))}
            className={`w-6 h-6 rounded-full border-2 transition-all ${DOT_COLORS[opt.id] || DOT_COLORS.slate}
              ${form.color === opt.id ? 'border-slate-800 scale-110 ring-2 ring-slate-300' : 'border-transparent hover:border-slate-300'}`}
            title={opt.label}
          />
        ))}
      </div>
    </div>
  )

  // Inline edit form
  const EditForm = ({ isNew }: { isNew: boolean }) => (
    <div className={`p-4 border rounded-lg space-y-3 ${isNew ? 'border-dashed border-slate-300 bg-slate-50/50' : 'border-slate-300 bg-slate-50'}`}>
      <div>
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Category name"
          className={FORM_INPUT}
          autoFocus
        />
      </div>
      <div>
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          placeholder="What belongs in this category?"
          rows={2}
          className={FORM_INPUT}
        />
      </div>
      <ColorPicker />
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex-shrink-0">Sort Order</label>
        <input
          type="number"
          value={form.display_order}
          onChange={e => setForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
          className={`${FORM_INPUT} w-20`}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isSaving || !form.name.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </button>
        <button onClick={cancel} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <Overlay onClose={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Icon d={icons.tag} className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">Categories</h2>
            <span className="text-xs text-slate-400">{cats.length} total</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <Icon d={icons.x} className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {cats.map(cat => {
              if (editingId === cat.id) {
                return <div key={cat.id}><EditForm isNew={false} /></div>
              }
              return (
                <div
                  key={cat.id}
                  className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50/50 transition-colors group"
                >
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                    DOT_COLORS[cat.color] || DOT_COLORS.slate
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{cat.id}</span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => startEdit(cat)}
                      className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      title="Edit"
                    >
                      <Icon d={icons.pencil} className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Icon d={icons.trash} className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}

            {isAdding && <EditForm isNew />}
          </div>
        </div>

        {/* Footer */}
        {!isAdding && !editingId && (
          <div className="px-6 py-3 border-t border-slate-200">
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Icon d={icons.plus} className="w-4 h-4" />
              New Category
            </button>
          </div>
        )}
      </div>
    </Overlay>
  )
}


// =============================================================================
// Overlay
// =============================================================================

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-all duration-150"
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function TagInput({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput('')
  }

  const remove = (item: string) => {
    onChange(value.filter(v => v !== item))
  }

  return (
    <FormField label={label}>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map(item => (
          <span
            key={item}
            className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600"
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); add() }
        }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : `Add ${placeholder}...`}
        className={`${FORM_INPUT} text-xs font-mono`}
      />
    </FormField>
  )
}

function MultiCheckbox({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt))
    } else {
      onChange([...selected, opt])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <label
          key={opt}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border transition-all
            ${selected.includes(opt)
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="sr-only"
          />
          {opt}
        </label>
      ))}
    </div>
  )
}

// =============================================================================
// Overview Tab
// =============================================================================

function OverviewTab({ page }: { page: PageEntry }) {
  return (
    <div className="space-y-5">
      <Section title="Data Dependencies">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Reads from</Label>
            <TagList items={page.reads} color="blue" />
          </div>
          <div>
            <Label>Writes to</Label>
            <TagList items={page.writes} color="amber" />
          </div>
          {page.rpcs.length > 0 && (
            <div>
              <Label>RPC Functions</Label>
              <TagList items={page.rpcs} color="cyan" />
            </div>
          )}
          {page.realtime.length > 0 && (
            <div>
              <Label>Realtime Subscriptions</Label>
              <TagList items={page.realtime} color="green" />
            </div>
          )}
          {page.materialized_views.length > 0 && (
            <div>
              <Label>Materialized Views</Label>
              <TagList items={page.materialized_views} color="purple" />
            </div>
          )}
          {page.api_routes.length > 0 && (
            <div>
              <Label>API Routes</Label>
              <TagList items={page.api_routes} color="red" />
            </div>
          )}
          {page.http_methods && page.http_methods.length > 0 && (
            <div>
              <Label>HTTP Methods</Label>
              <TagList items={page.http_methods} color="purple" />
            </div>
          )}
        </div>
      </Section>

      {(page.calculation_engine || page.key_validations.length > 0 || page.timezone_aware) && (
        <Section title="Business Logic">
          <div className="space-y-3">
            {page.calculation_engine && (
              <div>
                <Label>Calculation Engine</Label>
                <code className="text-sm px-2 py-1 bg-amber-50 border border-amber-200 rounded font-mono text-amber-800">
                  {page.calculation_engine}
                </code>
              </div>
            )}
            {page.key_validations.length > 0 && (
              <div>
                <Label>Key Validations</Label>
                <ul className="space-y-1.5">
                  {page.key_validations.map((v, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 text-xs">&#9888;</span>
                      <code className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">{v}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {page.timezone_aware && (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <span className="text-blue-500">&#128336;</span>
                Handles facility-specific timezone logic
              </div>
            )}
          </div>
        </Section>
      )}

      {(page.components.length > 0 || page.interactions.length > 0 || page.state_management) && (
        <Section title="UI Details">
          <div className="space-y-3">
            {page.components.length > 0 && (
              <div>
                <Label>Components</Label>
                <TagList items={page.components} color="green" />
              </div>
            )}
            {page.interactions.length > 0 && (
              <div>
                <Label>User Interactions</Label>
                <ul className="space-y-1">
                  {page.interactions.map((interaction, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {interaction}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {page.state_management && (
              <div>
                <Label>State Management Notes</Label>
                <p className="text-sm text-slate-600">{page.state_management}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {page.notes && (
        <Section title="Notes">
          <p className="text-sm text-slate-600">{page.notes}</p>
        </Section>
      )}
    </div>
  )
}

// =============================================================================
// Database Tab
// =============================================================================

function DatabaseTab({
  page, allPages, metadata, isLoading,
}: {
  page: PageEntry
  allPages: PageEntry[]
  metadata: Record<string, TableMetadata>
  isLoading: boolean
}) {
  const allTables = [...new Set([...page.reads, ...page.writes])]

  if (isLoading) return <LoadingSpinner text="Loading database metadata..." />

  return (
    <div className="space-y-5">
      {allTables.map(tableName => {
        const meta = metadata[tableName]
        const isRead = page.reads.includes(tableName)
        const isWrite = page.writes.includes(tableName)

        return (
          <Section
            key={tableName}
            title={
              <span className="flex items-center gap-2">
                <code className="font-mono text-sm">{tableName}</code>
                {isRead && <MiniTag color="blue">READ</MiniTag>}
                {isWrite && <MiniTag color="amber">WRITE</MiniTag>}
                {meta && (
                  <span className="text-xs text-slate-400 font-normal ml-1">
                    ~{meta.approximateRowCount.toLocaleString()} rows
                  </span>
                )}
              </span>
            }
          >
            {meta ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider">
                      <th className="pb-2 pr-4">Column</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Nullable</th>
                      <th className="pb-2">Default</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {meta.columns.map(col => (
                      <tr key={col.column_name} className="text-slate-600">
                        <td className="py-1.5 pr-4 font-mono text-xs text-slate-700">{col.column_name}</td>
                        <td className="py-1.5 pr-4 text-xs text-slate-500">{col.data_type}</td>
                        <td className="py-1.5 pr-4 text-xs">
                          {col.is_nullable === 'YES'
                            ? <span className="text-amber-600">nullable</span>
                            : <span className="text-slate-400">required</span>
                          }
                        </td>
                        <td className="py-1.5 text-xs text-slate-400 font-mono truncate max-w-[200px]">
                          {col.column_default || '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Deploy introspection RPCs to see live column data.
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">Also used by: </span>
              {getPagesByTable(allPages, tableName)
                .filter(p => p.id !== page.id)
                .map((p, i) => (
                  <span key={p.id} className="text-xs text-slate-500">
                    {i > 0 && ', '}{p.name}
                  </span>
                ))}
              {getPagesByTable(allPages, tableName).filter(p => p.id !== page.id).length === 0 && (
                <span className="text-xs text-slate-300 italic">no other pages</span>
              )}
            </div>
          </Section>
        )
      })}
      {allTables.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">No tables declared. Edit this page to add data dependencies.</p>
      )}
    </div>
  )
}

// =============================================================================
// Triggers Tab
// =============================================================================

function TriggersTab({
  page, metadata, isLoading,
}: {
  page: PageEntry
  metadata: Record<string, TableMetadata>
  isLoading: boolean
}) {
  const allTables = [...new Set([...page.reads, ...page.writes])]

  if (isLoading) return <LoadingSpinner text="Loading triggers and FK data..." />

  const hasTriggers = allTables.some(t => metadata[t]?.triggers.length > 0)
  const hasFKs = allTables.some(t => metadata[t]?.foreignKeys.length > 0)
  const hasIndexes = allTables.some(t => metadata[t]?.indexes.length > 0)

  return (
    <div className="space-y-5">
      <Section title="Triggers">
        {allTables.map(tableName => {
          const triggers = metadata[tableName]?.triggers || []
          if (triggers.length === 0) return null
          return (
            <div key={tableName} className="mb-4">
              <Label>{tableName}</Label>
              <div className="space-y-2">
                {triggers.map(t => (
                  <div key={t.trigger_name} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="font-mono font-medium text-slate-800">{t.trigger_name}</code>
                      <MiniTag color="blue">{t.action_timing}</MiniTag>
                      <MiniTag color="cyan">{t.event_manipulation}</MiniTag>
                    </div>
                    <code className="text-xs text-slate-500 font-mono block">{t.action_statement}</code>
                    {t.action_condition && (
                      <div className="mt-1 text-xs text-slate-400">
                        WHEN: <code className="font-mono">{t.action_condition}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {!hasTriggers && <EmptyMeta text="No triggers found on tables used by this page." metadata={metadata} />}
      </Section>

      <Section title="Foreign Key Relationships">
        {allTables.map(tableName => {
          const fks = metadata[tableName]?.foreignKeys || []
          if (fks.length === 0) return null
          return (
            <div key={tableName} className="mb-4">
              <Label>{tableName}</Label>
              <div className="space-y-1">
                {fks.map(fk => (
                  <div key={fk.constraint_name} className="text-sm text-slate-600 flex items-center gap-2">
                    <code className="font-mono text-xs">{fk.column_name}</code>
                    <span className="text-slate-300">&rarr;</span>
                    <code className="font-mono text-xs text-blue-600">{fk.foreign_table}.{fk.foreign_column}</code>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {!hasFKs && <EmptyMeta text="No foreign keys found." metadata={metadata} />}
      </Section>

      <Section title="Indexes">
        {allTables.map(tableName => {
          const idxs = metadata[tableName]?.indexes || []
          if (idxs.length === 0) return null
          return (
            <div key={tableName} className="mb-4">
              <Label>{tableName}</Label>
              <div className="space-y-1">
                {idxs.map(idx => (
                  <div key={idx.index_name} className="text-sm flex items-center gap-2">
                    <code className="font-mono text-xs text-slate-600">{idx.index_name}</code>
                    {idx.is_unique && <MiniTag color="green">UNIQUE</MiniTag>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {!hasIndexes && <EmptyMeta text="No indexes found." metadata={metadata} />}
      </Section>
    </div>
  )
}

// =============================================================================
// Platform Tab
// =============================================================================

function PlatformTab({ page }: { page: PageEntry }) {
  return (
    <div className="space-y-5">
      <Section title="iOS Parity">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${page.ios_exists ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-sm text-slate-600">
              {page.ios_exists ? 'iOS equivalent exists' : 'No iOS equivalent'}
            </span>
          </div>
          {page.ios_exists && page.ios_view_name && (
            <div>
              <Label>SwiftUI View</Label>
              <code className="text-sm px-2 py-1 bg-emerald-50 border border-emerald-200 rounded font-mono text-emerald-800">
                {page.ios_view_name}
              </code>
            </div>
          )}
          {page.ios_notes && (
            <div>
              <Label>iOS Notes</Label>
              <p className="text-sm text-slate-600">{page.ios_notes}</p>
            </div>
          )}
        </div>
      </Section>

      {page.parity_notes && (
        <Section title="Parity Notes">
          <p className="text-sm text-slate-600">{page.parity_notes}</p>
        </Section>
      )}

      <Section title="Feature Matrix">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-400 uppercase tracking-wider">
              <th className="pb-2 pr-4">Feature</th>
              <th className="pb-2 pr-4">Web</th>
              <th className="pb-2">iOS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="text-slate-600">
              <td className="py-2 pr-4">Page exists</td>
              <td className="py-2 pr-4"><StatusDot active /></td>
              <td className="py-2"><StatusDot active={page.ios_exists} /></td>
            </tr>
            <tr className="text-slate-600">
              <td className="py-2 pr-4">Realtime updates</td>
              <td className="py-2 pr-4"><StatusDot active={page.realtime.length > 0} /></td>
              <td className="py-2"><StatusDot active={page.ios_exists && page.realtime.length > 0} /></td>
            </tr>
            <tr className="text-slate-600">
              <td className="py-2 pr-4">Write operations</td>
              <td className="py-2 pr-4"><StatusDot active={page.writes.length > 0} /></td>
              <td className="py-2"><StatusDot active={page.ios_exists && page.writes.length > 0} /></td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  )
}

// =============================================================================
// Dependencies Tab — reverse lookup by table
// =============================================================================

function DependenciesTab({ page, allPages }: { page: PageEntry; allPages: PageEntry[] }) {
  const allTables = [...new Set([...page.reads, ...page.writes])]

  return (
    <div className="space-y-5">
      <Section title="Table Impact Map">
        <p className="text-sm text-slate-500 mb-4">
          Every table this entry touches and what else depends on it.
          Useful before schema changes.
        </p>
        {allTables.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No table dependencies declared.</p>
        ) : (
          <div className="space-y-4">
            {allTables.map(table => {
              const dependents = getPagesByTable(allPages, table).filter(p => p.id !== page.id)
              const isRead = page.reads.includes(table)
              const isWrite = page.writes.includes(table)
              return (
                <div key={table} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm font-mono font-semibold text-slate-700">{table}</code>
                    <div className="flex gap-1">
                      {isRead && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                          READ
                        </span>
                      )}
                      {isWrite && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium">
                          WRITE
                        </span>
                      )}
                    </div>
                  </div>
                  {dependents.length > 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Also used by ({dependents.length})
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {dependents.map(dep => (
                          <span
                            key={dep.id}
                            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg"
                          >
                            <span className="text-slate-600 font-medium">{dep.name}</span>
                            <span className="text-slate-400">
                              {dep.reads.includes(table) && dep.writes.includes(table) ? 'R/W'
                                : dep.reads.includes(table) ? 'R' : 'W'}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No other entries use this table</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {page.api_routes.length > 0 && (
        <Section title="API Dependencies">
          <div className="space-y-2">
            {page.api_routes.map(route => (
              <div key={route} className="flex items-center gap-2">
                <code className="text-xs font-mono px-2 py-1 bg-cyan-50 border border-cyan-200 rounded text-cyan-700">{route}</code>
              </div>
            ))}
          </div>
        </Section>
      )}

      {page.components.length > 0 && (
        <Section title="Component Dependencies">
          <div className="flex flex-wrap gap-2">
            {page.components.map(comp => {
              // Find if this component is documented
              const compEntry = allPages.find(p =>
                p.name.toLowerCase().replace(/\s/g, '') === comp.toLowerCase() ||
                p.route.endsWith('/' + comp)
              )
              return (
                <span
                  key={comp}
                  className={`text-xs px-2 py-1 rounded-lg border font-medium
                    ${compEntry ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  {comp}
                  {compEntry && <span className="ml-1 text-emerald-400">✓</span>}
                </span>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

// =============================================================================

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>
}

function TagList({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0) return <span className="text-sm text-slate-300 italic">None</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <code key={item} className={`text-xs px-2 py-0.5 rounded-md border font-mono ${TAG_COLORS[color] || TAG_COLORS.slate}`}>
          {item}
        </code>
      ))}
    </div>
  )
}

function MiniTag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider border ${TAG_COLORS[color] || TAG_COLORS.slate}`}>
      {children}
    </span>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-200'}`} />
}

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <div className="animate-spin inline-block w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function EmptyMeta({ text, metadata }: { text: string; metadata: Record<string, TableMetadata> }) {
  return (
    <p className="text-sm text-slate-400 italic">
      {Object.keys(metadata).length > 0 ? text : 'Deploy introspection RPCs to see live data.'}
    </p>
  )
}