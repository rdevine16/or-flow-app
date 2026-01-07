'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import EditableList from '../../../components/settings/EditableList'

interface ProcedureType {
  id: string
  name: string
}

export default function ProceduresSettingsPage() {
  const supabase = createClient()
  const [procedures, setProcedures] = useState<ProcedureType[]>([])
  const [loading, setLoading] = useState(true)
  const facilityId = 'a1111111-1111-1111-1111-111111111111'

  useEffect(() => {
    fetchProcedures()
  }, [])

  const fetchProcedures = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('procedure_types')
      .select('id, name')
      .eq('facility_id', facilityId)
      .order('name')
    
    setProcedures(data || [])
    setLoading(false)
  }

  const handleAdd = async (name: string) => {
    const { data, error } = await supabase
      .from('procedure_types')
      .insert({ name, facility_id: facilityId })
      .select()
      .single()

    if (!error && data) {
      setProcedures([...procedures, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
  }

  const handleEdit = async (id: string, name: string) => {
    const { error } = await supabase
      .from('procedure_types')
      .update({ name })
      .eq('id', id)

    if (!error) {
      setProcedures(
        procedures
          .map(p => p.id === id ? { ...p, name } : p)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('procedure_types')
      .delete()
      .eq('id', id)

    if (!error) {
      setProcedures(procedures.filter(p => p.id !== id))
    }
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Procedure Types"
          description="Manage the surgical procedures available for case creation at your facility."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <EditableList
              items={procedures}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              itemLabel="Procedure"
              placeholder="Enter procedure name (e.g., Total Hip Replacement)"
            />
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}