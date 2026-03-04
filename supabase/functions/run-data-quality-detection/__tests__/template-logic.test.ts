/**
 * Tests for template-driven DQ detection logic.
 *
 * The edge function runs in Deno, so we can't import from it directly.
 * Instead, we replicate the pure functions here and test the algorithms.
 * The implementations are kept in sync with index.ts.
 */
import { describe, it, expect } from 'vitest'

// ============================================
// Replicated pure functions from index.ts
// ============================================

const KNOWN_CHECK_PAIRS: [string, string][] = [
  ['patient_in', 'patient_out'],
  ['anes_start', 'anes_end'],
  ['incision', 'closing'],
  ['closing', 'closing_complete'],
]

function getExpectedMilestones(
  caseTemplateId: string | null,
  templateMap: Map<string, Set<string>>,
  defaultTemplateId: string | null
): Set<string> {
  const templateId = caseTemplateId || defaultTemplateId
  if (!templateId) return new Set()
  return templateMap.get(templateId) || new Set()
}

function buildCheckPairs(expectedMilestones: Set<string>): [string, string][] {
  return KNOWN_CHECK_PAIRS.filter(
    ([start, end]) => expectedMilestones.has(start) && expectedMilestones.has(end)
  )
}

// ============================================
// Tests
// ============================================

describe('getExpectedMilestones', () => {
  const templateMap = new Map<string, Set<string>>([
    ['tmpl-essential', new Set(['patient_in', 'patient_out'])],
    ['tmpl-full', new Set(['patient_in', 'anes_start', 'incision', 'closing', 'anes_end', 'patient_out'])],
    ['tmpl-hand-surgery', new Set(['patient_in', 'block_start', 'block_end', 'incision', 'closing', 'patient_out'])],
  ])

  it('returns milestones from the case template when set', () => {
    const result = getExpectedMilestones('tmpl-essential', templateMap, 'tmpl-full')
    expect(result).toEqual(new Set(['patient_in', 'patient_out']))
  })

  it('falls back to facility default when case template is null', () => {
    const result = getExpectedMilestones(null, templateMap, 'tmpl-full')
    expect(result).toEqual(new Set(['patient_in', 'anes_start', 'incision', 'closing', 'anes_end', 'patient_out']))
  })

  it('returns empty set when both case template and default are null', () => {
    const result = getExpectedMilestones(null, templateMap, null)
    expect(result).toEqual(new Set())
  })

  it('returns empty set when template ID is not in the map', () => {
    const result = getExpectedMilestones('tmpl-nonexistent', templateMap, null)
    expect(result).toEqual(new Set())
  })

  it('prefers case template over default even if case template is smaller', () => {
    const result = getExpectedMilestones('tmpl-essential', templateMap, 'tmpl-full')
    expect(result.size).toBe(2)
  })
})

describe('buildCheckPairs', () => {
  it('returns all pairs when all milestones are present', () => {
    const all = new Set(['patient_in', 'patient_out', 'anes_start', 'anes_end', 'incision', 'closing', 'closing_complete'])
    expect(buildCheckPairs(all)).toEqual(KNOWN_CHECK_PAIRS)
  })

  it('returns only patient_in/patient_out for Essential template (2 milestones)', () => {
    const essential = new Set(['patient_in', 'patient_out'])
    expect(buildCheckPairs(essential)).toEqual([['patient_in', 'patient_out']])
  })

  it('returns empty array when no milestones match any pair', () => {
    const custom = new Set(['block_start', 'block_end'])
    expect(buildCheckPairs(custom)).toEqual([])
  })

  it('skips pairs where only one milestone is present', () => {
    const partial = new Set(['patient_in', 'patient_out', 'anes_start']) // no anes_end
    expect(buildCheckPairs(partial)).toEqual([['patient_in', 'patient_out']])
  })

  it('includes closing pair only when closing_complete is present', () => {
    const withClosing = new Set(['patient_in', 'patient_out', 'closing', 'closing_complete'])
    const result = buildCheckPairs(withClosing)
    expect(result).toContainEqual(['patient_in', 'patient_out'])
    expect(result).toContainEqual(['closing', 'closing_complete'])
    expect(result).not.toContainEqual(['incision', 'closing']) // incision not in template
  })

  it('handles empty set', () => {
    expect(buildCheckPairs(new Set())).toEqual([])
  })
})

describe('template-driven missing milestone detection (integration logic)', () => {
  it('Essential case: only flags patient_in and patient_out as missing, not incision/closing', () => {
    const essentialTemplate = new Set(['patient_in', 'patient_out'])
    const recordedMilestones = new Set<string>() // none recorded

    const missing = [...essentialTemplate].filter(m => !recordedMilestones.has(m))

    expect(missing).toContain('patient_in')
    expect(missing).toContain('patient_out')
    expect(missing).not.toContain('incision')
    expect(missing).not.toContain('closing')
    expect(missing).toHaveLength(2)
  })

  it('Full template case: flags all 4 standard milestones when missing', () => {
    const fullTemplate = new Set(['patient_in', 'incision', 'closing', 'patient_out'])
    const recordedMilestones = new Set<string>() // none recorded

    const missing = [...fullTemplate].filter(m => !recordedMilestones.has(m))

    expect(missing).toContain('patient_in')
    expect(missing).toContain('incision')
    expect(missing).toContain('closing')
    expect(missing).toContain('patient_out')
    expect(missing).toHaveLength(4)
  })

  it('Full template with some recorded: only flags actually missing milestones', () => {
    const fullTemplate = new Set(['patient_in', 'incision', 'closing', 'patient_out'])
    const recordedMilestones = new Set(['patient_in', 'patient_out']) // only bookends

    const missing = [...fullTemplate].filter(m => !recordedMilestones.has(m))

    expect(missing).toEqual(['incision', 'closing'])
  })

  it('No template (empty set): skips missing milestone check entirely', () => {
    const noTemplate = new Set<string>()
    // This mirrors the guard: `if (statusName === 'completed' && expectedMilestones.size > 0)`
    const shouldCheck = noTemplate.size > 0
    expect(shouldCheck).toBe(false)
  })
})

describe('template-driven negative duration detection (integration logic)', () => {
  it('Essential template: only checks patient_in/patient_out pair', () => {
    const essential = new Set(['patient_in', 'patient_out'])
    const pairs = buildCheckPairs(essential)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual(['patient_in', 'patient_out'])
  })

  it('no template fallback: checks all KNOWN_CHECK_PAIRS', () => {
    // When expectedMilestones.size === 0, edge function falls back to KNOWN_CHECK_PAIRS
    // This is safe because negative duration checks only fire on actual data errors
    const expectedMilestones = new Set<string>()
    const checkPairs = expectedMilestones.size > 0
      ? buildCheckPairs(expectedMilestones)
      : KNOWN_CHECK_PAIRS
    expect(checkPairs).toEqual(KNOWN_CHECK_PAIRS)
  })
})
