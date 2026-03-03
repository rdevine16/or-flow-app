// components/integrations/SwitchIntegrationDialog.tsx
// Confirmation dialog for switching between HL7v2 integration types.
// Enforces one-HL7v2-per-facility constraint with a clear warning.

'use client'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ArrowRightLeft } from 'lucide-react'
import type { EhrIntegrationType } from '@/lib/integrations/shared/integration-types'
import { EHR_SYSTEM_DISPLAY_NAMES } from '@/lib/integrations/shared/integration-types'

interface SwitchIntegrationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  currentType: EhrIntegrationType
  targetType: EhrIntegrationType
  loading?: boolean
}

export default function SwitchIntegrationDialog({
  open,
  onClose,
  onConfirm,
  currentType,
  targetType,
  loading = false,
}: SwitchIntegrationDialogProps) {
  const currentName = EHR_SYSTEM_DISPLAY_NAMES[currentType]
  const targetName = EHR_SYSTEM_DISPLAY_NAMES[targetType]

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      variant="warning"
      title={`Switch to ${targetName}?`}
      message={
        <>
          Switching from <strong>{currentName}</strong> to <strong>{targetName}</strong> will
          disconnect your current HL7v2 integration. Entity mappings (surgeon, procedure, room)
          will be preserved and can be reused if you switch back.
        </>
      }
      confirmText={`Switch to ${targetName}`}
      cancelText="Keep Current"
      loading={loading}
      icon={<ArrowRightLeft className="w-6 h-6" />}
    />
  )
}
