'use client'

import Link from 'next/link'
import { ShieldX } from 'lucide-react'

interface AccessDeniedProps {
  message?: string
}

export default function AccessDenied({
  message = "You don't have permission to access this page.",
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
        <ShieldX className="w-7 h-7 text-slate-400" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">{message}</p>
      <Link
        href="/dashboard"
        className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}
