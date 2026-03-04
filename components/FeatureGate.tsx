// components/FeatureGate.tsx
// Conditionally renders children based on feature access and/or subscription tier.
//
// Supports two independent gating mechanisms (can be combined):
//   1. `feature` — checks facility_features via useFeature (legacy per-feature toggle)
//   2. `requires` — checks subscription tier via UserContext (new tier system)
//
// When both are provided, BOTH must pass for children to render.

'use client'

import { type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useFeature, type FeatureName, FEATURES } from '@/lib/features/useFeature'
import { useUser } from '@/lib/UserContext'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'
import { type TierSlug, getTierName } from '@/lib/tier-config'
import Link from 'next/link'

// ============================================
// Types
// ============================================

type GateMode = 'hide' | 'lock' | 'blur' | 'locked-tab'

interface FeatureGateProps {
  children: ReactNode
  /** Legacy per-feature gate (checks facility_features table) */
  feature?: FeatureName
  /** Minimum subscription tier required */
  requires?: TierSlug
  /** How to render when access is denied (default: 'hide') */
  mode?: GateMode
  /** Content to show if feature is disabled (only used when mode='hide') */
  fallback?: ReactNode
  /** Custom upgrade message for blur/lock overlays */
  upgradeMessage?: string
  /** Show legacy upgrade prompt (feature-based, not tier-based) */
  showUpgrade?: boolean
}

// ============================================
// Component
// ============================================

/**
 * Conditionally render content based on feature access and/or subscription tier.
 *
 * Tier-based gating (new):
 *   <FeatureGate requires="professional" mode="blur">
 *     <ScoreRing />
 *   </FeatureGate>
 *
 * Feature-based gating (legacy):
 *   <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
 *     <NavItem href="/checkin">Check-In</NavItem>
 *   </FeatureGate>
 *
 * Combined (both must pass):
 *   <FeatureGate feature={FEATURES.PATIENT_CHECKIN} requires="professional" mode="blur">
 *     <CheckInContent />
 *   </FeatureGate>
 */
export function FeatureGate({
  children,
  feature,
  requires,
  mode = 'hide',
  fallback = null,
  upgradeMessage,
  showUpgrade = false,
}: FeatureGateProps) {
  // --- Feature-level check (legacy) ---
  const featureCheck = useFeatureCheck(feature)

  // --- Tier-level check ---
  const { isTierAtLeast, tierLoading } = useUser()

  // Loading state
  if (featureCheck.isLoading || (requires && tierLoading)) {
    return null
  }

  // Determine access
  const featureAllowed = feature ? featureCheck.isEnabled : true
  const tierAllowed = requires ? isTierAtLeast(requires) : true
  const isAllowed = featureAllowed && tierAllowed

  if (isAllowed) {
    return <>{children}</>
  }

  // --- Denied: render based on mode ---

  // If tier is the blocker, use tier-aware rendering
  if (requires && !tierAllowed) {
    return renderTierDenied(mode, requires, children, upgradeMessage, fallback)
  }

  // Feature-level denial (legacy path)
  if (showUpgrade && feature) {
    return <LegacyUpgradePrompt feature={feature} message={upgradeMessage} />
  }

  return <>{fallback}</>
}

// ============================================
// Mode renderers
// ============================================

function renderTierDenied(
  mode: GateMode,
  requiredTier: TierSlug,
  children: ReactNode,
  upgradeMessage?: string,
  fallback?: ReactNode,
): ReactNode {
  switch (mode) {
    case 'hide':
      return <>{fallback ?? null}</>

    case 'lock':
      return <LockedContent requiredTier={requiredTier}>{children}</LockedContent>

    case 'blur':
      return (
        <BlurredContent requiredTier={requiredTier} upgradeMessage={upgradeMessage}>
          {children}
        </BlurredContent>
      )

    case 'locked-tab':
      return <LockedTab requiredTier={requiredTier} />

    default:
      return <>{fallback ?? null}</>
  }
}

// ============================================
// Lock mode — greyed out with lock icon + tier badge
// ============================================

function LockedContent({
  requiredTier,
  children,
}: {
  requiredTier: TierSlug
  children: ReactNode
}) {
  const tierName = getTierName(requiredTier)

  return (
    <div className="relative opacity-50 pointer-events-none select-none" aria-hidden="true">
      {children}
      <div className="absolute inset-0 flex items-center justify-end gap-1.5 pr-2">
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {tierName === 'Professional' ? 'Pro' : tierName}
        </span>
      </div>
    </div>
  )
}

// ============================================
// Blur mode — blurred preview with UpgradePrompt overlay
// ============================================

function BlurredContent({
  requiredTier,
  upgradeMessage,
  children,
}: {
  requiredTier: TierSlug
  upgradeMessage?: string
  children: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Blurred content preview */}
      <div
        className="pointer-events-none select-none blur-[6px]"
        aria-hidden="true"
      >
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
        <UpgradePrompt requiredTier={requiredTier} message={upgradeMessage} />
      </div>
    </div>
  )
}

// ============================================
// Locked-tab mode — disabled tab with tooltip-style hint
// ============================================

function LockedTab({ requiredTier }: { requiredTier: TierSlug }) {
  const tierName = getTierName(requiredTier)

  return (
    <span
      className="inline-flex cursor-not-allowed items-center gap-1.5 text-sm text-slate-400"
      title={`Upgrade to ${tierName} to access this tab`}
    >
      <Lock className="h-3.5 w-3.5" />
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {tierName === 'Professional' ? 'Pro' : tierName}
      </span>
    </span>
  )
}

// ============================================
// Legacy feature-based upgrade prompt (preserved from v1)
// ============================================

function LegacyUpgradePrompt({ feature, message }: { feature: FeatureName; message?: string }) {
  const featureLabels: Record<FeatureName, string> = {
    [FEATURES.PATIENT_CHECKIN]: 'Patient Check-In',
  }

  const featureLabel = featureLabels[feature] || feature

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200">
        <Lock className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="mb-1 font-semibold text-slate-900">{featureLabel}</h3>
      <p className="mb-4 text-sm text-slate-500">
        {message || `This feature is not enabled for your facility.`}
      </p>
      <Link
        href="/settings/subscription"
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        View Available Add-Ons
      </Link>
    </div>
  )
}

// ============================================
// Internal: conditional feature hook
// ============================================

/**
 * Wraps useFeature so it returns a pass-through when no feature is specified.
 * This avoids calling the hook conditionally.
 */
function useFeatureCheck(feature?: FeatureName) {
  // Always call the hook (Rules of Hooks) — use a dummy feature name if not needed
  const hookResult = useFeature((feature ?? FEATURES.PATIENT_CHECKIN) as FeatureName)

  if (!feature) {
    return { isEnabled: true, isLoading: false }
  }

  return hookResult
}

// ============================================
// Re-exports for convenience
// ============================================

export { FEATURES }

/**
 * Trial banner component - shows countdown when feature is on trial
 */
export { TrialBanner } from '@/components/TrialBanner'
