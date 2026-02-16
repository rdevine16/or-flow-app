'use client'

import { Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ComingSoonPlaceholderProps {
  title: string
  description: string
  icon?: LucideIcon
  children?: React.ReactNode
}

export default function ComingSoonPlaceholder({
  title,
  description,
  icon: Icon = Clock,
  children,
}: ComingSoonPlaceholderProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">{title}</h1>
      <p className="text-slate-500 mb-6">{description}</p>

      <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Coming Soon</h3>
            <p className="text-sm text-slate-600 mt-1">
              This feature is currently in development. Check back soon for updates.
            </p>
          </div>
        </div>
      </div>

      {children}
    </>
  )
}
