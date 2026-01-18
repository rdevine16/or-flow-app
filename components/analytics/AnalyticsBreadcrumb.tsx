// components/analytics/AnalyticsBreadcrumb.tsx
// Breadcrumb navigation for analytics sub-pages

'use client'

import Link from 'next/link'
import { ChevronRightIcon, ChartBarIcon } from '@heroicons/react/20/solid'

interface AnalyticsBreadcrumbProps {
  currentPage: string
  icon?: React.ComponentType<{ className?: string }>
}

export default function AnalyticsBreadcrumb({ currentPage, icon: Icon }: AnalyticsBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm mb-6">
      <Link 
        href="/analytics" 
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ChartBarIcon className="w-4 h-4" />
        <span>Analytics</span>
      </Link>
      <ChevronRightIcon className="w-4 h-4 text-slate-300" />
      <span className="flex items-center gap-1.5 text-slate-900 font-medium">
        {Icon && <Icon className="w-4 h-4 text-slate-600" />}
        {currentPage}
      </span>
    </nav>
  )
}

// Alternative: Page header with breadcrumb built-in
interface AnalyticsPageHeaderProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
}

export function AnalyticsPageHeader({ title, description, icon: Icon, actions }: AnalyticsPageHeaderProps) {
  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-4">
        <Link 
          href="/analytics" 
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ChartBarIcon className="w-4 h-4" />
          <span>Analytics</span>
        </Link>
        <ChevronRightIcon className="w-4 h-4 text-slate-300" />
        <span className="text-slate-900 font-medium">{title}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2.5 rounded-xl bg-slate-100">
              <Icon className="w-6 h-6 text-slate-600" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {description && (
              <p className="text-slate-500 mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}