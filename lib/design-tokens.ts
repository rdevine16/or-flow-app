// lib/design-tokens.ts
// Central design system tokens for ORbit
// Single source of truth for all design values

/**
 * USAGE:
 * import { tokens, statusColors, getRoleColors } from '@/lib/design-tokens'
 *
 * // In components:
 * className={statusColors.in_progress.bg}
 * className={getRoleColors('surgeon').bg}
 *
 * // Surgeon visualization:
 * import { getSurgeonColor } from '@/lib/design-tokens'
 * const color = getSurgeonColor(index)
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
  lg: '0.75rem',    // 12px — buttons, badges, inputs
  xl: '1rem',       // 16px — cards, modals, containers
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
// Canonical: blue=scheduled, green=in_progress/active,
//   slate=completed/inactive, amber=delayed/pending, red=cancelled
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
    bg: 'bg-green-50',
    bgHover: 'hover:bg-green-100',
    text: 'text-green-600',
    textDark: 'text-green-900',
    border: 'border-green-200',
    borderDark: 'border-green-300',
    dot: 'bg-green-500',
    ring: 'ring-green-500/20',
    gradient: 'bg-gradient-to-br from-green-50 to-green-100/50',
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
    text: 'text-red-600',
    textDark: 'text-red-900',
    border: 'border-red-200',
    borderDark: 'border-red-300',
    dot: 'bg-red-500',
    ring: 'ring-red-500/20',
    gradient: 'bg-gradient-to-br from-red-50 to-red-100/50',
  },
  active: {
    bg: 'bg-green-50',
    bgHover: 'hover:bg-green-100',
    text: 'text-green-600',
    textDark: 'text-green-900',
    border: 'border-green-200',
    borderDark: 'border-green-300',
    dot: 'bg-green-500',
    ring: 'ring-green-500/20',
    gradient: 'bg-gradient-to-br from-green-50 to-green-100/50',
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
  needs_validation: {
    bg: 'bg-orange-50',
    bgHover: 'hover:bg-orange-100',
    text: 'text-orange-700',
    textDark: 'text-orange-900',
    border: 'border-orange-200',
    borderDark: 'border-orange-300',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500/20',
    gradient: 'bg-gradient-to-br from-orange-50 to-orange-100/50',
  },
  on_hold: {
    bg: 'bg-slate-100',
    bgHover: 'hover:bg-slate-200',
    text: 'text-slate-500',
    textDark: 'text-slate-700',
    border: 'border-slate-200',
    borderDark: 'border-slate-300',
    dot: 'bg-slate-400',
    ring: 'ring-slate-400/20',
    gradient: 'bg-gradient-to-br from-slate-50 to-slate-100/50',
  },
} as const

// ============================================
// ALERT/NOTIFICATION COLORS
// Canonical text shades: blue-600, green-600, amber-700, red-600
// ============================================
export const alertColors = {
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    icon: 'text-blue-500',
    button: 'text-blue-600 hover:text-blue-700',
  },
  success: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
    icon: 'text-green-500',
    button: 'text-green-600 hover:text-green-700',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: 'text-amber-500',
    button: 'text-amber-600 hover:text-amber-700',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    icon: 'text-red-600',
    button: 'text-red-600 hover:text-red-700',
  },
} as const

// ============================================
// ROLE COLORS (for badges)
// Canonical: design-tokens.ts wins, 50-level bg, amber for anesthesiologist
// ============================================
export const roleColors = {
  surgeon: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  anesthesiologist: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  nurse: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  tech: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  admin: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
  },
  global_admin: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  facility_admin: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
} as const

// ============================================
// SURGEON DATA VISUALIZATION PALETTE
// Consolidated from types/block-scheduling.ts,
// hooks/useSurgeonColors.ts, app/admin/demo/page.tsx
// ============================================
export const surgeonPalette = {
  hex: [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#EF4444', // red
    '#84CC16', // lime
    '#A855F7', // violet
  ],
  tailwind: [
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
    { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' },
    { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' },
  ],
} as const

// ============================================
// COMPONENT SIZING
// ============================================
export const components = {
  button: {
    sm: { height: '32px', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    md: { height: '36px', padding: 'px-4 py-2', fontSize: 'text-sm' },
    lg: { height: '44px', padding: 'px-6 py-2.5', fontSize: 'text-base' },
  },
  input: {
    sm: { height: '32px', padding: 'px-3 py-1.5', fontSize: 'text-xs' },
    md: { height: '36px', padding: 'px-3 py-2', fontSize: 'text-sm' },
    lg: { height: '44px', padding: 'px-4 py-2.5', fontSize: 'text-base' },
  },
  table: {
    headerHeight: '36px',
    rowHeight: '40px',
    cellPaddingX: 'px-3',
    cellPaddingY: 'py-2',
  },
  badge: {
    height: '20px',
    padding: 'px-2 py-0.5',
    fontSize: 'text-xs',
  },
  card: {
    padding: 'p-4',
    gap: 'gap-6',
  },
  modal: {
    padding: 'p-6',
    maxWidth: 'max-w-lg',
  },
  sidebar: {
    width: '256px',
    itemPadding: 'px-3 py-2',
  },
} as const

// ============================================
// ACCESSIBILITY MINIMUMS
// ============================================
export const a11y = {
  minClickTarget: 32,            // px — 32px minimum for surgical users
  minTextContrast: 4.5,          // ratio for body text (WCAG AA)
  minLargeTextContrast: 3,       // ratio for 18px+ text
  minUIContrast: 3,              // ratio for UI components
  focusRingWidth: 2,             // px
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
// BUTTON VARIANT COLORS
// Single source of truth for button styles across Button, Modal.Action, EmptyState
// ============================================
export const buttonVariants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500/20 shadow-sm',
  secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-slate-500/20',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/20 shadow-sm',
  dangerGhost: 'text-red-600 hover:bg-red-50 focus:ring-red-500/20',
  warning: 'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500/20 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-500/20',
  outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500/20',
} as const

export type ButtonVariant = keyof typeof buttonVariants

// Spinner color per button variant (for proper contrast)
export const buttonSpinnerColors = {
  primary: 'white',
  secondary: 'slate',
  danger: 'white',
  dangerGhost: 'red',
  warning: 'white',
  ghost: 'slate',
  outline: 'blue',
} as const satisfies Record<ButtonVariant, string>

// ============================================
// BADGE VARIANT COLORS
// ============================================
export const badgeVariants = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
} as const

// ============================================
// METRIC / DATA VIZ COLORS
// Used by MetricCard, MetricCardCompact, StatsCard
// ============================================
export const metricColors = {
  blue: {
    gradient: 'from-blue-500 to-blue-600',
    light: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  green: {
    gradient: 'from-green-500 to-green-600',
    light: 'text-green-600',
    bg: 'bg-green-50',
  },
  amber: {
    gradient: 'from-amber-500 to-amber-600',
    light: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  red: {
    gradient: 'from-red-500 to-red-600',
    light: 'text-red-600',
    bg: 'bg-red-50',
  },
  slate: {
    gradient: 'from-slate-600 to-slate-700',
    light: 'text-slate-600',
    bg: 'bg-slate-50',
  },
} as const

// ============================================
// TREND INDICATOR COLORS
// Used by MetricCard, StatsCard for up/down/neutral trends
// ============================================
export const trendColors = {
  up: { text: 'text-green-600', bg: 'bg-green-50 text-green-600' },
  down: { text: 'text-red-600', bg: 'bg-red-50 text-red-600' },
  neutral: { text: 'text-slate-600', bg: 'bg-slate-100 text-slate-600' },
} as const

// ============================================
// SPINNER COLORS
// ============================================
export const spinnerColors = {
  blue: 'border-blue-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  slate: 'border-slate-600 border-t-transparent',
  green: 'border-green-600 border-t-transparent',
  red: 'border-red-600 border-t-transparent',
} as const

// ============================================
// SURGICAL PHASE COLORS
// Used by PhaseBadge for live case phase display
// ============================================
export const phaseColors = {
  'Patient In': { bg: 'bg-blue-500', shadow: 'shadow-blue-500/40' },
  'In Anesthesia': { bg: 'bg-amber-500', shadow: 'shadow-amber-500/40' },
  'Prepping': { bg: 'bg-purple-500', shadow: 'shadow-purple-500/40' },
  'In Surgery': { bg: 'bg-green-500', shadow: 'shadow-green-500/40' },
  'Closing': { bg: 'bg-yellow-500', shadow: 'shadow-yellow-500/40' },
  'Complete': { bg: 'bg-slate-500', shadow: 'shadow-slate-500/40' },
} as const

// ============================================
// PACE STATUS COLORS
// Used by PaceProgressBar for ahead/onPace/behind display
// ============================================
export const paceColors = {
  ahead: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    border: 'border-green-200',
    gradient: 'from-green-500 to-green-400',
  },
  onPace: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    border: 'border-blue-200',
    gradient: 'from-blue-500 to-blue-400',
  },
  slightlyBehind: {
    bg: 'bg-amber-500',
    text: 'text-amber-700',
    border: 'border-amber-200',
    gradient: 'from-amber-500 to-amber-400',
  },
  behind: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    border: 'border-red-200',
    gradient: 'from-red-500 to-red-400',
  },
} as const

// ============================================
// SEVERITY COLORS
// Used by flag rules settings (info/warning/critical)
// ============================================
export const severityColors = {
  info: { label: 'Info', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' },
  warning: { label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  critical: { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-200' },
} as const

// ============================================
// CATEGORY COLORS
// Used by cancellation reasons and flag rule categories
// ============================================
export const categoryColors = {
  patient: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  scheduling: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  clinical: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  external: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  timing: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  efficiency: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  anesthesia: { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  recovery: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  financial: { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  quality: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
} as const

// ============================================
// TRAY STATUS COLORS
// Used by device rep / tray status display
// ============================================
export const trayStatusColors = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  consignment: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  loaners_confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  delivered: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
} as const

// ============================================
// VARIANCE COLORS
// Used for actual vs expected comparisons
// ============================================
export const varianceColors = {
  good: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  bad: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
} as const

// ============================================
// CHART HEX COLORS
// Raw hex values for inline styles, SVGs, and chart libraries
// ============================================
export const chartHex = {
  /** @deprecated Use resolvePhaseHex(colorKey) from milestone-phase-config.ts instead. Will be removed once surgeon page switches to dynamic phases (Phase 3). */
  phases: {
    preOp: '#2563EB',     // blue-600
    surgical: '#60A5FA',  // blue-400
    closing: '#10B981',   // green-500
    emergence: '#FBBF24', // amber-400
  },
  /** Neutral dark text for stat numbers */
  neutral: '#0F172A',     // slate-900
  /** SVG track / background strokes */
  track: '#f1f5f9',       // slate-100
  trackDark: '#e2e8f0',   // slate-200
  /** Radial progress stroke colors (for SVG elements) */
  stroke: {
    blue: '#2563eb',      // blue-600
    green: '#10b981',     // green-500
    amber: '#f59e0b',     // amber-500
    red: '#ef4444',       // red-500
    slate: '#94a3b8',     // slate-400
    violet: '#8b5cf6',    // violet-500
  },
} as const

