import { describe, it, expect } from 'vitest'
import { fmtK, fmtDur, fmtTime, fmt, phaseGroupColor, formatCurrency, formatPercent, formatCompact } from '../utils'

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
