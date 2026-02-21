// SummaryRow — gauge card (left) + 3 stat cards (right) grid layout

import { AlertTriangle, Clock } from 'lucide-react'
import type { DataQualitySummary } from '@/lib/dataQuality'
import QualityGauge from './QualityGauge'
import SeverityBadge from './SeverityBadge'

interface SummaryRowProps {
  summary: DataQualitySummary
}

export default function SummaryRow({ summary }: SummaryRowProps) {
  return (
    <div
      className="grid grid-cols-[auto_1fr] gap-5 mb-6"
      data-testid="summary-row"
    >
      {/* Quality Gauge Card */}
      <div className="bg-white border border-stone-200 rounded-xl px-7 py-5 flex flex-col items-center justify-center min-w-[180px]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">
          Quality Score
        </span>
        <QualityGauge score={summary.qualityScore} size={130} />
      </div>

      {/* Stats Grid — 3 cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Open Issues */}
        <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Open Issues
            </span>
            <div className="w-7 h-7 rounded-[7px] bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-[32px] font-bold text-stone-900 leading-none">
              {summary.totalUnresolved}
            </span>
            <div className="text-xs text-stone-500 mt-1">
              Requires attention
            </div>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Expiring Soon
            </span>
            <div className="w-7 h-7 rounded-[7px] bg-red-50 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-red-600" />
            </div>
          </div>
          <div className="mt-2">
            <span
              className={`font-mono text-[32px] font-bold leading-none ${
                summary.expiringThisWeek > 0 ? 'text-amber-600' : 'text-stone-900'
              }`}
            >
              {summary.expiringThisWeek}
            </span>
            <div className="text-xs text-stone-500 mt-1">
              within 7 days
            </div>
          </div>
        </div>

        {/* By Severity */}
        <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">
            By Severity
          </span>
          <div className="flex flex-col gap-2">
            <SeverityBadge severity="error" count={summary.bySeverity.error || 0} label="Critical" />
            <SeverityBadge severity="warning" count={summary.bySeverity.warning || 0} label="Warning" />
            <SeverityBadge severity="info" count={summary.bySeverity.info || 0} label="Info" />
          </div>
        </div>
      </div>
    </div>
  )
}
