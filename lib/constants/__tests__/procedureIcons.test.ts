import { describe, it, expect } from 'vitest'
import { Bone, Hand, Eye, Heart, Ear, Scissors, Cross } from 'lucide-react'
import { PROCEDURE_ICON_MAP, PROCEDURE_ICON_FALLBACK, getProcedureIcon } from '../procedureIcons'

describe('procedureIcons constants', () => {
  it('exports a non-empty icon map', () => {
    expect(Object.keys(PROCEDURE_ICON_MAP).length).toBeGreaterThan(0)
  })

  it('maps orthopedic categories to Bone icon', () => {
    expect(PROCEDURE_ICON_MAP['orthopedic']).toBe(Bone)
    expect(PROCEDURE_ICON_MAP['joint']).toBe(Bone)
    expect(PROCEDURE_ICON_MAP['spine']).toBe(Bone)
  })

  it('maps hand categories to Hand icon', () => {
    expect(PROCEDURE_ICON_MAP['hand']).toBe(Hand)
    expect(PROCEDURE_ICON_MAP['hand/wrist']).toBe(Hand)
  })

  it('maps ophthalmology to Eye icon', () => {
    expect(PROCEDURE_ICON_MAP['ophthalmology']).toBe(Eye)
  })

  it('maps cardiac to Heart icon', () => {
    expect(PROCEDURE_ICON_MAP['cardiac']).toBe(Heart)
  })

  it('maps ENT to Ear icon', () => {
    expect(PROCEDURE_ICON_MAP['ent']).toBe(Ear)
  })

  it('maps general surgery to Scissors icon', () => {
    expect(PROCEDURE_ICON_MAP['general']).toBe(Scissors)
  })

  it('fallback icon is Cross', () => {
    expect(PROCEDURE_ICON_FALLBACK).toBe(Cross)
  })
})

describe('getProcedureIcon', () => {
  it('returns correct icon for known category', () => {
    expect(getProcedureIcon('Orthopedic')).toBe(Bone)
    expect(getProcedureIcon('CARDIAC')).toBe(Heart)
    expect(getProcedureIcon('ent')).toBe(Ear)
  })

  it('returns fallback for unknown category', () => {
    expect(getProcedureIcon('unknown_category')).toBe(Cross)
  })

  it('returns fallback for null/undefined', () => {
    expect(getProcedureIcon(null)).toBe(Cross)
    expect(getProcedureIcon(undefined)).toBe(Cross)
  })

  it('is case-insensitive', () => {
    expect(getProcedureIcon('OPHTHALMOLOGY')).toBe(Eye)
    expect(getProcedureIcon('Hand')).toBe(Hand)
    expect(getProcedureIcon('General Surgery')).toBe(Scissors)
  })
})
