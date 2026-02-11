// components/ui/Pagination.tsx
// Reusable pagination component with per-page selector and smart page windowing
//
// Usage:
//   <Pagination
//     currentPage={currentPage}
//     totalPages={totalPages}
//     totalItems={items.length}
//     perPage={perPage}
//     onPageChange={setCurrentPage}
//     onPerPageChange={(n) => { setPerPage(n); setCurrentPage(1) }}
//   />

'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange?: (perPage: number) => void
  perPageOptions?: number[]
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 25, 50, 100],
  className = '',
}: PaginationProps) {
  // Generate smart page number window: 1 ... 4 5 6 ... 20
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('ellipsis')

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)

      if (currentPage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }

    return pages
  }, [currentPage, totalPages])

  if (totalPages <= 1 && !onPerPageChange) return null

  const itemLabel = totalItems === 1 ? 'item' : 'items'

  return (
    <div className={`px-6 py-4 border-t border-slate-200 flex items-center justify-between ${className}`}>
      {/* Per-page selector */}
      <div className="flex items-center gap-2">
        {onPerPageChange ? (
          <>
            <span className="text-sm text-slate-600">Show</span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {perPageOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <span className="text-sm text-slate-600">
              of {totalItems} {itemLabel}
            </span>
          </>
        ) : (
          <span className="text-sm text-slate-600">
            {totalItems} {itemLabel}
          </span>
        )}
      </div>

      {/* Page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-3 py-1 text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`
                  px-3 py-1 rounded-lg text-sm font-medium transition-colors
                  ${page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                  }
                `}
              >
                {page}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
