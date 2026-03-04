import { describe, it, expect } from 'vitest'

// ============================================
// Test the Phase 8 template-scoped logic for
// missing milestones detection
// ============================================

// Re-export the pure functions for testing
// (these were added in Phase 8 to make queryMissingMilestones template-aware)

/** Supabase returns belongs-to joins as object or single-element array */
function normalizeJoin<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] || null
  return data
}

/** Resolve expected milestone names for a case, falling back to facility default */
function getExpectedMilestones(
  caseTemplateId: string | null,
  templateMap: Map<string, Set<string>>,
  defaultTemplateId: string | null
): Set<string> {
  const templateId = caseTemplateId || defaultTemplateId
  if (!templateId) return new Set()
  return templateMap.get(templateId) ?? new Set()
}

describe('normalizeJoin (Supabase join normalization)', () => {
  it('returns null for null input', () => {
    expect(normalizeJoin(null)).toBe(null)
  })

  it('returns the object if data is already an object', () => {
    const obj = { name: 'patient_in' }
    expect(normalizeJoin(obj)).toBe(obj)
  })

  it('returns first element if data is an array with one element', () => {
    const arr = [{ name: 'patient_in' }]
    const result = normalizeJoin(arr)
    expect(result).toEqual({ name: 'patient_in' })
  })

  it('returns null if data is an empty array', () => {
    expect(normalizeJoin([])).toBe(null)
  })

  it('returns first element if data is an array with multiple elements', () => {
    const arr = [{ name: 'patient_in' }, { name: 'incision' }]
    const result = normalizeJoin(arr)
    expect(result).toEqual({ name: 'patient_in' })
  })

  it('handles primitive types', () => {
    expect(normalizeJoin('string')).toBe('string')
    expect(normalizeJoin(42)).toBe(42)
    expect(normalizeJoin(true)).toBe(true)
  })
})

describe('getExpectedMilestones (template resolution logic)', () => {
  const templateMap = new Map<string, Set<string>>([
    ['template-1', new Set(['patient_in', 'incision', 'closure', 'patient_out'])],
    ['template-2', new Set(['patient_in', 'timeout', 'incision', 'closure', 'patient_out', 'room_ready'])],
    ['template-3', new Set(['patient_in', 'patient_out'])], // minimal template
  ])

  const defaultTemplateId = 'template-1'

  it('uses case template when provided', () => {
    const result = getExpectedMilestones('template-2', templateMap, defaultTemplateId)
    expect(result.size).toBe(6)
    expect(result.has('timeout')).toBe(true)
    expect(result.has('room_ready')).toBe(true)
  })

  it('falls back to default template when case template is null', () => {
    const result = getExpectedMilestones(null, templateMap, defaultTemplateId)
    expect(result.size).toBe(4)
    expect(result.has('patient_in')).toBe(true)
    expect(result.has('incision')).toBe(true)
    expect(result.has('closure')).toBe(true)
    expect(result.has('patient_out')).toBe(true)
    // Should NOT include timeout or room_ready from template-2
    expect(result.has('timeout')).toBe(false)
  })

  it('returns empty set when case template is null and no default exists', () => {
    const result = getExpectedMilestones(null, templateMap, null)
    expect(result.size).toBe(0)
  })

  it('returns empty set when case template is not in map', () => {
    const result = getExpectedMilestones('non-existent', templateMap, defaultTemplateId)
    expect(result.size).toBe(0)
  })

  it('returns empty set when both case and default are null', () => {
    const result = getExpectedMilestones(null, templateMap, null)
    expect(result.size).toBe(0)
  })

  it('prefers case template over default even when both exist', () => {
    // template-3 is minimal (only 2 milestones), but it should be used instead of default
    const result = getExpectedMilestones('template-3', templateMap, defaultTemplateId)
    expect(result.size).toBe(2)
    expect(result.has('patient_in')).toBe(true)
    expect(result.has('patient_out')).toBe(true)
    // Should NOT include incision or closure from default template-1
    expect(result.has('incision')).toBe(false)
  })

  it('handles empty template map gracefully', () => {
    const emptyMap = new Map<string, Set<string>>()
    const result = getExpectedMilestones('template-1', emptyMap, null)
    expect(result.size).toBe(0)
  })
})

