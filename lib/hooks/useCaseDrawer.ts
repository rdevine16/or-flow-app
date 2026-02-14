// lib/hooks/useCaseDrawer.ts
// Data fetching hook for the Case Drawer.
// Fetches full case detail via casesDAL.getById when a case is selected.

'use client'

import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { casesDAL, type CaseDetail } from '@/lib/dal/cases'

export interface UseCaseDrawerReturn {
  caseDetail: CaseDetail | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCaseDrawer(caseId: string | null): UseCaseDrawerReturn {
  const { data, loading, error, refetch } = useSupabaseQuery<CaseDetail>(
    async (supabase) => {
      if (!caseId) return null as unknown as CaseDetail
      const { data: detail, error: fetchError } = await casesDAL.getById(supabase, caseId)
      if (fetchError) throw fetchError
      return detail as CaseDetail
    },
    {
      deps: [caseId],
      enabled: !!caseId,
    }
  )

  return {
    caseDetail: data,
    loading,
    error,
    refetch,
  }
}
