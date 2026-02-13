// components/cases/CaseFlagsSection.tsx
// Unified flags & delays section for the case detail page sidebar.
// Replaces the old amber "Delays" box.
//
// Behavior:
//   - Delay flags: always visible + reportable (in-progress and completed)
//   - Threshold flags: only visible after case completion (auto-detected at patient_out)
//   - "Report Delay" inline form writes to both case_flags AND case_delays (backward compat)
//
// Usage:
//   <CaseFlagsSection
//     caseId={caseData.id}
//     facilityId={userFacilityId}
//     isCompleted={isCompleted}
//     userId={userId}
//     supabase={supabase}
//   />

'use client'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Clock, Flag, Info, Pause, Play, Plus, Square, Timer, X } from 'lucide-react'
import { useDelayTimer } from '@/lib/hooks/useDelayTimer'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatElapsedMs } from '@/lib/formatters'

// =====================================================
// TYPES
// =====================================================

interface CaseFlagRow {
  id: string
  case_id: string
  flag_type: 'threshold' | 'delay'
  severity: string
  metric_value: number | null
  threshold_value: number | null
  comparison_scope: string | null
  delay_type_id: string | null
  duration_minutes: number | null
  note: string | null
  created_by: string | null
  created_at: string
  flag_rules: {
    name: string
    category: string
    metric: string
    description: string | null
  } | null
  delay_types: {
    display_name: string
  } | null
}

interface DelayTypeOption {
  id: string
  name: string
  display_name: string | null
}

interface CaseFlagsSectionProps {
  caseId: string
  facilityId: string
  isCompleted: boolean
  userId: string | null
  supabase: any // SupabaseClient
}

// =====================================================
// SEVERITY CONFIG
// =====================================================

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    dot: 'bg-red-500',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-600',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    label: 'Info',
  },
} as const

// =====================================================
// COMPONENT
// =====================================================

