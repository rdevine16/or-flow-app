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
// MAGNITUDE → RANGE TABLES
// =====================================================

/** Helper: clamp magnitude to 1-3, return the matching range */
function magnitudeRange(
  magnitude: number,
  ranges: Record<number, { min: number; max: number }>,
): { min: number; max: number } {
  const clamped = Math.max(1, Math.min(3, Math.round(magnitude)))
  return ranges[clamped] ?? ranges[2]
}

// Late start: first case delay in minutes
const LATE_START_FIRST_CASE: Record<number, { min: number; max: number }> = {
  1: { min: 15, max: 25 },
  2: { min: 20, max: 35 },
  3: { min: 30, max: 45 },
}

// Late start: per-subsequent-case cascade in minutes
const LATE_START_CASCADE: Record<number, { min: number; max: number }> = {
  1: { min: 3, max: 8 },
  2: { min: 5, max: 12 },
  3: { min: 8, max: 15 },
}

// Long turnovers: total turnover time (vs normal 15-20 min)
const LONG_TURNOVER_TOTAL: Record<number, { min: number; max: number }> = {
  1: { min: 25, max: 35 },
  2: { min: 30, max: 45 },
  3: { min: 45, max: 60 },
}

// Extended phases: % OVER median surgical time
const EXTENDED_PHASE_PCT: Record<number, { min: number; max: number }> = {
  1: { min: 40, max: 55 },
  2: { min: 50, max: 65 },
  3: { min: 60, max: 80 },
}

// Callback delays: additional minutes added to callback timing
const CALLBACK_DELAY_MINS: Record<number, { min: number; max: number }> = {
  1: { min: 10, max: 15 },
  2: { min: 15, max: 20 },
  3: { min: 20, max: 25 },
}

// Fast cases: % FASTER than median surgical time
const FAST_CASE_PCT: Record<number, { min: number; max: number }> = {
  1: { min: 15, max: 18 },
  2: { min: 18, max: 22 },
  3: { min: 22, max: 25 },
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
 * On bad days, ALL enabled outlier types fire with maximum magnitude.
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
 * Late starts: first case 15-45 min late (scaled by magnitude).
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
  const magnitude = isBadDay ? 3 : setting.magnitude

  if (!shouldFire(frequency)) return 0

  const range = magnitudeRange(magnitude, LATE_START_FIRST_CASE)
  return randomInt(range.min, range.max)
}

/**
 * For subsequent cases on a late start day, compute additional cascade delay.
 * Each case after the first gets an extra 5-15 min delay (things don't recover).
 *
 * @returns Additional delay in minutes for this case (0 if outlier disabled)
 */
export function computeCascadeDelay(
  profile: OutlierProfile,
  isBadDay: boolean,
): number {
  const setting = profile.outliers.lateStarts
  if (!setting.enabled) return 0

  const magnitude = isBadDay ? 3 : setting.magnitude
  const range = magnitudeRange(magnitude, LATE_START_CASCADE)
  return randomInt(range.min, range.max)
}

// =====================================================
// CASE-LEVEL: SURGICAL TIME ADJUSTMENT
// =====================================================

/**
 * Adjust a case's surgical time for Extended Phases and Fast Cases.
 * These are mutually exclusive per case: extended phases checked first.
 *
 * - Extended Phases: surgical time 40-80% over median
 * - Fast Cases: surgical time 15-25% faster than median
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
    const magnitude = isBadDay ? 3 : extended.magnitude

    if (shouldFire(frequency)) {
      const pctRange = magnitudeRange(magnitude, EXTENDED_PHASE_PCT)
      const pct = randomInt(pctRange.min, pctRange.max) / 100
      return Math.round(baseSurgicalTime * (1 + pct))
    }
  }

  // If extended didn't fire, check fast cases
  if (fast.enabled) {
    const frequency = isBadDay ? 100 : fast.frequency
    const magnitude = isBadDay ? 3 : fast.magnitude

    if (shouldFire(frequency)) {
      const pctRange = magnitudeRange(magnitude, FAST_CASE_PCT)
      const pct = randomInt(pctRange.min, pctRange.max) / 100
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
 * Long turnovers: 25-60 min total (vs normal 15-20).
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
  const magnitude = isBadDay ? 3 : setting.magnitude

  if (!shouldFire(frequency)) return baseTurnoverMinutes

  const range = magnitudeRange(magnitude, LONG_TURNOVER_TOTAL)
  return randomInt(range.min, range.max)
}

// =====================================================
// CALLBACK DELAY (FLIP ROOM)
// =====================================================

/**
 * Compute additional callback delay for flip room transitions.
 * Surgeon calls back 10-25 min late when this fires.
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
  const magnitude = isBadDay ? 3 : setting.magnitude

  if (!shouldFire(frequency)) return 0

  const range = magnitudeRange(magnitude, CALLBACK_DELAY_MINS)
  return randomInt(range.min, range.max)
}

// =====================================================
// CONVENIENCE: CHECK IF ANY OUTLIER IS ENABLED
// =====================================================

/** Returns true if at least one outlier type is enabled in the profile */
export function hasAnyOutlierEnabled(profile: OutlierProfile): boolean {
  return Object.values(profile.outliers).some(s => s.enabled)
}
