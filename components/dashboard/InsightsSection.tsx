// components/dashboard/InsightsSection.tsx
// "What should we fix?" — lazy-loaded AI insights section.
// Uses IntersectionObserver to trigger data fetch when scrolled into view.
// One insight expanded at a time, accordion-style.

'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { useDashboardInsights } from '@/lib/hooks/useDashboardInsights'
import type { TimeRange } from '@/lib/hooks/useDashboardKPIs'

// ============================================
// Component
// ============================================

interface InsightsSectionProps {
  timeRange: TimeRange
}

export function InsightsSection({ timeRange }: InsightsSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // IntersectionObserver — fires once, never reverts
  useEffect(() => {
    const el = containerRef.current
    if (!el || visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  const { data, loading } = useDashboardInsights(timeRange, visible)
  const insights = data?.insights ?? []

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div ref={containerRef} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h2 className="text-base font-semibold text-slate-900">What should we fix?</h2>
        </div>
        {insights.length > 0 && (
          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
            {insights.length} insight{insights.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-start gap-3 py-3">
              <div className="w-5 h-5 rounded-full bg-slate-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-64 bg-slate-100 rounded" />
              </div>
              <div className="w-4 h-4 bg-slate-100 rounded shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — insights loaded with no results */}
      {!loading && data && insights.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Looking good</p>
          <p className="text-xs text-slate-400 mt-1">No actionable insights for this period.</p>
        </div>
      )}

      {/* Insight cards */}
      {!loading && insights.length > 0 && (
        <div className="space-y-1">
          {insights.map((insight, index) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              rank={index + 1}
              expanded={expandedId === insight.id}
              onToggle={() => handleToggle(insight.id)}
            />
          ))}
        </div>
      )}

      {/* Pre-scroll placeholder — not yet visible and not loading */}
      {!visible && !loading && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-5 h-5 text-slate-300 mb-2" />
          <p className="text-xs text-slate-400">Scroll to load insights</p>
        </div>
      )}
    </div>
  )
}
