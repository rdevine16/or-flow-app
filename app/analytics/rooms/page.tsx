'use client'

import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import AnalyticsLayout from '../../../components/analytics/AnalyticsLayout'

export default function RoomAnalyticsPage() {
  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsLayout
          title="Room Utilization"
          description="OR room efficiency and utilization metrics"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Coming Soon</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Room utilization analytics including usage rates, turnover times, and efficiency comparisons across OR rooms.
            </p>
          </div>
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}