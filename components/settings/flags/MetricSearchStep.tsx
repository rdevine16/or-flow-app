// components/settings/flags/MetricSearchStep.tsx
// Step 1 of the rule builder: search input + category-grouped metrics list.
// Static metrics from METRICS_CATALOG + dynamic per-cost-category metrics.

'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { METRICS_CATALOG, METRIC_CATEGORIES } from '@/lib/constants/metrics-catalog'
import { getCategoryColors } from '@/lib/design-tokens'
import type { MetricCatalogEntry } from '@/types/flag-settings'

interface MetricSearchStepProps {
  onSelectMetric: (metric: MetricCatalogEntry) => void
  dynamicMetrics: MetricCatalogEntry[]
}

export function MetricSearchStep({ onSelectMetric, dynamicMetrics }: MetricSearchStepProps) {
  const [search, setSearch] = useState('')

  const allMetrics = useMemo(
    () => [...METRICS_CATALOG, ...dynamicMetrics],
    [dynamicMetrics]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return allMetrics
    const q = search.toLowerCase()
    return allMetrics.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    )
  }, [allMetrics, search])

  // Group by category
  const grouped = useMemo(() => {
    const groups = new Map<string, MetricCatalogEntry[]>()
    for (const m of filtered) {
      const list = groups.get(m.category) || []
      list.push(m)
      groups.set(m.category, list)
    }
    return groups
  }, [filtered])

  // Category order from METRIC_CATEGORIES
  const orderedCategories = METRIC_CATEGORIES.map((c) => c.id).filter((id) =>
    grouped.has(id)
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            autoFocus
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          {filtered.length} metric{filtered.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* Metrics list grouped by category */}
      <div className="flex-1 overflow-y-auto">
        {orderedCategories.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">
            No metrics match your search.
          </div>
        ) : (
          orderedCategories.map((catId) => {
            const catConfig = METRIC_CATEGORIES.find((c) => c.id === catId)
            const metrics = grouped.get(catId) || []
            const colors = getCategoryColors(catId)

            return (
              <div key={catId}>
                {/* Category header */}
                <div className="sticky top-0 z-10 px-6 py-2 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold ${colors.bg} ${colors.text}`}
                  >
                    {catConfig?.label ?? catId}
                  </span>
                </div>

                {/* Metric items */}
                {metrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => onSelectMetric(metric)}
                    className="w-full text-left px-6 py-3 hover:bg-blue-50/50 border-b border-slate-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors">
                          {metric.name}
                          {metric.costCategoryId && (
                            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                              PER-CATEGORY
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {metric.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {metric.unit || metric.dataType}
                        </span>
                        <span className="text-slate-300 group-hover:text-blue-400 transition-colors">
                          &rsaquo;
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
