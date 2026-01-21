// components/settings/FinancialsLayout.tsx
// Layout wrapper for all financials pages with navigation

'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface FinancialsLayoutProps {
  children: React.ReactNode
}

const navItems = [
  {
    name: 'Procedure Pricing',
    href: '/settings/financials/procedure-pricing',
    description: 'Set costs and reimbursements per procedure',
  },
  {
    name: 'Payers',
    href: '/settings/financials/payers',
    description: 'Manage insurance companies and payer contracts',
  },
  {
    name: 'Surgeon Variance',
    href: '/settings/financials/surgeon-variance',
    description: 'Surgeon-specific cost overrides',
  },
  {
    name: 'Cost Categories',
    href: '/settings/financials/cost-categories',
    description: 'Define cost and revenue categories',
  },
]

export default function FinancialsLayout({ children }: FinancialsLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Financials</h1>
        <p className="text-slate-600 mt-1">
          Manage procedure costs, reimbursements, and profitability settings
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium transition-colors
                  ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Page Content */}
      <div>
        {children}
      </div>
    </div>
  )
}