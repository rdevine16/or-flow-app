// components/analytics/flags/FlagDrillThrough.tsx
// Slide-over drill-through panel for flag analytics.
// Two modes: surgeon detail, room detail.
// Case drill-through navigates to /cases instead (Q8).
// 640px wide, right-slide, Radix Dialog — matches InsightSlideOver pattern.

'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X, User, DoorOpen, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type {
  SurgeonFlagRow,
  RoomFlagRow,
  RecentFlaggedCase,
} from '@/types/flag-analytics'

// ============================================
// Types
// ============================================

export type DrillThroughTarget =
  | { mode: 'surgeon'; surgeonId: string }
  | { mode: 'room'; roomId: string }
  | null

interface FlagDrillThroughProps {
  target: DrillThroughTarget
  onClose: () => void
  surgeonFlags: SurgeonFlagRow[]
  roomFlags: RoomFlagRow[]
  recentFlaggedCases: RecentFlaggedCase[]
  onCaseClick?: (caseId: string) => void
}

// ============================================
// Severity badge config (shared)
// ============================================

const SEVERITY_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
}

// ============================================
// Component
// ============================================

export default function FlagDrillThrough({
  target,
  onClose,
  surgeonFlags,
  roomFlags,
  recentFlaggedCases,
  onCaseClick,
}: FlagDrillThroughProps) {
  const isOpen = target !== null

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[640px] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.08)] border-l border-slate-200 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          aria-describedby={undefined}
        >
          {target?.mode === 'surgeon' && (
            <SurgeonPanel
              surgeonId={target.surgeonId}
              surgeonFlags={surgeonFlags}
              recentFlaggedCases={recentFlaggedCases}
              onClose={onClose}
              onCaseClick={onCaseClick}
            />
          )}
          {target?.mode === 'room' && (
            <RoomPanel
              roomId={target.roomId}
              roomFlags={roomFlags}
              recentFlaggedCases={recentFlaggedCases}
              onClose={onClose}
              onCaseClick={onCaseClick}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ============================================
// Surgeon drill-through panel
// ============================================

function SurgeonPanel({
  surgeonId,
  surgeonFlags,
  recentFlaggedCases,
  onClose,
  onCaseClick,
}: {
  surgeonId: string
  surgeonFlags: SurgeonFlagRow[]
  recentFlaggedCases: RecentFlaggedCase[]
  onClose: () => void
  onCaseClick?: (caseId: string) => void
}) {
  const surgeon = surgeonFlags.find((s) => s.surgeonId === surgeonId)

  // Filter recent cases by surgeon name
  const surgeonCases = surgeon
    ? recentFlaggedCases.filter((c) => c.surgeon === surgeon.name)
    : []

  return (
    <>
      {/* Header */}
      <PanelHeader
        icon={<User className="w-4 h-4" />}
        label="Surgeon Detail"
        title={surgeon?.name ?? 'Unknown Surgeon'}
        onClose={onClose}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!surgeon ? (
          <div className="text-center py-12 text-sm text-slate-400">Surgeon data not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Summary stats — three cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Cases" value={String(surgeon.cases)} />
              <StatCard
                label="Total Cases Flagged"
                value={String(surgeon.flaggedCases ?? Math.round(surgeon.rate * surgeon.cases / 100))}
              />
              <StatCard
                label="Flag Rate"
                value={`${surgeon.rate.toFixed(1)}%`}
                highlight={surgeon.rate > 30}
              />
            </div>

            {/* Trend row */}
            <TrendRow trend={surgeon.trend} />

            {/* Top flag */}
            {surgeon.topFlag && surgeon.topFlag !== 'N/A' && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Most Common Flag
                </h4>
                <div className="text-sm font-medium text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  {surgeon.topFlag}
                </div>
              </div>
            )}

            {/* Flagged cases for this surgeon */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Flagged Cases ({surgeonCases.length})
              </h4>
              {surgeonCases.length === 0 ? (
                <p className="text-sm text-slate-400">No recent flagged cases in this period.</p>
              ) : (
                <div className="space-y-2">
                  {surgeonCases.map((c) => (
                    <CaseRow key={c.caseId} caseData={c} onClick={onCaseClick} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ============================================
// Room drill-through panel
// ============================================

function RoomPanel({
  roomId,
  roomFlags,
  recentFlaggedCases,
  onClose,
  onCaseClick,
}: {
  roomId: string
  roomFlags: RoomFlagRow[]
  recentFlaggedCases: RecentFlaggedCase[]
  onClose: () => void
  onCaseClick?: (caseId: string) => void
}) {
  const room = roomFlags.find((r) => r.roomId === roomId)

  const roomCases = recentFlaggedCases.filter((c) => c.roomId === roomId)

  return (
    <>
      {/* Header */}
      <PanelHeader
        icon={<DoorOpen className="w-4 h-4" />}
        label="Room Detail"
        title={room?.room ?? 'Unknown Room'}
        onClose={onClose}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!room ? (
          <div className="text-center py-12 text-sm text-slate-400">Room data not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Summary stats — three cards */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Cases" value={String(room.cases)} />
              <StatCard
                label="Total Cases Flagged"
                value={String(Math.round(room.rate * room.cases / 100))}
              />
              <StatCard
                label="Flag Rate"
                value={`${room.rate.toFixed(1)}%`}
                highlight={room.rate > 30}
              />
            </div>

            {/* Top issue */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Top Auto-Detected Issue
              </h4>
              <div className={`text-sm rounded-lg px-3 py-2 border ${
                room.topIssue && room.topIssue !== 'N/A'
                  ? 'font-medium text-slate-900 bg-slate-50 border-slate-100'
                  : 'text-slate-400 bg-slate-50/50 border-slate-100'
              }`}>
                {room.topIssue && room.topIssue !== 'N/A' ? room.topIssue : 'No threshold issues detected'}
              </div>
            </div>

            {/* Top delay */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Top Reported Delay
              </h4>
              <div className={`text-sm rounded-lg px-3 py-2 border ${
                room.topDelay && room.topDelay !== 'N/A'
                  ? 'font-medium text-slate-900 bg-amber-50 border-amber-100'
                  : 'text-slate-400 bg-slate-50/50 border-slate-100'
              }`}>
                {room.topDelay && room.topDelay !== 'N/A' ? room.topDelay : 'No delays reported'}
              </div>
            </div>

            {/* Flagged cases for this room */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Flagged Cases ({roomCases.length})
              </h4>
              {roomCases.length === 0 ? (
                <p className="text-sm text-slate-400">No recent flagged cases in this period.</p>
              ) : (
                <div className="space-y-2">
                  {roomCases.map((c) => (
                    <CaseRow key={c.caseId} caseData={c} onClick={onCaseClick} />
                  ))}
                </div>
              )}
            </div>

            {/* Link to cases page */}
            <div className="pt-2">
              <a
                href="/cases"
                className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View all cases in {room.room} on the Cases page
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ============================================
// Shared sub-components
// ============================================

function PanelHeader({
  icon,
  label,
  title,
  onClose,
}: {
  icon: React.ReactNode
  label: string
  title: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
      <div className="min-w-0 flex-1 mr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-100 text-violet-700 flex items-center gap-1">
            {icon}
            {label}
          </span>
          <Dialog.Title className="text-[15px] font-semibold text-slate-900 truncate">
            {title}
          </Dialog.Title>
        </div>
        <p className="text-xs text-slate-400">Flag detail for this entity</p>
      </div>
      <Dialog.Close asChild>
        <button
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close panel"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>
      </Dialog.Close>
    </div>
  )
}

function StatCard({ label, value, subtitle, highlight }: { label: string; value: string; subtitle?: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </div>
      {subtitle && (
        <div className={`text-[11px] mt-0.5 ${highlight ? 'text-rose-500' : 'text-slate-400'}`}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function TrendRow({ trend }: { trend: number }) {
  if (trend === 0) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center gap-3">
        <Minus className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-400">No change from prior period</span>
      </div>
    )
  }

  const isImproving = trend < 0
  const absTrend = Math.abs(trend)

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
      isImproving ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
    }`}>
      <div className={`flex items-center gap-1.5 ${
        isImproving ? 'text-emerald-600' : 'text-rose-600'
      }`}>
        {isImproving ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
        <span className="text-sm font-bold font-mono">{absTrend.toFixed(1)}%</span>
      </div>
      <span className="text-sm text-slate-600">
        Flag rate {isImproving ? 'decreased' : 'increased'} by {absTrend.toFixed(1)}% vs prior period
      </span>
    </div>
  )
}

function CaseRow({ caseData, onClick }: { caseData: RecentFlaggedCase; onClick?: (caseId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(caseData.caseId)}
      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors group cursor-pointer"
    >
      <div className="flex-shrink-0">
        <span className="text-[13px] font-semibold text-sky-600 font-mono group-hover:text-sky-700">
          {caseData.caseNumber}
        </span>
        <div className="text-[11px] text-slate-400 mt-0.5">{caseData.date}</div>
      </div>
      <div className="flex-shrink-0 w-[100px] text-xs text-slate-600 truncate">{caseData.procedure}</div>
      <div className="flex gap-1 flex-wrap flex-1">
        {caseData.flags.map((f, j) => {
          const config = SEVERITY_BADGE[f.severity] ?? SEVERITY_BADGE.info
          return (
            <span
              key={j}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${config.bg} ${config.text} ${config.border}`}
            >
              <span className="text-[8px] opacity-70">{f.type === 'delay' ? '◷' : '⚡'}</span>
              {f.name}
            </span>
          )
        })}
      </div>
    </button>
  )
}
