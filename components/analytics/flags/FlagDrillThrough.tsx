// components/analytics/flags/FlagDrillThrough.tsx
// Slide-over drill-through panel for flag analytics.
// Two modes: surgeon detail, room detail.
// Case drill-through navigates to /cases instead (Q8).
// 640px wide, right-slide, Radix Dialog — matches InsightSlideOver pattern.

'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X, User, DoorOpen, ExternalLink } from 'lucide-react'
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
            />
          )}
          {target?.mode === 'room' && (
            <RoomPanel
              roomId={target.roomId}
              roomFlags={roomFlags}
              onClose={onClose}
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
}: {
  surgeonId: string
  surgeonFlags: SurgeonFlagRow[]
  recentFlaggedCases: RecentFlaggedCase[]
  onClose: () => void
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
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Cases" value={String(surgeon.cases)} />
              <StatCard label="Flagged Cases" value={String(surgeon.flags)} />
              <StatCard label="Flag Rate" value={`${surgeon.rate.toFixed(1)}%`} highlight={surgeon.rate > 30} />
              <StatCard
                label="Trend"
                value={
                  surgeon.trend > 0
                    ? `+${surgeon.trend.toFixed(1)}%`
                    : `${surgeon.trend.toFixed(1)}%`
                }
                highlight={surgeon.trend > 0}
              />
            </div>

            {/* Top flag */}
            {surgeon.topFlag && (
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
                    <CaseRow key={c.caseId} caseData={c} />
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
  onClose,
}: {
  roomId: string
  roomFlags: RoomFlagRow[]
  onClose: () => void
}) {
  const room = roomFlags.find((r) => r.roomId === roomId)

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
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Cases" value={String(room.cases)} />
              <StatCard label="Total Flags" value={String(room.flags)} />
              <StatCard label="Flag Rate" value={`${room.rate.toFixed(1)}%`} highlight={room.rate > 30} />
              <StatCard label="Flags / Case" value={room.cases > 0 ? (room.flags / room.cases).toFixed(1) : '0'} />
            </div>

            {/* Top issue */}
            {room.topIssue && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Top Auto-Detected Issue
                </h4>
                <div className="text-sm font-medium text-slate-900 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  {room.topIssue}
                </div>
              </div>
            )}

            {/* Top delay */}
            {room.topDelay && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Top Reported Delay
                </h4>
                <div className="text-sm font-medium text-slate-900 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                  {room.topDelay}
                </div>
              </div>
            )}

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

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  )
}

function CaseRow({ caseData }: { caseData: RecentFlaggedCase }) {
  return (
    <a
      href={`/cases?caseId=${caseData.caseId}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors group"
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
    </a>
  )
}
