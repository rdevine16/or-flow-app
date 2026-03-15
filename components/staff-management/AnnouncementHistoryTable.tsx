// components/staff-management/AnnouncementHistoryTable.tsx
// Sortable, filterable history table for all announcements.
// Displays status badges, row actions (edit, deactivate, delete), filters, and search.
'use client'

import { useState, useMemo, useCallback } from 'react'
import Badge from '@/components/ui/Badge'
import { Input, Select } from '@/components/ui/Input'
import { IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  Search,
  Edit2,
  Pause,
  Trash2,
  ArrowUpDown,
  Megaphone,
  Filter,
  X,
} from 'lucide-react'
import type {
  Announcement,
  AnnouncementStatus,
  AnnouncementPriority,
  AnnouncementCategory,
  AnnouncementFilterParams,
} from '@/types/announcements'
import {
  AUDIENCE_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from '@/types/announcements'

// ============================================
// TYPES
// ============================================

interface AnnouncementHistoryTableProps {
  announcements: Announcement[]
  loading: boolean
  filters: AnnouncementFilterParams
  onFilterChange: (filters: Partial<AnnouncementFilterParams>) => void
  onClearFilters: () => void
  onEdit: (announcement: Announcement) => void
  onDeactivate: (announcement: Announcement) => Promise<void>
  onDelete: (announcement: Announcement) => Promise<void>
}

type SortField = 'title' | 'created_at' | 'expires_at' | 'priority' | 'status'
type SortDir = 'asc' | 'desc'

// ============================================
// STATUS BADGE STYLES
// ============================================

const STATUS_BADGE_VARIANT: Record<AnnouncementStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  scheduled: 'default',
  active: 'success',
  expired: 'default',
  deactivated: 'error',
}

const PRIORITY_BADGE_VARIANT: Record<AnnouncementPriority, 'info' | 'warning' | 'error'> = {
  normal: 'info',
  warning: 'warning',
  critical: 'error',
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const PRIORITY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  normal: 2,
}

// ============================================
// COMPONENT
// ============================================

export function AnnouncementHistoryTable({
  announcements,
  loading,
  filters,
  onFilterChange,
  onClearFilters,
  onEdit,
  onDeactivate,
  onDelete,
}: AnnouncementHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deactivate' | 'delete'
    announcement: Announcement
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Toggle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'created_at' || field === 'expires_at' ? 'desc' : 'asc')
    }
  }, [sortField])

  // Sort announcements
  const sorted = useMemo(() => {
    const arr = [...announcements]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'expires_at':
          cmp = new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime()
          break
        case 'priority':
          cmp = (PRIORITY_SORT_ORDER[a.priority] ?? 2) - (PRIORITY_SORT_ORDER[b.priority] ?? 2)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [announcements, sortField, sortDir])

  const hasActiveFilters = !!(filters.status || filters.priority || filters.category || filters.search)

  // Confirm action handler
  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      if (confirmAction.type === 'deactivate') {
        await onDeactivate(confirmAction.announcement)
      } else {
        await onDelete(confirmAction.announcement)
      }
      setConfirmAction(null)
    } finally {
      setActionLoading(false)
    }
  }, [confirmAction, onDeactivate, onDelete])

  // Sort button helper
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-600' : 'text-slate-300'}`} />
    </button>
  )

  return (
    <div className="space-y-3">
      {/* Compact filter toolbar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => onFilterChange({ search: e.target.value || undefined })}
            placeholder="Search announcements..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="h-5 w-px bg-slate-200 shrink-0" />

        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />

        {/* Inline filters */}
        <Select
          value={filters.status ?? ''}
          onChange={(e) =>
            onFilterChange({
              status: (e.target.value as AnnouncementStatus) || undefined,
            })
          }
          className="!px-2.5 !py-1.5 h-8 text-sm min-w-[120px]"
        >
          <option value="">All Statuses</option>
          {(Object.entries(STATUS_LABELS) as [AnnouncementStatus, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </Select>

        <Select
          value={filters.priority ?? ''}
          onChange={(e) =>
            onFilterChange({
              priority: (e.target.value as AnnouncementPriority) || undefined,
            })
          }
          className="!px-2.5 !py-1.5 h-8 text-sm min-w-[120px]"
        >
          <option value="">All Priorities</option>
          {(Object.entries(PRIORITY_LABELS) as [AnnouncementPriority, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </Select>

        <Select
          value={filters.category ?? ''}
          onChange={(e) =>
            onFilterChange({
              category: (e.target.value as AnnouncementCategory) || undefined,
            })
          }
          className="!px-2.5 !py-1.5 h-8 text-sm min-w-[130px]"
        >
          <option value="">All Categories</option>
          {(Object.entries(CATEGORY_LABELS) as [AnnouncementCategory, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </Select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium px-1.5 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {hasActiveFilters ? 'No announcements match your filters' : 'No announcements yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {hasActiveFilters
                ? 'Try adjusting your filters or search terms'
                : 'Create your first announcement to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3">
                    <SortHeader field="title">Title</SortHeader>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Sender
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Audience
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="priority">Priority</SortHeader>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Category
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="status">Status</SortHeader>
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="created_at">Created</SortHeader>
                  </th>
                  <th className="text-left px-4 py-3">
                    <SortHeader field="expires_at">Expires</SortHeader>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((ann) => {
                  const canEdit = ann.status === 'active' || ann.status === 'scheduled'
                  const canDeactivate = ann.status === 'active' || ann.status === 'scheduled'
                  const senderName = ann.creator
                    ? `${ann.creator.first_name} ${ann.creator.last_name}`
                    : 'Unknown'

                  return (
                    <tr key={ann.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {ann.title}
                          </p>
                          {ann.body && (
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {ann.body}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{senderName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default" size="sm">
                          {AUDIENCE_LABELS[ann.audience]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PRIORITY_BADGE_VARIANT[ann.priority]} size="sm">
                          {PRIORITY_LABELS[ann.priority]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {CATEGORY_LABELS[ann.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_VARIANT[ann.status]} size="sm">
                          {STATUS_LABELS[ann.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500 whitespace-nowrap">
                          {formatDate(ann.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500 whitespace-nowrap">
                          {formatDateTime(ann.expires_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label="Edit announcement"
                              onClick={() => onEdit(ann)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </IconButton>
                          )}
                          {canDeactivate && (
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label="Deactivate announcement"
                              onClick={() =>
                                setConfirmAction({ type: 'deactivate', announcement: ann })
                              }
                            >
                              <Pause className="w-4 h-4" />
                            </IconButton>
                          )}
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Delete announcement"
                            onClick={() =>
                              setConfirmAction({ type: 'delete', announcement: ann })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm dialog for deactivate/delete */}
      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          variant={confirmAction.type === 'delete' ? 'danger' : 'warning'}
          title={
            confirmAction.type === 'delete'
              ? 'Delete announcement?'
              : 'Deactivate announcement?'
          }
          message={
            confirmAction.type === 'delete'
              ? `"${confirmAction.announcement.title}" will be permanently removed.`
              : `"${confirmAction.announcement.title}" will be deactivated and the banner will be hidden for all users.`
          }
          confirmText={confirmAction.type === 'delete' ? 'Delete' : 'Deactivate'}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
