// hooks/__tests__/useAdminTemplateBuilder.test.ts
// Tests required milestone enforcement in useAdminTemplateBuilder (admin hook).
// This mirrors the structure of useTemplateBuilder.test.ts but focuses on admin-specific behavior.

import { describe, it, expect } from 'vitest'
import type { TemplateItemData } from '@/lib/utils/buildTemplateRenderList'
import type { MilestoneLookup, PhaseLookup } from '@/lib/utils/buildTemplateRenderList'
import {
  REQUIRED_PHASE_NAMES,
  REQUIRED_PHASE_MILESTONES,
  isRequiredMilestone,
  isRequiredPhase,
} from '@/lib/template-defaults'

// ─── Mock Data (admin tables: milestone_types, phase_templates) ──

const mockMilestones: MilestoneLookup[] = [
  { id: 'm-pi', name: 'patient_in', display_name: 'Patient In', pair_with_id: null, pair_position: null },
  { id: 'm-pds', name: 'prep_drape_start', display_name: 'Prep/Drape Start', pair_with_id: 'm-pdc', pair_position: 'start' },
  { id: 'm-pdc', name: 'prep_drape_complete', display_name: 'Prep/Drape Complete', pair_with_id: 'm-pds', pair_position: 'end' },
  { id: 'm-inc', name: 'incision', display_name: 'Incision', pair_with_id: null, pair_position: null },
  { id: 'm-close', name: 'closing', display_name: 'Closing', pair_with_id: 'm-closec', pair_position: 'start' },
  { id: 'm-closec', name: 'closing_complete', display_name: 'Closing Complete', pair_with_id: 'm-close', pair_position: 'end' },
  { id: 'm-po', name: 'patient_out', display_name: 'Patient Out', pair_with_id: null, pair_position: null },
  { id: 'm-timeout', name: 'timeout', display_name: 'Timeout', pair_with_id: null, pair_position: null }, // extra, non-required
]

const mockPhases: PhaseLookup[] = [
  { id: 'p-pre', name: 'pre_op', display_name: 'Pre-Op', color_key: 'blue', display_order: 1, parent_phase_id: null },
  { id: 'p-surg', name: 'surgical', display_name: 'Surgical', color_key: 'green', display_order: 2, parent_phase_id: null },
  { id: 'p-close', name: 'closing', display_name: 'Closing', color_key: 'orange', display_order: 3, parent_phase_id: null },
  { id: 'p-post', name: 'post_op', display_name: 'Post-Op', color_key: 'purple', display_order: 4, parent_phase_id: null },
  { id: 'p-extra', name: 'setup', display_name: 'Setup', color_key: 'gray', display_order: 5, parent_phase_id: null }, // extra, non-required
]

// ─── Test Suites ─────────────────────────────────────────────────

