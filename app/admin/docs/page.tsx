'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/UserContext'
import {
  pageRegistry,
  getPagesByCategory,
  getCategories,
  getPagesByTable,
  type PageEntry,
  type PageCategory,
} from '@/lib/pageRegistry'
import {
  getTablesMetadata,
  type TableMetadata,
} from '@/lib/supabaseIntrospection'

// =============================================================================
// Icons (inline SVGs — swap for your icon library if you have one)
// =============================================================================

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function BookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 12c.621 0 1.125.504 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  )
}

function DeviceIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  )
}

function CubeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  )
}

// =============================================================================
// Category badge colors (light theme)
// =============================================================================

const CATEGORY_COLORS: Record<PageCategory, string> = {
  'Surgeon-Facing': 'bg-blue-50 text-blue-700 border-blue-200',
  'Admin': 'bg-amber-50 text-amber-700 border-amber-200',
  'Global Admin': 'bg-red-50 text-red-700 border-red-200',
  'Shared': 'bg-green-50 text-green-700 border-green-200',
  'Auth': 'bg-purple-50 text-purple-700 border-purple-200',
  'API Routes': 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

// =============================================================================
// Detail tabs
// =============================================================================

type DetailTab = 'overview' | 'database' | 'triggers' | 'platform'

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <CubeIcon /> },
  { id: 'database', label: 'Database', icon: <TableIcon /> },
  { id: 'triggers', label: 'Triggers & FKs', icon: <BoltIcon /> },
  { id: 'platform', label: 'Platform', icon: <DeviceIcon /> },
]

// =============================================================================
// Main Page
// =============================================================================

