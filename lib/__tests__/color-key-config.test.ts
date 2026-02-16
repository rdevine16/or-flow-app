// lib/__tests__/color-key-config.test.ts
import { describe, it, expect } from 'vitest'
import {
  COLOR_KEY_PALETTE,
  COLOR_KEY_MAP,
  resolveColorKey,
} from '../milestone-phase-config'

describe('COLOR_KEY_PALETTE', () => {
  it('contains exactly 8 color options', () => {
    expect(COLOR_KEY_PALETTE).toHaveLength(8)
  })

  it('includes all expected color keys', () => {
    const keys = COLOR_KEY_PALETTE.map(c => c.key)
    expect(keys).toEqual(['blue', 'green', 'amber', 'purple', 'teal', 'indigo', 'rose', 'slate'])
  })

  it('every color has all required Tailwind class fields', () => {
    for (const color of COLOR_KEY_PALETTE) {
      expect(color.key).toBeTruthy()
      expect(color.label).toBeTruthy()
      expect(color.swatch).toMatch(/^bg-/)
      expect(color.accentBg).toMatch(/^bg-/)
      expect(color.accentText).toMatch(/^text-/)
      expect(color.headerBg).toMatch(/^bg-/)
      expect(color.borderColor).toMatch(/^border-/)
    }
  })

  it('has unique keys', () => {
    const keys = COLOR_KEY_PALETTE.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('COLOR_KEY_MAP', () => {
  it('maps all palette entries by key', () => {
    for (const color of COLOR_KEY_PALETTE) {
      expect(COLOR_KEY_MAP[color.key]).toBe(color)
    }
  })
})

describe('resolveColorKey', () => {
  it('resolves known color keys', () => {
    expect(resolveColorKey('blue').key).toBe('blue')
    expect(resolveColorKey('green').label).toBe('Green')
    expect(resolveColorKey('amber').swatch).toBe('bg-amber-500')
  })

  it('falls back to slate for null', () => {
    const result = resolveColorKey(null)
    expect(result.key).toBe('slate')
  })

  it('falls back to slate for unknown key', () => {
    const result = resolveColorKey('neon_pink')
    expect(result.key).toBe('slate')
  })
})
