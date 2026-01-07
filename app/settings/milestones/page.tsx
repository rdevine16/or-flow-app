'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import DashboardLayout from '../../../components/layouts/DashboardLayout'
import Container from '../../../components/ui/Container'
import SettingsLayout from '../../../components/settings/SettingsLayout'
import SortableList from '../../../components/settings/SortableList'

interface MilestoneType {
  id: string
  name: string
  display_name: string
  display_order: number
}

export default function MilestonesSettingsPage() {
  const supabase = createClient()
  const [milestones, setMilestones] = useState<MilestoneType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMilestones()
  }, [])

  const fetchMilestones = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('milestone_types')
      .select('id, name, display_name, display_order')
      .order('display_order')

    setMilestones(data || [])
    setLoading(false)
  }

  const handleAdd = async (name: string, displayName: string) => {
    const maxOrder = milestones.length > 0 
      ? Math.max(...milestones.map(m => m.display_order)) 
      : 0

    const { data, error } = await supabase
      .from('milestone_types')
      .insert({
        name,
        display_name: displayName,
        display_order: maxOrder + 1,
      })
      .select()
      .single()

    if (!error && data) {
      setMilestones([...milestones, data])
    }
  }

  const handleEdit = async (id: string, name: string, displayName: string) => {
    const { error } = await supabase
      .from('milestone_types')
      .update({ display_name: displayName })
      .eq('id', id)

    if (!error) {
      setMilestones(
        milestones.map(m => m.id === id ? { ...m, display_name: displayName } : m)
      )
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('milestone_types')
      .delete()
      .eq('id', id)

    if (!error) {
      setMilestones(milestones.filter(m => m.id !== id))
    }
  }

  const handleReorder = async (newItems: MilestoneType[]) => {
    // Optimistically update UI
    setMilestones(newItems)

    // Update each item's display_order in the database
    const updates = newItems.map((item, index) =>
      supabase
        .from('milestone_types')
        .update({ display_order: index + 1 })
        .eq('id', item.id)
    )

    await Promise.all(updates)
  }

  return (
    <DashboardLayout>
      <Container className="py-8">
        <SettingsLayout
          title="Milestones"
          description="Configure the surgical milestones tracked during cases. Drag to reorder."
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : (
            <>
              {/* Info Banner */}
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Order matters!</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    The order of milestones here determines how they appear on the case tracking page.
                    Drag items to arrange them in the correct surgical workflow sequence.
                  </p>
                </div>
              </div>

              <SortableList
                items={milestones}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReorder={handleReorder}
                itemLabel="Milestone"
                showDisplayName={true}
              />
            </>
          )}
        </SettingsLayout>
      </Container>
    </DashboardLayout>
  )
}