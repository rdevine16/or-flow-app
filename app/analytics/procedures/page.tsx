'use client'

import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import AnalyticsLayout from '../../../components/analytics/AnalyticsLayout'

export default function ProcedureAnalyticsPage() {
  return (
    <DashboardLayout>
      <Container className="py-8">
        <AnalyticsLayout
          title="Procedure Analysis"
          description="Metrics and trends by procedure type"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Coming Soon</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Detailed procedure analytics including average times, volume trends, and efficiency metrics by procedure type.
            </p>
          </div>
        </AnalyticsLayout>
      </Container>
    </DashboardLayout>
  )
}