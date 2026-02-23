// lib/__tests__/settings-nav-phases.test.ts
import { describe, it, expect } from 'vitest'
import { settingsCategories, getCategoryForPath, getNavItemForPath } from '../settings-nav-config'

describe('settings nav - phases entry', () => {
  const caseManagement = settingsCategories.find(c => c.id === 'case-management')

  it('case-management category exists', () => {
    expect(caseManagement).toBeDefined()
  })

  it('has a phases nav item', () => {
    const phases = caseManagement!.items.find(i => i.id === 'phases')
    expect(phases).toBeDefined()
    expect(phases!.href).toBe('/settings/phases')
    expect(phases!.label).toBe('Phases')
  })

  it('phases appears after milestones in the nav order', () => {
    const items = caseManagement!.items
    const milestonesIdx = items.findIndex(i => i.id === 'milestones')
    const phasesIdx = items.findIndex(i => i.id === 'phases')
    expect(phasesIdx).toBeGreaterThan(milestonesIdx)
    expect(phasesIdx).toBe(milestonesIdx + 1)
  })

  it('getCategoryForPath returns case-management for /settings/phases', () => {
    expect(getCategoryForPath('/settings/phases')).toBe('case-management')
  })

  it('getNavItemForPath returns phases item for /settings/phases', () => {
    const item = getNavItemForPath('/settings/phases')
    expect(item).toBeDefined()
    expect(item!.id).toBe('phases')
  })

  it('procedure-milestones and surgeon-milestones nav items have been removed', () => {
    const procMs = caseManagement!.items.find(i => i.id === 'procedure-milestones')
    const surgMs = caseManagement!.items.find(i => i.id === 'surgeon-milestones')
    expect(procMs).toBeUndefined()
    expect(surgMs).toBeUndefined()
  })
})
