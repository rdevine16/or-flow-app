// components/settings/surgeon-milestones/AddProcedureDropdown.tsx
'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'

interface ProcedureOption {
  id: string
  name: string
}

interface AddProcedureDropdownProps {
  /** Called with the selected procedure ID */
  onAdd: (procedureId: string) => void
  /** IDs of procedures already overridden by this surgeon */
  existingProcIds: string[]
  /** All available procedure types */
  allProcedures: ProcedureOption[]
}

export function AddProcedureDropdown({
  onAdd,
  existingProcIds,
  allProcedures,
}: AddProcedureDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const available = useMemo(() => {
    const existing = new Set(existingProcIds)
    let list = allProcedures.filter((p) => !existing.has(p.id))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [existingProcIds, allProcedures, search])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-[5px] px-3 py-1.5 border-[1.5px] border-dashed border-slate-300 rounded-md bg-[#FAFBFC] cursor-pointer text-[11px] font-medium text-slate-500 w-full justify-center hover:border-blue-500 hover:text-blue-500 transition-colors"
      >
        <Plus className="w-[13px] h-[13px]" /> Add Procedure Override
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-[100] max-h-[260px] flex flex-col">
          <div className="p-2 pb-1">
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 rounded-[5px] border border-slate-200">
              <Search className="w-[13px] h-[13px] text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search procedures..."
                autoFocus
                className="border-none outline-none bg-transparent text-[11px] text-slate-800 w-full"
              />
            </div>
          </div>
          <div className="overflow-y-auto p-1">
            {available.length === 0 && (
              <div className="py-3 text-center text-[11px] text-slate-400">
                {search ? 'No match' : 'All procedures added'}
              </div>
            )}
            {available.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onAdd(p.id)
                  setOpen(false)
                  setSearch('')
                }}
                className="px-2.5 py-[7px] rounded cursor-pointer text-[11px] text-slate-800 hover:bg-slate-100"
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
