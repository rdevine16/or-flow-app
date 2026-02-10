// lib/design-tokens.ts
// Central design system tokens for ORbit
// Single source of truth for all design values

/**
 * USAGE:
 * import { tokens, statusColors } from '@/lib/design-tokens'
 * 
 * // In components:
 * className={`${tokens.spacing.md} ${tokens.radius.lg}`}
 * className={statusColors.in_progress.bg}
 */

// ============================================
// SPACING SYSTEM
// ============================================
export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
  '4xl': '6rem',    // 96px
} as const

// ============================================
// BORDER RADIUS
// ============================================
export const radius = {
  none: '0',
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const

// ============================================
// ELEVATION (SHADOWS)
// ============================================
export const elevation = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
} as const

export const shadowValues = {
  none: '0 0 #0000',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const

// ============================================
// TRANSITIONS
// ============================================
export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slowest: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const

export const transitionClasses = {
  fast: 'transition-all duration-150 ease-out',
  base: 'transition-all duration-200 ease-out',
  slow: 'transition-all duration-300 ease-out',
  colors: 'transition-colors duration-200 ease-out',
  transform: 'transition-transform duration-200 ease-out',
} as const

// ============================================
// STATUS COLORS (Unified across app)
// ============================================
export const statusColors = {
  scheduled: {
    bg: 'bg-blue-50',
    bgHover: 'hover:bg-blue-100',
    text: 'text-blue-700',
    textDark: 'text-blue-900',
    border: 'border-blue-200',
    borderDark: 'border-blue-300',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/20',
    gradient: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
  },
  in_progress: {
    bg: 'bg-emerald-50',
    bgHover: 'hover:bg-emerald-100',
    text: 'text-emerald-700',
    textDark: 'text-emerald-900',
    border: 'border-emerald-200',
    borderDark: 'border-emerald-300',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
    gradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
  },
  completed: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    text: 'text-slate-600',
    textDark: 'text-slate-900',
    border: 'border-slate-200',
    borderDark: 'border-slate-300',
    dot: 'bg-slate-400',
    ring: 'ring-slate-500/20',
    gradient: 'bg-gradient-to-br from-slate-50 to-slate-100/50',
  },
  delayed: {
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    text: 'text-amber-700',
    textDark: 'text-amber-900',
    border: 'border-amber-200',
    borderDark: 'border-amber-300',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
  },
  cancelled: {
    bg: 'bg-red-50',
    bgHover: 'hover:bg-red-100',
    text: 'text-red-700',
    textDark: 'text-red-900',
    border: 'border-red-200',
    borderDark: 'border-red-300',
    dot: 'bg-red-500',
    ring: 'ring-red-500/20',
    gradient: 'bg-gradient-to-br from-red-50 to-red-100/50',
  },
  active: {
    bg: 'bg-emerald-50',
    bgHover: 'hover:bg-emerald-100',
    text: 'text-emerald-700',
    textDark: 'text-emerald-900',
    border: 'border-emerald-200',
    borderDark: 'border-emerald-300',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
    gradient: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
  },
  inactive: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    text: 'text-slate-600',
    textDark: 'text-slate-900',
    border: 'border-slate-200',
    borderDark: 'border-slate-300',
    dot: 'bg-slate-400',
    ring: 'ring-slate-500/20',
    gradient: 'bg-gradient-to-br from-slate-50 to-slate-100/50',
  },
  pending: {
    bg: 'bg-amber-50',
    bgHover: 'hover:bg-amber-100',
    text: 'text-amber-700',
    textDark: 'text-amber-900',
    border: 'border-amber-200',
    borderDark: 'border-amber-300',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    gradient: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
  },
} as const

// ============================================
// ALERT/NOTIFICATION COLORS
// ============================================
export const alertColors = {
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    button: 'text-blue-600 hover:text-blue-700',
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    icon: 'text-green-500',
    button: 'text-green-600 hover:text-green-700',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    button: 'text-amber-600 hover:text-amber-700',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: 'text-red-500',
    button: 'text-red-600 hover:text-red-700',
  },
} as const

// ============================================
// ROLE COLORS (for badges)
// ============================================
export const roleColors = {
  surgeon: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  anesthesiologist: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  nurse: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  tech: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
  },
  admin: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
  },
  global_admin: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
  facility_admin: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
  },
} as const

// ============================================
// Z-INDEX SCALE
// ============================================
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const

// ============================================
// TYPOGRAPHY
// ============================================
export const typography = {
  fontFamily: {
    sans: 'var(--font-geist-sans)',
    mono: 'var(--font-geist-mono)',
  },
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const

// ============================================
// BREAKPOINTS (for responsive design)
// ============================================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// ============================================
// ANIMATION DURATIONS
// ============================================
export const animationDuration = {
  instant: '0ms',
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
  slower: '500ms',
  slowest: '700ms',
} as const

// ============================================
// EXPORT ALL AS DEFAULT
// ============================================
export const tokens = {
  spacing,
  radius,
  elevation,
  shadowValues,
  transition,
  transitionClasses,
  zIndex,
  typography,
  breakpoints,
  animationDuration,
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status color classes by status string
 * @example getStatusColors('in_progress') => { bg: 'bg-emerald-50', ... }
 */
export function getStatusColors(status: string) {
  const normalizedStatus = status.toLowerCase() as keyof typeof statusColors
  return statusColors[normalizedStatus] || statusColors.scheduled
}

/**
 * Get a human-readable label for a case status
 * @example getStatusLabel('in_progress') => 'In Progress'
 * @example getStatusLabel(null) => 'Scheduled'
 */
export function getStatusLabel(status: string | null): string {
  if (!status) return 'Scheduled'
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Get alert color classes by variant
 * @example getAlertColors('error') => { bg: 'bg-red-50', ... }
 */
export function getAlertColors(variant: keyof typeof alertColors) {
  return alertColors[variant]
}

/**
 * Get role color classes by role
 * @example getRoleColors('surgeon') => { bg: 'bg-blue-50', ... }
 */
export function getRoleColors(role: string) {
  const normalizedRole = role.toLowerCase() as keyof typeof roleColors
  return roleColors[normalizedRole] || roleColors.admin
}
