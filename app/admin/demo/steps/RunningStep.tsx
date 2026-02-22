// app/admin/demo/steps/RunningStep.tsx
// Step 6: SSE-powered progress indicator, phase checklist, and success/error screen

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Check,
  Loader2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Trash2,
  Database,
  Users,
  Flag,
  Milestone,
  BarChart3,
  XCircle,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DemoWizardState } from '../types'

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

export interface SSEProgressEvent {
  type: 'progress'
  phase: string
  current: number
  total: number
  message: string
}

export interface SSECompleteEvent {
  type: 'complete'
  result: GenerationResult
}

export interface SSEErrorEvent {
  type: 'error'
  error: string
  purged: boolean
}

export type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent

export interface GenerationResult {
  casesGenerated: number
  cancelledCount: number
  delayedCount: number
  flaggedCount: number
  milestonesInserted: number
  staffAssigned: number
  duration: number
}

// ============================================================================
// GENERATION PHASES
// ============================================================================

interface PhaseInfo {
  id: string
  label: string
  icon: typeof Database
}

const GENERATION_PHASES: PhaseInfo[] = [
  { id: 'purging', label: 'Purging existing data', icon: Trash2 },
  { id: 'generating_cases', label: 'Generating cases', icon: Database },
  { id: 'inserting_milestones', label: 'Inserting milestones', icon: Milestone },
  { id: 'assigning_staff', label: 'Assigning staff', icon: Users },
  { id: 'detecting_flags', label: 'Detecting flags', icon: Flag },
  { id: 'finalizing', label: 'Finalizing', icon: BarChart3 },
]

// ============================================================================
// PROPS
// ============================================================================