// ============================================
// FLAG ANALYTICS CHART COLORS
// Used by flag analytics page charts, heatmap, and breakdowns
// ============================================
export const flagChartColors = {
  /** Stacked area: auto-detected threshold flags */
  autoDetected: '#8b5cf6',  // violet-500
  /** Stacked area: user-reported delay flags */
  delays: '#f97316',        // orange-500
  /** Severity: critical flags */
  critical: '#ef4444',      // red-500
  /** Severity: warning flags */
  warning: '#f59e0b',       // amber-500
  /** Severity: info flags */
  info: '#3b82f6',          // blue-500
  /** Heatmap: FCOTS category */
  fcots: '#f43f5e',         // rose-500
  /** Heatmap: Timing category */
  timing: '#f59e0b',        // amber-500
  /** Heatmap: Turnover category */
  turnover: '#8b5cf6',      // violet-500
  /** Category: Financial flags */
  financial: '#10b981',     // emerald-500
  /** Category: Quality flags */
  quality: '#6366f1',       // indigo-500
} as const

// ============================================
// INPUT COLORS
// ============================================
export const inputColors = {
  normal: {
    border: 'border-slate-200',
    focus: 'focus:border-blue-500 focus:ring-blue-500/20',
  },
  error: {
    border: 'border-red-300',
    focus: 'focus:border-red-500 focus:ring-red-500/20',
  },
} as const

