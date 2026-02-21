'use client'

import Link from 'next/link'
import { Flag } from 'lucide-react'
import { useFlagCounts } from '@/lib/hooks/useFlagCounts'

interface FlagsCompactBannerProps {
  facilityId: string
  startDate?: string
  endDate?: string
}

export default function FlagsCompactBanner({ facilityId, startDate, endDate }: FlagsCompactBannerProps) {
  const { data, loading } = useFlagCounts(facilityId, startDate, endDate)

  if (loading) {
    return (
      <div className="h-12 bg-white rounded-xl border border-slate-200/60 shadow-sm animate-pulse" />
    )
  }

  if (!data || data.total === 0) return null

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-slate-200/60 shadow-sm">
      <div className="flex items-center gap-2">
        <Flag className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-900">{data.total}</span>
        <span className="text-xs text-slate-500">flags</span>
      </div>

      <div className="w-px h-5 bg-slate-200" />

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-red-500" />
          <span className="text-xs text-slate-500">Critical</span>
          <span className={`text-xs font-bold ${data.critical > 0 ? 'text-red-500' : 'text-slate-900'}`}>
            {data.critical}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-amber-500" />
          <span className="text-xs text-slate-500">Warning</span>
          <span className="text-xs font-bold text-slate-900">{data.warning}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-blue-500" />
          <span className="text-xs text-slate-500">Info</span>
          <span className="text-xs font-bold text-slate-900">{data.info}</span>
        </span>
      </div>

      <div className="ml-auto">
        <Link
          href="/analytics/flags"
          className="text-xs font-medium text-blue-500 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
        >
          View details &rarr;
        </Link>
      </div>
    </div>
  )
}
