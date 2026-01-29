// components/FeatureGate.tsx
// Conditionally renders children based on feature access

'use client'

import { useFeature, FeatureName, FEATURES } from '../lib/features/useFeature'
import Link from 'next/link'

interface FeatureGateProps {
  feature: FeatureName
  children: React.ReactNode
  /** Content to show if feature is disabled (default: nothing) */
  fallback?: React.ReactNode
  /** Show upgrade prompt instead of hiding content */
  showUpgrade?: boolean
  /** Custom upgrade message */
  upgradeMessage?: string
}

/**
 * Conditionally render content based on feature access
 * 
 * Usage:
 *   <FeatureGate feature={FEATURES.PATIENT_CHECKIN}>
 *     <NavItem href="/checkin">Check-In</NavItem>
 *   </FeatureGate>
 * 
 * With fallback:
 *   <FeatureGate 
 *     feature={FEATURES.PATIENT_CHECKIN} 
 *     fallback={<DisabledNavItem />}
 *   >
 *     <NavItem href="/checkin">Check-In</NavItem>
 *   </FeatureGate>
 * 
 * With upgrade prompt:
 *   <FeatureGate 
 *     feature={FEATURES.PATIENT_CHECKIN} 
 *     showUpgrade 
 *     upgradeMessage="Enable Patient Check-In to track arrivals"
 *   >
 *     <CheckInContent />
 *   </FeatureGate>
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback = null,
  showUpgrade = false,
  upgradeMessage,
}: FeatureGateProps) {
  const { isEnabled, isLoading } = useFeature(feature)

  // While loading, show nothing (or could show skeleton)
  if (isLoading) {
    return null
  }

  // Feature is enabled - show children
  if (isEnabled) {
    return <>{children}</>
  }

  // Feature is disabled
  if (showUpgrade) {
    return <UpgradePrompt feature={feature} message={upgradeMessage} />
  }

  return <>{fallback}</>
}

/**
 * Small upgrade prompt component
 */
function UpgradePrompt({ feature, message }: { feature: FeatureName; message?: string }) {
  const featureLabels: Record<FeatureName, string> = {
    [FEATURES.PATIENT_CHECKIN]: 'Patient Check-In',
  }

  const featureLabel = featureLabels[feature] || feature

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
      <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{featureLabel}</h3>
      <p className="text-sm text-slate-500 mb-4">
        {message || `This feature is not enabled for your facility.`}
      </p>
      <Link 
        href="/settings/subscription"
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        View Available Add-Ons
      </Link>
    </div>
  )
}

/**
 * Trial banner component - shows countdown when feature is on trial
 * 
 * Usage:
 *   <TrialBanner feature={FEATURES.PATIENT_CHECKIN} />
 */
export function TrialBanner({ feature }: { feature: FeatureName }) {
  const { isEnabled, isTrialing, trialDaysRemaining } = useFeature(feature)

  if (!isEnabled || !isTrialing || trialDaysRemaining === null) {
    return null
  }

  const featureLabels: Record<FeatureName, string> = {
    [FEATURES.PATIENT_CHECKIN]: 'Patient Check-In',
  }

  const featureLabel = featureLabels[feature] || feature
  const isUrgent = trialDaysRemaining <= 3

  return (
    <div className={`rounded-lg px-4 py-3 flex items-center justify-between ${
      isUrgent 
        ? 'bg-amber-50 border border-amber-200' 
        : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${isUrgent ? 'bg-amber-100' : 'bg-blue-100'}`}>
          <svg className={`w-4 h-4 ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <span className={`text-sm font-medium ${isUrgent ? 'text-amber-900' : 'text-blue-900'}`}>
            {featureLabel} trial: {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
          </span>
        </div>
      </div>
      <Link 
        href="/settings/subscription"
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
          isUrgent
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        Upgrade Now
      </Link>
    </div>
  )
}

// Re-export FEATURES for convenience
export { FEATURES }