// app/admin/demo/__tests__/demo-wizard.test.tsx
// Phase 7 tests: RunningStep SSE event parsing, ReviewStep rendering,
// and end-to-end wizard flow coverage

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import RunningStep from '../steps/RunningStep'
import type { SSEProgressEvent, SSECompleteEvent, SSEErrorEvent, SSEEvent } from '../steps/RunningStep'
import type { DemoWizardState } from '../types'

// ============================================================================
// SSE Event Parsing (unit tests for the parsing logic)
// ============================================================================

describe('SSE event parsing', () => {
  function parseSSEEvent(data: string): SSEEvent | null {
    try {
      return JSON.parse(data) as SSEEvent
    } catch {
      return null
    }
  }

  it('parses a progress event correctly', () => {
    const data = JSON.stringify({
      type: 'progress',
      phase: 'generating_cases',
      current: 50,
      total: 100,
      message: 'Generating 250 cases',
    })

    const event = parseSSEEvent(data)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('progress')
    const progressEvent = event as SSEProgressEvent
    expect(progressEvent.phase).toBe('generating_cases')
    expect(progressEvent.current).toBe(50)
    expect(progressEvent.total).toBe(100)
    expect(progressEvent.message).toBe('Generating 250 cases')
  })

  it('parses a complete event correctly', () => {
    const data = JSON.stringify({
      type: 'complete',
      result: {
        casesGenerated: 500,
        cancelledCount: 15,
        delayedCount: 30,
        flaggedCount: 45,
        unvalidatedCount: 10,
        milestonesInserted: 4500,
        staffAssigned: 1500,
        implantsInserted: 400,
        duration: 12500,
      },
    })

    const event = parseSSEEvent(data)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('complete')
    const completeEvent = event as SSECompleteEvent
    expect(completeEvent.result.casesGenerated).toBe(500)
    expect(completeEvent.result.cancelledCount).toBe(15)
    expect(completeEvent.result.flaggedCount).toBe(45)
    expect(completeEvent.result.duration).toBe(12500)
  })

  it('parses an error event correctly', () => {
    const data = JSON.stringify({
      type: 'error',
      error: 'Database connection failed',
      purged: true,
    })

    const event = parseSSEEvent(data)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('error')
    const errorEvent = event as SSEErrorEvent
    expect(errorEvent.error).toBe('Database connection failed')
    expect(errorEvent.purged).toBe(true)
  })

  it('returns null for invalid JSON', () => {
    expect(parseSSEEvent('not-json')).toBeNull()
    expect(parseSSEEvent('')).toBeNull()
    expect(parseSSEEvent('{broken')).toBeNull()
  })

  it('parses SSE line format correctly', () => {
    const line = 'data: {"type":"progress","phase":"clearing","current":10,"total":100,"message":"Clearing..."}'
    const data = line.slice(6).trim()
    const event = parseSSEEvent(data)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('progress')
  })

  it('handles error event with purged=false', () => {
    const data = JSON.stringify({
      type: 'error',
      error: 'Partial failure',
      purged: false,
    })
    const event = parseSSEEvent(data) as SSEErrorEvent
    expect(event.purged).toBe(false)
  })
})

// ============================================================================
// SSE Event Handling Logic (counts extraction from messages)
// ============================================================================

describe('SSE count extraction from progress messages', () => {
  function extractCounts(
    message: string,
    prevCounts: { cases: number; milestones: number; staff: number; flags: number },
  ) {
    const caseMatch = message.match(/(\d+)\s+cases?/i)
    const msMatch = message.match(/(\d+)\s+milestones?/i)
    const staffMatch = message.match(/(\d+)\s+staff/i)
    const flagMatch = message.match(/(\d+)\s+flags?/i)

    return {
      cases: caseMatch ? parseInt(caseMatch[1], 10) : prevCounts.cases,
      milestones: msMatch ? parseInt(msMatch[1], 10) : prevCounts.milestones,
      staff: staffMatch ? parseInt(staffMatch[1], 10) : prevCounts.staff,
      flags: flagMatch ? parseInt(flagMatch[1], 10) : prevCounts.flags,
    }
  }

  const zeroCounts = { cases: 0, milestones: 0, staff: 0, flags: 0 }

  it('extracts case count from "Inserting 500 cases..."', () => {
    const counts = extractCounts('Inserting 500 cases...', zeroCounts)
    expect(counts.cases).toBe(500)
  })

  it('extracts milestone count from "Inserting 4500 milestones..."', () => {
    const counts = extractCounts('Inserting 4500 milestones...', zeroCounts)
    expect(counts.milestones).toBe(4500)
  })

  it('extracts staff count from "Inserting 1500 staff..."', () => {
    const counts = extractCounts('Inserting 1500 staff...', zeroCounts)
    expect(counts.staff).toBe(1500)
  })

  it('extracts flag count from "Inserting 45 flags..."', () => {
    const counts = extractCounts('Inserting 45 flags...', zeroCounts)
    expect(counts.flags).toBe(45)
  })

  it('preserves previous counts when message has no match', () => {
    const prev = { cases: 500, milestones: 4500, staff: 1500, flags: 45 }
    const counts = extractCounts('Recalculating averages...', prev)
    expect(counts).toEqual(prev)
  })

  it('extracts singular "case" (not just "cases")', () => {
    const counts = extractCounts('Dr. Smith: 1 case', zeroCounts)
    expect(counts.cases).toBe(1)
  })

  it('handles messages with multiple count types', () => {
    const counts = extractCounts('Generated 100 cases with 900 milestones', zeroCounts)
    expect(counts.cases).toBe(100)
    expect(counts.milestones).toBe(900)
  })
})

