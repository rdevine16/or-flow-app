// app/analytics/financials/surgeons/[id]/page.tsx
// Shell page — populated in Phase 4

'use client'

import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import { ChevronLeft } from 'lucide-react'

export default function SurgeonDetailPage() {
  const params = useParams()
  const router = useRouter()
  const surgeonId = params.id as string

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button
          onClick={() => router.push('/analytics/financials')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Financial Analytics
        </button>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔨</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Surgeon Detail — Coming Soon
          </h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            The surgeon detail view with hero header, sub-tabs, and daily activity will be built in Phase 4.
          </p>
          <p className="text-xs text-slate-400 mt-4 font-mono">Surgeon ID: {surgeonId}</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
