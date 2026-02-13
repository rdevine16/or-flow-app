import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MilestoneCard, { type MilestoneCardData } from '../MilestoneCard'
import { type MilestonePaceInfo } from '@/lib/pace-utils'

// ============================================
// HELPERS
// ============================================

function buildCard(overrides: Partial<MilestoneCardData> = {}): MilestoneCardData {
  return {
    milestone: {
      id: 'fm-1',
      name: 'incision',
      display_name: 'Incision',
      display_order: 3,
      pair_with_id: null,
      pair_position: null,
      source_milestone_type_id: 'mt-incision',
    },
    recorded: undefined,
    isPaired: false,
    partner: undefined,
    partnerRecorded: undefined,
    elapsedDisplay: '',
    displayName: 'Incision',
    isComplete: false,
    isInProgress: false,
    ...overrides,
  }
}

function buildCompletedCard(overrides: Partial<MilestoneCardData> = {}): MilestoneCardData {
  return buildCard({
    recorded: { id: 'cm-1', facility_milestone_id: 'fm-1', recorded_at: '2025-01-15T14:30:00Z' },
    isComplete: true,
    ...overrides,
  })
}

const defaultHandlers = {
  onRecord: vi.fn(),
  onRecordEnd: vi.fn(),
  onUndo: vi.fn(),
  onUndoEnd: vi.fn(),
}

// ============================================
// UNIT: Pace info display on completed milestone
// ============================================

describe('MilestoneCard — pace info display', () => {
  it('should show pace text when milestone is complete and has pace info', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 20,
      varianceMinutes: 5,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        timeZone="UTC"
        paceInfo={paceInfo}
      />
    )

    expect(screen.getByText(/20m vs 25m exp/)).toBeInTheDocument()
    expect(screen.getByText(/5m ahead/)).toBeInTheDocument()
  })

  it('should show "behind" text when variance is negative', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 33,
      varianceMinutes: -8,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    expect(screen.getByText(/33m vs 25m exp/)).toBeInTheDocument()
    expect(screen.getByText(/8m behind/)).toBeInTheDocument()
  })

  it('should show "on pace" when variance is zero', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 25,
      varianceMinutes: 0,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    expect(screen.getByText(/on pace/)).toBeInTheDocument()
  })

  it('should NOT show pace text when milestone is not complete', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 20,
      varianceMinutes: 5,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCard()} // not completed
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    expect(screen.queryByText(/vs.*exp/)).not.toBeInTheDocument()
  })

  it('should NOT show pace text when paceInfo is null', () => {
    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={null}
      />
    )

    expect(screen.queryByText(/vs.*exp/)).not.toBeInTheDocument()
  })

  it('should NOT show pace text when paceInfo is undefined (prop omitted)', () => {
    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
      />
    )

    expect(screen.queryByText(/vs.*exp/)).not.toBeInTheDocument()
  })

  it('should NOT show pace text when sampleSize is below threshold', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 20,
      varianceMinutes: 5,
      sampleSize: 5, // below MIN_SAMPLE_SIZE (10)
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    expect(screen.queryByText(/vs.*exp/)).not.toBeInTheDocument()
  })

  it('should show pace text when sampleSize is exactly at threshold', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 20,
      varianceMinutes: 5,
      sampleSize: 10, // exactly MIN_SAMPLE_SIZE
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    expect(screen.getByText(/20m vs 25m exp/)).toBeInTheDocument()
  })
})

// ============================================
// INTEGRATION: Pace color coding
// ============================================

describe('MilestoneCard — pace color coding', () => {
  it('should use green color for significantly ahead (>5 min)', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 15,
      varianceMinutes: 10,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    const aheadText = screen.getByText(/10m ahead/)
    expect(aheadText.className).toContain('text-green-600')
  })

  it('should use red color for significantly behind (>5 min)', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 35,
      varianceMinutes: -10,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    const behindText = screen.getByText(/10m behind/)
    expect(behindText.className).toContain('text-red-500')
  })

  it('should use amber color for slightly behind (1-5 min)', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 28,
      varianceMinutes: -3,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    const behindText = screen.getByText(/3m behind/)
    expect(behindText.className).toContain('text-amber-500')
  })

  it('should use blue color for on pace or slightly ahead (0-5 min)', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 25,
      actualMinutes: 23,
      varianceMinutes: 2,
      sampleSize: 30,
    }

    render(
      <MilestoneCard
        card={buildCompletedCard()}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    const aheadText = screen.getByText(/2m ahead/)
    expect(aheadText.className).toContain('text-blue-500')
  })
})

// ============================================
// WORKFLOW: Pace display with paired milestones
// ============================================

describe('MilestoneCard — paired milestone pace', () => {
  it('should show duration-based pace for completed paired milestone', () => {
    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 18, // expected anesthesia duration
      actualMinutes: 15,   // actual anesthesia duration
      varianceMinutes: 3,  // 3 min ahead
      sampleSize: 25,
    }

    const card = buildCard({
      milestone: {
        id: 'fm-anes-start',
        name: 'anes_start',
        display_name: 'Anesthesia Start',
        display_order: 2,
        pair_with_id: 'fm-anes-end',
        pair_position: 'start',
        source_milestone_type_id: 'mt-anes-start',
      },
      recorded: { id: 'cm-2', facility_milestone_id: 'fm-anes-start', recorded_at: '2025-01-15T08:10:00Z' },
      isPaired: true,
      partner: {
        id: 'fm-anes-end',
        name: 'anes_end',
        display_name: 'Anesthesia End',
        display_order: 3,
        pair_with_id: 'fm-anes-start',
        pair_position: 'end',
        source_milestone_type_id: 'mt-anes-end',
      },
      partnerRecorded: { id: 'cm-3', facility_milestone_id: 'fm-anes-end', recorded_at: '2025-01-15T08:25:00Z' },
      elapsedDisplay: '15m 0s',
      displayName: 'Anesthesia',
      isComplete: true,
    })

    render(
      <MilestoneCard
        card={card}
        {...defaultHandlers}
        timeZone="UTC"
        paceInfo={paceInfo}
      />
    )

    expect(screen.getByText(/15m vs 18m exp/)).toBeInTheDocument()
    expect(screen.getByText(/3m ahead/)).toBeInTheDocument()
  })

  it('should not show pace for in-progress paired milestone', () => {
    const card = buildCard({
      milestone: {
        id: 'fm-anes-start',
        name: 'anes_start',
        display_name: 'Anesthesia Start',
        display_order: 2,
        pair_with_id: 'fm-anes-end',
        pair_position: 'start',
        source_milestone_type_id: 'mt-anes-start',
      },
      recorded: { id: 'cm-2', facility_milestone_id: 'fm-anes-start', recorded_at: '2025-01-15T08:10:00Z' },
      isPaired: true,
      isInProgress: true,
      isComplete: false,
      elapsedDisplay: '5m 30s',
      displayName: 'Anesthesia',
    })

    const paceInfo: MilestonePaceInfo = {
      expectedMinutes: 18,
      actualMinutes: 5,
      varianceMinutes: 13,
      sampleSize: 25,
    }

    render(
      <MilestoneCard
        card={card}
        {...defaultHandlers}
        paceInfo={paceInfo}
      />
    )

    // Pace text should NOT appear for in-progress milestones
    expect(screen.queryByText(/vs.*exp/)).not.toBeInTheDocument()
  })
})
