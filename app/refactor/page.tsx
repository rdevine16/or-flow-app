'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import { IssueCard } from './IssueCard'
import { ProgressBar, FilterBar } from './components'
import { useToast } from '@/components/ui/Toast/ToastProvider'


export type RiskLevel = 'safe' | 'review' | 'manual'
export type IssueType = 
  | 'console-log' 
  | 'delete-confirm' 
  | 'hardcoded-color' 
  | 'inline-spinner' 
  | 'status-badge'
  | 'modal-state'
  | 'loading-state'
  | 'pagination'
  | 'form-validation'
  | 'error-display'
  | 'empty-state'
  | 'search-input'
  | 'action-buttons'
  | 'title-tooltip'
  | 'sortable-table'

export interface RefactorIssue {
  id: string
  file: string
  line: number
  type: IssueType
  risk: RiskLevel
  description: string
  beforeCode: string
  afterCode: string
  context: string
  imports?: string[]
  warnings?: string[]
  metadata?: any
}

export default function RefactorPage() {
  const [scanning, setScanning] = useState(false)
  const { showToast } = useToast()
  const [issues, setIssues] = useState<RefactorIssue[]>([])
  const [fixedIssues, setFixedIssues] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<{
    risk?: RiskLevel
    type?: IssueType
    file?: string
    showFixed: boolean
  }>({ showFixed: false })

  // ============================================
  // NEW: Pagination State
  // ============================================
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Load fixed issues from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('orbit-refactor-fixed')
    if (saved) {
      setFixedIssues(new Set(JSON.parse(saved)))
    }
  }, [])

  // Save fixed issues to localStorage
  const markAsFixed = (issueId: string) => {
    const updated = new Set(fixedIssues)
    updated.add(issueId)
    setFixedIssues(updated)
    localStorage.setItem('orbit-refactor-fixed', JSON.stringify([...updated]))
  }

  const markAsUnfixed = (issueId: string) => {
    const updated = new Set(fixedIssues)
    updated.delete(issueId)
    setFixedIssues(updated)
    localStorage.setItem('orbit-refactor-fixed', JSON.stringify([...updated]))
  }

  const handleScan = async () => {
    setScanning(true)
    
try {
  const response = await fetch('/api/refactor/scan', {
    method: 'POST',
  })
  const data = await response.json()
  setIssues(data.issues || [])
  setCurrentPage(1) // Reset to first page on new scan
  
  // ✅ Success toast
  showToast({
    type: 'success',
    title: 'Scan Complete',
    message: `Found ${data.issues?.length || 0} issues`
  })
  
} catch (error) {
  
  // ✅ Error toast
  showToast({
    type: 'error',
    title: 'Scan Failed',
    message: error instanceof Error ? error.message : 'Failed to scan codebase'
  })
  
} finally {
  setScanning(false)
}
  }

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    if (!filter.showFixed && fixedIssues.has(issue.id)) return false
    if (filter.risk && issue.risk !== filter.risk) return false
    if (filter.type && issue.type !== filter.type) return false
    if (filter.file && !issue.file.includes(filter.file)) return false
    return true
  })

  // ============================================
  // NEW: Pagination Logic
  // ============================================
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentIssues = filteredIssues.slice(startIndex, endIndex)

  // Calculate stats
  const stats = {
    total: issues.length,
    fixed: fixedIssues.size,
    remaining: issues.length - fixedIssues.size,
    byRisk: {
      safe: issues.filter(i => i.risk === 'safe').length,
      review: issues.filter(i => i.risk === 'review').length,
      manual: issues.filter(i => i.risk === 'manual').length,
    },
    byType: issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1
      return acc
    }, {} as Record<IssueType, number>)
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Refactoring Assistant
            </h1>
            <p className="text-slate-600">
              Guided code improvements with safety checks
            </p>
          </div>

          {/* Scan Button */}
          {issues.length === 0 && !scanning && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Ready to scan your codebase?
                </h2>
                <p className="text-slate-600 mb-6">
                  This will analyze your app for refactoring opportunities
                </p>
                <button
                  onClick={handleScan}
                  className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Scan
                </button>
              </div>
            </div>
          )}

          {/* Scanning State */}
          {scanning && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Scanning your codebase...
                </h2>
                <p className="text-slate-600">
                  This may take a minute
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {issues.length > 0 && !scanning && (
            <div className="space-y-6">
              {/* Progress Overview */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Progress
                    </h2>
                    <p className="text-sm text-slate-600">
                      {stats.fixed} of {stats.total} issues addressed
                    </p>
                  </div>
                  <button
                    onClick={handleScan}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Re-scan
                  </button>
                </div>
                
                <ProgressBar 
                  current={stats.fixed} 
                  total={stats.total} 
                />

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {stats.byRisk.safe}
                    </div>
                    <div className="text-sm text-green-600">Safe to fix</div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-700">
                      {stats.byRisk.review}
                    </div>
                    <div className="text-sm text-amber-700">Review needed</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {stats.byRisk.manual}
                    </div>
                    <div className="text-sm text-red-600">Manual only</div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <FilterBar
                filter={filter}
                onChange={setFilter}
                stats={stats}
              />

              {/* ============================================
                  NEW: Pagination Controls (Top)
                  ============================================ */}
              {filteredIssues.length > itemsPerPage && (
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredIssues.length)} of {filteredIssues.length}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      
                      <span className="text-sm text-slate-600 px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Issues List */}
              <div className="space-y-4">
                {currentIssues.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
                    <p className="text-slate-600">
                      No issues match your filters
                    </p>
                  </div>
                ) : (
                  currentIssues.map(issue => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isFixed={fixedIssues.has(issue.id)}
                      onMarkFixed={() => markAsFixed(issue.id)}
                      onMarkUnfixed={() => markAsUnfixed(issue.id)}
                    />
                  ))
                )}
              </div>

              {/* ============================================
                  NEW: Pagination Controls (Bottom)
                  ============================================ */}
              {filteredIssues.length > itemsPerPage && (
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredIssues.length)} of {filteredIssues.length}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCurrentPage(1)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        First
                      </button>
                      <button
                        onClick={() => {
                          setCurrentPage(p => Math.max(1, p - 1))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      
                      <span className="text-sm text-slate-600 px-3">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => {
                          setCurrentPage(p => Math.min(totalPages, p + 1))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => {
                          setCurrentPage(totalPages)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </DashboardLayout>
  )
}