// components/ui/EmptyState.tsx
'use client'

import { ReactNode } from 'react'
import { BarChart3, CalendarDays, ClipboardList, FileText, Folder, Inbox, Search, Users } from 'lucide-react'
import { buttonVariants } from '@/lib/design-tokens'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode | {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className = '' 
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      {icon && (
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
            {icon}
          </div>
        </div>
      )}
      
      <h3 className="text-base font-medium text-slate-900 mb-1">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-4">
          {typeof action === 'object' && action !== null && 'label' in action ? (
            <button
              onClick={(action as { label: string; onClick: () => void }).onClick}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${buttonVariants.primary}`}
            >
              {(action as { label: string; onClick: () => void }).label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Common Icons for Empty States
// ============================================

export const EmptyStateIcons = {
  // Inbox/No items
  Inbox: (
    <Inbox className="w-8 h-8" />
  ),

  // Search/No results
  Search: (
    <Search className="w-8 h-8" />
  ),

  // Folder/No files
  Folder: (
    <Folder className="w-8 h-8" />
  ),

  // Document/No content
  Document: (
    <FileText className="w-8 h-8" />
  ),

  // Calendar/No events
  Calendar: (
    <CalendarDays className="w-8 h-8" />
  ),

  // Users/No people
  Users: (
    <Users className="w-8 h-8" />
  ),

  // Clipboard/No tasks
  Clipboard: (
    <ClipboardList className="w-8 h-8" />
  ),

  // Chart/No data
  Chart: (
    <BarChart3 className="w-8 h-8" />
  ),
}

// ============================================
// Usage Examples
// ============================================

/*
// Basic usage
<EmptyState
  icon={EmptyStateIcons.Inbox}
  title="No cases found"
  description="Get started by creating your first case"
  action={{
    label: "Create Case",
    onClick: handleCreate
  }}
/>

// Without action button
<EmptyState
  icon={EmptyStateIcons.Search}
  title="No results found"
  description="Try adjusting your search filters"
/>

// Custom icon
<EmptyState
  icon={<YourCustomIcon />}
  title="Custom empty state"
/>
*/