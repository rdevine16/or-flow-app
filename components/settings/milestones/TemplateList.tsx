// components/settings/milestones/TemplateList.tsx
// Left column of the template builder: searchable template list with CRUD actions.
'use client'

import { useState, useMemo } from 'react'
import type { MilestoneTemplate } from '@/hooks/useTemplateBuilder'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Plus, Copy, Star, Archive } from 'lucide-react'

interface TemplateListProps {
  templates: MilestoneTemplate[]
  selectedTemplateId: string | null
  procedureCounts: Record<string, number>
  saving: boolean
  onSelect: (id: string) => void
  onCreate: (name: string, description: string) => void
  onDuplicate: (id: string) => void
  onSetDefault: (id: string) => void
  onArchive: (id: string) => Promise<{ blocked: boolean; reason?: string }>
}

export function TemplateList({
  templates,
  selectedTemplateId,
  procedureCounts,
  saving,
  onSelect,
  onCreate,
  onDuplicate,
  onSetDefault,
  onArchive,
}: TemplateListProps) {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [archiveModal, setArchiveModal] = useState<{
    isOpen: boolean
    templateId: string | null
    templateName: string
    blockReason: string | null
  }>({
    isOpen: false,
    templateId: null,
    templateName: '',
    blockReason: null,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase()
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    )
  }, [templates, search])

  const handleArchiveClick = async (template: MilestoneTemplate) => {
    const result = await onArchive(template.id)
    if (result.blocked) {
      setArchiveModal({
        isOpen: true,
        templateId: null,
        templateName: template.name,
        blockReason: result.reason || 'Cannot archive this template.',
      })
    }
  }

  return (
    <div className="w-[200px] min-w-[200px] border-r border-slate-200 flex flex-col">
      {/* Search + Create */}
      <div className="p-2 pb-1.5 space-y-1.5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search..."
          className="h-8 text-xs"
        />
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Template
        </button>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs text-slate-400">
            {search ? 'No templates match.' : 'No templates yet.'}
          </div>
        ) : (
          filtered.map(template => {
            const isSelected = template.id === selectedTemplateId
            const procCount = procedureCounts[template.id] || 0

            return (
              <div
                key={template.id}
                onClick={() => onSelect(template.id)}
                className={`
                  group relative px-2 py-1.5 rounded-md mb-0.5 cursor-pointer transition-all
                  ${isSelected
                    ? 'border-[1.5px] border-blue-500 bg-blue-50/60'
                    : 'border-[1.5px] border-transparent hover:bg-slate-50'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  {/* Default indicator bar */}
                  <div className={`w-[3px] h-[18px] rounded-sm flex-shrink-0 ${
                    template.is_default ? 'bg-blue-500' : 'bg-slate-200'
                  }`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs truncate ${
                        isSelected ? 'font-semibold' : 'font-medium'
                      } text-slate-900`}>
                        {template.name}
                      </span>
                      {template.is_default && (
                        <span className="text-[8px] font-bold text-blue-600 bg-blue-100 px-1 py-[1px] rounded flex-shrink-0">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {procCount > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {procCount} procedure{procCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                {isSelected && (
                  <div className="flex items-center gap-0.5 mt-1 ml-[11px]">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(template.id) }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {!template.is_default && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSetDefault(template.id) }}
                        className="p-1 text-slate-400 hover:text-amber-500 rounded transition-colors"
                        title="Set as default"
                      >
                        <Star className="w-3 h-3" />
                      </button>
                    )}
                    {!template.is_default && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchiveClick(template) }}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="Archive"
                      >
                        <Archive className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Create Modal */}
      <CreateTemplateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={onCreate}
        saving={saving}
      />

      {/* Block reason dialog */}
      <ConfirmDialog
        open={archiveModal.isOpen}
        onClose={() => setArchiveModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => setArchiveModal(prev => ({ ...prev, isOpen: false }))}
        variant="info"
        title="Cannot Archive Template"
        message={
          <p className="text-sm text-slate-600">
            {archiveModal.blockReason}
          </p>
        }
        confirmText="OK"
      />
    </div>
  )
}

// ─── Create Template Modal ──────────────────────────────

function CreateTemplateModal({
  open,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  onClose: () => void
  onSave: (name: string, description: string) => void
  saving: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) return
    onSave(name, description)
    setName('')
    setDescription('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="New Template">
      {open && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mako THA Full"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Modal.Footer>
            <Modal.Cancel onClick={onClose} />
            <Modal.Action onClick={handleSubmit} loading={saving} disabled={!name.trim()}>
              Create Template
            </Modal.Action>
          </Modal.Footer>
        </>
      )}
    </Modal>
  )
}
