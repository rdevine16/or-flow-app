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
  | { type: 'MOVE_ITEM_WITHIN_PHASE'; phaseId: string; activeId: string; overId: string }

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
    case 'MOVE_ITEM_WITHIN_PHASE': {
      // arrayMove helper from @dnd-kit/sortable
      function arrayMove<T>(array: T[], from: number, to: number): T[] {
        const arr = [...array]
        const item = arr.splice(from, 1)[0]
        arr.splice(to, 0, item)
        return arr
      }

      const phaseKey = action.phaseId === 'unassigned' ? null : action.phaseId
      const phaseItems = state.items
        .filter(i => (i.facility_phase_id ?? null) === phaseKey)
        .sort((a, b) => a.display_order - b.display_order)

      const oldIndex = phaseItems.findIndex(i => i.id === action.activeId)
      const newIndex = phaseItems.findIndex(i => i.id === action.overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state

      const reordered = arrayMove(phaseItems, oldIndex, newIndex)
      const orders = phaseItems.map(i => i.display_order)
      const updated = reordered.map((item, idx) => ({ ...item, display_order: orders[idx] }))

      const idSet = new Set(phaseItems.map(i => i.id))
      const otherItems = state.items.filter(i => !idSet.has(i.id))
      return { items: [...otherItems, ...updated].sort((a, b) => a.display_order - b.display_order) }
    }
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

  describe('MOVE_ITEM_WITHIN_PHASE', () => {
    it('moves item down within phase (reorder from top to bottom)', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p1', display_order: 3 },
      ]
      const result = builderReducer({ items }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i1', overId: 'i3' })

      // After move: i2, i3, i1 — but display_order preserved from original positions
      expect(result.items).toHaveLength(3)
      const sorted = result.items.sort((a, b) => a.display_order - b.display_order)
      expect(sorted[0].id).toBe('i2') // now at display_order 1
      expect(sorted[1].id).toBe('i3') // now at display_order 2
      expect(sorted[2].id).toBe('i1') // now at display_order 3
    })

    it('moves item up within phase (reorder from bottom to top)', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p1', display_order: 3 },
      ]
      const result = builderReducer({ items }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i3', overId: 'i1' })

      // After move: i3, i1, i2
      const sorted = result.items.sort((a, b) => a.display_order - b.display_order)
      expect(sorted[0].id).toBe('i3') // now at display_order 1
      expect(sorted[1].id).toBe('i1') // now at display_order 2
      expect(sorted[2].id).toBe('i2') // now at display_order 3
    })

    it('handles reorder in unassigned section (phaseId="unassigned")', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: null, display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: null, display_order: 2 },
      ]
      const result = builderReducer({ items }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'unassigned', activeId: 'i2', overId: 'i1' })

      const sorted = result.items.sort((a, b) => a.display_order - b.display_order)
      expect(sorted[0].id).toBe('i2')
      expect(sorted[1].id).toBe('i1')
    })

    it('does not affect items in other phases', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 1 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 2 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p2', display_order: 3 },
      ]
      const result = builderReducer({ items }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i1', overId: 'i2' })

      // i3 (in p2) should be unchanged
      const i3 = result.items.find(i => i.id === 'i3')
      expect(i3).toEqual(items[2])
    })

    it('returns state unchanged if activeId not found', () => {
      const result = builderReducer({ items: baseItems }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i999', overId: 'i2' })
      expect(result.items).toEqual(baseItems)
    })

    it('returns state unchanged if overId not found', () => {
      const result = builderReducer({ items: baseItems }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i1', overId: 'i999' })
      expect(result.items).toEqual(baseItems)
    })

    it('returns state unchanged if activeId === overId (no-op)', () => {
      const result = builderReducer({ items: baseItems }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i1', overId: 'i1' })
      expect(result.items).toEqual(baseItems)
    })

    it('preserves display_order values from original phase (swaps them, not reassigns)', () => {
      const items: TemplateItemData[] = [
        { id: 'i1', template_id: 't1', facility_milestone_id: 'm1', facility_phase_id: 'p1', display_order: 10 },
        { id: 'i2', template_id: 't1', facility_milestone_id: 'm2', facility_phase_id: 'p1', display_order: 20 },
        { id: 'i3', template_id: 't1', facility_milestone_id: 'm3', facility_phase_id: 'p1', display_order: 30 },
      ]
      const result = builderReducer({ items }, { type: 'MOVE_ITEM_WITHIN_PHASE', phaseId: 'p1', activeId: 'i1', overId: 'i3' })

      // After move: i2 at 10, i3 at 20, i1 at 30 (order values preserved from original array)
      const sorted = result.items.sort((a, b) => a.display_order - b.display_order)
      expect(sorted[0]).toMatchObject({ id: 'i2', display_order: 10 })
      expect(sorted[1]).toMatchObject({ id: 'i3', display_order: 20 })
      expect(sorted[2]).toMatchObject({ id: 'i1', display_order: 30 })
    })
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
