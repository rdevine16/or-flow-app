/**
 * Tests for the dynamic phase wiring on the Surgeon Day Overview page.
 *
 * Phase 3 replaced hardcoded 4-phase Case Breakdown with dynamic phases
 * from phase_definitions. These tests verify:
 * 1. The data flow: phase_definitions + case_milestones → CasePhaseBarPhase[]
 * 2. Legend generation from phase tree
 * 3. Edge cases: missing milestones, subphases, empty definitions
 */
import { describe, it, expect } from 'vitest'
import {
  computePhaseDurations,
  buildMilestoneTimestampMap,
  type PhaseDefInput,
} from '@/lib/analyticsV2'
import {
  buildPhaseTree,
  resolvePhaseHex,
  resolveSubphaseHex,
} from '@/lib/milestone-phase-config'
import type {
  CasePhaseBarPhase,
  CasePhaseBarSubphase,
  PhaseLegendItem,
} from '@/components/analytics/AnalyticsComponents'

// ─── Test Data ───────────────────────────────────────────────────

const MILESTONE_IDS = {
  patientIn: 'ms-patient-in',
  incision: 'ms-incision',
  closing: 'ms-closing',
  closingComplete: 'ms-closing-complete',
  patientOut: 'ms-patient-out',
  anesStart: 'ms-anes-start',
  anesEnd: 'ms-anes-end',
}

/** Facility phase definitions matching the typical 4-phase + 1 subphase layout */
const PHASE_DEFS: PhaseDefInput[] = [
  {
    id: 'phase-preop',
    name: 'pre_op',
    display_name: 'Pre-Op',
    display_order: 1,
    color_key: 'blue',
    parent_phase_id: null,
    start_milestone_id: MILESTONE_IDS.patientIn,
    end_milestone_id: MILESTONE_IDS.incision,
  },
  {
    id: 'phase-anes',
    name: 'anesthesia',
    display_name: 'Anesthesia',
    display_order: 2,
    color_key: 'teal',
    parent_phase_id: 'phase-preop',
    start_milestone_id: MILESTONE_IDS.anesStart,
    end_milestone_id: MILESTONE_IDS.anesEnd,
  },
  {
    id: 'phase-surgical',
    name: 'surgical',
    display_name: 'Surgical',
    display_order: 3,
    color_key: 'green',
    parent_phase_id: null,
    start_milestone_id: MILESTONE_IDS.incision,
    end_milestone_id: MILESTONE_IDS.closing,
  },
  {
    id: 'phase-closing',
    name: 'closing',
    display_name: 'Closing',
    display_order: 4,
    color_key: 'amber',
    parent_phase_id: null,
    start_milestone_id: MILESTONE_IDS.closing,
    end_milestone_id: MILESTONE_IDS.closingComplete,
  },
  {
    id: 'phase-emergence',
    name: 'emergence',
    display_name: 'Emergence',
    display_order: 5,
    color_key: 'purple',
    parent_phase_id: null,
    start_milestone_id: MILESTONE_IDS.closingComplete,
    end_milestone_id: MILESTONE_IDS.patientOut,
  },
]

/** Case milestones with all timestamps present */
function makeFullMilestones() {
  const base = new Date('2026-01-15T07:00:00Z').getTime()
  return [
    { facility_milestone_id: MILESTONE_IDS.patientIn, recorded_at: new Date(base).toISOString() },
    { facility_milestone_id: MILESTONE_IDS.anesStart, recorded_at: new Date(base + 5 * 60_000).toISOString() },
    { facility_milestone_id: MILESTONE_IDS.anesEnd, recorded_at: new Date(base + 15 * 60_000).toISOString() },
    { facility_milestone_id: MILESTONE_IDS.incision, recorded_at: new Date(base + 20 * 60_000).toISOString() },
    { facility_milestone_id: MILESTONE_IDS.closing, recorded_at: new Date(base + 80 * 60_000).toISOString() },
    { facility_milestone_id: MILESTONE_IDS.closingComplete, recorded_at: new Date(base + 90 * 60_000).toISOString() },
    { facility_milestone_id: MILESTONE_IDS.patientOut, recorded_at: new Date(base + 100 * 60_000).toISOString() },
  ]
}

// ─── Helper: mirrors the caseBreakdown useMemo logic ─────────────

function buildCasePhases(
  phaseDefinitions: PhaseDefInput[],
  caseMilestones: Array<{ facility_milestone_id: string; recorded_at: string }>,
): CasePhaseBarPhase[] {
  const phaseTree = buildPhaseTree(phaseDefinitions)
  const timestampMap = buildMilestoneTimestampMap(caseMilestones)
  const durations = computePhaseDurations(phaseDefinitions, timestampMap)
  const durationMap = new Map(durations.map(d => [d.phaseId, d]))

  return phaseTree.map(node => {
    const parentDuration = durationMap.get(node.phase.id)
    const subphases: CasePhaseBarSubphase[] = node.children
      .map(child => {
        const childDuration = durationMap.get(child.phase.id)
        if (!childDuration || childDuration.durationSeconds === null) return null
        return {
          label: childDuration.displayName,
          value: childDuration.durationSeconds,
          color: resolveSubphaseHex(childDuration.colorKey),
        }
      })
      .filter((s): s is CasePhaseBarSubphase => s !== null)

    return {
      label: parentDuration?.displayName ?? node.phase.display_name,
      value: parentDuration?.durationSeconds ?? 0,
      color: resolvePhaseHex(parentDuration?.colorKey ?? node.phase.color_key),
      isMissing: parentDuration?.durationSeconds === null,
      subphases: subphases.length > 0 ? subphases : undefined,
    }
  })
}

