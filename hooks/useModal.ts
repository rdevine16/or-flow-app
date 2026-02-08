// hooks/useModal.ts
import { useState, useCallback } from 'react'

interface UseModalReturn {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export function useModal(defaultOpen = false): UseModalReturn {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

// ============================================
// Usage Examples
// ============================================

/*
// Basic modal state management
const modal = useModal()

return (
  <>
    <button onClick={modal.open}>
      Open Modal
    </button>

    {modal.isOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6">
          <h2>Modal Title</h2>
          <p>Modal content...</p>
          <button onClick={modal.close}>Close</button>
        </div>
      </div>
    )}
  </>
)

// With multiple modals
const addModal = useModal()
const editModal = useModal()
const deleteModal = useModal()

// With default open state
const modal = useModal(true) // Opens automatically

// Toggle modal
<button onClick={modal.toggle}>
  {modal.isOpen ? 'Close' : 'Open'} Modal
</button>

// Complex example with form
function UserForm() {
  const modal = useModal()
  const [formData, setFormData] = useState({ name: '', email: '' })

  const handleSubmit = async () => {
    await saveUser(formData)
    modal.close()
    setFormData({ name: '', email: '' })
  }

  return (
    <>
      <button onClick={modal.open}>Add User</button>

      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add User</h2>
            
            <div className="space-y-4">
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Name"
                className="w-full px-3 py-2 border rounded"
              />
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email"
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={modal.close}>Cancel</button>
              <button onClick={handleSubmit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
*/
