// lib/demo-outlier-engine.ts
// Standalone module with pure functions for demo data outlier generation.
// Each function determines whether an outlier fires and computes its impact.
// No shared state — all randomness is inline via Math.random().

import type { OutlierType, OutlierSetting } from '@/app/admin/demo/types'

// =====================================================
// TYPES
// =====================================================

export interface OutlierProfile {
  outliers: Record<OutlierType, OutlierSetting>
  badDaysPerMonth: number
}

// =====================================================
// CASCADE RANGE (internal — derived from late start range)
// =====================================================

/** Derive cascade delay range from the late start first-case range.
 *  Cascade per subsequent case is roughly 20-35% of the first-case range. */
function cascadeRange(lateStartSetting: OutlierSetting): { min: number; max: number } {
  return {
    min: Math.max(2, Math.round(lateStartSetting.rangeMin * 0.2)),
    max: Math.max(5, Math.round(lateStartSetting.rangeMax * 0.35)),
  }
}

// =====================================================
// RANDOM HELPERS
// =====================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shouldFire(frequencyPct: number): boolean {
  return Math.random() * 100 < frequencyPct
}

// =====================================================
// BAD DAY SCHEDULER
// =====================================================

/**
 * Pre-compute which operating dates are "bad days" for a surgeon.
 * On bad days, ALL enabled outlier types fire at 100% frequency.
 *
 * @param operatingDates All dates the surgeon operates (YYYY-MM-DD strings)
 * @param badDaysPerMonth How many bad days per month (0-3)
 * @returns Set of YYYY-MM-DD strings designated as bad days
 */
export function scheduleBadDays(
  operatingDates: string[],
  badDaysPerMonth: number,
): Set<string> {
  if (badDaysPerMonth <= 0 || operatingDates.length === 0) return new Set()

  // Group dates by month
  const byMonth = new Map<string, string[]>()
  for (const d of operatingDates) {
    const monthKey = d.slice(0, 7) // "YYYY-MM"
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, [])
    byMonth.get(monthKey)!.push(d)
  }

  const badDays = new Set<string>()
  for (const [, monthDates] of byMonth) {
    // Pick N random dates from this month
    const shuffled = [...monthDates].sort(() => Math.random() - 0.5)
    const count = Math.min(badDaysPerMonth, shuffled.length)
    for (let i = 0; i < count; i++) {
      badDays.add(shuffled[i])
    }
  }

  return badDays
}

// =====================================================
// DAY-LEVEL: LATE START
// =====================================================

/**
 * Determine if today is a late start day and compute the first-case delay.
 * Uses the user-defined rangeMin/rangeMax from the outlier setting.
 * Frequency controls % of operating days affected.
 *
 * @returns Delay in minutes for the first case (0 if no late start fires)
 */
export function computeLateStartDelay(
  profile: OutlierProfile,
  isBadDay: boolean,
): number {
  const setting = profile.outliers.lateStarts
  if (!setting.enabled) return 0

  const frequency = isBadDay ? 100 : setting.frequency

  if (!shouldFire(frequency)) return 0

  return randomInt(setting.rangeMin, setting.rangeMax)
}

/**
 * For subsequent cases on a late start day, compute additional cascade delay.
 * Cascade range is derived from the late start first-case range (~20-35%).
 *
 * @returns Additional delay in minutes for this case (0 if outlier disabled)
 */
export function computeCascadeDelay(
  profile: OutlierProfile,
  _isBadDay: boolean,
): number {
  const setting = profile.outliers.lateStarts
  if (!setting.enabled) return 0

  const range = cascadeRange(setting)
  return randomInt(range.min, range.max)
}

// =====================================================
// CASE-LEVEL: SURGICAL TIME ADJUSTMENT
// =====================================================

/**
 * Adjust a case's surgical time for Extended Phases and Fast Cases.
 * These are mutually exclusive per case: extended phases checked first.
 * Uses user-defined rangeMin/rangeMax percentages from outlier settings.
 *
 * @returns Adjusted surgical time in minutes
 */
export function adjustSurgicalTime(
  profile: OutlierProfile,
  baseSurgicalTime: number,
  isBadDay: boolean,
): number {
  const extended = profile.outliers.extendedPhases
  const fast = profile.outliers.fastCases

  // Check extended phases first (higher demo impact)
  if (extended.enabled) {
    const frequency = isBadDay ? 100 : extended.frequency

    if (shouldFire(frequency)) {
      const pct = randomInt(extended.rangeMin, extended.rangeMax) / 100
      return Math.round(baseSurgicalTime * (1 + pct))
    }
  }

  // If extended didn't fire, check fast cases
  if (fast.enabled) {
    const frequency = isBadDay ? 100 : fast.frequency

    if (shouldFire(frequency)) {
      const pct = randomInt(fast.rangeMin, fast.rangeMax) / 100
      return Math.round(baseSurgicalTime * (1 - pct))
    }
  }

  return baseSurgicalTime
}

// =====================================================
// BETWEEN CASES: TURNOVER ADJUSTMENT
// =====================================================

/**
 * Adjust turnover time between single-room cases.
 * Uses user-defined rangeMin/rangeMax minutes from outlier settings.
 * Frequency controls % of turnovers affected.
 *
 * @returns Adjusted turnover time in minutes (replaces base time when firing)
 */
export function adjustTurnoverTime(
  profile: OutlierProfile,
  baseTurnoverMinutes: number,
  isBadDay: boolean,
): number {
  const setting = profile.outliers.longTurnovers
  if (!setting.enabled) return baseTurnoverMinutes

  const frequency = isBadDay ? 100 : setting.frequency

  if (!shouldFire(frequency)) return baseTurnoverMinutes

  return randomInt(setting.rangeMin, setting.rangeMax)
}

// =====================================================
// CALLBACK DELAY (FLIP ROOM)
// =====================================================

/**
 * Compute additional callback delay for flip room transitions.
 * Uses user-defined rangeMin/rangeMax minutes from outlier settings.
 * Frequency controls % of flip transitions affected.
 *
 * @returns Extra minutes to add to callback timing (0 if not firing)
 */
export function computeCallbackDelay(
  profile: OutlierProfile,
  isBadDay: boolean,
): number {
  const setting = profile.outliers.callbackDelays
  if (!setting.enabled) return 0

  const frequency = isBadDay ? 100 : setting.frequency

  if (!shouldFire(frequency)) return 0

  return randomInt(setting.rangeMin, setting.rangeMax)
}

// =====================================================
// CONVENIENCE: CHECK IF ANY OUTLIER IS ENABLED
// =====================================================

/** Returns true if at least one outlier type is enabled in the profile */
export function hasAnyOutlierEnabled(profile: OutlierProfile): boolean {
  return Object.values(profile.outliers).some(s => s.enabled)
}
