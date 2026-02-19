// components/dashboard/TodaysSurgeons.tsx
// Mini-list of surgeons operating today with case counts and ORbit Score grade badges.

'use client'

import Link from 'next/link'
import { Stethoscope } from 'lucide-react'
import { ScoreRing } from '@/components/ui/ScoreRing'
import type { TodaySurgeonData } from '@/lib/hooks/useTodayStatus'

// ============================================
// Component
// ============================================

interface TodaysSurgeonsProps {
  surgeons: TodaySurgeonData[]
  loading?: boolean
}

export function TodaysSurgeons({ surgeons, loading = false }: TodaysSurgeonsProps) {
  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Today&apos;s Surgeons</h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <SurgeonRowSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (surgeons.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Today&apos;s Surgeons</h3>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Stethoscope className="w-5 h-5 text-slate-300 mb-2" />
          <p className="text-xs text-slate-400">No surgeons scheduled today</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Today&apos;s Surgeons</h3>
      <div className="space-y-1">
        {surgeons.map((surgeon) => (
          <SurgeonRow key={surgeon.surgeonId} surgeon={surgeon} />
        ))}
      </div>
    </div>
  )
}

// ============================================
// Surgeon row
// ============================================

function SurgeonRow({ surgeon }: { surgeon: TodaySurgeonData }) {
  return (
    <Link
      href="/analytics/surgeons"
      className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{surgeon.surgeonName}</p>
        <p className="text-xs text-slate-400">
          {surgeon.casesRemaining === 0
            ? 'All cases complete'
            : `${surgeon.casesRemaining} case${surgeon.casesRemaining === 1 ? '' : 's'} remaining`}
        </p>
      </div>

      {/* Score ring */}
      {surgeon.compositeScore != null ? (
        <div className="shrink-0">
          <ScoreRing score={Math.round(surgeon.compositeScore)} size={36} ringWidth={4} />
        </div>
      ) : (
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-medium text-slate-400 bg-slate-50 shrink-0">
          —
        </span>
      )}
    </Link>
  )
}

// ============================================
// Loading skeleton
// ============================================

function SurgeonRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 px-2 animate-pulse">
      <div className="flex-1">
        <div className="h-4 w-24 bg-slate-200 rounded mb-1" />
        <div className="h-3 w-32 bg-slate-100 rounded" />
      </div>
      <div className="w-7 h-7 bg-slate-100 rounded-lg shrink-0" />
    </div>
  )
}
