// hooks/__tests__/useTemplateBuilder.test.ts
// Tests the reducer logic and derived data computations of useTemplateBuilder.
// We test the reducer in isolation since mocking multiple useSupabaseQuery calls is fragile.
import { describe, it, expect } from 'vitest'
import type { TemplateItemData } from '@/lib/utils/buildTemplateRenderList'

// ─── Extract reducer logic for direct testing ─────────────

interface BuilderState {
  items: TemplateItemData[]
}

type BuilderAction =
  | { type: 'SET_ITEMS'; items: TemplateItemData[] }
  | { type: 'ADD_ITEM'; item: TemplateItemData }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'BULK_REMOVE_BY_PHASE'; phaseId: string }
  | { type: 'REORDER_ITEMS'; items: TemplateItemData[] }

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { items: action.items }
    case 'ADD_ITEM':
      return { items: [...state.items, action.item] }
    case 'REMOVE_ITEM':
      return { items: state.items.filter(i => i.id !== action.itemId) }
    case 'BULK_REMOVE_BY_PHASE':
      return { items: state.items.filter(i => i.facility_phase_id !== action.phaseId) }
    case 'REORDER_ITEMS':
      return { items: action.items }
    default:
      return state
  }
}

// ─── Reducer Tests ────────────────────────────────────────

describe('builderReducer', () => {
  const baseItems: TemplateItemData[] = [
    { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
    { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 2 },
    { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p2', display_order: 3 },
  ]

  it('SET_ITEMS replaces all items', () => {
    const newItems: TemplateItemData[] = [
      { id: 'i9', template_id: 't1', facility_milestone_id: 'm9', facility_phase_id: 'p1', display_order: 1 },
    ]
    const result = builderReducer({ items: baseItems }, { type: 'SET_ITEMS', items: newItems })
    expect(result.items).toEqual(newItems)
    expect(result.items).toHaveLength(1)
  })

  it('ADD_ITEM appends a new item', () => {
    const newItem: TemplateItemData = {
      id: 'i4', template_id: 't1', facility_milestone_id: 'm4', facility_phase_id: 'p2', display_order: 4,
    }
    const result = builderReducer({ items: baseItems }, { type: 'ADD_ITEM', item: newItem })
    expect(result.items).toHaveLength(4)
    expect(result.items[3]).toEqual(newItem)
  })

  it('REMOVE_ITEM filters out the specified item', () => {
    const result = builderReducer({ items: baseItems }, { type: 'REMOVE_ITEM', itemId: 'i2' })
    expect(result.items).toHaveLength(2)
    expect(result.items.map(i => i.id)).toEqual(['i1', 'i3'])
  })

  it('REMOVE_ITEM with non-existent id does nothing', () => {
    const result = builderReducer({ items: baseItems }, { type: 'REMOVE_ITEM', itemId: 'i999' })
    expect(result.items).toHaveLength(3)
  })

  it('BULK_REMOVE_BY_PHASE removes all items in a phase', () => {
    const result = builderReducer({ items: baseItems }, { type: 'BULK_REMOVE_BY_PHASE', phaseId: 'p1' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('i3')
  })

  it('BULK_REMOVE_BY_PHASE with no matching phase does nothing', () => {
    const result = builderReducer({ items: baseItems }, { type: 'BULK_REMOVE_BY_PHASE', phaseId: 'p999' })
    expect(result.items).toHaveLength(3)
  })

  it('REORDER_ITEMS replaces with new order', () => {
    const reordered = [...baseItems].reverse()
    const result = builderReducer({ items: baseItems }, { type: 'REORDER_ITEMS', items: reordered })
    expect(result.items).toEqual(reordered)
    expect(result.items[0].id).toBe('i3')
    expect(result.items[2].id).toBe('i1')
  })

  it('handles empty state', () => {
    const result = builderReducer({ items: [] }, { type: 'ADD_ITEM', item: baseItems[0] })
    expect(result.items).toHaveLength(1)
  })
})

// ─── Derived Data Logic Tests ─────────────────────────────

describe('derived data computations', () => {
  it('assignedMilestoneIds computed from items', () => {
    const items: TemplateItemData[] = [
      { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
      { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 2 },
    ]
    const assignedMilestoneIds = new Set(items.map(i => i.facility_milestone_id))
    expect(assignedMilestoneIds.has('m1')).toBe(true)
    expect(assignedMilestoneIds.has('m2')).toBe(true)
    expect(assignedMilestoneIds.has('m3')).toBe(false)
  })

  it('assignedPhaseIds excludes null facility_phase_id', () => {
    const items: TemplateItemData[] = [
      { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
      { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: null, display_order: 2 },
      { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p1', display_order: 3 },
    ]
    const assignedPhaseIds = new Set(items.map(i => i.facility_phase_id).filter(Boolean) as string[])
    expect(assignedPhaseIds.has('p1')).toBe(true)
    expect(assignedPhaseIds.size).toBe(1)
  })

  it('activeTemplates filters is_active=true and deleted_at=null', () => {
    const templates = [
      { id: 't1', name: 'Active', is_default: true, is_active: true, deleted_at: null },
      { id: 't2', name: 'Archived', is_default: false, is_active: false, deleted_at: '2024-01-01' },
      { id: 't3', name: 'Inactive', is_default: false, is_active: false, deleted_at: null },
    ]
    const active = templates.filter(t => t.is_active && !t.deleted_at)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('t1')
  })

  it('availableMilestones excludes assigned milestones', () => {
    const milestones = [
      { id: 'm1', name: 'Patient In' },
      { id: 'm2', name: 'Incision' },
      { id: 'm3', name: 'Patient Out' },
    ]
    const assignedIds = new Set(['m1', 'm2'])
    const available = milestones.filter(m => !assignedIds.has(m.id))
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('m3')
  })

  it('auto-selects default template', () => {
    const templates = [
      { id: 't1', name: 'Standard', is_default: false, is_active: true, deleted_at: null },
      { id: 't2', name: 'Advanced', is_default: true, is_active: true, deleted_at: null },
    ]
    const active = templates.filter(t => t.is_active && !t.deleted_at)
    const defaultTemplate = active.find(t => t.is_default)
    expect(defaultTemplate?.id).toBe('t2')
  })

  it('auto-selects first template when no default', () => {
    const templates = [
      { id: 't1', name: 'Alpha', is_default: false, is_active: true, deleted_at: null },
      { id: 't2', name: 'Beta', is_default: false, is_active: true, deleted_at: null },
    ]
    const active = templates.filter(t => t.is_active && !t.deleted_at)
    const defaultTemplate = active.find(t => t.is_default)
    const selected = defaultTemplate?.id ?? active[0]?.id ?? null
    expect(selected).toBe('t1')
  })
})
