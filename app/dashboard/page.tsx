// app/dashboard/page.tsx
// Facility admin dashboard — home base for operational overview
// Phase 1: Placeholder page. KPIs, alerts, and room status coming in later phases.

'use client'

import DashboardLayout from '@/components/layouts/DashboardLayout'
import { LayoutGrid } from 'lucide-react'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Facility operations overview</p>

        <div className="mt-8 flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-xl">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
            <LayoutGrid className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Dashboard Coming Soon</h2>
          <p className="text-sm text-slate-500 max-w-md text-center">
            KPI metrics, needs attention alerts, room status, and trend charts will be added in upcoming phases.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
