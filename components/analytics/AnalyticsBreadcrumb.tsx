// components/analytics/AnalyticsBreadcrumb.tsx
// Page header for analytics sub-pages (breadcrumb nav removed — handled by Header)

'use client'

interface AnalyticsPageHeaderProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
}

export function AnalyticsPageHeader({ title, description, actions }: AnalyticsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="text-slate-500 text-sm mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}