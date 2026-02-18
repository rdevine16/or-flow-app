// components/analytics/InsightSlideOver.tsx
// Slide-over panel for insight drill-through.
// 640px wide, slides from right, Radix Dialog for accessibility.
// Each panel type will be implemented in subsequent phases.

'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Download, Check } from 'lucide-react'
import type { Insight, InsightSeverity } from '@/lib/insightsEngine'
import type { AnalyticsOverview, FacilityAnalyticsConfig } from '@/lib/analyticsV2'
import { exportInsightPanel } from '@/lib/insightExports'
import InsightPanelCallback from '@/components/analytics/InsightPanelCallback'
import InsightPanelFCOTS from '@/components/analytics/InsightPanelFCOTS'
import InsightPanelUtilization from '@/components/analytics/InsightPanelUtilization'
import InsightPanelNonOpTime from '@/components/analytics/InsightPanelNonOpTime'
import InsightPanelScheduling from '@/components/analytics/InsightPanelScheduling'
import InsightPanelTurnover from '@/components/analytics/InsightPanelTurnover'
import InsightPanelCancellation from '@/components/analytics/InsightPanelCancellation'

// ============================================
// SEVERITY CONFIG
// ============================================

const SEVERITY_STYLES: Record<InsightSeverity, { labelBg: string; labelText: string }> = {
  critical: { labelBg: 'bg-red-100', labelText: 'text-red-800' },
  warning: { labelBg: 'bg-amber-100', labelText: 'text-amber-800' },
  positive: { labelBg: 'bg-emerald-100', labelText: 'text-emerald-800' },
  info: { labelBg: 'bg-indigo-100', labelText: 'text-indigo-800' },
}

// ============================================
// PANEL TITLE MAP
// ============================================

const PANEL_TITLES: Record<string, string> = {
  callback: 'Callback / Idle Time Detail',
  fcots: 'First Case On-Time Detail',
  utilization: 'OR Utilization by Room',
  turnover: 'Turnover Detail',
  cancellation: 'Cancellation Detail',
  non_op_time: 'Non-Operative Time Breakdown',
  scheduling: 'Scheduling & Volume Detail',
}

// ============================================
// COMPONENT
// ============================================

interface InsightSlideOverProps {
  insight: Insight | null
  onClose: () => void
  analytics: AnalyticsOverview
  config: FacilityAnalyticsConfig
}

export default function InsightSlideOver({ insight, onClose, analytics, config }: InsightSlideOverProps) {
  const [exported, setExported] = useState(false)
  const isOpen = insight !== null && insight.drillThroughType !== null
  const severity = insight?.severity ?? 'info'
  const styles = SEVERITY_STYLES[severity]
  const panelTitle = insight?.drillThroughType
    ? PANEL_TITLES[insight.drillThroughType] ?? insight.title
    : insight?.title ?? ''

  const handleExport = useCallback(() => {
    if (!insight?.drillThroughType) return
    exportInsightPanel(insight.drillThroughType, analytics, config)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }, [insight, analytics, config])

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[640px] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.08)] border-l border-slate-200 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
            <div className="min-w-0 flex-1 mr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${styles.labelBg} ${styles.labelText}`}>
                  {severity}
                </span>
                <Dialog.Title className="text-[15px] font-semibold text-slate-900 truncate">
                  {panelTitle}
                </Dialog.Title>
              </div>
              <p className="text-xs text-slate-400">
                Supporting data for this insight
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleExport}
                className={`p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  exported
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                }`}
                aria-label="Export to XLSX"
              >
                {exported ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
              </button>
              <Dialog.Close asChild>
                <button
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6">
            {insight?.drillThroughType === 'callback' ? (
              <InsightPanelCallback
                surgeonSummaries={analytics.surgeonIdleSummaries}
                flipRoomAnalysis={analytics.flipRoomAnalysis}
                insight={insight}
                revenuePerMinute={config.orHourlyRate ? config.orHourlyRate / 60 : 36}
                operatingDaysPerYear={config.operatingDaysPerYear}
              />
            ) : insight?.drillThroughType === 'fcots' ? (
              <InsightPanelFCOTS
                fcots={analytics.fcots}
                graceMinutes={config.fcotsGraceMinutes}
                targetPercent={config.fcotsTargetPercent}
              />
            ) : insight?.drillThroughType === 'utilization' ? (
              <InsightPanelUtilization
                orUtilization={analytics.orUtilization}
                config={config}
              />
            ) : insight?.drillThroughType === 'non_op_time' ? (
              <InsightPanelNonOpTime
                analytics={analytics}
              />
            ) : insight?.drillThroughType === 'scheduling' ? (
              <InsightPanelScheduling
                analytics={analytics}
              />
            ) : insight?.drillThroughType === 'turnover' ? (
              <InsightPanelTurnover
                sameRoomTurnover={analytics.sameRoomTurnover}
                config={config}
              />
            ) : insight?.drillThroughType === 'cancellation' ? (
              <InsightPanelCancellation
                cancellationRate={analytics.cancellationRate}
                config={config}
              />
            ) : insight?.drillThroughType ? (
              <PanelPlaceholder type={insight.drillThroughType} />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ============================================
// PLACEHOLDER (replaced in subsequent phases)
// ============================================

function PanelPlaceholder({ type }: { type: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
        <span className="text-2xl text-indigo-400">&#x1F4CA;</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">
        {PANEL_TITLES[type] ?? type}
      </h3>
      <p className="text-sm text-slate-400">
        Panel content coming in a future phase
      </p>
    </div>
  )
}