export default function CaseFlagsSection({
  caseId,
  facilityId,
  isCompleted,
  userId,
  supabase,
}: CaseFlagsSectionProps) {
  // Data
  const [flags, setFlags] = useState<CaseFlagRow[]>([])
  const [delayTypeOptions, setDelayTypeOptions] = useState<DelayTypeOption[]>([])
  const [loading, setLoading] = useState(true)

  // Report delay form
  const [showReportForm, setShowReportForm] = useState(false)
  const [selectedDelayType, setSelectedDelayType] = useState('')
  const [delayDuration, setDelayDuration] = useState('')
  const [delayNote, setDelayNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [durationMode, setDurationMode] = useState<'manual' | 'timer'>('manual')

  // Delay timer
  const delayTimer = useDelayTimer()

  // Toast (at component level — not inside callbacks)
  const { showToast } = useToast()

  // Confirm dialog for close-while-timer-running warning
  const { confirmDialog: timerWarningDialog, showConfirm: showTimerWarning } = useConfirmDialog()

  // Expand/collapse for completed view with many flags
  const [expanded, setExpanded] = useState(false)

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchFlags = useCallback(async () => {
    const { data } = await supabase
      .from('case_flags')
      .select(`
        id,
        case_id,
        flag_type,
        severity,
        metric_value,
        threshold_value,
        comparison_scope,
        delay_type_id,
        duration_minutes,
        note,
        created_by,
        created_at,
        flag_rules (name, category, metric, description),
        delay_types (display_name)
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })

    if (data) setFlags(data as CaseFlagRow[])
    setLoading(false)
  }, [caseId, supabase])

  const fetchDelayTypes = useCallback(async () => {
    const { data } = await supabase
      .from('delay_types')
      .select('id, name, display_name')
      .or(`facility_id.eq.${facilityId},facility_id.is.null`)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (data) setDelayTypeOptions(data)
  }, [facilityId, supabase])

  useEffect(() => {
    fetchFlags()
    fetchDelayTypes()
  }, [fetchFlags, fetchDelayTypes])

  // =====================================================
  // FILTERED FLAGS
  // =====================================================

  // During in-progress: show only delay flags
  // After completion: show all flags
  const visibleFlags = flags.filter(f => {
    if (isCompleted) return true
    return f.flag_type === 'delay'
  })

  // Sort: critical → warning → info, then by created_at
  const sortedFlags = [...visibleFlags].sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 }
    const sevDiff = (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0)
    if (sevDiff !== 0) return sevDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const thresholdFlags = sortedFlags.filter(f => f.flag_type === 'threshold')
  const delayFlags = sortedFlags.filter(f => f.flag_type === 'delay')
  const totalCount = sortedFlags.length

  // For collapsible display when there are many flags
  const COLLAPSE_THRESHOLD = 4
  const displayFlags = expanded ? sortedFlags : sortedFlags.slice(0, COLLAPSE_THRESHOLD)
  const hasMore = sortedFlags.length > COLLAPSE_THRESHOLD

  // =====================================================
  // FORM CLOSE (with timer warning)
  // =====================================================

  const resetForm = useCallback(() => {
    setSelectedDelayType('')
    setDelayDuration('')
    setDelayNote('')
    setDurationMode('manual')
    delayTimer.reset()
    setShowReportForm(false)
  }, [delayTimer])

  const handleCloseForm = useCallback(() => {
    if (delayTimer.isActive) {
      showTimerWarning({
        variant: 'warning',
        title: 'Timer is running',
        message: 'A delay timer is active. Closing will discard it. Continue?',
        confirmText: 'Discard',
        cancelText: 'Keep timing',
        onConfirm: () => resetForm(),
      })
    } else {
      resetForm()
    }
  }, [delayTimer.isActive, showTimerWarning, resetForm])

  // =====================================================
  // TIMER CONTROLS
  // =====================================================

  const handleTimerStop = useCallback(() => {
    const minutes = delayTimer.stop()
    setDelayDuration(String(minutes))
  }, [delayTimer])

  // =====================================================
  // REPORT DELAY HANDLER
  // =====================================================

  const handleReportDelay = async () => {
    if (!selectedDelayType) return
    setSaving(true)

    const duration = delayDuration ? parseInt(delayDuration) : null
    const note = delayNote.trim() || null

    try {
      // 1. Write to case_flags (new system)
      await supabase.from('case_flags').insert({
        case_id: caseId,
        facility_id: facilityId,
        flag_type: 'delay',
        delay_type_id: selectedDelayType,
        duration_minutes: duration,
        severity: 'warning', // delay flags default to warning
        note,
        created_by: userId,
      })

      // 2. Write to case_delays (backward compat)
      await supabase.from('case_delays').insert({
        case_id: caseId,
        delay_type_id: selectedDelayType,
        duration_minutes: duration,
        notes: note,
        recorded_at: new Date().toISOString(),
        recorded_by: userId,
      })

      // Reset form
      resetForm()

      // Re-fetch flags
      await fetchFlags()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Failed to Report Delay',
        message: err instanceof Error ? err.message : 'An unexpected error occurred'
      })
    }

    setSaving(false)
  }

  // =====================================================
  // HELPERS
  // =====================================================

  const getFlagLabel = (flag: CaseFlagRow): string => {
    if (flag.flag_type === 'threshold') {
      return flag.flag_rules?.name || 'Threshold Flag'
    }
    const dt = flag.delay_types
    const dtData = Array.isArray(dt) ? dt[0] : dt
    return dtData?.display_name || 'Delay'
  }

  const getFlagDetail = (flag: CaseFlagRow): string | null => {
    if (flag.flag_type === 'threshold') {
      const actual = flag.metric_value !== null ? Math.round(flag.metric_value) : null
      const threshold = flag.threshold_value !== null ? Math.round(flag.threshold_value) : null
      if (actual !== null && threshold !== null) {
        return `${actual} min (threshold: ${threshold} min)`
      }
      return null
    }
    if (flag.duration_minutes) {
      return `${flag.duration_minutes} min`
    }
    return null
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // =====================================================
  // RENDER
  // =====================================================

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="p-3 space-y-2">
          <div className="h-8 bg-slate-50 rounded-lg animate-pulse" />
          <div className="h-8 bg-slate-50 rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  // Determine header count badge
  const headerBadge = totalCount > 0 ? (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
      sortedFlags.some(f => f.severity === 'critical')
        ? 'bg-red-100 text-red-600'
        : sortedFlags.some(f => f.severity === 'warning')
          ? 'bg-amber-100 text-amber-700'
          : 'bg-blue-100 text-blue-700'
    }`}>
      {totalCount}
    </span>
  ) : null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            {isCompleted ? 'Case Flags' : 'Flags & Delays'}
          </h3>
          {headerBadge}
        </div>
        {!showReportForm && (
          <button
            onClick={() => setShowReportForm(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Report Delay
          </button>
        )}
      </div>

      <div className="p-3">
        {/* ============================================= */}
        {/* REPORT DELAY FORM (inline)                    */}
        {/* ============================================= */}
        {showReportForm && (
          <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Report a Delay</span>
              <button
                onClick={handleCloseForm}
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Delay type picker */}
            <select
              value={selectedDelayType}
              onChange={(e) => setSelectedDelayType(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="">Select delay type...</option>
              {delayTypeOptions.map(dt => (
                <option key={dt.id} value={dt.id}>
                  {dt.display_name || dt.name}
                </option>
              ))}
            </select>

            {/* Duration mode segmented control */}
            <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setDurationMode('manual')}
                disabled={delayTimer.isActive}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
                  durationMode === 'manual'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                } ${delayTimer.isActive ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Clock className="w-3 h-3" />
                Manual
              </button>
              <button
                type="button"
                onClick={() => setDurationMode('timer')}
                disabled={delayTimer.isActive && durationMode === 'manual'}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors border-l border-slate-200 ${
                  durationMode === 'timer'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                } ${delayTimer.isActive && durationMode === 'manual' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Timer className="w-3 h-3" />
                Timer
              </button>
            </div>

            {/* Duration input: Manual or Timer mode */}
            {durationMode === 'manual' ? (
              <div className="flex gap-2">
                <div className="w-24">
                  <input
                    type="number"
                    value={delayDuration}
                    onChange={(e) => setDelayDuration(e.target.value)}
                    placeholder="Min"
                    min={0}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <input
                  type="text"
                  value={delayNote}
                  onChange={(e) => setDelayNote(e.target.value)}
                  placeholder="Notes (optional)"
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedDelayType) handleReportDelay()
                  }}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Timer display */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    {delayTimer.state === 'running' && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                    )}
                    {delayTimer.state === 'paused' && (
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                    )}
                    <span className={`text-lg font-mono font-semibold tabular-nums ${
                      delayTimer.state === 'running' ? 'text-slate-900' :
                      delayTimer.state === 'paused' ? 'text-amber-700' :
                      'text-slate-400'
                    }`}>
                      {formatElapsedMs(delayTimer.elapsedMs)}
                    </span>
                  </div>
                  {delayTimer.state === 'paused' && (
                    <span className="text-[10px] font-medium text-amber-700 uppercase tracking-wider">Paused</span>
                  )}
                </div>

                {/* Timer controls */}
                <div className="flex gap-1.5">
                  {delayTimer.state === 'idle' && (
                    <button
                      type="button"
                      onClick={delayTimer.start}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Start
                    </button>
                  )}
                  {delayTimer.state === 'running' && (
                    <>
                      <button
                        type="button"
                        onClick={delayTimer.pause}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                      >
                        <Pause className="w-3 h-3" />
                        Pause
                      </button>
                      <button
                        type="button"
                        onClick={handleTimerStop}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Square className="w-3 h-3" />
                        Stop
                      </button>
                    </>
                  )}
                  {delayTimer.state === 'paused' && (
                    <>
                      <button
                        type="button"
                        onClick={delayTimer.resume}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-green-600 bg-green-100 rounded-lg hover:bg-green-200 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Resume
                      </button>
                      <button
                        type="button"
                        onClick={handleTimerStop}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-600 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Square className="w-3 h-3" />
                        Stop
                      </button>
                    </>
                  )}
                </div>

                {/* Show computed duration after timer stop (duration auto-filled) */}
                {!delayTimer.isActive && delayDuration && (
                  <p className="text-[11px] text-slate-500 text-center">
                    Duration: {delayDuration} min
                  </p>
                )}

                {/* Notes input (timer mode) */}
                <input
                  type="text"
                  value={delayNote}
                  onChange={(e) => setDelayNote(e.target.value)}
                  placeholder="Notes (optional)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && selectedDelayType && !delayTimer.isActive) handleReportDelay()
                  }}
                />
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleReportDelay}
              disabled={!selectedDelayType || saving || delayTimer.isActive}
              className="w-full py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Delay'}
            </button>
          </div>
        )}

        {/* ============================================= */}
        {/* FLAGS LIST                                    */}
        {/* ============================================= */}
        {sortedFlags.length === 0 ? (
          <div className="text-center py-4">
            <Flag className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs text-slate-400">
              {isCompleted ? 'No flags on this case' : 'No delays reported'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Threshold flags section header (completed only) */}
            {isCompleted && thresholdFlags.length > 0 && delayFlags.length > 0 && (
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-1">
                Auto-Detected
              </p>
            )}

            {displayFlags.map((flag) => {
              const sevConfig = SEVERITY_CONFIG[flag.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info
              const label = getFlagLabel(flag)
              const detail = getFlagDetail(flag)
              const isThreshold = flag.flag_type === 'threshold'

              // Show section divider before first delay if both types present
              const isFirstDelay = flag === delayFlags[0] && thresholdFlags.length > 0 && isCompleted

              return (
                <div key={flag.id}>
                  {isFirstDelay && (
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 pt-2">
                      Reported Delays
                    </p>
                  )}
                  <div className={`flex items-start gap-2.5 px-2.5 py-2 rounded-xl ${sevConfig.bg} border ${sevConfig.border}`}>
                    {/* Severity dot */}
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sevConfig.dot}`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold ${sevConfig.text}`}>
                          {label}
                        </span>
                        {isThreshold && flag.comparison_scope && (
                          <span className="text-[9px] font-medium px-1 py-0.5 bg-white/60 rounded text-slate-500">
                            {flag.comparison_scope}
                          </span>
                        )}
                      </div>

                      {/* Detail line */}
                      {detail && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>
                      )}

                      {/* Note */}
                      {flag.note && (
                        <p className="text-[11px] text-slate-400 mt-0.5 italic truncate">
                          &ldquo;{flag.note}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Time */}
                    <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                      {formatTime(flag.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Show more / less toggle */}
            {hasMore && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    {sortedFlags.length - COLLAPSE_THRESHOLD} more flag{sortedFlags.length - COLLAPSE_THRESHOLD !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timer close warning dialog */}
      {timerWarningDialog}
    </div>
  )
}