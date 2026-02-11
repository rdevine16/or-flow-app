'use client'

import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layouts/DashboardLayout'
import Container from '@/components/ui/Container'
import Card from '@/components/ui/Card'
import CaseForm from '@/components/cases/CaseForm'
import { ChevronLeft } from 'lucide-react'

export default function NewCasePage() {
  const router = useRouter()

  return (
    <DashboardLayout>
      <Container className="py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/cases')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Create New Case</h1>
            <p className="text-slate-500">Enter the details for the new surgical case.</p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CaseForm mode="create" />
        </Card>
      </Container>
    </DashboardLayout>
  )
}