/** Mirrors the dynamicLegendItems useMemo logic */
function buildLegendItems(phaseDefinitions: PhaseDefInput[]): PhaseLegendItem[] {
  const phaseTree = buildPhaseTree(phaseDefinitions)
  const items: PhaseLegendItem[] = []
  phaseTree.forEach(node => {
    items.push({
      label: node.phase.display_name,
      color: resolvePhaseHex(node.phase.color_key),
    })
    node.children.forEach(child => {
      items.push({
        label: child.phase.display_name,
        color: resolveSubphaseHex(child.phase.color_key),
        isSubphase: true,
      })
    })
  })
  return items
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Dynamic case breakdown phases (surgeon page wiring)', () => {
  describe('buildCasePhases — full data', () => {
    it('produces one CasePhaseBarPhase per parent phase', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      // 4 parent phases: Pre-Op, Surgical, Closing, Emergence
      expect(phases).toHaveLength(4)
    })

    it('assigns correct labels from display_name', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      expect(phases.map(p => p.label)).toEqual(['Pre-Op', 'Surgical', 'Closing', 'Emergence'])
    })

    it('computes correct durations in seconds', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      // Pre-Op: 0→20 min = 1200s
      expect(phases[0].value).toBe(1200)
      // Surgical: 20→80 min = 3600s
      expect(phases[1].value).toBe(3600)
      // Closing: 80→90 min = 600s
      expect(phases[2].value).toBe(600)
      // Emergence: 90→100 min = 600s
      expect(phases[3].value).toBe(600)
    })

    it('uses resolvePhaseHex colors from color_key', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      expect(phases[0].color).toBe(resolvePhaseHex('blue'))
      expect(phases[1].color).toBe(resolvePhaseHex('green'))
      expect(phases[2].color).toBe(resolvePhaseHex('amber'))
      expect(phases[3].color).toBe(resolvePhaseHex('purple'))
    })

    it('sets isMissing to false for phases with data', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      phases.forEach(p => {
        expect(p.isMissing).toBe(false)
      })
    })

    it('attaches subphases to the correct parent', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      // Pre-Op has Anesthesia subphase
      expect(phases[0].subphases).toHaveLength(1)
      expect(phases[0].subphases![0].label).toBe('Anesthesia')
      // Anesthesia: 5→15 min = 600s
      expect(phases[0].subphases![0].value).toBe(600)
      expect(phases[0].subphases![0].color).toBe(resolveSubphaseHex('teal'))
    })

    it('does not attach subphases to phases without children', () => {
      const phases = buildCasePhases(PHASE_DEFS, makeFullMilestones())
      expect(phases[1].subphases).toBeUndefined()
      expect(phases[2].subphases).toBeUndefined()
      expect(phases[3].subphases).toBeUndefined()
    })
  })

  describe('buildCasePhases — missing milestones', () => {
    it('marks parent phase as isMissing when boundary milestone is absent', () => {
      // Remove incision milestone — Pre-Op and Surgical both lose a boundary
      const milestones = makeFullMilestones().filter(m => m.facility_milestone_id !== MILESTONE_IDS.incision)
      const phases = buildCasePhases(PHASE_DEFS, milestones)

      expect(phases[0].isMissing).toBe(true)
      expect(phases[0].value).toBe(0)
      expect(phases[1].isMissing).toBe(true)
      expect(phases[1].value).toBe(0)
      // Closing and Emergence still valid
      expect(phases[2].isMissing).toBe(false)
      expect(phases[3].isMissing).toBe(false)
    })

    it('omits subphase when its boundary milestone is absent', () => {
      // Remove anes_start — Anesthesia subphase should not appear
      const milestones = makeFullMilestones().filter(m => m.facility_milestone_id !== MILESTONE_IDS.anesStart)
      const phases = buildCasePhases(PHASE_DEFS, milestones)

      // Pre-Op still valid (patient_in → incision present)
      expect(phases[0].isMissing).toBe(false)
      // But Anesthesia subphase should be filtered out
      expect(phases[0].subphases).toBeUndefined()
    })

    it('handles case with zero milestones — all phases missing', () => {
      const phases = buildCasePhases(PHASE_DEFS, [])
      expect(phases).toHaveLength(4)
      phases.forEach(p => {
        expect(p.isMissing).toBe(true)
        expect(p.value).toBe(0)
        expect(p.subphases).toBeUndefined()
      })
    })
  })

  describe('buildCasePhases — empty/minimal phase definitions', () => {
    it('returns empty array when no phase definitions exist', () => {
      const phases = buildCasePhases([], makeFullMilestones())
      expect(phases).toEqual([])
    })

    it('works with a single phase definition (no subphases)', () => {
      const singlePhase: PhaseDefInput[] = [{
        id: 'phase-only',
        name: 'total',
        display_name: 'Total OR',
        display_order: 1,
        color_key: 'blue',
        parent_phase_id: null,
        start_milestone_id: MILESTONE_IDS.patientIn,
        end_milestone_id: MILESTONE_IDS.patientOut,
      }]
      const phases = buildCasePhases(singlePhase, makeFullMilestones())
      expect(phases).toHaveLength(1)
      expect(phases[0].label).toBe('Total OR')
      expect(phases[0].value).toBe(6000) // 100 min = 6000s
      expect(phases[0].subphases).toBeUndefined()
    })
  })

  describe('buildLegendItems', () => {
    it('produces parent + subphase entries in display order', () => {
      const items = buildLegendItems(PHASE_DEFS)
      expect(items).toHaveLength(5) // 4 parents + 1 subphase
      expect(items.map(i => i.label)).toEqual([
        'Pre-Op', 'Anesthesia', 'Surgical', 'Closing', 'Emergence',
      ])
    })

    it('marks subphases with isSubphase: true', () => {
      const items = buildLegendItems(PHASE_DEFS)
      expect(items[0].isSubphase).toBeUndefined() // Pre-Op is parent
      expect(items[1].isSubphase).toBe(true)       // Anesthesia is subphase
      expect(items[2].isSubphase).toBeUndefined() // Surgical is parent
    })

    it('uses correct hex colors for parents and subphases', () => {
      const items = buildLegendItems(PHASE_DEFS)
      expect(items[0].color).toBe(resolvePhaseHex('blue'))    // Pre-Op parent
      expect(items[1].color).toBe(resolveSubphaseHex('teal')) // Anesthesia subphase
      expect(items[2].color).toBe(resolvePhaseHex('green'))   // Surgical parent
    })

    it('returns empty array for empty phase definitions', () => {
      expect(buildLegendItems([])).toEqual([])
    })
  })

  describe('integration: changing facility phase configuration', () => {
    it('adding a new phase appears in both breakdown and legend', () => {
      // Add a 5th parent phase "Recovery"
      const extendedDefs: PhaseDefInput[] = [
        ...PHASE_DEFS,
        {
          id: 'phase-recovery',
          name: 'recovery',
          display_name: 'Recovery',
          display_order: 6,
          color_key: 'rose',
          parent_phase_id: null,
          start_milestone_id: MILESTONE_IDS.patientOut,
          end_milestone_id: 'ms-recovery-end',
        },
      ]

      // Case has recovery milestone
      const milestones = [
        ...makeFullMilestones(),
        { facility_milestone_id: 'ms-recovery-end', recorded_at: new Date('2026-01-15T09:00:00Z').toISOString() },
      ]

      const phases = buildCasePhases(extendedDefs, milestones)
      expect(phases).toHaveLength(5) // Now 5 parent phases
      expect(phases[4].label).toBe('Recovery')
      expect(phases[4].color).toBe(resolvePhaseHex('rose'))

      const legend = buildLegendItems(extendedDefs)
      expect(legend.find(l => l.label === 'Recovery')).toBeDefined()
    })

    it('removing a phase removes it from both breakdown and legend', () => {
      // Remove Closing phase
      const reducedDefs = PHASE_DEFS.filter(p => p.id !== 'phase-closing')
      const phases = buildCasePhases(reducedDefs, makeFullMilestones())
      expect(phases).toHaveLength(3) // Pre-Op, Surgical, Emergence
      expect(phases.map(p => p.label)).toEqual(['Pre-Op', 'Surgical', 'Emergence'])

      const legend = buildLegendItems(reducedDefs)
      expect(legend.find(l => l.label === 'Closing')).toBeUndefined()
    })

    it('adding a second subphase nests under the correct parent', () => {
      const withSecondSubphase: PhaseDefInput[] = [
        ...PHASE_DEFS,
        {
          id: 'phase-positioning',
          name: 'positioning',
          display_name: 'Positioning',
          display_order: 2,
          color_key: 'indigo',
          parent_phase_id: 'phase-preop',
          start_milestone_id: 'ms-pos-start',
          end_milestone_id: 'ms-pos-end',
        },
      ]

      const milestones = [
        ...makeFullMilestones(),
        { facility_milestone_id: 'ms-pos-start', recorded_at: new Date('2026-01-15T07:16:00Z').toISOString() },
        { facility_milestone_id: 'ms-pos-end', recorded_at: new Date('2026-01-15T07:19:00Z').toISOString() },
      ]

      const phases = buildCasePhases(withSecondSubphase, milestones)
      // Pre-Op should have 2 subphases
      expect(phases[0].subphases).toHaveLength(2)
      const subLabels = phases[0].subphases!.map(s => s.label)
      expect(subLabels).toContain('Anesthesia')
      expect(subLabels).toContain('Positioning')
    })
  })
})
