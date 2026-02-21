// ReviewDrawer — slide-over panel with review sections (Phase 5)
// Placeholder: will be implemented in Phase 5

interface ReviewDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function ReviewDrawer({ isOpen, onClose }: ReviewDrawerProps) {
  if (!isOpen) return null
  return (
    <div data-testid="review-drawer">
      <button onClick={onClose}>Close</button>
    </div>
  )
}
