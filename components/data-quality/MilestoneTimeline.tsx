// MilestoneTimeline — vertical track with connected nodes (Phase 6)
// Placeholder: will be implemented in Phase 6

interface MilestoneTimelineProps {
  milestones: Array<{
    id?: string
    name: string
    display_name: string
    recorded_at: string | null
  }>
}

export default function MilestoneTimeline({ milestones }: MilestoneTimelineProps) {
  return (
    <div data-testid="milestone-timeline">
      {milestones.length} milestones
    </div>
  )
}
