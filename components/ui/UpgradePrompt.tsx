// components/ui/UpgradePrompt.tsx
// Inline upgrade CTA overlay for tier-gated content.
// Used by FeatureGate in 'blur' and 'lock' modes.

'use client'

import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'
import { type TierSlug, getTierName } from '@/lib/tier-config'

interface UpgradePromptProps {
  /** The minimum tier required to access this content */
  requiredTier: TierSlug
  /** Optional message describing what the user gains */
  message?: string
  /** Compact mode for smaller containers (e.g. sidebar items) */
  compact?: boolean
}

/**
 * Inline upgrade CTA shown over blurred/locked content.
 *
 * Usage:
 *   <UpgradePrompt requiredTier="professional" />
 *   <UpgradePrompt requiredTier="enterprise" message="Unlock financial analytics" compact />
 */
export function UpgradePrompt({ requiredTier, message, compact = false }: UpgradePromptProps) {
  const tierName = getTierName(requiredTier)

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Lock className="h-3.5 w-3.5" />
        <span>Upgrade to {tierName}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
        <Lock className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">
          Upgrade to {tierName}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {message || `This feature is available on the ${tierName} plan and above.`}
        </p>
      </div>
      <Link
        href="/settings/subscription"
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        <Sparkles className="h-4 w-4" />
        View Plans
      </Link>
    </div>
  )
}
