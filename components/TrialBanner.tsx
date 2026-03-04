// components/TrialBanner.tsx
// Trial banner component - shows countdown when feature is on trial.
// Extracted from FeatureGate.tsx; re-exported there for backwards compatibility.

'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'
import { useFeature, FEATURES, type FeatureName } from '@/lib/features/useFeature'

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
    <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${
      isUrgent
        ? 'border border-amber-200 bg-amber-50'
        : 'border border-blue-200 bg-blue-50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-1.5 ${isUrgent ? 'bg-amber-100' : 'bg-blue-100'}`}>
          <Clock className={`h-4 w-4 ${isUrgent ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <span className={`text-sm font-medium ${isUrgent ? 'text-amber-900' : 'text-blue-900'}`}>
          {featureLabel} trial: {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
        </span>
      </div>
      <Link
        href="/settings/subscription"
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
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
