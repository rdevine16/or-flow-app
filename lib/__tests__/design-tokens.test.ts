import { describe, it, expect } from 'vitest'
import {
  spacing,
  radius,
  elevation,
  shadowValues,
  transition,
  transitionClasses,
  statusColors,
  alertColors,
  roleColors,
  surgeonPalette,
  paceColors,
  severityColors,
  categoryColors,
  trayStatusColors,
  varianceColors,
  chartHex,
  components,
  a11y,
  zIndex,
  typography,
  breakpoints,
  animationDuration,
  tokens,
  getStatusColors,
  getStatusLabel,
  getAlertColors,
  getRoleColors,
  getSurgeonColor,
  getNextSurgeonColor,
  getPaceColors,
  getVarianceColors,
  getTrayStatusColors,
  getCategoryColors,
} from '@/lib/design-tokens'

// ============================================
// SHAPE VALIDATION
// ============================================
describe('design-tokens shape', () => {
  it('exports all expected top-level constants', () => {
    expect(spacing).toBeDefined()
    expect(radius).toBeDefined()
    expect(elevation).toBeDefined()
    expect(shadowValues).toBeDefined()
    expect(transition).toBeDefined()
    expect(transitionClasses).toBeDefined()
    expect(statusColors).toBeDefined()
    expect(alertColors).toBeDefined()
    expect(roleColors).toBeDefined()
    expect(surgeonPalette).toBeDefined()
    expect(paceColors).toBeDefined()
    expect(severityColors).toBeDefined()
    expect(categoryColors).toBeDefined()
    expect(trayStatusColors).toBeDefined()
    expect(varianceColors).toBeDefined()
    expect(components).toBeDefined()
    expect(a11y).toBeDefined()
    expect(zIndex).toBeDefined()
    expect(typography).toBeDefined()
    expect(breakpoints).toBeDefined()
    expect(animationDuration).toBeDefined()
  })

  it('tokens combined export includes components and a11y', () => {
    expect(tokens.components).toBeDefined()
    expect(tokens.a11y).toBeDefined()
    expect(tokens.spacing).toBeDefined()
  })
})

// ============================================
// STATUS COLORS
// ============================================
describe('statusColors', () => {
  const requiredStatuses = [
    'scheduled', 'in_progress', 'completed', 'delayed',
    'cancelled', 'active', 'inactive', 'pending',
  ] as const

  it.each(requiredStatuses)('has all required properties for %s', (status) => {
    const colors = statusColors[status]
    expect(colors.bg).toBeDefined()
    expect(colors.bgHover).toBeDefined()
    expect(colors.text).toBeDefined()
    expect(colors.textDark).toBeDefined()
    expect(colors.border).toBeDefined()
    expect(colors.borderDark).toBeDefined()
    expect(colors.dot).toBeDefined()
    expect(colors.ring).toBeDefined()
    expect(colors.gradient).toBeDefined()
  })

  it('contains zero emerald references', () => {
    const allValues = Object.values(statusColors)
      .flatMap(s => Object.values(s))
      .join(' ')
    expect(allValues).not.toContain('emerald')
  })

  it('uses green for in_progress and active', () => {
    expect(statusColors.in_progress.bg).toContain('green')
    expect(statusColors.active.bg).toContain('green')
  })

  it('uses canonical text shades', () => {
    expect(statusColors.cancelled.text).toBe('text-red-600')
    expect(statusColors.in_progress.text).toBe('text-green-600')
    expect(statusColors.delayed.text).toBe('text-amber-700')
  })
})

// ============================================
// ALERT COLORS
// ============================================
describe('alertColors', () => {
  it('has all four variants', () => {
    expect(alertColors.info).toBeDefined()
    expect(alertColors.success).toBeDefined()
    expect(alertColors.warning).toBeDefined()
    expect(alertColors.error).toBeDefined()
  })

  it('uses canonical text shades', () => {
    expect(alertColors.info.text).toBe('text-blue-600')
    expect(alertColors.success.text).toBe('text-green-600')
    expect(alertColors.warning.text).toBe('text-amber-700')
    expect(alertColors.error.text).toBe('text-red-600')
  })

  it('contains zero emerald references', () => {
    const allValues = Object.values(alertColors)
      .flatMap(s => Object.values(s))
      .join(' ')
    expect(allValues).not.toContain('emerald')
  })
})

// ============================================
// ROLE COLORS
// ============================================
describe('roleColors', () => {
  const requiredRoles = [
    'surgeon', 'anesthesiologist', 'nurse', 'tech',
    'admin', 'global_admin', 'facility_admin',
  ] as const

  it.each(requiredRoles)('has bg, text, border, dot for %s', (role) => {
    const colors = roleColors[role]
    expect(colors.bg).toBeDefined()
    expect(colors.text).toBeDefined()
    expect(colors.border).toBeDefined()
    expect(colors.dot).toBeDefined()
  })

  it('uses amber (not orange) for anesthesiologist', () => {
    expect(roleColors.anesthesiologist.bg).toContain('amber')
    expect(roleColors.anesthesiologist.text).toContain('amber')
  })

  it('uses green (not emerald) for nurse', () => {
    expect(roleColors.nurse.bg).toContain('green')
    expect(roleColors.nurse.text).toContain('green')
    expect(roleColors.nurse.dot).toContain('green')
  })

  it('contains zero emerald references', () => {
    const allValues = Object.values(roleColors)
      .flatMap(s => Object.values(s))
      .join(' ')
    expect(allValues).not.toContain('emerald')
  })
})

