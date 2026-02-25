'use client'

import { Suspense } from 'react'
import DataQualityPage from '@/components/data-quality/DataQualityPage'

export default function DataQualityRoute() {
  return (
    <Suspense>
      <DataQualityPage />
    </Suspense>
  )
}