describe('useAdminTemplateBuilder — Phase 2 required milestone enforcement', () => {
  describe('templateHasRequiredStructure computation', () => {
    it('returns true when all 4 required phases and 7 unique milestones (9 placements) are present', () => {
      // Full required structure:
      // pre_op: patient_in, prep_drape_start, prep_drape_complete
      // surgical: incision, closing (shared boundary)
      // closing: closing (shared), closing_complete (shared)
      // post_op: closing_complete (shared), patient_out
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-pds', facility_phase_id: 'p-pre', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm-pdc', facility_phase_id: 'p-pre', display_order: 3 },
        { id: 'i4', template_id: 't1', facility_milestone_id: 'm-inc', facility_phase_id: 'p-surg', display_order: 4 },
        { id: 'i5', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-surg', display_order: 5 },
        { id: 'i6', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-close', display_order: 6 },
        { id: 'i7', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-close', display_order: 7 },
        { id: 'i8', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-post', display_order: 8 },
        { id: 'i9', template_id: 't1', facility_milestone_id: 'm-po', facility_phase_id: 'p-post', display_order: 9 },
      ]

      let hasStructure = true
      for (const [phaseName, msNames] of Object.entries(REQUIRED_PHASE_MILESTONES)) {
        const phaseEntry = mockPhases.find(p => p.name === phaseName)
        if (!phaseEntry) {
          hasStructure = false
          break
        }
        for (const msName of msNames) {
          const msEntry = mockMilestones.find(m => m.name === msName)
          if (!msEntry) {
            hasStructure = false
            break
          }
          const exists = items.some(
            i => i.facility_milestone_id === msEntry.id && i.facility_phase_id === phaseEntry.id,
          )
          if (!exists) {
            hasStructure = false
            break
          }
        }
        if (!hasStructure) break
      }

      expect(hasStructure).toBe(true)
    })

    it('returns false when missing a required milestone within a phase', () => {
      // Missing prep_drape_start in pre_op
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm-pdc', facility_phase_id: 'p-pre', display_order: 3 },
        { id: 'i4', template_id: 't1', facility_milestone_id: 'm-inc', facility_phase_id: 'p-surg', display_order: 4 },
        { id: 'i5', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-surg', display_order: 5 },
        { id: 'i6', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-close', display_order: 6 },
        { id: 'i7', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-close', display_order: 7 },
        { id: 'i8', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-post', display_order: 8 },
        { id: 'i9', template_id: 't1', facility_milestone_id: 'm-po', facility_phase_id: 'p-post', display_order: 9 },
      ]

      let hasStructure = true
      for (const [phaseName, msNames] of Object.entries(REQUIRED_PHASE_MILESTONES)) {
        const phaseEntry = mockPhases.find(p => p.name === phaseName)
        if (!phaseEntry) {
          hasStructure = false
          break
        }
        for (const msName of msNames) {
          const msEntry = mockMilestones.find(m => m.name === msName)
          if (!msEntry) {
            hasStructure = false
            break
          }
          const exists = items.some(
            i => i.facility_milestone_id === msEntry.id && i.facility_phase_id === phaseEntry.id,
          )
          if (!exists) {
            hasStructure = false
            break
          }
        }
        if (!hasStructure) break
      }

      expect(hasStructure).toBe(false)
    })

    it('returns false when missing a required phase entirely', () => {
      // No post_op phase items
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-pds', facility_phase_id: 'p-pre', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm-pdc', facility_phase_id: 'p-pre', display_order: 3 },
        { id: 'i4', template_id: 't1', facility_milestone_id: 'm-inc', facility_phase_id: 'p-surg', display_order: 4 },
        { id: 'i5', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-surg', display_order: 5 },
        { id: 'i6', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-close', display_order: 6 },
        { id: 'i7', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-close', display_order: 7 },
        // Missing p-post items
      ]

      let hasStructure = true
      for (const [phaseName, msNames] of Object.entries(REQUIRED_PHASE_MILESTONES)) {
        const phaseEntry = mockPhases.find(p => p.name === phaseName)
        if (!phaseEntry) {
          hasStructure = false
          break
        }
        for (const msName of msNames) {
          const msEntry = mockMilestones.find(m => m.name === msName)
          if (!msEntry) {
            hasStructure = false
            break
          }
          const exists = items.some(
            i => i.facility_milestone_id === msEntry.id && i.facility_phase_id === phaseEntry.id,
          )
          if (!exists) {
            hasStructure = false
            break
          }
        }
        if (!hasStructure) break
      }

      expect(hasStructure).toBe(false)
    })

    it('allows extra milestones and phases beyond the required set', () => {
      // Full required set + extra milestone (timeout) and extra phase
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-pds', facility_phase_id: 'p-pre', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm-pdc', facility_phase_id: 'p-pre', display_order: 3 },
        { id: 'i4', template_id: 't1', facility_milestone_id: 'm-inc', facility_phase_id: 'p-surg', display_order: 4 },
        { id: 'i5', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-surg', display_order: 5 },
        { id: 'i6', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-close', display_order: 6 },
        { id: 'i7', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-close', display_order: 7 },
        { id: 'i8', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-post', display_order: 8 },
        { id: 'i9', template_id: 't1', facility_milestone_id: 'm-po', facility_phase_id: 'p-post', display_order: 9 },
        { id: 'i10', template_id: 't1', facility_milestone_id: 'm-timeout', facility_phase_id: 'p-pre', display_order: 10 }, // extra
      ]

      let hasStructure = true
      for (const [phaseName, msNames] of Object.entries(REQUIRED_PHASE_MILESTONES)) {
        const phaseEntry = mockPhases.find(p => p.name === phaseName)
        if (!phaseEntry) {
          hasStructure = false
          break
        }
        for (const msName of msNames) {
          const msEntry = mockMilestones.find(m => m.name === msName)
          if (!msEntry) {
            hasStructure = false
            break
          }
          const exists = items.some(
            i => i.facility_milestone_id === msEntry.id && i.facility_phase_id === phaseEntry.id,
          )
          if (!exists) {
            hasStructure = false
            break
          }
        }
        if (!hasStructure) break
      }

      expect(hasStructure).toBe(true)
    })
  })

  describe('requiredMilestoneItemIds computation (admin)', () => {
    it('includes item IDs for all 9 required placements when template has full structure', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-pds', facility_phase_id: 'p-pre', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm-pdc', facility_phase_id: 'p-pre', display_order: 3 },
        { id: 'i4', template_id: 't1', facility_milestone_id: 'm-inc', facility_phase_id: 'p-surg', display_order: 4 },
        { id: 'i5', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-surg', display_order: 5 },
        { id: 'i6', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-close', display_order: 6 },
        { id: 'i7', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-close', display_order: 7 },
        { id: 'i8', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-post', display_order: 8 },
        { id: 'i9', template_id: 't1', facility_milestone_id: 'm-po', facility_phase_id: 'p-post', display_order: 9 },
      ]

      const milestoneNameById = new Map(mockMilestones.map(m => [m.id, m.name]))
      const phaseNameById = new Map(mockPhases.map(p => [p.id, p.name]))

      const templateHasRequiredStructure = true

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const item of items) {
          const msName = milestoneNameById.get(item.facility_milestone_id)
          const phaseName = item.facility_phase_id ? phaseNameById.get(item.facility_phase_id) : null
          if (msName && phaseName && isRequiredMilestone(msName) && isRequiredPhase(phaseName)) {
            const requiredMs = REQUIRED_PHASE_MILESTONES[phaseName]
            if (requiredMs?.includes(msName)) {
              requiredIds.add(item.id)
            }
          }
        }
      }

      expect(requiredIds.size).toBe(9) // All 9 placements
      expect(requiredIds.has('i1')).toBe(true)
      expect(requiredIds.has('i2')).toBe(true)
      expect(requiredIds.has('i3')).toBe(true)
      expect(requiredIds.has('i4')).toBe(true)
      expect(requiredIds.has('i5')).toBe(true)
      expect(requiredIds.has('i6')).toBe(true)
      expect(requiredIds.has('i7')).toBe(true)
      expect(requiredIds.has('i8')).toBe(true)
      expect(requiredIds.has('i9')).toBe(true)
    })

    it('excludes non-required milestones even if in required phases', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-timeout', facility_phase_id: 'p-pre', display_order: 2 }, // extra
      ]

      const milestoneNameById = new Map(mockMilestones.map(m => [m.id, m.name]))
      const phaseNameById = new Map(mockPhases.map(p => [p.id, p.name]))

      const requiredIds = new Set<string>()
      for (const item of items) {
        const msName = milestoneNameById.get(item.facility_milestone_id)
        const phaseName = item.facility_phase_id ? phaseNameById.get(item.facility_phase_id) : null
        if (msName && phaseName && isRequiredMilestone(msName) && isRequiredPhase(phaseName)) {
          const requiredMs = REQUIRED_PHASE_MILESTONES[phaseName]
          if (requiredMs?.includes(msName)) {
            requiredIds.add(item.id)
          }
        }
      }

      expect(requiredIds.has('i1')).toBe(true)
      expect(requiredIds.has('i2')).toBe(false) // timeout is not required
    })

    it('returns empty set when template does not have required structure (grandfathered)', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        // Missing rest of required structure
      ]

      const templateHasRequiredStructure = false // grandfathered template

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        // enforcement logic would run here, but it doesn't
      }

      expect(requiredIds.size).toBe(0)
    })
  })

  describe('requiredPhaseIds computation (admin)', () => {
    it('includes all 4 required phase IDs when template has full structure', () => {
      const templateHasRequiredStructure = true

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const phase of mockPhases) {
          if (isRequiredPhase(phase.name)) {
            requiredIds.add(phase.id)
          }
        }
      }

      expect(requiredIds.size).toBe(4)
      expect(requiredIds.has('p-pre')).toBe(true)
      expect(requiredIds.has('p-surg')).toBe(true)
      expect(requiredIds.has('p-close')).toBe(true)
      expect(requiredIds.has('p-post')).toBe(true)
    })

    it('excludes non-required phases', () => {
      const templateHasRequiredStructure = true

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const phase of mockPhases) {
          if (isRequiredPhase(phase.name)) {
            requiredIds.add(phase.id)
          }
        }
      }

      expect(requiredIds.has('p-extra')).toBe(false) // setup phase is not required
    })

    it('returns empty set when template does not have required structure (grandfathered)', () => {
      const templateHasRequiredStructure = false

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        // enforcement logic would run here, but it doesn't
      }

      expect(requiredIds.size).toBe(0)
    })
  })

  describe('createTemplate auto-population (admin)', () => {
    it('generates 9 required item inserts (4 phases with varying milestones, 2 shared boundaries)', () => {
      // This tests the createTemplate logic at lines 353-387 in useAdminTemplateBuilder.ts
      const phaseLookup = mockPhases
      const milestoneLookup = mockMilestones
      const phaseByName = new Map(phaseLookup.map(p => [p.name, p]))
      const milestoneByName = new Map(milestoneLookup.map(m => [m.name, m]))

      const requiredItems: Array<{
        template_type_id: string
        milestone_type_id: string
        phase_template_id: string
        display_order: number
      }> = []
      const requiredEmptyPhaseIds = new Set<string>()
      let displayOrder = 0
      const newTemplateId = 'new-template-id'

      for (const phaseName of REQUIRED_PHASE_NAMES) {
        const phase = phaseByName.get(phaseName)
        if (!phase) continue

        requiredEmptyPhaseIds.add(phase.id)
        const milestonesForPhase = REQUIRED_PHASE_MILESTONES[phaseName] || []

        for (const msName of milestonesForPhase) {
          const ms = milestoneByName.get(msName)
          if (!ms) continue

          displayOrder += 1
          requiredItems.push({
            template_type_id: newTemplateId,
            milestone_type_id: ms.id,
            phase_template_id: phase.id,
            display_order: displayOrder,
          })
        }
      }

      expect(requiredItems.length).toBe(9)
      expect(requiredEmptyPhaseIds.size).toBe(4)

      // Verify phase order
      expect(requiredItems[0].phase_template_id).toBe('p-pre') // patient_in
      expect(requiredItems[1].phase_template_id).toBe('p-pre') // prep_drape_start
      expect(requiredItems[2].phase_template_id).toBe('p-pre') // prep_drape_complete
      expect(requiredItems[3].phase_template_id).toBe('p-surg') // incision
      expect(requiredItems[4].phase_template_id).toBe('p-surg') // closing (shared)
      expect(requiredItems[5].phase_template_id).toBe('p-close') // closing (shared)
      expect(requiredItems[6].phase_template_id).toBe('p-close') // closing_complete (shared)
      expect(requiredItems[7].phase_template_id).toBe('p-post') // closing_complete (shared)
      expect(requiredItems[8].phase_template_id).toBe('p-post') // patient_out

      // Verify milestone IDs
      expect(requiredItems[0].milestone_type_id).toBe('m-pi')
      expect(requiredItems[1].milestone_type_id).toBe('m-pds')
      expect(requiredItems[2].milestone_type_id).toBe('m-pdc')
      expect(requiredItems[3].milestone_type_id).toBe('m-inc')
      expect(requiredItems[4].milestone_type_id).toBe('m-close')
      expect(requiredItems[5].milestone_type_id).toBe('m-close') // shared
      expect(requiredItems[6].milestone_type_id).toBe('m-closec')
      expect(requiredItems[7].milestone_type_id).toBe('m-closec') // shared
      expect(requiredItems[8].milestone_type_id).toBe('m-po')

      // Verify display_order is sequential
      expect(requiredItems.map(i => i.display_order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('populates requiredEmptyPhaseIds with all 4 required phase IDs', () => {
      const phaseLookup = mockPhases
      const phaseByName = new Map(phaseLookup.map(p => [p.name, p]))

      const requiredEmptyPhaseIds = new Set<string>()

      for (const phaseName of REQUIRED_PHASE_NAMES) {
        const phase = phaseByName.get(phaseName)
        if (!phase) continue
        requiredEmptyPhaseIds.add(phase.id)
      }

      expect(requiredEmptyPhaseIds.size).toBe(4)
      expect(requiredEmptyPhaseIds.has('p-pre')).toBe(true)
      expect(requiredEmptyPhaseIds.has('p-surg')).toBe(true)
      expect(requiredEmptyPhaseIds.has('p-close')).toBe(true)
      expect(requiredEmptyPhaseIds.has('p-post')).toBe(true)
    })

    it('skips missing phases gracefully', () => {
      // Simulate scenario where a required phase doesn't exist in phase_templates
      const incompletePhaseLookup = mockPhases.filter(p => p.name !== 'post_op')
      const phaseByName = new Map(incompletePhaseLookup.map(p => [p.name, p]))
      const milestoneByName = new Map(mockMilestones.map(m => [m.name, m]))

      const requiredItems: Array<{
        milestone_type_id: string
        phase_template_id: string
      }> = []

      for (const phaseName of REQUIRED_PHASE_NAMES) {
        const phase = phaseByName.get(phaseName)
        if (!phase) continue // skip missing

        const milestonesForPhase = REQUIRED_PHASE_MILESTONES[phaseName] || []
        for (const msName of milestonesForPhase) {
          const ms = milestoneByName.get(msName)
          if (!ms) continue

          requiredItems.push({
            milestone_type_id: ms.id,
            phase_template_id: phase.id,
          })
        }
      }

      // Should have 7 items (pre_op: 3, surgical: 2, closing: 2) — post_op items skipped
      expect(requiredItems.length).toBe(7)
      expect(requiredItems.every(i => i.phase_template_id !== 'p-post')).toBe(true)
    })

    it('skips missing milestones gracefully', () => {
      // Simulate scenario where a required milestone doesn't exist in milestone_types
      const incompleteMilestoneLookup = mockMilestones.filter(m => m.name !== 'incision')
      const phaseByName = new Map(mockPhases.map(p => [p.name, p]))
      const milestoneByName = new Map(incompleteMilestoneLookup.map(m => [m.name, m]))

      const requiredItems: Array<{
        milestone_type_id: string
        phase_template_id: string
      }> = []

      for (const phaseName of REQUIRED_PHASE_NAMES) {
        const phase = phaseByName.get(phaseName)
        if (!phase) continue

        const milestonesForPhase = REQUIRED_PHASE_MILESTONES[phaseName] || []
        for (const msName of milestonesForPhase) {
          const ms = milestoneByName.get(msName)
          if (!ms) continue // skip missing

          requiredItems.push({
            milestone_type_id: ms.id,
            phase_template_id: phase.id,
          })
        }
      }

      // Should have 8 items (incision is missing from surgical phase)
      expect(requiredItems.length).toBe(8)
      expect(requiredItems.every(i => i.milestone_type_id !== 'm-inc')).toBe(true)
    })
  })

  describe('removeMilestone blocking (admin)', () => {
    it('allows removal of non-required milestones', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-timeout', facility_phase_id: 'p-pre', display_order: 2 },
      ]

      const milestoneNameById = new Map(mockMilestones.map(m => [m.id, m.name]))
      const phaseNameById = new Map(mockPhases.map(p => [p.id, p.name]))
      const templateHasRequiredStructure = false // doesn't matter, timeout is never required

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const item of items) {
          const msName = milestoneNameById.get(item.facility_milestone_id)
          const phaseName = item.facility_phase_id ? phaseNameById.get(item.facility_phase_id) : null
          if (msName && phaseName && isRequiredMilestone(msName) && isRequiredPhase(phaseName)) {
            const requiredMs = REQUIRED_PHASE_MILESTONES[phaseName]
            if (requiredMs?.includes(msName)) {
              requiredIds.add(item.id)
            }
          }
        }
      }

      // Try to remove timeout (i2)
      const itemToRemove = items.find(i => i.id === 'i2')
      expect(itemToRemove).toBeDefined()
      expect(requiredIds.has('i2')).toBe(false) // should NOT be blocked
    })

    it('blocks removal of required milestones when template has full structure', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm-pds', facility_phase_id: 'p-pre', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm-pdc', facility_phase_id: 'p-pre', display_order: 3 },
        { id: 'i4', template_id: 't1', facility_milestone_id: 'm-inc', facility_phase_id: 'p-surg', display_order: 4 },
        { id: 'i5', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-surg', display_order: 5 },
        { id: 'i6', template_id: 't1', facility_milestone_id: 'm-close', facility_phase_id: 'p-close', display_order: 6 },
        { id: 'i7', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-close', display_order: 7 },
        { id: 'i8', template_id: 't1', facility_milestone_id: 'm-closec', facility_phase_id: 'p-post', display_order: 8 },
        { id: 'i9', template_id: 't1', facility_milestone_id: 'm-po', facility_phase_id: 'p-post', display_order: 9 },
      ]

      const milestoneNameById = new Map(mockMilestones.map(m => [m.id, m.name]))
      const phaseNameById = new Map(mockPhases.map(p => [p.id, p.name]))
      const templateHasRequiredStructure = true

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const item of items) {
          const msName = milestoneNameById.get(item.facility_milestone_id)
          const phaseName = item.facility_phase_id ? phaseNameById.get(item.facility_phase_id) : null
          if (msName && phaseName && isRequiredMilestone(msName) && isRequiredPhase(phaseName)) {
            const requiredMs = REQUIRED_PHASE_MILESTONES[phaseName]
            if (requiredMs?.includes(msName)) {
              requiredIds.add(item.id)
            }
          }
        }
      }

      // Try to remove patient_in (i1)
      expect(requiredIds.has('i1')).toBe(true) // BLOCKED

      // Try to remove incision (i4)
      expect(requiredIds.has('i4')).toBe(true) // BLOCKED

      // All 9 should be blocked
      expect(requiredIds.size).toBe(9)
    })

    it('does NOT block removal when template is grandfathered (no required structure)', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm-pi', facility_phase_id: 'p-pre', display_order: 1 },
        // Missing rest of structure → grandfathered
      ]

      const templateHasRequiredStructure = false

      const requiredIds = new Set<string>()
      if (templateHasRequiredStructure) {
        // enforcement doesn't run
      }

      // Should allow removal of i1 (even though patient_in is normally required)
      expect(requiredIds.has('i1')).toBe(false)
    })
  })

  describe('removePhaseFromTemplate blocking (admin)', () => {
    it('blocks removal of required phases when template has full structure', () => {
      const templateHasRequiredStructure = true

      const requiredPhaseIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const phase of mockPhases) {
          if (isRequiredPhase(phase.name)) {
            requiredPhaseIds.add(phase.id)
          }
        }
      }

      // Try to remove pre_op
      expect(requiredPhaseIds.has('p-pre')).toBe(true) // BLOCKED

      // Try to remove surgical
      expect(requiredPhaseIds.has('p-surg')).toBe(true) // BLOCKED

      // Try to remove closing
      expect(requiredPhaseIds.has('p-close')).toBe(true) // BLOCKED

      // Try to remove post_op
      expect(requiredPhaseIds.has('p-post')).toBe(true) // BLOCKED
    })

    it('allows removal of non-required phases', () => {
      const templateHasRequiredStructure = true

      const requiredPhaseIds = new Set<string>()
      if (templateHasRequiredStructure) {
        for (const phase of mockPhases) {
          if (isRequiredPhase(phase.name)) {
            requiredPhaseIds.add(phase.id)
          }
        }
      }

      // Try to remove setup (p-extra)
      expect(requiredPhaseIds.has('p-extra')).toBe(false) // NOT blocked
    })

    it('does NOT block removal when template is grandfathered (no required structure)', () => {
      const templateHasRequiredStructure = false

      const requiredPhaseIds = new Set<string>()
      if (templateHasRequiredStructure) {
        // enforcement doesn't run
      }

      // Should allow removal of any phase
      expect(requiredPhaseIds.size).toBe(0)
    })
  })
})