export default function AdminDocsPage() {
  const supabase = createClient()
  const { isGlobalAdmin } = useUser()

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(getCategories()))
  const [tableMetadata, setTableMetadata] = useState<Record<string, TableMetadata>>({})
  const [isLoadingMeta, setIsLoadingMeta] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const grouped = useMemo(() => getPagesByCategory(), [])
  const categories = useMemo(() => getCategories(), [])
  const selectedPage = useMemo(
    () => pageRegistry.find(p => p.id === selectedPageId) ?? null,
    [selectedPageId]
  )

  // Filter pages by search
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped
    const q = searchQuery.toLowerCase()
    const result: Partial<Record<PageCategory, PageEntry[]>> = {}
    for (const cat of categories) {
      const pages = (grouped[cat] || []).filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.route.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.reads.some(t => t.toLowerCase().includes(q)) ||
          p.writes.some(t => t.toLowerCase().includes(q))
      )
      if (pages.length > 0) result[cat] = pages
    }
    return result
  }, [grouped, categories, searchQuery])

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // Load database metadata when a page is selected
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

  // Access guard — global admin only
  if (!isGlobalAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400 text-sm">Access restricted to global administrators.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ================================================================ */}
      {/* LEFT PANEL — Table of Contents                                   */}
      {/* ================================================================ */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col bg-slate-50/50">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <BookIcon className="w-5 h-5 text-slate-600" />
            <h1 className="text-base font-semibold text-slate-800 tracking-tight">ORbit Docs</h1>
          </div>
          <input
            type="text"
            placeholder="Search pages, tables..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg
                       placeholder-slate-400 text-slate-700
                       focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300
                       transition-colors"
          />
        </div>

        {/* Category Tree */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {Object.entries(filteredGrouped).map(([category, pages]) => (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-2 py-2 text-xs font-semibold uppercase tracking-wider
                           text-slate-400 hover:text-slate-600 transition-colors rounded"
              >
                <ChevronIcon open={expandedCategories.has(category)} />
                <span>{category}</span>
                <span className="ml-auto text-slate-300 text-[10px] font-normal">
                  {(pages as PageEntry[]).length}
                </span>
              </button>

              {expandedCategories.has(category) && (
                <div className="ml-4 space-y-0.5">
                  {(pages as PageEntry[]).map(page => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setSelectedPageId(page.id)
                        setActiveTab('overview')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150
                        ${
                          selectedPageId === page.id
                            ? 'bg-slate-200/70 text-slate-900 font-medium'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <div className="leading-snug">{page.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate font-mono">{page.route}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-400">
          {pageRegistry.length} pages documented
        </div>
      </aside>

      {/* ================================================================ */}
      {/* RIGHT PANEL — Detail View                                        */}
      {/* ================================================================ */}
      <main className="flex-1 overflow-y-auto bg-white">
        {!selectedPage ? (
          <EmptyState />
        ) : (
          <div className="max-w-4xl mx-auto px-8 py-6">
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">{selectedPage.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[selectedPage.category]}`}>
                  {selectedPage.category}
                </span>
              </div>
              <p className="text-slate-500 text-sm">{selectedPage.description}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                <code className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-slate-600">
                  {selectedPage.route}
                </code>
                <span>Roles: {selectedPage.roles.join(', ')}</span>
                {selectedPage.lastReviewed && <span>Reviewed: {selectedPage.lastReviewed}</span>}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-slate-200 pb-px">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors
                    ${
                      activeTab === tab.id
                        ? 'text-slate-800 border-b-2 border-slate-800 -mb-px'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && <OverviewTab page={selectedPage} />}
            {activeTab === 'database' && (
              <DatabaseTab page={selectedPage} metadata={tableMetadata} isLoading={isLoadingMeta} />
            )}
            {activeTab === 'triggers' && (
              <TriggersTab page={selectedPage} metadata={tableMetadata} isLoading={isLoadingMeta} />
            )}
            {activeTab === 'platform' && <PlatformTab page={selectedPage} />}
          </div>
        )}
      </main>
    </div>
  )
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400">
      <BookIcon className="w-8 h-8 text-slate-300" />
      <p className="mt-3 text-base font-medium text-slate-500">Select a page from the sidebar</p>
      <p className="text-sm mt-1">to view its documentation and live database metadata</p>
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
          {page.realtime && page.realtime.length > 0 && (
            <div>
              <Label>Realtime Subscriptions</Label>
              <TagList items={page.realtime} color="green" />
            </div>
          )}
          {page.materializedViews && page.materializedViews.length > 0 && (
            <div>
              <Label>Materialized Views</Label>
              <TagList items={page.materializedViews} color="purple" />
            </div>
          )}
          {page.apiRoutes && page.apiRoutes.length > 0 && (
            <div>
              <Label>API Routes</Label>
              <TagList items={page.apiRoutes} color="red" />
            </div>
          )}
        </div>
      </Section>

      {(page.calculationEngine || page.keyValidations || page.timezoneAware) && (
        <Section title="Business Logic">
          <div className="space-y-3">
            {page.calculationEngine && (
              <div>
                <Label>Calculation Engine</Label>
                <code className="text-sm px-2 py-1 bg-amber-50 border border-amber-200 rounded font-mono text-amber-800">
                  {page.calculationEngine}
                </code>
              </div>
            )}
            {page.keyValidations && page.keyValidations.length > 0 && (
              <div>
                <Label>Key Validations</Label>
                <ul className="space-y-1.5">
                  {page.keyValidations.map((v, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5 text-xs">&#9888;</span>
                      <code className="font-mono text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700">{v}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {page.timezoneAware && (
              <div className="text-sm text-slate-500 flex items-center gap-2">
                <span className="text-blue-500">&#128336;</span>
                Handles facility-specific timezone logic
              </div>
            )}
          </div>
        </Section>
      )}

      {(page.components || page.interactions || page.stateManagement) && (
        <Section title="UI Details">
          <div className="space-y-3">
            {page.components && page.components.length > 0 && (
              <div>
                <Label>Components</Label>
                <TagList items={page.components} color="green" />
              </div>
            )}
            {page.interactions && page.interactions.length > 0 && (
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
            {page.stateManagement && (
              <div>
                <Label>State Management Notes</Label>
                <p className="text-sm text-slate-600">{page.stateManagement}</p>
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
  page, metadata, isLoading,
}: {
  page: PageEntry
  metadata: Record<string, TableMetadata>
  isLoading: boolean
}) {
  const allTables = [...new Set([...page.reads, ...page.writes])]

  if (isLoading) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
        <p className="text-sm">Loading database metadata...</p>
      </div>
    )
  }

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
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
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
                Deploy the introspection RPCs to see live column data.
                <br />
                <span className="text-xs">Run <code className="bg-slate-100 px-1 rounded">introspection_setup.sql</code> in Supabase SQL Editor</span>
              </p>
            )}

            {/* Cross-reference */}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">Also used by: </span>
              {getPagesByTable(tableName)
                .filter(p => p.id !== page.id)
                .map((p, i) => (
                  <span key={p.id} className="text-xs text-slate-500">
                    {i > 0 && ', '}{p.name}
                  </span>
                ))}
              {getPagesByTable(tableName).filter(p => p.id !== page.id).length === 0 && (
                <span className="text-xs text-slate-300 italic">no other pages</span>
              )}
            </div>
          </Section>
        )
      })}
    </div>
  )
}

// =============================================================================
// Triggers & Foreign Keys Tab
// =============================================================================

function TriggersTab({
  page, metadata, isLoading,
}: {
  page: PageEntry
  metadata: Record<string, TableMetadata>
  isLoading: boolean
}) {
  const allTables = [...new Set([...page.reads, ...page.writes])]

  if (isLoading) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full mb-3" />
        <p className="text-sm">Loading trigger and FK data...</p>
      </div>
    )
  }

  const hasTriggers = allTables.some(t => metadata[t]?.triggers.length > 0)
  const hasFKs = allTables.some(t => metadata[t]?.foreignKeys.length > 0)
  const hasIndexes = allTables.some(t => metadata[t]?.indexes.length > 0)

  return (
    <div className="space-y-5">
      {/* Triggers */}
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
        {!hasTriggers && (
          <p className="text-sm text-slate-400 italic">
            {Object.keys(metadata).length > 0
              ? 'No triggers found on tables used by this page.'
              : 'Deploy introspection RPCs to see triggers.'}
          </p>
        )}
      </Section>

      {/* Foreign Keys */}
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
        {!hasFKs && (
          <p className="text-sm text-slate-400 italic">
            {Object.keys(metadata).length > 0
              ? 'No foreign keys found on tables used by this page.'
              : 'Deploy introspection RPCs to see relationships.'}
          </p>
        )}
      </Section>

      {/* Indexes */}
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
        {!hasIndexes && (
          <p className="text-sm text-slate-400 italic">
            {Object.keys(metadata).length > 0
              ? 'No indexes found.'
              : 'Deploy introspection RPCs to see indexes.'}
          </p>
        )}
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
            <span className={`w-2.5 h-2.5 rounded-full ${page.ios.exists ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className="text-sm text-slate-600">
              {page.ios.exists ? 'iOS equivalent exists' : 'No iOS equivalent'}
            </span>
          </div>

          {page.ios.exists && page.ios.viewName && (
            <div>
              <Label>SwiftUI View</Label>
              <code className="text-sm px-2 py-1 bg-green-50 border border-green-200 rounded font-mono text-green-800">
                {page.ios.viewName}
              </code>
            </div>
          )}

          {page.ios.notes && (
            <div>
              <Label>iOS Notes</Label>
              <p className="text-sm text-slate-600">{page.ios.notes}</p>
            </div>
          )}
        </div>
      </Section>

      {page.parityNotes && (
        <Section title="Parity Notes">
          <p className="text-sm text-slate-600">{page.parityNotes}</p>
        </Section>
      )}

      <Section title="Feature Matrix">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
              <th className="pb-2 pr-4">Feature</th>
              <th className="pb-2 pr-4">Web</th>
              <th className="pb-2">iOS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="text-slate-600">
              <td className="py-2 pr-4">Page exists</td>
              <td className="py-2 pr-4"><StatusDot active /></td>
              <td className="py-2"><StatusDot active={page.ios.exists} /></td>
            </tr>
            <tr className="text-slate-600">
              <td className="py-2 pr-4">Realtime updates</td>
              <td className="py-2 pr-4"><StatusDot active={!!page.realtime && page.realtime.length > 0} /></td>
              <td className="py-2"><StatusDot active={page.ios.exists && !!page.realtime && page.realtime.length > 0} /></td>
            </tr>
            <tr className="text-slate-600">
              <td className="py-2 pr-4">Write operations</td>
              <td className="py-2 pr-4"><StatusDot active={page.writes.length > 0} /></td>
              <td className="py-2"><StatusDot active={page.ios.exists && page.writes.length > 0} /></td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  )
}

// =============================================================================
// Shared UI Components
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
  return <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{children}</div>
}

const TAG_COLORS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}

function TagList({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0) return <span className="text-sm text-slate-300 italic">None</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <code
          key={item}
          className={`text-xs px-2 py-0.5 rounded-md border font-mono ${TAG_COLORS[color] || TAG_COLORS.blue}`}
        >
          {item}
        </code>
      ))}
    </div>
  )
}

function MiniTag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider border ${TAG_COLORS[color] || TAG_COLORS.blue}`}>
      {children}
    </span>
  )
}

function StatusDot({ active }: { active: boolean }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500' : 'bg-slate-200'}`} />
}