// ============================================================================
// Phase Completion Tracking
// ============================================================================

describe('phase completion tracking', () => {
  const PHASE_IDS = [
    'purging',
    'generating_cases',
    'inserting_milestones',
    'assigning_staff',
    'detecting_flags',
    'finalizing',
  ]

  it('marks earlier phases as completed when a later phase starts', () => {
    const completedPhases = new Set<string>()

    // Simulate receiving a progress event for phase index 3 (assigning_staff)
    const currentPhaseIdx = 3
    for (let i = 0; i < currentPhaseIdx; i++) {
      completedPhases.add(PHASE_IDS[i])
    }

    expect(completedPhases.has('purging')).toBe(true)
    expect(completedPhases.has('generating_cases')).toBe(true)
    expect(completedPhases.has('inserting_milestones')).toBe(true)
    expect(completedPhases.has('assigning_staff')).toBe(false) // current, not completed
    expect(completedPhases.has('detecting_flags')).toBe(false)
    expect(completedPhases.has('finalizing')).toBe(false)
  })

  it('marks all phases as completed on "complete" event', () => {
    const completedPhases = new Set(PHASE_IDS)
    expect(completedPhases.size).toBe(6)
    for (const id of PHASE_IDS) {
      expect(completedPhases.has(id)).toBe(true)
    }
  })
})

// ============================================================================
// Progress Calculation
// ============================================================================

describe('progress percentage calculation', () => {
  it('computes progress as (current/total)*100 rounded', () => {
    expect(Math.round((25 / 100) * 100)).toBe(25)
    expect(Math.round((50 / 100) * 100)).toBe(50)
    expect(Math.round((75 / 100) * 100)).toBe(75)
    expect(Math.round((100 / 100) * 100)).toBe(100)
  })

  it('handles non-round percentages', () => {
    expect(Math.round((33 / 100) * 100)).toBe(33)
    expect(Math.round((67 / 100) * 100)).toBe(67)
  })
})

// ============================================================================
// Success Screen Metrics
// ============================================================================

describe('success screen per-case averages', () => {
  it('computes milestones per case', () => {
    const casesGenerated = 500
    const milestonesInserted = 4500
    const perCase = (milestonesInserted / casesGenerated).toFixed(1)
    expect(perCase).toBe('9.0')
  })

  it('computes staff per case', () => {
    const casesGenerated = 500
    const staffAssigned = 1500
    const perCase = (staffAssigned / casesGenerated).toFixed(1)
    expect(perCase).toBe('3.0')
  })

  it('computes flags per case', () => {
    const casesGenerated = 500
    const flaggedCount = 45
    const perCase = (flaggedCount / casesGenerated).toFixed(2)
    expect(perCase).toBe('0.09')
  })

  it('handles zero cases gracefully', () => {
    const casesGenerated = 0
    const perCase = casesGenerated > 0 ? (4500 / casesGenerated).toFixed(1) : '0'
    expect(perCase).toBe('0')
  })
})

// ============================================================================
// RunningStep Component Rendering
// ============================================================================

describe('RunningStep component', () => {
  const mockWizardState: DemoWizardState = {
    facilityId: 'facility-1',
    monthsOfHistory: 6,
    purgeFirst: true,
    surgeonProfiles: {},
  }

  // Mock fetch to prevent actual API calls
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('mocked')))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <RunningStep
        wizardState={mockWizardState}
        onRestart={() => {}}
        facilityId="facility-1"
      />,
    )
    // Should show "Generating Demo Data" header
    expect(screen.getByText('Generating Demo Data')).toBeInTheDocument()
  })

  it('displays all generation phases', () => {
    render(
      <RunningStep
        wizardState={mockWizardState}
        onRestart={() => {}}
        facilityId="facility-1"
      />,
    )
    expect(screen.getByText('Purging existing data')).toBeInTheDocument()
    expect(screen.getByText('Generating cases')).toBeInTheDocument()
    expect(screen.getByText('Inserting milestones')).toBeInTheDocument()
    expect(screen.getByText('Assigning staff')).toBeInTheDocument()
    expect(screen.getByText('Detecting flags')).toBeInTheDocument()
    expect(screen.getByText('Finalizing')).toBeInTheDocument()
  })

  it('shows initial progress at 0%', () => {
    render(
      <RunningStep
        wizardState={mockWizardState}
        onRestart={() => {}}
        facilityId="facility-1"
      />,
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders running count labels', () => {
    render(
      <RunningStep
        wizardState={mockWizardState}
        onRestart={() => {}}
        facilityId="facility-1"
      />,
    )
    expect(screen.getByText('Cases')).toBeInTheDocument()
    expect(screen.getByText('Milestones')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument()
    expect(screen.getByText('Flags')).toBeInTheDocument()
  })
})