export interface RunningStepProps {
  wizardState: DemoWizardState
  /** Called when user clicks "Generate Again" */
  onRestart: () => void
  /** Called when user clicks "View Facility" */
  facilityId: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function RunningStep({
  wizardState,
  onRestart,
  facilityId,
}: RunningStepProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [currentPhase, setCurrentPhase] = useState<string>('')
  const [currentMessage, setCurrentMessage] = useState<string>('')
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [errorPurged, setErrorPurged] = useState(false)
  const [counts, setCounts] = useState({ cases: 0, milestones: 0, staff: 0, flags: 0 })

  const abortRef = useRef<AbortController | null>(null)
  const hasStarted = useRef(false)

  // Parse an SSE event from data string
  const parseSSEEvent = useCallback((data: string): SSEEvent | null => {
    try {
      return JSON.parse(data) as SSEEvent
    } catch {
      return null
    }
  }, [])

  // Handle incoming SSE events
  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'progress': {
        setCurrentPhase(event.phase)
        setCurrentMessage(event.message)
        setProgress(Math.round((event.current / event.total) * 100))

        // Track phase completions
        setCompletedPhases((prev) => {
          const phases = GENERATION_PHASES.map((p) => p.id)
          const currentIdx = phases.indexOf(event.phase)
          const newSet = new Set(prev)
          for (let i = 0; i < currentIdx; i++) {
            newSet.add(phases[i])
          }
          return newSet
        })

        // Update running counts from message
        const caseMatch = event.message.match(/(\d+)\s+cases?/i)
        const msMatch = event.message.match(/(\d+)\s+milestones?/i)
        const staffMatch = event.message.match(/(\d+)\s+staff/i)
        const flagMatch = event.message.match(/(\d+)\s+flags?/i)

        setCounts((prev) => ({
          cases: caseMatch ? parseInt(caseMatch[1], 10) : prev.cases,
          milestones: msMatch ? parseInt(msMatch[1], 10) : prev.milestones,
          staff: staffMatch ? parseInt(staffMatch[1], 10) : prev.staff,
          flags: flagMatch ? parseInt(flagMatch[1], 10) : prev.flags,
        }))
        break
      }
      case 'complete': {
        setStatus('complete')
        setProgress(100)
        setResult(event.result)
        // Mark all phases as completed
        setCompletedPhases(new Set(GENERATION_PHASES.map((p) => p.id)))
        break
      }
      case 'error': {
        setStatus('error')
        setErrorMessage(event.error)
        setErrorPurged(event.purged)
        break
      }
    }
  }, [])

  // Start SSE connection
  const startGeneration = useCallback(async () => {
    setStatus('running')
    setProgress(0)
    setCompletedPhases(new Set())
    setCounts({ cases: 0, milestones: 0, staff: 0, flags: 0 })
    setResult(null)
    setErrorMessage('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/demo-data/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facilityId: wizardState.facilityId,
          surgeonProfiles: wizardState.surgeonProfiles,
          monthsOfHistory: wizardState.monthsOfHistory,
          purgeFirst: wizardState.purgeFirst,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errBody.error || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data) {
              const event = parseSSEEvent(data)
              if (event) handleEvent(event)
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim()
        if (data) {
          const event = parseSSEEvent(data)
          if (event) handleEvent(event)
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [wizardState, parseSSEEvent, handleEvent])

  // Auto-start on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      startGeneration()
    }
    return () => {
      abortRef.current?.abort()
    }
  }, [startGeneration])

  // ── Render: Running State ──
  if (status === 'running' || status === 'idle') {
    return (
      <div className="flex flex-col gap-5">
        {/* Progress Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[17px] font-semibold text-slate-900">Generating Demo Data</h2>
            <span className="text-sm font-bold text-blue-600 font-mono">{progress}%</span>
          </div>

          {/* Linear progress bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Current phase label */}
          <p className="text-xs text-slate-500 mt-2">{currentMessage || 'Starting...'}</p>

          {/* Running counts */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <RunningCount label="Cases" value={counts.cases} icon={Database} />
            <RunningCount label="Milestones" value={counts.milestones} icon={Milestone} />
            <RunningCount label="Staff" value={counts.staff} icon={Users} />
            <RunningCount label="Flags" value={counts.flags} icon={Flag} />
          </div>
        </div>

        {/* Phase Checklist */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Generation Phases
          </h3>
          <div className="flex flex-col gap-2">
            {GENERATION_PHASES.map((phase) => {
              const isCompleted = completedPhases.has(phase.id)
              const isActive = currentPhase === phase.id && !isCompleted
              const PhaseIcon = phase.icon

              return (
                <div
                  key={phase.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-50' : isCompleted ? 'bg-green-50/50' : ''
                  }`}
                  data-testid={`phase-${phase.id}`}
                >
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  ) : (
                    <PhaseIcon className="w-5 h-5 text-slate-300 shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      isActive
                        ? 'font-medium text-blue-700'
                        : isCompleted
                        ? 'text-green-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {phase.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Success State ──
  if (status === 'complete' && result) {
    const milsPerCase = result.casesGenerated > 0
      ? (result.milestonesInserted / result.casesGenerated).toFixed(1)
      : '0'
    const staffPerCase = result.casesGenerated > 0
      ? (result.staffAssigned / result.casesGenerated).toFixed(1)
      : '0'
    const flagsPerCase = result.casesGenerated > 0
      ? (result.flaggedCount / result.casesGenerated).toFixed(2)
      : '0'

    return (
      <div className="flex flex-col gap-5">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-8 text-center text-white">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold">Demo Data Generated Successfully</h2>
          <p className="text-green-100 text-sm mt-1">
            Completed in {(result.duration / 1000).toFixed(1)}s
          </p>
        </div>

        {/* Per-Case Averages */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Per-Case Averages
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <SuccessMetric
              label="Milestones / Case"
              value={milsPerCase}
              icon={Milestone}
              color="text-blue-600"
            />
            <SuccessMetric
              label="Staff / Case"
              value={staffPerCase}
              icon={Users}
              color="text-purple-600"
            />
            <SuccessMetric
              label="Flags / Case"
              value={flagsPerCase}
              icon={Flag}
              color="text-amber-600"
            />
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Generation Totals
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TotalCard label="Total Cases" value={result.casesGenerated} icon={Database} />
            <TotalCard label="Cancelled" value={result.cancelledCount} icon={XCircle} />
            <TotalCard label="Delayed" value={result.delayedCount} icon={Clock} />
            <TotalCard label="Flagged" value={result.flaggedCount} icon={Flag} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw className="w-4 h-4" />
            Generate Again
          </Button>
          <a
            href={`/dashboard?facilityId=${facilityId}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 hover:shadow-lg transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            View Facility
          </a>
        </div>
      </div>
    )
  }

  // ── Render: Error State ──
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Generation Failed</h2>
        <p className="text-sm text-red-600 mt-2 max-w-md mx-auto">{errorMessage}</p>
        {errorPurged && (
          <p className="text-xs text-slate-500 mt-3">
            Generated data has been automatically rolled back. You can retry safely.
          </p>
        )}
        {!errorPurged && (
          <p className="text-xs text-amber-600 mt-3">
            Partial data may remain. Consider purging before retrying.
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onRestart}>
          <RotateCcw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function RunningCount({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Database
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <div>
        <p className="text-xs font-bold text-slate-900 font-mono">{value.toLocaleString()}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function SuccessMetric({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  icon: typeof Database
  color: string
}) {
  return (
    <div className="text-center p-4 rounded-xl bg-slate-50">
      <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function TotalCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Database
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div>
        <p className="text-sm font-bold text-slate-900">{value.toLocaleString()}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  )
}
