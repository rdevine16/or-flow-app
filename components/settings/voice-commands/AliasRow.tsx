'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { VoiceCommandAlias } from '@/lib/dal/voice-commands'

interface AliasRowProps {
  alias: VoiceCommandAlias
  onDelete: (aliasId: string) => Promise<void>
  readOnly?: boolean
}

export function AliasRow({ alias, onDelete, readOnly = false }: AliasRowProps) {
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(alias.id)
    } finally {
      setDeleting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="group flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white transition-colors">
      <span className="text-xs text-slate-700 flex-1 truncate">
        {alias.alias_phrase}
      </span>

      {alias.auto_learned && (
        <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-purple-50 text-purple-600 border border-purple-200 flex-shrink-0">
          AI Learned
        </span>
      )}

      {!readOnly && (
        confirmOpen ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {deleting ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmOpen(true)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
            aria-label={`Delete alias "${alias.alias_phrase}"`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )
      )}
    </div>
  )
}
