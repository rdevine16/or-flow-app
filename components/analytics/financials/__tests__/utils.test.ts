import { describe, it, expect } from 'vitest'
import { fmtK, fmtDur, fmtTime, fmt, phaseGroupColor, formatCurrency, formatPercent, formatCompact, normalizeJoin, median, percentile } from '../utils'

describe('fmtK', () => {
  it('formats thousands with k suffix', () => {
    expect(fmtK(4200)).toBe('$4.2k')
    expect(fmtK(1000)).toBe('$1k')
    expect(fmtK(12500)).toBe('$12.5k')
  })

  it('formats sub-thousand values without suffix', () => {
    expect(fmtK(850)).toBe('$850')
    expect(fmtK(0)).toBe('$0')
  })

  it('handles negative values', () => {
    expect(fmtK(-4200)).toBe('-$4.2k')
    expect(fmtK(-500)).toBe('-$500')
  })

  it('returns dash for null/undefined', () => {
    expect(fmtK(null)).toBe('—')
    expect(fmtK(undefined)).toBe('—')
  })
})

describe('fmtDur', () => {
  it('formats hours and minutes', () => {
    expect(fmtDur(90)).toBe('1h 30m')
    expect(fmtDur(125)).toBe('2h 5m')
  })

  it('formats minutes only when under 60', () => {
    expect(fmtDur(45)).toBe('45m')
    expect(fmtDur(0)).toBe('0m')
  })

  it('returns dash for null/undefined', () => {
    expect(fmtDur(null)).toBe('—')
    expect(fmtDur(undefined)).toBe('—')
  })
})

describe('fmtTime', () => {
  it('formats AM time', () => {
    expect(fmtTime(7, 30)).toBe('7:30 AM')
    expect(fmtTime(0, 0)).toBe('12:00 AM')
  })

  it('formats PM time', () => {
    expect(fmtTime(13, 45)).toBe('1:45 PM')
    expect(fmtTime(12, 0)).toBe('12:00 PM')
  })

  it('pads minutes with leading zero', () => {
    expect(fmtTime(8, 5)).toBe('8:05 AM')
  })
})

describe('fmt', () => {
  it('formats with dollar sign', () => {
    expect(fmt(5000)).toBe('$5,000')
    expect(fmt(1234567)).toBe('$1,234,567')
  })

  it('uses absolute value', () => {
    expect(fmt(-500)).toBe('$500')
  })

  it('returns dash for null/undefined', () => {
    expect(fmt(null)).toBe('—')
    expect(fmt(undefined)).toBe('—')
  })
})

describe('phaseGroupColor', () => {
  it('maps phase groups to colors', () => {
    expect(phaseGroupColor('pre_op')).toBe('blue')
    expect(phaseGroupColor('surgical')).toBe('green')
    expect(phaseGroupColor('closing')).toBe('amber')
    expect(phaseGroupColor('post_op')).toBe('violet')
  })

  it('defaults to blue for unknown groups', () => {
    expect(phaseGroupColor('other')).toBe('blue')
  })
})

describe('formatCurrency', () => {
  it('formats positive values', () => {
    expect(formatCurrency(1500)).toBe('$1,500')
  })

  it('wraps negative in parentheses', () => {
    expect(formatCurrency(-500)).toBe('($500)')
  })

  it('returns dash for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('formats with one decimal', () => {
    expect(formatPercent(25.678)).toBe('25.7%')
  })

  it('returns dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
})

describe('formatCompact', () => {
  it('formats millions', () => {
    expect(formatCompact(1500000)).toBe('$1.5M')
  })

  it('formats thousands', () => {
    expect(formatCompact(45000)).toBe('$45K')
  })

  it('falls back to currency for small values', () => {
    expect(formatCompact(500)).toBe('$500')
  })

  it('handles negatives', () => {
    expect(formatCompact(-2500000)).toBe('-$2.5M')
  })
})

describe('normalizeJoin', () => {
  it('extracts first element from array', () => {
    const data = [{ id: 1, name: 'first' }, { id: 2, name: 'second' }]
    expect(normalizeJoin(data)).toEqual({ id: 1, name: 'first' })
  })

  it('returns single object as-is', () => {
    const data = { id: 1, name: 'single' }
    expect(normalizeJoin(data)).toEqual({ id: 1, name: 'single' })
  })

  it('returns null for empty array', () => {
    expect(normalizeJoin([])).toBeNull()
  })

  it('returns null for null input', () => {
    expect(normalizeJoin(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(normalizeJoin(undefined)).toBeNull()
  })
})

describe('median', () => {
  it('computes median for odd count', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([10, 5, 15, 20, 8])).toBe(10)
  })

  it('computes median for even count (average of two middle values)', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([10, 20])).toBe(15)
  })

  it('returns single value for single-element array', () => {
    expect(median([42])).toBe(42)
  })

  it('returns null for empty array', () => {
    expect(median([])).toBeNull()
  })

  it('handles unsorted input correctly', () => {
    expect(median([100, 1, 50, 25, 75])).toBe(50)
  })

  it('handles duplicate values', () => {
    expect(median([5, 5, 5, 5])).toBe(5)
  })
})

describe('percentile', () => {
  it('computes 50th percentile (median) for odd count', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3)
  })

  it('computes 50th percentile (median) for even count', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
  })

  it('computes 25th percentile (first quartile)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 25)).toBe(2.75)
  })

  it('computes 75th percentile (third quartile)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 75)).toBe(6.25)
  })

  it('computes 0th percentile (minimum)', () => {
    expect(percentile([10, 20, 30], 0)).toBe(10)
  })

  it('computes 100th percentile (maximum)', () => {
    expect(percentile([10, 20, 30], 100)).toBe(30)
  })

  it('returns null for empty array', () => {
    expect(percentile([], 50)).toBeNull()
  })

  it('returns single value for single-element array', () => {
    expect(percentile([42], 50)).toBe(42)
  })

  it('handles unsorted input correctly', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
  })

  it('interpolates between values when index is fractional', () => {
    // For [1,2,3,4], 75th percentile: index = 0.75 * 3 = 2.25
    // Interpolates between index 2 (value 3) and index 3 (value 4)
    // Result: 3 + 0.25 * (4 - 3) = 3.25
    const result = percentile([1, 2, 3, 4], 75)
    expect(result).toBe(3.25)
  })
})