// ============================================
// TOGGLE COLORS
// ============================================
export const toggleColors = {
  checked: 'bg-blue-600',
  unchecked: 'bg-slate-300',
} as const

// ============================================
// COMBINED EXPORT
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
  components,
  a11y,
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status color classes by status string
 * @example getStatusColors('in_progress') => { bg: 'bg-green-50', ... }
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
 * Get role color classes by role string
 * @example getRoleColors('surgeon') => { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' }
 */
export function getRoleColors(role: string): { bg: string; text: string; border: string; dot: string } {
  const normalizedRole = role.toLowerCase() as keyof typeof roleColors
  return roleColors[normalizedRole] || roleColors.admin
}

/**
 * Get surgeon palette color by index (wraps around)
 * @example getSurgeonColor(0) => { hex: '#3B82F6', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' }
 */
export function getSurgeonColor(index: number) {
  return {
    hex: surgeonPalette.hex[index % surgeonPalette.hex.length],
    ...surgeonPalette.tailwind[index % surgeonPalette.tailwind.length],
  }
}

/**
 * Get next available surgeon color hex that hasn't been used
 * @example getNextSurgeonColor(new Set(['#3B82F6'])) => '#10B981'
 */
export function getNextSurgeonColor(usedColors: Set<string>): string {
  return surgeonPalette.hex.find(c => !usedColors.has(c)) || surgeonPalette.hex[0]
}

/**
 * Get pace status color classes
 * @example getPaceColors('ahead') => { bg: 'bg-green-500', text: 'text-green-600', ... }
 */
export function getPaceColors(status: keyof typeof paceColors) {
  return paceColors[status]
}

/**
 * Get variance indicator colors based on actual vs expected
 * @example getVarianceColors(actualMin, avgMin) => { bg, text, border }
 */
export function getVarianceColors(
  actualMinutes: number,
  avgMinutes: number,
  thresholds = { good: 5, warning: 15 }
): { color: keyof typeof varianceColors; bg: string; text: string; border: string } {
  const absDiff = Math.abs(actualMinutes - avgMinutes)
  if (absDiff <= thresholds.good) {
    return { color: 'good', ...varianceColors.good }
  } else if (absDiff <= thresholds.warning) {
    return { color: 'warning', ...varianceColors.warning }
  }
  return { color: 'bad', ...varianceColors.bad }
}

/**
 * Get tray status color classes
 * @example getTrayStatusColors('delivered') => { bg, text, border }
 */
export function getTrayStatusColors(status: string) {
  const normalized = status as keyof typeof trayStatusColors
  return trayStatusColors[normalized] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }
}

/**
 * Get category color classes
 * @example getCategoryColors('timing') => { bg, text, border }
 */
export function getCategoryColors(category: string) {
  const normalized = category as keyof typeof categoryColors
  return categoryColors[normalized] || { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }
}
