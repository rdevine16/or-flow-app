// components/ui/TableActions.tsx
'use client'

import { Copy, ExternalLink, Eye, Pencil, Trash2 } from 'lucide-react'


interface TableActionsProps {
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  onOpen?: () => void
  viewTooltip?: string
  editTooltip?: string
  deleteTooltip?: string
  duplicateTooltip?: string
  openTooltip?: string
  className?: string
}

export function TableActions({
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onOpen,
  viewTooltip = 'View',
  editTooltip = 'Edit',
  deleteTooltip = 'Delete',
  duplicateTooltip = 'Duplicate',
  openTooltip = 'Open',
  className = '',
}: TableActionsProps) {
  return (
    <div className={`flex items-center justify-end gap-1 ${className}`}>
      {/* View */}
      {onView && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={viewTooltip}
          aria-label={viewTooltip}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* Edit */}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={editTooltip}
          aria-label={editTooltip}
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}

      {/* Duplicate */}
      {onDuplicate && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={duplicateTooltip}
          aria-label={duplicateTooltip}
        >
          <Copy className="w-4 h-4" />
        </button>
      )}

      {/* Open (external) */}
      {onOpen && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={openTooltip}
          aria-label={openTooltip}
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      )}

      {/* Delete */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title={deleteTooltip}
          aria-label={deleteTooltip}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ============================================
// Usage Examples
// ============================================

/*
// In a table row
<tr>
  <td>John Doe</td>
  <td>john@example.com</td>
  <td>
    <TableActions
      onView={() => router.push(`/users/${user.id}`)}
      onEdit={() => handleEdit(user.id)}
      onDelete={() => handleDelete(user.id)}
    />
  </td>
</tr>

// With custom tooltips
<TableActions
  onEdit={() => handleEdit(id)}
  onDelete={() => handleDelete(id)}
  editTooltip="Edit case"
  deleteTooltip="Delete case"
/>

// Just view and edit
<TableActions
  onView={() => handleView(id)}
  onEdit={() => handleEdit(id)}
/>

// With duplicate action
<TableActions
  onEdit={() => handleEdit(id)}
  onDuplicate={() => handleDuplicate(id)}
  onDelete={() => handleDelete(id)}
/>

// All actions
<TableActions
  onView={() => handleView(id)}
  onEdit={() => handleEdit(id)}
  onDuplicate={() => handleDuplicate(id)}
  onOpen={() => window.open(`/cases/${id}`, '_blank')}
  onDelete={() => handleDelete(id)}
/>
*/
