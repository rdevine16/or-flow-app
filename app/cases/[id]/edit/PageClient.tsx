'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Card from '@/components/ui/Card'
import CaseForm from '@/components/cases/CaseForm'
import { ChevronLeft } from 'lucide-react'

export default function EditCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/cases')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Edit Case</h1>
          <p className="text-slate-500">Update the case details below.</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CaseForm mode="edit" caseId={id} />
      </Card>
    </DashboardLayout>
  )
}
