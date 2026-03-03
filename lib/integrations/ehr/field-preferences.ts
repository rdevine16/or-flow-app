/**
 * Field Preferences — per-EHR-system field priority configuration
 *
 * Different EHR systems place surgeon and other key fields in different
 * HL7v2 segments. This module provides a lookup for the preferred field
 * extraction order per system.
 *
 * - Epic/Cerner: AIP segment (role=SURGEON) is primary, PV1-7 is fallback
 * - MEDITECH: PV1-7 (attending doctor) is primary, AIP is fallback
 */

import type { EhrIntegrationType } from '@/lib/integrations/shared/integration-types'
import type { SIUMessage } from '@/lib/hl7v2/types'

export type SurgeonFieldPriority = 'aip_first' | 'pv1_first'

export interface FieldPreferences {
  surgeonFieldPriority: SurgeonFieldPriority
  /** Whether this system may include custom Z-segments that should be parsed gracefully */
  hasCustomZSegments: boolean
}

const FIELD_PREFERENCES: Record<string, FieldPreferences> = {
  epic_hl7v2: {
    surgeonFieldPriority: 'aip_first',
    hasCustomZSegments: false,
  },
  cerner_hl7v2: {
    surgeonFieldPriority: 'aip_first',
    hasCustomZSegments: true, // Cerner may include ZSG segments
  },
  meditech_hl7v2: {
    surgeonFieldPriority: 'pv1_first',
    hasCustomZSegments: false,
  },
}

/**
 * Get field extraction preferences for a given EHR integration type.
 */
export function getFieldPreferences(integrationType: EhrIntegrationType): FieldPreferences {
  return FIELD_PREFERENCES[integrationType] ?? FIELD_PREFERENCES.epic_hl7v2
}

/**
 * Extract surgeon info from an SIU message using system-specific field priority.
 *
 * Epic/Cerner: Look in AIP segments first (role=SURGEON), fall back to PV1-7
 * MEDITECH: Look in PV1-7 first, fall back to AIP segments
 */
export function extractSurgeonInfo(
  siu: SIUMessage,
  integrationType: EhrIntegrationType,
): { npi: string; lastName: string; firstName: string; middleName: string } {
  const prefs = getFieldPreferences(integrationType)
  const surgeonAip = siu.aip.find(a => a.role.toUpperCase() === 'SURGEON')

  const fromAip = surgeonAip
    ? {
        npi: surgeonAip.personnelNPI,
        lastName: surgeonAip.personnelLastName,
        firstName: surgeonAip.personnelFirstName,
        middleName: surgeonAip.personnelMiddleName,
      }
    : null

  const fromPv1 = siu.pv1.attendingDoctor
    ? {
        npi: siu.pv1.attendingDoctor.npi,
        lastName: siu.pv1.attendingDoctor.lastName,
        firstName: siu.pv1.attendingDoctor.firstName,
        middleName: siu.pv1.attendingDoctor.middleName,
      }
    : null

  if (prefs.surgeonFieldPriority === 'pv1_first') {
    return fromPv1 ?? fromAip ?? { npi: '', lastName: '', firstName: '', middleName: '' }
  }

  // Default: aip_first (Epic, Cerner)
  return fromAip ?? fromPv1 ?? { npi: '', lastName: '', firstName: '', middleName: '' }
}
