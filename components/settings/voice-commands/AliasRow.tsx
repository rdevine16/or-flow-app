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
      {/* Phrase — fills available space */}
      <span className="text-xs text-slate-700 flex-1 truncate">
        {alias.alias_phrase}
      </span>

      {/* Fixed-width tag columns for vertical alignment */}
      <span className="w-[46px] flex-shrink-0 text-center">
        {alias.source_alias_id && (
          <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium rounded bg-blue-50 text-blue-600 border border-blue-200">
            Global
          </span>
        )}
      </span>

      <span className="w-[62px] flex-shrink-0 text-center">
        {alias.auto_learned && (
          <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium rounded bg-purple-50 text-purple-600 border border-purple-200">
            AI Learned
          </span>
        )}
      </span>

      {/* Delete action column — fixed width for alignment */}
      <span className="w-[24px] flex-shrink-0">
        {!readOnly && !alias.source_alias_id && (
          confirmOpen ? (
            <div className="flex items-center gap-1">
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
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
              aria-label={`Delete alias "${alias.alias_phrase}"`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )
        )}
      </span>
    </div>
  )
}
