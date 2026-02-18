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

  it('phases appears before procedure-milestones in the nav order', () => {
    const items = caseManagement!.items
    const phasesIdx = items.findIndex(i => i.id === 'phases')
    const procMilestonesIdx = items.findIndex(i => i.id === 'procedure-milestones')
    expect(phasesIdx).toBeLessThan(procMilestonesIdx)
  })

  it('getCategoryForPath returns case-management for /settings/phases', () => {
    expect(getCategoryForPath('/settings/phases')).toBe('case-management')
  })

  it('getNavItemForPath returns phases item for /settings/phases', () => {
    const item = getNavItemForPath('/settings/phases')
    expect(item).toBeDefined()
    expect(item!.id).toBe('phases')
  })
})

describe('settings nav - surgeon milestones entry', () => {
  const caseManagement = settingsCategories.find(c => c.id === 'case-management')

  it('has a surgeon-milestones nav item', () => {
    const item = caseManagement!.items.find(i => i.id === 'surgeon-milestones')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/settings/surgeon-milestones')
    expect(item!.label).toBe('Surgeon Milestones')
  })

  it('surgeon-milestones appears after surgeon-preferences in the nav order', () => {
    const items = caseManagement!.items
    const surgPrefIdx = items.findIndex(i => i.id === 'surgeon-preferences')
    const surgMsIdx = items.findIndex(i => i.id === 'surgeon-milestones')
    expect(surgMsIdx).toBeGreaterThan(surgPrefIdx)
    expect(surgMsIdx).toBe(surgPrefIdx + 1)
  })

  it('getCategoryForPath returns case-management for /settings/surgeon-milestones', () => {
    expect(getCategoryForPath('/settings/surgeon-milestones')).toBe('case-management')
  })

  it('getNavItemForPath returns surgeon-milestones item for /settings/surgeon-milestones', () => {
    const item = getNavItemForPath('/settings/surgeon-milestones')
    expect(item).toBeDefined()
    expect(item!.id).toBe('surgeon-milestones')
  })
})
