// lib/features/useFeature.ts
// Hook to check if a feature is enabled for the current facility

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../supabase'
import { useUser } from '../UserContext'
import { logger } from '@/lib/logger'

const log = logger('useFeature')

// Feature name constants
export const FEATURES = {
  PATIENT_CHECKIN: 'patient_checkin',
} as const

export type FeatureName = typeof FEATURES[keyof typeof FEATURES]

interface FeatureStatus {
  isEnabled: boolean
  isLoading: boolean
  trialEndsAt: Date | null
  isTrialing: boolean
  trialDaysRemaining: number | null
}

/**
 * Hook to check if a feature is enabled for the current user's facility
 * 
 * Usage:
 *   const { isEnabled, isLoading } = useFeature(FEATURES.PATIENT_CHECKIN)
 *   
 *   if (isLoading) return <Skeleton />
 *   if (!isEnabled) return <UpgradePrompt />
 *   return <FeatureContent />
 */
export function useFeature(featureName: FeatureName): FeatureStatus {
  const { userData, loading: userLoading } = useUser()
  const [status, setStatus] = useState<FeatureStatus>({
    isEnabled: false,
    isLoading: true,
    trialEndsAt: null,
    isTrialing: false,
    trialDaysRemaining: null,
  })

  useEffect(() => {
    if (userLoading) return
    
    const checkFeature = async () => {
      // Global admins always have access to all features
      if (userData?.accessLevel === 'global_admin') {
        setStatus({
          isEnabled: true,
          isLoading: false,
          trialEndsAt: null,
          isTrialing: false,
          trialDaysRemaining: null,
        })
        return
      }

      // No facility = no feature access
      if (!userData?.facilityId) {
        setStatus({
          isEnabled: false,
          isLoading: false,
          trialEndsAt: null,
          isTrialing: false,
          trialDaysRemaining: null,
        })
        return
      }

      const supabase = createClient()
      
      try {
        // Check using the database function
        const { data, error } = await supabase.rpc('facility_has_feature', {
          p_facility_id: userData.facilityId,
          p_feature_name: featureName,
        })

        if (error) {
          log.error('Feature check failed', error)
          setStatus(prev => ({ ...prev, isEnabled: false, isLoading: false }))
          return
        }

        // Also get trial info if enabled
        if (data) {
          const { data: featureData } = await supabase
            .from('facility_features')
            .select(`
              trial_ends_at,
              features!inner(name)
            `)
            .eq('facility_id', userData.facilityId)
            .eq('features.name', featureName)
            .single()

          const trialEndsAt = featureData?.trial_ends_at 
            ? new Date(featureData.trial_ends_at) 
            : null
          
          const isTrialing = trialEndsAt !== null && trialEndsAt > new Date()
          const trialDaysRemaining = isTrialing 
            ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null

          setStatus({
            isEnabled: true,
            isLoading: false,
            trialEndsAt,
            isTrialing,
            trialDaysRemaining,
          })
        } else {
          setStatus({
            isEnabled: false,
            isLoading: false,
            trialEndsAt: null,
            isTrialing: false,
            trialDaysRemaining: null,
          })
        }
      } catch (err) {
        log.error('Feature check failed', err)
        setStatus(prev => ({ ...prev, isEnabled: false, isLoading: false }))
      }
    }

    checkFeature()
  }, [featureName, userData?.facilityId, userData?.accessLevel, userLoading])

  return status
}

/**
 * Simple boolean check - useful for conditional rendering
 * Returns undefined while loading
 */
export function useHasFeature(featureName: FeatureName): boolean | undefined {
  const { isEnabled, isLoading } = useFeature(featureName)
  if (isLoading) return undefined
  return isEnabled
}