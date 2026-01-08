'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface AnalyticsSection {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  description: string
}

const analyticsSections: AnalyticsSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/analytics',
    description: 'Key metrics and trends',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'surgeons',
    label: 'Surgeon Analysis',
    href: '/analytics/surgeons',
    description: 'Individual surgeon metrics',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    id: 'comparison',
    label: 'Surgeon Comparison',
    href: '/analytics/comparison',
    description: 'Compare surgeon performance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'procedures',
    label: 'Procedure Analysis',
    href: '/analytics/procedures',
    description: 'Metrics by procedure type',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    id: 'rooms',
    label: 'Room Utilization',
    href: '/analytics/rooms',
    description: 'OR room efficiency',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

interface AnalyticsLayoutProps {
  children: React.ReactNode
  title: string
  description: string
  actions?: React.ReactNode
}

export default function AnalyticsLayout({ children, title, description, actions }: AnalyticsLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-24">
          <nav className="space-y-1">
            {analyticsSections.map((section) => {
              const isActive = pathname === section.href
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>
                    {section.icon}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{section.label}</p>
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* Export Card */}
          <div className="mt-8 p-4 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
            <div className="flex items-center gap-2 text-teal-900 font-medium mb-2">
              <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Data
            </div>
            <p className="text-xs text-teal-700 leading-relaxed mb-3">
              Download analytics reports in PDF or Excel format.
            </p>
            <button className="w-full px-3 py-2 text-sm font-medium text-teal-700 bg-white border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors">
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="text-slate-500 mt-1">{description}</p>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  )
}