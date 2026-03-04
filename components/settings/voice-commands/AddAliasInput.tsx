'use client'

import { useState, useRef } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { voiceCommandsDAL } from '@/lib/dal/voice-commands'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface AddAliasInputProps {
  /** The action_type for new aliases in this section */
  actionType: string
  /** milestone_type_id — used for global templates (facility_id=NULL) */
  milestoneTypeId: string | null
  /** facility_milestone_id — used for facility-scoped aliases */
  facilityMilestoneId?: string | null
  /** facility_id for facility-scoped aliases, null for global templates */
  facilityId: string | null
  /** Called after a successful add to refresh the alias list */
  onAdded: () => void
}

export function AddAliasInput({
  actionType,
  milestoneTypeId,
  facilityMilestoneId = null,
  facilityId,
  onAdded,
}: AddAliasInputProps) {
  const [phrase, setPhrase] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const handleAdd = async () => {
    const trimmed = phrase.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      const supabase = createClient()

      // Check for duplicates across all objectives in this scope
      const { data: existing, error: checkError } = await voiceCommandsDAL.checkDuplicate(
        supabase,
        trimmed,
        actionType,
        facilityId,
      )

      if (checkError) {
        showToast({ type: 'error', title: 'Failed to check duplicates', message: checkError.message })
        return
      }

      if (existing) {
        showToast({
          type: 'warning',
          title: 'Duplicate phrase',
          message: `"${trimmed}" is already used for ${existing.action_type} (${existing.milestone_type_id ? 'milestone' : 'action'})`,
        })
        return
      }

      // Insert the new alias
      // Global templates use milestone_type_id; facility aliases use facility_milestone_id
      const { error: insertError } = await voiceCommandsDAL.addAlias(supabase, {
        facility_id: facilityId,
        milestone_type_id: facilityId ? null : milestoneTypeId,
        facility_milestone_id: facilityId ? facilityMilestoneId : null,
        alias_phrase: trimmed,
        action_type: actionType,
      })

      if (insertError) {
        showToast({ type: 'error', title: 'Failed to add alias', message: insertError.message })
        return
      }

      showToast({ type: 'success', title: 'Alias added' })
      setPhrase('')
      onAdded()
      inputRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'Escape') {
      setPhrase('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <input
        ref={inputRef}
        type="text"
        placeholder="Add voice phrase..."
        value={phrase}
        onChange={(e) => setPhrase(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="flex-1 px-2.5 py-1.5 text-xs bg-white rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleAdd}
        disabled={saving || !phrase.trim()}
        className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
        Add
      </button>
    </div>
  )
}
