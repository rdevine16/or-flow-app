// hooks/usePagination.ts
import { useState, useMemo } from 'react'

interface UsePaginationProps {
  totalItems: number
  itemsPerPage?: number
  initialPage?: number
}

interface UsePaginationReturn {
  currentPage: number
  totalPages: number
  canGoNext: boolean
  canGoPrev: boolean
  nextPage: () => void
  prevPage: () => void
  goToPage: (page: number) => void
  startIndex: number
  endIndex: number
  itemsPerPage: number
  reset: () => void
}

export function usePagination({
  totalItems,
  itemsPerPage = 10,
  initialPage = 1,
}: UsePaginationProps): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage)

  // Calculate total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage]
  )

  // Can navigate?
  const canGoNext = currentPage < totalPages
  const canGoPrev = currentPage > 1

  // Navigation functions
  const nextPage = () => {
    if (canGoNext) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const prevPage = () => {
    if (canGoPrev) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  const reset = () => {
    setCurrentPage(initialPage)
  }

  // Calculate indices
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)

  // Auto-correct page if it exceeds total pages
  // (e.g., if items are deleted and current page becomes invalid)
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  return {
    currentPage,
    totalPages,
    canGoNext,
    canGoPrev,
    nextPage,
    prevPage,
    goToPage,
    startIndex,
    endIndex,
    itemsPerPage,
    reset,
  }
}

// ============================================
// Usage Examples
// ============================================

/*
// Basic usage
const items = [...] // Your array of items
const pagination = usePagination({
  totalItems: items.length,
  itemsPerPage: 10,
  initialPage: 1,
})

// Get current page items
const currentItems = items.slice(pagination.startIndex, pagination.endIndex)

// Render pagination UI
<div>
  <button 
    onClick={pagination.prevPage} 
    disabled={!pagination.canGoPrev}
  >
    Previous
  </button>
  
  <span>
    Page {pagination.currentPage} of {pagination.totalPages}
  </span>
  
  <button 
    onClick={pagination.nextPage} 
    disabled={!pagination.canGoNext}
  >
    Next
  </button>
</div>

// Jump to specific page
<select 
  value={pagination.currentPage}
  onChange={(e) => pagination.goToPage(Number(e.target.value))}
>
  {Array.from({ length: pagination.totalPages }, (_, i) => (
    <option key={i + 1} value={i + 1}>
      Page {i + 1}
    </option>
  ))}
</select>

// Reset to first page (e.g., after search)
<button onClick={pagination.reset}>
  Reset
</button>

// With different page sizes
const [pageSize, setPageSize] = useState(10)
const pagination = usePagination({
  totalItems: items.length,
  itemsPerPage: pageSize,
})

// Page size selector
<select 
  value={pageSize} 
  onChange={(e) => {
    setPageSize(Number(e.target.value))
    pagination.reset() // Reset to page 1 when changing page size
  }}
>
  <option value={10}>10 per page</option>
  <option value={25}>25 per page</option>
  <option value={50}>50 per page</option>
  <option value={100}>100 per page</option>
</select>
*/
