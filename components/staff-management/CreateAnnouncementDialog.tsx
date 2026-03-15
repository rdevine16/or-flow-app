// components/staff-management/CreateAnnouncementDialog.tsx
// Modal dialog for creating and editing announcements.
// Includes form fields for all announcement properties and a live banner preview.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea, Select, Label } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import {
  Megaphone,
  Info,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react'
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementCategory,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/types/announcements'
import {
  AUDIENCE_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
} from '@/types/announcements'

// ============================================
// TYPES
// ============================================

interface CreateAnnouncementDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: CreateAnnouncementInput) => Promise<{ success: boolean; error?: string }>
  onUpdate?: (id: string, input: UpdateAnnouncementInput) => Promise<{ success: boolean; error?: string }>
  /** If set, dialog opens in edit mode with pre-filled values */
  editing?: Announcement | null
}

// ============================================
// PRIORITY STYLES (reused in Phase 4 banner)
// ============================================

const PRIORITY_STYLES: Record<AnnouncementPriority, {
  bg: string
  text: string
  border: string
  icon: React.ReactNode
}> = {
  normal: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: <Info className="w-4 h-4 text-blue-600" />,
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: <AlertOctagon className="w-4 h-4 text-red-600" />,
  },
}

// ============================================
// HELPERS
// ============================================

/** Compute duration_days from starts_at and expires_at */
function computeDurationDays(startsAt: string, expiresAt: string): number {
  const start = new Date(startsAt)
  const end = new Date(expiresAt)
  const diffMs = end.getTime() - start.getTime()
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.min(7, days))
}

// ============================================
// COMPONENT
// ============================================

export function CreateAnnouncementDialog({
  open,
  onClose,
  onSave,
  onUpdate,
  editing,
}: CreateAnnouncementDialogProps) {
  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('both')
  const [priority, setPriority] = useState<AnnouncementPriority>('normal')
  const [category, setCategory] = useState<AnnouncementCategory>('general')
  const [durationDays, setDurationDays] = useState(1)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = !!editing

  // Reset / populate form when dialog opens
  useEffect(() => {
    if (!open) return

    if (editing) {
      setTitle(editing.title)
      setBody(editing.body ?? '')
      setAudience(editing.audience)
      setPriority(editing.priority)
      setCategory(editing.category)
      setDurationDays(computeDurationDays(editing.starts_at, editing.expires_at))
      const wasScheduled = editing.status === 'scheduled'
      setIsScheduled(wasScheduled)
      setScheduledFor(wasScheduled ? editing.starts_at.slice(0, 16) : '')
    } else {
      setTitle('')
      setBody('')
      setAudience('both')
      setPriority('normal')
      setCategory('general')
      setDurationDays(1)
      setIsScheduled(false)
      setScheduledFor('')
    }
    setError(null)
    setSaving(false)
  }, [open, editing])

  // Validation
  const isValid = title.trim().length > 0 && (!isScheduled || scheduledFor.length > 0)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!isValid || saving) return

      setSaving(true)
      setError(null)

      try {
        if (isEditMode && editing && onUpdate) {
          const input: UpdateAnnouncementInput = {
            title: title.trim(),
            body: body.trim() || null,
            audience,
            priority,
            category,
            duration_days: durationDays,
            scheduled_for: isScheduled ? new Date(scheduledFor).toISOString() : null,
          }
          const result = await onUpdate(editing.id, input)
          if (!result.success) {
            setError(result.error ?? 'Update failed')
            return
          }
        } else {
          const input: CreateAnnouncementInput = {
            title: title.trim(),
            body: body.trim() || null,
            audience,
            priority,
            category,
            duration_days: durationDays,
            scheduled_for: isScheduled ? new Date(scheduledFor).toISOString() : null,
          }
          const result = await onSave(input)
          if (!result.success) {
            setError(result.error ?? 'Create failed')
            return
          }
        }
        onClose()
      } finally {
        setSaving(false)
      }
    },
    [isValid, saving, isEditMode, editing, onUpdate, onSave, onClose, title, body, audience, priority, category, durationDays, isScheduled, scheduledFor]
  )

  const priorityStyle = PRIORITY_STYLES[priority]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Announcement' : 'Create Announcement'}
      icon={<Megaphone className="w-5 h-5 text-blue-600" />}
      size="lg"
      scrollable
    >
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <Label required>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter announcement title"
              maxLength={100}
              required
              disabled={saving}
            />
            <p className="mt-1 text-xs text-slate-400">{title.length}/100</p>
          </div>

          {/* Body */}
          <div>
            <Label>Message Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional detailed message (shown when banner is expanded)"
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Row: Audience + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Audience</Label>
              <Select
                value={audience}
                onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                disabled={saving}
              >
                {(Object.entries(AUDIENCE_LABELS) as [AnnouncementAudience, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </Select>
            </div>

            <div>
              <Label required>Priority</Label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
                disabled={saving}
              >
                {(Object.entries(PRIORITY_LABELS) as [AnnouncementPriority, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </Select>
            </div>
          </div>

          {/* Row: Category + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required>Category</Label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                disabled={saving}
              >
                {(Object.entries(CATEGORY_LABELS) as [AnnouncementCategory, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </Select>
            </div>

            <div>
              <Label required>Duration</Label>
              <Select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                disabled={saving}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} {d === 1 ? 'day' : 'days'}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Schedule toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-700">Schedule for later</p>
              <p className="text-xs text-slate-500">
                {isScheduled
                  ? 'Announcement will activate at the scheduled time'
                  : 'Announcement will go live immediately'}
              </p>
            </div>
            <Toggle
              checked={isScheduled}
              onChange={() => {
                setIsScheduled((v) => !v)
                if (isScheduled) setScheduledFor('')
              }}
              disabled={saving}
              size="sm"
            />
          </div>

          {/* Schedule datetime picker */}
          {isScheduled && (
            <div>
              <Label required>Scheduled Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                required
                disabled={saving}
              />
            </div>
          )}

          {/* Live Banner Preview */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Banner Preview</p>
            <div
              className={`
                flex items-start gap-3 px-4 py-3 rounded-lg border
                ${priorityStyle.bg} ${priorityStyle.border}
              `}
            >
              {priorityStyle.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${priorityStyle.text} ${priorityStyle.bg}
                      border ${priorityStyle.border}
                    `}
                  >
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className={`text-sm font-semibold ${priorityStyle.text}`}>
                    {title || 'Announcement title'}
                  </span>
                </div>
                {body && (
                  <p className={`text-sm mt-1 ${priorityStyle.text} opacity-80`}>
                    {body}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Modal.Cancel onClick={onClose}>Cancel</Modal.Cancel>
          <Modal.Action
            onClick={() => {
              const form = document.querySelector('form') as HTMLFormElement
              form?.requestSubmit()
            }}
            loading={saving}
            disabled={!isValid}
          >
            {isEditMode ? 'Save Changes' : isScheduled ? 'Schedule' : 'Send Now'}
          </Modal.Action>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
