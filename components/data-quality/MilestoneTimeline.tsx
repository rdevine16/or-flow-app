// MilestoneTimeline — vertical track with connected milestone nodes
// Displays case milestones with status indicators, edit capability, and pair arrows

import { ArrowDown, ArrowUp, Check } from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface EditableMilestone {
  id?: string
  name: string
  display_name: string
  display_order: number
  pair_with_id: string | null
  recorded_at: string | null
  original_recorded_at: string | null
  isEditing: boolean
  hasChanged: boolean
  canEdit: boolean
}

interface MilestoneTimelineProps {
  milestones: EditableMilestone[]
  issueMilestoneIds: Set<string>
  loading: boolean
  onToggleEdit: (index: number) => void
  onTimeChange: (index: number, time: string) => void
}

// ============================================
// HELPERS
// ============================================

function formatTimeWithSeconds(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return isoString
  }
}

// ============================================
// COMPONENT
// ============================================

export default function MilestoneTimeline({
  milestones,
  issueMilestoneIds,
  loading,
  onToggleEdit,
  onTimeChange,
}: MilestoneTimelineProps) {
  if (loading) {
    return (
      <div data-testid="milestone-timeline" className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div data-testid="milestone-timeline" className="text-center py-6">
        <p className="text-xs text-slate-400 italic">No milestones found for this case</p>
      </div>
    )
  }

  return (
    <div data-testid="milestone-timeline">
      {/* Legend */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-[10px] text-slate-400">Recorded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full border-2 border-slate-300" />
          <span className="text-[10px] text-slate-400">Missing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[10px] text-slate-400">Issue</span>
        </div>
      </div>

      {/* Timeline track */}
      <div className="pl-1">
        {milestones.map((milestone, index) => (
          <TimelineNode
            key={milestone.id || milestone.name}
            milestone={milestone}
            index={index}
            isLast={index === milestones.length - 1}
            hasIssue={milestone.id ? issueMilestoneIds.has(milestone.id) : false}
            allMilestones={milestones}
            onToggleEdit={onToggleEdit}
            onTimeChange={onTimeChange}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================
// TIMELINE NODE
// ============================================

function TimelineNode({
  milestone,
  index,
  isLast,
  hasIssue,
  allMilestones,
  onToggleEdit,
  onTimeChange,
}: {
  milestone: EditableMilestone
  index: number
  isLast: boolean
  hasIssue: boolean
  allMilestones: EditableMilestone[]
  onToggleEdit: (index: number) => void
  onTimeChange: (index: number, time: string) => void
}) {
  const isMissing = !milestone.recorded_at
  const pairedMilestone = milestone.pair_with_id
    ? allMilestones.find(m => m.id === milestone.pair_with_id)
    : null
  const isStartOfPair = pairedMilestone && milestone.display_order < (pairedMilestone.display_order || 999)
  const isEndOfPair = pairedMilestone && milestone.display_order > (pairedMilestone.display_order || 0)

  // Node color: missing = hollow, issue = amber, recorded = green, modified = blue
  const nodeColor = isMissing
    ? 'border-2 border-slate-300'
    : hasIssue
      ? 'bg-amber-500'
      : milestone.hasChanged
        ? 'bg-blue-500'
        : 'bg-green-500'

  // Track line color
  const trackColor = 'bg-slate-200'

  return (
    <div className="flex gap-3">
      {/* Vertical track column */}
      <div className="flex flex-col items-center w-5 flex-shrink-0 pt-0.5">
        {/* Node circle */}
        <div className={`w-3 h-3 rounded-full relative z-[1] flex items-center justify-center ${nodeColor}`}>
          {!isMissing && !hasIssue && !milestone.hasChanged && (
            <Check className="w-2 h-2 text-white" strokeWidth={3} />
          )}
        </div>
        {/* Connecting line */}
        {!isLast && (
          <div className={`w-0.5 flex-1 min-h-[24px] ${trackColor}`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-3 ${isLast ? 'pb-0' : ''} ${hasIssue ? 'bg-amber-50 -ml-1 px-2.5 py-2 rounded-lg mb-1' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          {/* Left: name + badges */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Pair arrow */}
            {isStartOfPair && <ArrowDown className="w-3 h-3 text-blue-400 flex-shrink-0" />}
            {isEndOfPair && <ArrowUp className="w-3 h-3 text-blue-400 flex-shrink-0" />}

            <span className={`text-[13px] font-semibold ${hasIssue ? 'text-amber-800' : 'text-slate-900'}`}>
              {milestone.display_name}
            </span>

            {isStartOfPair && (
              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-100 text-blue-600 rounded">Start</span>
            )}
            {isEndOfPair && (
              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-100 text-blue-600 rounded">End</span>
            )}
            {hasIssue && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-200 text-amber-700 rounded uppercase tracking-wide">
                Issue
              </span>
            )}
            {milestone.hasChanged && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-600 rounded">
                Modified
              </span>
            )}
          </div>

          {/* Right: time + edit button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {milestone.isEditing ? (
              <input
                type="datetime-local"
                step="1"
                value={milestone.recorded_at ? milestone.recorded_at.slice(0, 19) : ''}
                onChange={(e) =>
                  onTimeChange(index, e.target.value ? new Date(e.target.value).toISOString() : '')
                }
                className="px-1.5 py-0.5 text-xs font-mono border-[1.5px] border-blue-500 rounded-md bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <span
                className={`text-[13px] font-mono font-medium ${
                  isMissing ? 'text-slate-400 italic' : 'text-slate-700'
                }`}
              >
                {milestone.recorded_at ? formatTimeWithSeconds(milestone.recorded_at) : 'Not recorded'}
              </span>
            )}
            {milestone.canEdit && (
              <button
                onClick={() => onToggleEdit(index)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-[5px] border transition-colors ${
                  milestone.isEditing
                    ? 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {milestone.isEditing ? 'Done' : isMissing ? 'Add' : 'Edit'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
