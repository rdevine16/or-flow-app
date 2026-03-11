// lib/roleStyles.ts
// Shared role color and abbreviation mapping for room schedule UI + PDF export

export interface RoleStyle {
  /** Short abbreviation (2-3 chars) */
  abbrev: string
  /** Tailwind bg class for the dot/circle */
  dotClass: string
  /** Tailwind bg class for the badge background */
  bgClass: string
  /** Tailwind text class */
  textClass: string
  /** RGB tuple for PDF rendering */
  pdfColor: [number, number, number]
}

const NURSE_STYLE: RoleStyle = {
  abbrev: 'RN',
  dotClass: 'bg-emerald-500',
  bgClass: 'bg-emerald-50',
  textClass: 'text-emerald-700',
  pdfColor: [16, 185, 129],
}

const SCRUB_TECH_STYLE: RoleStyle = {
  abbrev: 'ST',
  dotClass: 'bg-violet-500',
  bgClass: 'bg-violet-50',
  textClass: 'text-violet-700',
  pdfColor: [139, 92, 246],
}

const ANESTHESIA_STYLE: RoleStyle = {
  abbrev: 'AN',
  dotClass: 'bg-amber-500',
  bgClass: 'bg-amber-50',
  textClass: 'text-amber-700',
  pdfColor: [245, 158, 11],
}

const ROLE_STYLES: Record<string, RoleStyle> = {
  'circulating nurse': { ...NURSE_STYLE, abbrev: 'CN' },
  nurse: NURSE_STYLE,
  rn: NURSE_STYLE,
  'scrub tech': SCRUB_TECH_STYLE,
  st: SCRUB_TECH_STYLE,
  tech: { ...SCRUB_TECH_STYLE, abbrev: 'TC' },
  anesthesiologist: ANESTHESIA_STYLE,
  crna: { ...ANESTHESIA_STYLE, abbrev: 'CR' },
  pa: {
    abbrev: 'PA',
    dotClass: 'bg-sky-500',
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-700',
    pdfColor: [14, 165, 233],
  },
  'first assist': {
    abbrev: 'FA',
    dotClass: 'bg-teal-500',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    pdfColor: [20, 184, 166],
  },
  fa: {
    abbrev: 'FA',
    dotClass: 'bg-teal-500',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    pdfColor: [20, 184, 166],
  },
  'device rep': {
    abbrev: 'DR',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    pdfColor: [249, 115, 22],
  },
}

const DEFAULT_STYLE: RoleStyle = {
  abbrev: '??',
  dotClass: 'bg-slate-400',
  bgClass: 'bg-slate-50',
  textClass: 'text-slate-600',
  pdfColor: [148, 163, 184],
}

/** Get style config for a role name (case-insensitive lookup) */
export function getRoleStyle(roleName: string | null | undefined): RoleStyle {
  if (!roleName) return DEFAULT_STYLE
  return ROLE_STYLES[roleName.toLowerCase()] ?? DEFAULT_STYLE
}

/** Get the 2-char abbreviation for a role */
export function getRoleAbbrev(roleName: string | null | undefined): string {
  return getRoleStyle(roleName).abbrev
}

/** Get person initials from first + last name */
export function getInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const f = (firstName ?? '')[0] ?? ''
  const l = (lastName ?? '')[0] ?? ''
  return (f + l).toUpperCase() || '??'
}
