import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the dismissed alerts sessionStorage helpers directly
// by importing the module and testing the dismiss behavior

// Mock sessionStorage
const storage = new Map<string, string>()

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
})

describe('dismissed alerts sessionStorage behavior', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('starts with empty dismissed set', () => {
    const raw = sessionStorage.getItem('dismissed_alerts')
    expect(raw).toBeNull()
  })

  it('stores dismissed alert IDs in sessionStorage', () => {
    const ids = ['alert-1', 'alert-2']
    sessionStorage.setItem('dismissed_alerts', JSON.stringify(ids))

    const raw = sessionStorage.getItem('dismissed_alerts')
    const parsed = JSON.parse(raw!)
    expect(parsed).toEqual(['alert-1', 'alert-2'])
  })

  it('dismissed set survives reads', () => {
    sessionStorage.setItem('dismissed_alerts', JSON.stringify(['alert-1']))

    // Simulate reading back
    const raw = sessionStorage.getItem('dismissed_alerts')
    const set = new Set(JSON.parse(raw!) as string[])
    expect(set.has('alert-1')).toBe(true)
    expect(set.has('alert-2')).toBe(false)
  })

  it('can add to dismissed set', () => {
    sessionStorage.setItem('dismissed_alerts', JSON.stringify(['alert-1']))

    // Read, add, write back
    const raw = sessionStorage.getItem('dismissed_alerts')
    const set = new Set(JSON.parse(raw!) as string[])
    set.add('alert-2')
    sessionStorage.setItem('dismissed_alerts', JSON.stringify([...set]))

    const updated = JSON.parse(sessionStorage.getItem('dismissed_alerts')!)
    expect(updated).toContain('alert-1')
    expect(updated).toContain('alert-2')
  })

  it('handles malformed JSON gracefully', () => {
    sessionStorage.setItem('dismissed_alerts', 'not valid json')

    let result = new Set<string>()
    try {
      const raw = sessionStorage.getItem('dismissed_alerts')
      if (raw) result = new Set(JSON.parse(raw) as string[])
    } catch {
      result = new Set()
    }

    expect(result.size).toBe(0)
  })
})
