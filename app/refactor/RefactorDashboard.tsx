'use client'

import { useState } from 'react'
import { IssueCard } from './IssueCard'
import type { RefactorIssue } from './page'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface RefactorDashboardProps {
  initialIssues: RefactorIssue[]
}

export function RefactorDashboard({ initialIssues }: RefactorDashboardProps) {
  const [issues, setIssues] = useState<RefactorIssue[]>(initialIssues)
  const [loading, setLoading] = useState(false)
  const [fixedIssues, setFixedIssues] = useState<Set<string>>(new Set())
  const { showToast } = useToast()
  // Filtering state
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedRisk, setSelectedRisk] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  const handleScan = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/refactor/scan', {
        method: 'POST',
      })
      const data = await response.json()
      setIssues(data.issues || [])
      setCurrentPage(1) // Reset to first page
    } catch (error) {
      showToast({
  type: 'error',
  title: 'Scan failed:',
  message: error instanceof Error ? error.message : 'Scan failed:'
})
    } finally {
      setLoading(false)
    }
  }

  // Filter issues
  const filteredIssues = issues.filter(issue => {
    // Type filter
    if (selectedType !== 'all' && issue.type !== selectedType) {
      return false
    }
    
    // Risk filter
    if (selectedRisk !== 'all' && issue.risk !== selectedRisk) {
      return false
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        issue.file.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.type.toLowerCase().includes(query)
      )
    }
    
    return true
  })

  // Get unique types for filter
  const issueTypes = Array.from(new Set(issues.map(i => i.type)))
  
  // Pagination
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentIssues = filteredIssues.slice(startIndex, endIndex)

  // Stats
  const stats = {
    total: issues.length,
    filtered: filteredIssues.length,
    safe: filteredIssues.filter(i => i.risk === 'safe').length,
    review: filteredIssues.filter(i => i.risk === 'review').length,
    manual: filteredIssues.filter(i => i.risk === 'manual').length,
    fixed: fixedIssues.size,
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Refactor Dashboard
          </h1>
          <p className="text-slate-600">
            Automated code quality scanner
          </p>
        </div>

        {/* Scan Button */}
        <div className="mb-6">
          <button
            onClick={handleScan}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Scanning...' : 'POST - Scan Codebase'}
          </button>
        </div>

        {/* Stats */}
        {issues.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-sm text-slate-600">Total Issues</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="text-2xl font-bold text-blue-600">{stats.filtered}</div>
              <div className="text-sm text-slate-600">Showing</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">{stats.safe}</div>
              <div className="text-sm text-green-600">Safe</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="text-2xl font-bold text-amber-700">{stats.review}</div>
              <div className="text-sm text-amber-700">Review</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.manual}</div>
              <div className="text-sm text-red-600">Manual</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{stats.fixed}</div>
              <div className="text-sm text-blue-600">Fixed</div>
            </div>
          </div>
        )}

        {/* Filters */}
        {issues.length > 0 && (
          <div className="bg-white rounded-lg p-4 mb-6 border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  placeholder="Search files, descriptions..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Issue Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types ({issues.length})</option>
                  {issueTypes.map(type => (
                    <option key={type} value={type}>
                      {type} ({issues.filter(i => i.type === type).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Risk Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Risk Level
                </label>
                <select
                  value={selectedRisk}
                  onChange={(e) => {
                    setSelectedRisk(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Risks ({issues.length})</option>
                  <option value="safe">Safe ({stats.safe})</option>
                  <option value="review">Review ({stats.review})</option>
                  <option value="manual">Manual ({stats.manual})</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Pagination Controls (Top) */}
        {filteredIssues.length > itemsPerPage && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-slate-200">
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
        {currentIssues.length > 0 ? (
          <div className="space-y-4">
            {currentIssues.map(issue => (
              <IssueCard
                key={issue.id}
                issue={issue}
                isFixed={fixedIssues.has(issue.id)}
                onMarkFixed={() => {
                  setFixedIssues(prev => new Set([...prev, issue.id]))
                }}
                onMarkUnfixed={() => {
                  setFixedIssues(prev => {
                    const next = new Set(prev)
                    next.delete(issue.id)
                    return next
                  })
                }}
              />
            ))}
          </div>
        ) : issues.length > 0 ? (
          <div className="bg-white rounded-lg p-8 text-center border border-slate-200">
            <p className="text-slate-600">No issues match your filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 text-center border border-slate-200">
            <p className="text-slate-600">Click "POST - Scan Codebase" to find refactoring opportunities</p>
          </div>
        )}

        {/* Pagination Controls (Bottom) */}
        {filteredIssues.length > itemsPerPage && (
          <div className="bg-white rounded-lg p-4 mt-4 border border-slate-200">
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
    </div>
  )
}
