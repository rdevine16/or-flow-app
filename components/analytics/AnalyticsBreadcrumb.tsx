// components/analytics/AnalyticsBreadcrumb.tsx
// Page header for analytics sub-pages (breadcrumb nav removed — handled by Header)

'use client'

interface AnalyticsPageHeaderProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
}

export function AnalyticsPageHeader({ title, description, icon: Icon, actions }: AnalyticsPageHeaderProps) {
  return (
    <div className="mb-8">
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