// ============================================
// SURGEON PALETTE
// ============================================
describe('surgeonPalette', () => {
  it('has 12 hex colors', () => {
    expect(surgeonPalette.hex).toHaveLength(12)
  })

  it('has 12 tailwind color sets', () => {
    expect(surgeonPalette.tailwind).toHaveLength(12)
  })

  it('hex colors are valid hex format', () => {
    surgeonPalette.hex.forEach(hex => {
      expect(hex).toMatch(/^#[0-9A-F]{6}$/i)
    })
  })

  it('tailwind entries have bg, text, border', () => {
    surgeonPalette.tailwind.forEach(entry => {
      expect(entry.bg).toBeDefined()
      expect(entry.text).toBeDefined()
      expect(entry.border).toBeDefined()
    })
  })
})

// ============================================
// COMPONENT SIZING
// ============================================
describe('components', () => {
  it('defines button sizes', () => {
    expect(components.button.sm).toBeDefined()
    expect(components.button.md).toBeDefined()
    expect(components.button.lg).toBeDefined()
  })

  it('defines input sizes', () => {
    expect(components.input.sm).toBeDefined()
    expect(components.input.md).toBeDefined()
    expect(components.input.lg).toBeDefined()
  })

  it('defines table sizing', () => {
    expect(components.table.headerHeight).toBeDefined()
    expect(components.table.rowHeight).toBeDefined()
  })
})

// ============================================
// ACCESSIBILITY
// ============================================
describe('a11y', () => {
  it('has 32px minimum click target', () => {
    expect(a11y.minClickTarget).toBeGreaterThanOrEqual(32)
  })

  it('meets WCAG AA contrast ratios', () => {
    expect(a11y.minTextContrast).toBeGreaterThanOrEqual(4.5)
    expect(a11y.minUIContrast).toBeGreaterThanOrEqual(3)
  })
})

// ============================================
// HELPER FUNCTIONS
// ============================================
describe('getStatusColors', () => {
  it('returns correct colors for known status', () => {
    const colors = getStatusColors('in_progress')
    expect(colors.bg).toBe('bg-green-50')
  })

  it('falls back to scheduled for unknown status', () => {
    const colors = getStatusColors('unknown_status')
    expect(colors.bg).toBe('bg-blue-50')
  })

  it('is case-insensitive', () => {
    const colors = getStatusColors('IN_PROGRESS')
    expect(colors.bg).toBe('bg-green-50')
  })
})

describe('getStatusLabel', () => {
  it('converts status to readable label', () => {
    expect(getStatusLabel('in_progress')).toBe('In Progress')
    expect(getStatusLabel('scheduled')).toBe('Scheduled')
  })

  it('returns Scheduled for null', () => {
    expect(getStatusLabel(null)).toBe('Scheduled')
  })
})

describe('getAlertColors', () => {
  it('returns correct colors for each variant', () => {
    expect(getAlertColors('error').text).toBe('text-red-600')
    expect(getAlertColors('warning').text).toBe('text-amber-700')
  })
})

describe('getRoleColors', () => {
  it('returns correct colors with border property', () => {
    const colors = getRoleColors('surgeon')
    expect(colors.bg).toBe('bg-blue-50')
    expect(colors.border).toBe('border-blue-200')
    expect(colors.dot).toBe('bg-blue-500')
  })

  it('falls back to admin for unknown role', () => {
    const colors = getRoleColors('unknown_role')
    expect(colors.bg).toBe('bg-slate-100')
  })

  it('is case-insensitive', () => {
    const colors = getRoleColors('Surgeon')
    expect(colors.bg).toBe('bg-blue-50')
  })
})

describe('getSurgeonColor', () => {
  it('returns hex and tailwind classes', () => {
    const color = getSurgeonColor(0)
    expect(color.hex).toBe('#3B82F6')
    expect(color.bg).toBe('bg-blue-100')
    expect(color.text).toBe('text-blue-800')
    expect(color.border).toBe('border-blue-200')
  })

  it('wraps around for index > palette length', () => {
    const color = getSurgeonColor(12) // Should wrap to index 0
    expect(color.hex).toBe('#3B82F6')
  })
})

describe('getNextSurgeonColor', () => {
  it('returns first unused color', () => {
    const used = new Set(['#3B82F6'])
    expect(getNextSurgeonColor(used)).toBe('#10B981')
  })

  it('returns first color when all are used', () => {
    const used = new Set(surgeonPalette.hex)
    expect(getNextSurgeonColor(used)).toBe('#3B82F6')
  })

  it('returns first color for empty set', () => {
    expect(getNextSurgeonColor(new Set())).toBe('#3B82F6')
  })
})

// ============================================
// CHART HEX COLORS (Phase 10)
// ============================================
describe('chartHex', () => {
  it('has phase colors as valid hex', () => {
    for (const hex of Object.values(chartHex.phases)) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('has track and trackDark as valid hex', () => {
    expect(chartHex.track).toMatch(/^#[0-9a-f]{6}$/)
    expect(chartHex.trackDark).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('has stroke colors for common chart palettes', () => {
    const expectedKeys = ['blue', 'green', 'amber', 'red', 'slate', 'violet']
    for (const key of expectedKeys) {
      expect(chartHex.stroke[key as keyof typeof chartHex.stroke]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('neutral is valid hex', () => {
    expect(chartHex.neutral).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

// ============================================
// PACE COLORS (Phase 5)
// ============================================
describe('paceColors', () => {
  const requiredStatuses = ['ahead', 'onPace', 'slightlyBehind', 'behind'] as const

  it.each(requiredStatuses)('has bg, text, border, gradient for %s', (status) => {
    const colors = paceColors[status]
    expect(colors.bg).toBeDefined()
    expect(colors.text).toBeDefined()
    expect(colors.border).toBeDefined()
    expect(colors.gradient).toBeDefined()
  })

  it('uses green for ahead', () => {
    expect(paceColors.ahead.text).toContain('green')
  })

  it('uses blue for onPace', () => {
    expect(paceColors.onPace.text).toContain('blue')
  })

  it('uses amber for slightlyBehind', () => {
    expect(paceColors.slightlyBehind.text).toContain('amber')
  })

  it('uses red for behind', () => {
    expect(paceColors.behind.text).toContain('red')
  })
})

describe('getPaceColors', () => {
  it('returns correct colors for each status', () => {
    expect(getPaceColors('ahead')).toEqual(paceColors.ahead)
    expect(getPaceColors('behind')).toEqual(paceColors.behind)
  })
})

// ============================================
// SEVERITY COLORS (Phase 5)
// ============================================
describe('severityColors', () => {
  it('has info, warning, critical', () => {
    expect(severityColors.info).toBeDefined()
    expect(severityColors.warning).toBeDefined()
    expect(severityColors.critical).toBeDefined()
  })

  it('each severity has label, color, bg, ring', () => {
    for (const sev of Object.values(severityColors)) {
      expect(sev.label).toBeDefined()
      expect(sev.color).toBeDefined()
      expect(sev.bg).toBeDefined()
      expect(sev.ring).toBeDefined()
    }
  })
})

// ============================================
// CATEGORY COLORS (Phase 5)
// ============================================
describe('categoryColors', () => {
  const categories = ['patient', 'scheduling', 'clinical', 'external', 'timing', 'efficiency', 'anesthesia', 'recovery'] as const

  it.each(categories)('has bg, text, border for %s', (cat) => {
    const colors = categoryColors[cat]
    expect(colors.bg).toBeDefined()
    expect(colors.text).toBeDefined()
    expect(colors.border).toBeDefined()
  })
})

describe('getCategoryColors', () => {
  it('returns correct colors for known category', () => {
    const colors = getCategoryColors('timing')
    expect(colors.text).toContain('blue')
  })

  it('falls back for unknown category', () => {
    const colors = getCategoryColors('unknown')
    expect(colors.bg).toBe('bg-slate-100')
  })
})

// ============================================
// TRAY STATUS COLORS (Phase 5)
// ============================================
describe('trayStatusColors', () => {
  const statuses = ['pending', 'consignment', 'loaners_confirmed', 'delivered'] as const

  it.each(statuses)('has bg, text, border for %s', (status) => {
    const colors = trayStatusColors[status]
    expect(colors.bg).toBeDefined()
    expect(colors.text).toBeDefined()
    expect(colors.border).toBeDefined()
  })
})

describe('getTrayStatusColors', () => {
  it('returns correct colors for known status', () => {
    expect(getTrayStatusColors('delivered').text).toContain('green')
    expect(getTrayStatusColors('pending').text).toContain('amber')
  })

  it('falls back for unknown status', () => {
    const colors = getTrayStatusColors('unknown')
    expect(colors.bg).toBe('bg-slate-50')
  })
})

// ============================================
// VARIANCE COLORS (Phase 5)
// ============================================
describe('varianceColors', () => {
  it('has good, warning, bad', () => {
    expect(varianceColors.good).toBeDefined()
    expect(varianceColors.warning).toBeDefined()
    expect(varianceColors.bad).toBeDefined()
  })
})

describe('getVarianceColors', () => {
  it('returns good when within threshold', () => {
    const result = getVarianceColors(50, 52)
    expect(result.color).toBe('good')
    expect(result.text).toContain('green')
  })

  it('returns warning for moderate variance', () => {
    const result = getVarianceColors(50, 60)
    expect(result.color).toBe('warning')
    expect(result.text).toContain('amber')
  })

  it('returns bad for large variance', () => {
    const result = getVarianceColors(50, 70)
    expect(result.color).toBe('bad')
    expect(result.text).toContain('red')
  })

  it('respects custom thresholds', () => {
    const result = getVarianceColors(50, 55, { good: 10, warning: 20 })
    expect(result.color).toBe('good')
  })
})