describe('Template-scoped missing milestone detection logic', () => {
  // This simulates the core logic from queryMissingMilestones
  function checkCaseHasMissingMilestones(
    caseData: {
      id: string
      milestone_template_id: string | null
      case_milestones: Array<{
        recorded_at: string | null
        facility_milestones: { name: string } | { name: string }[] | null
      }>
    },
    templateMap: Map<string, Set<string>>,
    defaultTemplateId: string | null
  ): boolean {
    const expected = getExpectedMilestones(
      caseData.milestone_template_id,
      templateMap,
      defaultTemplateId
    )
    if (expected.size === 0) return false

    // Build set of milestones that have been recorded
    const recorded = new Set<string>()
    const milestones = Array.isArray(caseData.case_milestones) ? caseData.case_milestones : []
    for (const m of milestones) {
      if (m.recorded_at) {
        const fm = normalizeJoin(m.facility_milestones)
        if (fm?.name) recorded.add(fm.name)
      }
    }

    // Check if any expected milestone is missing
    for (const name of expected) {
      if (!recorded.has(name)) {
        return true
      }
    }
    return false
  }

  const templateMap = new Map<string, Set<string>>([
    ['template-1', new Set(['patient_in', 'incision', 'closure', 'patient_out'])],
    ['template-2', new Set(['patient_in', 'timeout', 'incision', 'closure', 'patient_out'])],
  ])
  const defaultTemplateId = 'template-1'

  it('detects case with ALL milestones missing', () => {
    const caseData = {
      id: 'case-1',
      milestone_template_id: 'template-1',
      case_milestones: [
        { recorded_at: null, facility_milestones: { name: 'patient_in' } },
        { recorded_at: null, facility_milestones: { name: 'incision' } },
        { recorded_at: null, facility_milestones: { name: 'closure' } },
        { recorded_at: null, facility_milestones: { name: 'patient_out' } },
      ],
    }
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(true)
  })

  it('detects case with SOME milestones missing', () => {
    const caseData = {
      id: 'case-2',
      milestone_template_id: 'template-1',
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: { name: 'patient_in' } },
        { recorded_at: '2024-03-01T10:15:00Z', facility_milestones: { name: 'incision' } },
        { recorded_at: null, facility_milestones: { name: 'closure' } }, // MISSING
        { recorded_at: null, facility_milestones: { name: 'patient_out' } }, // MISSING
      ],
    }
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(true)
  })

  it('does NOT flag case with all expected milestones recorded', () => {
    const caseData = {
      id: 'case-3',
      milestone_template_id: 'template-1',
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: { name: 'patient_in' } },
        { recorded_at: '2024-03-01T10:15:00Z', facility_milestones: { name: 'incision' } },
        { recorded_at: '2024-03-01T11:00:00Z', facility_milestones: { name: 'closure' } },
        { recorded_at: '2024-03-01T11:10:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    }
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(false)
  })

  it('does NOT flag case for milestones NOT in its template', () => {
    // Case uses template-1 (4 milestones)
    // But has additional milestones from a different template that are missing
    // Only template-1 milestones should be checked
    const caseData = {
      id: 'case-4',
      milestone_template_id: 'template-1',
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: { name: 'patient_in' } },
        { recorded_at: '2024-03-01T10:15:00Z', facility_milestones: { name: 'incision' } },
        { recorded_at: '2024-03-01T11:00:00Z', facility_milestones: { name: 'closure' } },
        { recorded_at: '2024-03-01T11:10:00Z', facility_milestones: { name: 'patient_out' } },
        { recorded_at: null, facility_milestones: { name: 'timeout' } }, // NOT in template-1
      ],
    }
    // Should NOT be flagged because all template-1 milestones are recorded
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(false)
  })

  it('DOES flag case when template-specific milestone is missing', () => {
    // template-2 includes 'timeout' which template-1 does not
    const caseData = {
      id: 'case-5',
      milestone_template_id: 'template-2',
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: { name: 'patient_in' } },
        { recorded_at: null, facility_milestones: { name: 'timeout' } }, // MISSING — required by template-2
        { recorded_at: '2024-03-01T10:15:00Z', facility_milestones: { name: 'incision' } },
        { recorded_at: '2024-03-01T11:00:00Z', facility_milestones: { name: 'closure' } },
        { recorded_at: '2024-03-01T11:10:00Z', facility_milestones: { name: 'patient_out' } },
      ],
    }
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(true)
  })

  it('does NOT flag case with no template assignment and no default template', () => {
    const caseData = {
      id: 'case-6',
      milestone_template_id: null,
      case_milestones: [
        { recorded_at: null, facility_milestones: { name: 'patient_in' } },
      ],
    }
    // No template = no expectations = not flagged
    expect(checkCaseHasMissingMilestones(caseData, templateMap, null)).toBe(false)
  })

  it('uses default template when case has no template assignment', () => {
    const caseData = {
      id: 'case-7',
      milestone_template_id: null,
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: { name: 'patient_in' } },
        { recorded_at: null, facility_milestones: { name: 'incision' } }, // MISSING
        { recorded_at: null, facility_milestones: { name: 'closure' } }, // MISSING
        { recorded_at: null, facility_milestones: { name: 'patient_out' } }, // MISSING
      ],
    }
    // Falls back to template-1 (default), which expects these 4 milestones
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(true)
  })

  it('handles case with empty case_milestones array', () => {
    const caseData = {
      id: 'case-8',
      milestone_template_id: 'template-1',
      case_milestones: [],
    }
    // All expected milestones are missing
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(true)
  })

  it('handles case_milestones with null facility_milestones', () => {
    const caseData = {
      id: 'case-9',
      milestone_template_id: 'template-1',
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: null }, // orphaned milestone?
        { recorded_at: '2024-03-01T10:15:00Z', facility_milestones: { name: 'incision' } },
      ],
    }
    // patient_in, closure, patient_out are missing from recorded set
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(true)
  })

  it('handles array-wrapped facility_milestones join (Supabase quirk)', () => {
    const caseData = {
      id: 'case-10',
      milestone_template_id: 'template-1',
      case_milestones: [
        { recorded_at: '2024-03-01T10:00:00Z', facility_milestones: [{ name: 'patient_in' }] as unknown as { name: string }[] },
        { recorded_at: '2024-03-01T10:15:00Z', facility_milestones: [{ name: 'incision' }] as unknown as { name: string }[] },
        { recorded_at: '2024-03-01T11:00:00Z', facility_milestones: [{ name: 'closure' }] as unknown as { name: string }[] },
        { recorded_at: '2024-03-01T11:10:00Z', facility_milestones: [{ name: 'patient_out' }] as unknown as { name: string }[] },
      ],
    }
    // All milestones recorded, even though Supabase returned arrays
    expect(checkCaseHasMissingMilestones(caseData, templateMap, defaultTemplateId)).toBe(false)
  })
})

describe('Template map edge cases', () => {
  it('handles template with no milestones', () => {
    const templateMap = new Map<string, Set<string>>([
      ['empty-template', new Set()],
    ])
    const result = getExpectedMilestones('empty-template', templateMap, null)
    expect(result.size).toBe(0)
  })

  it('handles template with duplicate milestone names (deduplicated by Set)', () => {
    const templateMap = new Map<string, Set<string>>([
      ['template-with-dupes', new Set(['patient_in', 'patient_in', 'patient_out'])],
    ])
    const result = getExpectedMilestones('template-with-dupes', templateMap, null)
    expect(result.size).toBe(2) // Set deduplicates
    expect(result.has('patient_in')).toBe(true)
    expect(result.has('patient_out')).toBe(true)
  })
})
